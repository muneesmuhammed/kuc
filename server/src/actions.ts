// Actions for KUC – Kalanja United Club.
//
// Public read actions serve the dashboard and sections. Every mutating
// action requires a valid admin session token: the admin password is set
// up by the admin on first use and stored only as a salted SHA-256 hash —
// it is never hard-coded and never returned to the client.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";

const WEEKLY_FEE = 10;

const COMMITTEE_POSITIONS = [
  "President",
  "Vice President",
  "Secretary",
  "Joint Secretary",
  "Treasurer",
  "Joint Treasurer",
  "Executive Member",
] as const;

// ---------- helpers ----------

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

type Db = ReturnType<Ctx["db"]>;

async function requireAdmin(ctx: Ctx, token: string): Promise<void> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.token, token))
    .limit(1);
  if (rows.length === 0) {
    throw new Error("Admin login required. Please log in as admin first.");
  }
}

// Committee, stats and money edits accept either an admin session or an
// editor session. Everything else (players, awards, passwords, settings)
// stays admin-only via requireAdmin.
async function requireEditorOrAdmin(ctx: Ctx, token: string): Promise<void> {
  const db = ctx.db<typeof schema>();
  const adminRows = await db
    .select()
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.token, token))
    .limit(1);
  if (adminRows.length > 0) return;
  const editorRows = await db
    .select()
    .from(schema.editorSessions)
    .where(eq(schema.editorSessions.token, token))
    .limit(1);
  if (editorRows.length > 0) return;
  throw new Error(
    "Editor or admin login required. Log in with the editor password or as admin first.",
  );
}

async function logActivity(db: Db, message: string): Promise<void> {
  await db.insert(schema.activityLog).values({ message });
}

async function photoUrl(
  ctx: Ctx,
  key: string | null,
): Promise<string | null> {
  if (!key) return null;
  try {
    return await ctx.blobs.getUrl(key);
  } catch {
    return null;
  }
}

const playerView = z.object({
  id: z.number(),
  playerCode: z.string(),
  fullName: z.string(),
  age: z.number(),
  position: z.string(),
  phone: z.string(),
  joiningDate: z.string(),
  status: z.string(),
  photoUrl: z.string().nullable(),
});

type PlayerRow = typeof schema.players.$inferSelect;

async function toPlayerView(ctx: Ctx, row: PlayerRow) {
  return {
    id: row.id,
    playerCode: row.playerCode,
    fullName: row.fullName,
    age: row.age,
    position: row.position,
    phone: row.phone,
    joiningDate: row.joiningDate,
    status: row.status,
    photoUrl: await photoUrl(ctx, row.photoBlobKey),
  };
}

async function allPlayerViews(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.players)
    .orderBy(asc(schema.players.fullName));
  return Promise.all(rows.map((r) => toPlayerView(ctx, r)));
}

const statsView = z.object({
  playerId: z.number(),
  matchesPlayed: z.number(),
  goals: z.number(),
  assists: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  yellowCards: z.number(),
  redCards: z.number(),
  performance: z.number(),
  attendance: z.number(),
  customStats: z.array(z.object({ label: z.string(), value: z.string() })),
});

type StatsRow = typeof schema.playerStats.$inferSelect;

function toStatsView(row: StatsRow | undefined, playerId: number) {
  let custom: { label: string; value: string }[] = [];
  if (row) {
    try {
      const parsed: unknown = JSON.parse(row.customStats);
      if (Array.isArray(parsed)) {
        custom = parsed
          .filter(
            (c): c is { label: string; value: string } =>
              typeof c === "object" &&
              c !== null &&
              typeof (c as { label?: unknown }).label === "string" &&
              typeof (c as { value?: unknown }).value === "string",
          )
          .map((c) => ({ label: c.label, value: c.value }));
      }
    } catch {
      custom = [];
    }
  }
  return {
    playerId,
    matchesPlayed: row?.matchesPlayed ?? 0,
    goals: row?.goals ?? 0,
    assists: row?.assists ?? 0,
    wins: row?.wins ?? 0,
    losses: row?.losses ?? 0,
    draws: row?.draws ?? 0,
    yellowCards: row?.yellowCards ?? 0,
    redCards: row?.redCards ?? 0,
    performance: row?.performance ?? 0,
    attendance: row?.attendance ?? 0,
    customStats: custom,
  };
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ---------- shared schemas ----------

const okResponse = z.object({ ok: z.literal(true) });

const playerInput = {
  fullName: z.string().trim().min(1, "Player name is required").max(80),
  age: z.number().int().min(5).max(100),
  position: z.string().trim().min(1, "Position is required").max(40),
  phone: z.string().trim().max(20),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be a date"),
  status: z.enum(["Active", "Inactive"]),
  photo: z
    .object({ dataBase64: z.string().min(1), mimeType: z.string() })
    .nullable()
    .optional(),
};

const statsInput = {
  matchesPlayed: z.number().int().min(0).max(10000),
  goals: z.number().int().min(0).max(10000),
  assists: z.number().int().min(0).max(10000),
  wins: z.number().int().min(0).max(10000),
  losses: z.number().int().min(0).max(10000),
  draws: z.number().int().min(0).max(10000),
  yellowCards: z.number().int().min(0).max(10000),
  redCards: z.number().int().min(0).max(10000),
  performance: z.number().min(0).max(10),
  attendance: z.number().min(0).max(100),
  customStats: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        value: z.string().trim().max(60),
      }),
    )
    .max(12),
};

export const Actions = {
  // ---------- dashboard ----------

  getDashboard: defineAction({
    description:
      "Returns club totals, lock state, current committee and recent activity for the home dashboard.",
    request: z.object({}),
    response: z.object({
      playerCount: z.number(),
      activeCount: z.number(),
      unlocked: z.boolean(),
      totalCollected: z.number(),
      pendingThisWeek: z.number(),
      expectedThisWeek: z.number(),
      currentWeekStart: z.string(),
      currentCommittee: z
        .object({
          year: z.number(),
          members: z.array(
            z.object({ position: z.string(), playerName: z.string() }),
          ),
        })
        .nullable(),
      latestAwards: z.array(
        z.object({
          year: z.number(),
          awardType: z.string(),
          playerName: z.string(),
        }),
      ),
      activity: z.array(
        z.object({ id: z.number(), message: z.string(), at: z.string() }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const playerRows = await db.select().from(schema.players);
      const weekStart = mondayOf(todayStr());
      const paidRows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.status, "paid"));
      const totalCollected = paidRows.reduce((s, p) => s + p.amount, 0);
      const paidThisWeek = new Set(
        paidRows
          .filter((p) => p.weekStart === weekStart)
          .map((p) => p.playerId),
      );
      const pendingThisWeek =
        playerRows.filter((p) => !paidThisWeek.has(p.id)).length * WEEKLY_FEE;

      const committeeRows = await db
        .select()
        .from(schema.committees)
        .orderBy(desc(schema.committees.year))
        .limit(1);
      let currentCommittee: {
        year: number;
        members: { position: string; playerName: string }[];
      } | null = null;
      const latest = committeeRows[0];
      if (latest) {
        const members = await db
          .select({
            position: schema.committeeMembers.position,
            playerName: schema.players.fullName,
          })
          .from(schema.committeeMembers)
          .innerJoin(
            schema.players,
            eq(schema.committeeMembers.playerId, schema.players.id),
          )
          .where(eq(schema.committeeMembers.committeeId, latest.id));
        currentCommittee = { year: latest.year, members };
      }

      const awardRows = await db
        .select({
          year: schema.awards.year,
          awardType: schema.awards.awardType,
          playerName: schema.players.fullName,
        })
        .from(schema.awards)
        .innerJoin(
          schema.players,
          eq(schema.awards.playerId, schema.players.id),
        )
        .where(eq(schema.awards.published, 1))
        .orderBy(desc(schema.awards.year))
        .limit(3);

      const activityRows = await db
        .select()
        .from(schema.activityLog)
        .orderBy(desc(schema.activityLog.id))
        .limit(8);

      return {
        playerCount: playerRows.length,
        activeCount: playerRows.filter((p) => p.status === "Active").length,
        unlocked: playerRows.length > 0,
        totalCollected,
        pendingThisWeek,
        expectedThisWeek: playerRows.length * WEEKLY_FEE,
        currentWeekStart: weekStart,
        currentCommittee,
        latestAwards: awardRows,
        activity: activityRows.map((a) => ({
          id: a.id,
          message: a.message,
          at: a.createdAt.toISOString(),
        })),
      };
    },
  }),

  // ---------- players ----------

  listPlayers: defineAction({
    description: "Lists all registered players with their profile details.",
    request: z.object({}),
    response: z.object({ players: z.array(playerView) }),
    async handler(ctx) {
      return { players: await allPlayerViews(ctx) };
    },
  }),

  getPlayerProfile: defineAction({
    description:
      "Returns one player's full profile with statistics, payment history and honours.",
    request: z.object({ playerId: z.number().int().positive() }),
    response: z.object({
      player: playerView.nullable(),
      stats: statsView.nullable(),
      payments: z.array(
        z.object({
          weekStart: z.string(),
          amount: z.number(),
          status: z.string(),
          paidDate: z.string().nullable(),
        }),
      ),
      totalPaid: z.number(),
      committeeRoles: z.array(
        z.object({ year: z.number(), position: z.string() }),
      ),
      awardsWon: z.array(
        z.object({ year: z.number(), awardType: z.string() }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return {
          player: null,
          stats: null,
          payments: [],
          totalPaid: 0,
          committeeRoles: [],
          awardsWon: [],
        };
      }
      const player = await toPlayerView(ctx, row);
      const statRows = await db
        .select()
        .from(schema.playerStats)
        .where(eq(schema.playerStats.playerId, row.id))
        .limit(1);
      const payRows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.playerId, row.id))
        .orderBy(desc(schema.payments.weekStart));
      const roles = await db
        .select({
          year: schema.committees.year,
          position: schema.committeeMembers.position,
        })
        .from(schema.committeeMembers)
        .innerJoin(
          schema.committees,
          eq(schema.committeeMembers.committeeId, schema.committees.id),
        )
        .where(eq(schema.committeeMembers.playerId, row.id))
        .orderBy(desc(schema.committees.year));
      const won = await db
        .select({ year: schema.awards.year, awardType: schema.awards.awardType })
        .from(schema.awards)
        .where(eq(schema.awards.playerId, row.id))
        .orderBy(desc(schema.awards.year));
      return {
        player,
        stats: toStatsView(statRows[0], row.id),
        payments: payRows.map((p) => ({
          weekStart: p.weekStart,
          amount: p.amount,
          status: p.status,
          paidDate: p.paidDate,
        })),
        totalPaid: payRows
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amount, 0),
        committeeRoles: roles,
        awardsWon: won,
      };
    },
  }),

  addPlayer: defineAction({
    description: "Admin only: registers a new player and returns the player.",
    request: z.object({ token: z.string().min(1), ...playerInput }),
    response: z.object({ player: playerView }),
    async handler(ctx, args) {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      let photoBlobKey: string | null = null;
      if (args.photo) {
        photoBlobKey = `players/${randomHex(12)}`;
        const bytes = Buffer.from(args.photo.dataBase64, "base64");
        await ctx.blobs.put(photoBlobKey, bytes, {
          contentType: args.photo.mimeType || "image/jpeg",
        });
      }
      const countRows = await db.select({ id: schema.players.id }).from(schema.players);
      const code = `KUC-${String(countRows.length + 1).padStart(3, "0")}`;
      // Ensure the code is unique even after deletions.
      let playerCode = code;
      let suffix = countRows.length + 1;
      for (;;) {
        const clash = await db
          .select()
          .from(schema.players)
          .where(eq(schema.players.playerCode, playerCode))
          .limit(1);
        if (clash.length === 0) break;
        suffix += 1;
        playerCode = `KUC-${String(suffix).padStart(3, "0")}`;
      }
      const inserted = await db
        .insert(schema.players)
        .values({
          playerCode,
          fullName: args.fullName,
          age: args.age,
          position: args.position,
          phone: args.phone,
          joiningDate: args.joiningDate,
          status: args.status,
          photoBlobKey,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Could not add the player. Please try again.");
      await logActivity(db, `Player registered: ${row.fullName} (${row.playerCode})`);
      ctx.invalidateQueries();
      return { player: await toPlayerView(ctx, row) };
    },
  }),

  updatePlayer: defineAction({
    description: "Admin only: edits an existing player's details.",
    request: z.object({
      token: z.string().min(1),
      playerId: z.number().int().positive(),
      ...playerInput,
      removePhoto: z.boolean().optional(),
    }),
    response: z.object({ player: playerView }),
    async handler(ctx, args) {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new Error("Player not found.");
      let photoBlobKey = existing.photoBlobKey;
      if (args.removePhoto) photoBlobKey = null;
      if (args.photo) {
        photoBlobKey = `players/${randomHex(12)}`;
        const bytes = Buffer.from(args.photo.dataBase64, "base64");
        await ctx.blobs.put(photoBlobKey, bytes, {
          contentType: args.photo.mimeType || "image/jpeg",
        });
      }
      const updated = await db
        .update(schema.players)
        .set({
          fullName: args.fullName,
          age: args.age,
          position: args.position,
          phone: args.phone,
          joiningDate: args.joiningDate,
          status: args.status,
          photoBlobKey,
        })
        .where(eq(schema.players.id, args.playerId))
        .returning();
      const row = updated[0];
      if (!row) throw new Error("Could not update the player.");
      await logActivity(db, `Player updated: ${row.fullName} (${row.playerCode})`);
      ctx.invalidateQueries();
      return { player: await toPlayerView(ctx, row) };
    },
  }),

  deletePlayer: defineAction({
    description:
      "Admin only: removes a player and their stats, payments, committee seats and awards.",
    request: z.object({
      token: z.string().min(1),
      playerId: z.number().int().positive(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new Error("Player not found.");
      const statements: BatchItem<"sqlite">[] = [
        db.delete(schema.playerStats).where(eq(schema.playerStats.playerId, args.playerId)),
        db.delete(schema.payments).where(eq(schema.payments.playerId, args.playerId)),
        db.delete(schema.committeeMembers).where(eq(schema.committeeMembers.playerId, args.playerId)),
        db.delete(schema.awards).where(eq(schema.awards.playerId, args.playerId)),
        db.delete(schema.players).where(eq(schema.players.id, args.playerId)),
      ];
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      await logActivity(db, `Player removed: ${existing.fullName} (${existing.playerCode})`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- stats ----------

  getStatsData: defineAction({
    description:
      "Returns every player's statistics plus club totals, top scorer, best player and rankings.",
    request: z.object({}),
    response: z.object({
      players: z.array(
        z.object({ player: playerView, stats: statsView }),
      ),
      totals: z.object({
        matches: z.number(),
        goals: z.number(),
        assists: z.number(),
        wins: z.number(),
        losses: z.number(),
        draws: z.number(),
      }),
      topScorerId: z.number().nullable(),
      bestPlayerId: z.number().nullable(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const views = await allPlayerViews(ctx);
      const statRows = await db.select().from(schema.playerStats);
      const byPlayer = new Map(statRows.map((s) => [s.playerId, s]));
      const players = views.map((player) => ({
        player,
        stats: toStatsView(byPlayer.get(player.id), player.id),
      }));
      const totals = players.reduce(
        (acc, p) => ({
          matches: acc.matches + p.stats.matchesPlayed,
          goals: acc.goals + p.stats.goals,
          assists: acc.assists + p.stats.assists,
          wins: acc.wins + p.stats.wins,
          losses: acc.losses + p.stats.losses,
          draws: acc.draws + p.stats.draws,
        }),
        { matches: 0, goals: 0, assists: 0, wins: 0, losses: 0, draws: 0 },
      );
      let topScorerId: number | null = null;
      let bestGoals = -1;
      let bestPlayerId: number | null = null;
      let bestPerf = -1;
      for (const p of players) {
        if (p.stats.goals > bestGoals) {
          bestGoals = p.stats.goals;
          topScorerId = p.player.id;
        }
        if (p.stats.performance > bestPerf) {
          bestPerf = p.stats.performance;
          bestPlayerId = p.player.id;
        }
      }
      if (bestGoals <= 0) topScorerId = null;
      if (bestPerf <= 0) bestPlayerId = null;
      return { players, totals, topScorerId, bestPlayerId };
    },
  }),

  updateStats: defineAction({
    description: "Admin or editor: creates or updates a player's statistics.",
    request: z.object({
      token: z.string().min(1),
      playerId: z.number().int().positive(),
      ...statsInput,
    }),
    response: z.object({ stats: statsView }),
    async handler(ctx, args) {
      await requireEditorOrAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const playerRows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const player = playerRows[0];
      if (!player) throw new Error("Player not found.");
      const values = {
        playerId: args.playerId,
        matchesPlayed: args.matchesPlayed,
        goals: args.goals,
        assists: args.assists,
        wins: args.wins,
        losses: args.losses,
        draws: args.draws,
        yellowCards: args.yellowCards,
        redCards: args.redCards,
        performance: args.performance,
        attendance: args.attendance,
        customStats: JSON.stringify(args.customStats),
        updatedAt: new Date(),
      };
      const existing = await db
        .select()
        .from(schema.playerStats)
        .where(eq(schema.playerStats.playerId, args.playerId))
        .limit(1);
      let row: StatsRow | undefined;
      if (existing[0]) {
        const updated = await db
          .update(schema.playerStats)
          .set(values)
          .where(eq(schema.playerStats.playerId, args.playerId))
          .returning();
        row = updated[0];
      } else {
        const inserted = await db
          .insert(schema.playerStats)
          .values(values)
          .returning();
        row = inserted[0];
      }
      await logActivity(db, `Statistics updated for ${player.fullName}`);
      ctx.invalidateQueries();
      return { stats: toStatsView(row, args.playerId) };
    },
  }),

  // ---------- money ----------

  getMoneyData: defineAction({
    description:
      "Returns weekly ₹10 contribution status for all players plus weekly and yearly reports.",
    request: z.object({ weekStart: z.string().optional() }),
    response: z.object({
      weeklyFee: z.number(),
      currentWeekStart: z.string(),
      selectedWeek: z.string(),
      weeks: z.array(z.string()),
      rows: z.array(
        z.object({
          player: playerView,
          status: z.string(),
          paidDate: z.string().nullable(),
          amount: z.number(),
        }),
      ),
      collectedThisWeek: z.number(),
      expectedThisWeek: z.number(),
      pendingThisWeek: z.number(),
      totalCollected: z.number(),
      weeklyReport: z.array(
        z.object({
          weekStart: z.string(),
          collected: z.number(),
          paidCount: z.number(),
          expected: z.number(),
        }),
      ),
      yearlyReport: z.array(
        z.object({ year: z.number(), collected: z.number(), payments: z.number() }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const currentWeekStart = mondayOf(todayStr());
      const selectedWeek = args.weekStart
        ? mondayOf(args.weekStart)
        : currentWeekStart;
      const views = await allPlayerViews(ctx);
      const allPayments = await db.select().from(schema.payments);
      const weekSet = new Set<string>([currentWeekStart]);
      for (const p of allPayments) weekSet.add(p.weekStart);
      const weeks = Array.from(weekSet).sort().reverse();

      const forWeek = new Map(
        allPayments
          .filter((p) => p.weekStart === selectedWeek)
          .map((p) => [p.playerId, p]),
      );
      const rows = views.map((player) => {
        const pay = forWeek.get(player.id);
        return {
          player,
          status: pay?.status ?? "unpaid",
          paidDate: pay?.paidDate ?? null,
          amount: pay?.amount ?? WEEKLY_FEE,
        };
      });
      const collectedThisWeek = rows
        .filter((r) => r.status === "paid")
        .reduce((s, r) => s + r.amount, 0);
      const expectedThisWeek = views.length * WEEKLY_FEE;
      const totalCollected = allPayments
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);

      const weeklyReport = weeks.map((w) => {
        const wp = allPayments.filter((p) => p.weekStart === w && p.status === "paid");
        return {
          weekStart: w,
          collected: wp.reduce((s, p) => s + p.amount, 0),
          paidCount: wp.length,
          expected: expectedThisWeek,
        };
      });
      const yearMap = new Map<number, { collected: number; payments: number }>();
      for (const p of allPayments) {
        if (p.status !== "paid") continue;
        const year = Number(p.weekStart.slice(0, 4));
        const entry = yearMap.get(year) ?? { collected: 0, payments: 0 };
        entry.collected += p.amount;
        entry.payments += 1;
        yearMap.set(year, entry);
      }
      const yearlyReport = Array.from(yearMap.entries())
        .map(([year, v]) => ({ year, collected: v.collected, payments: v.payments }))
        .sort((a, b) => b.year - a.year);

      return {
        weeklyFee: WEEKLY_FEE,
        currentWeekStart,
        selectedWeek,
        weeks,
        rows,
        collectedThisWeek,
        expectedThisWeek,
        pendingThisWeek: expectedThisWeek - collectedThisWeek,
        totalCollected,
        weeklyReport,
        yearlyReport,
      };
    },
  }),

  setPayment: defineAction({
    description:
      "Admin or editor: marks a player's weekly contribution as paid or unpaid.",
    request: z.object({
      token: z.string().min(1),
      playerId: z.number().int().positive(),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      paid: z.boolean(),
      paidDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireEditorOrAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const weekStart = mondayOf(args.weekStart);
      const playerRows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const player = playerRows[0];
      if (!player) throw new Error("Player not found.");
      const existing = await db
        .select()
        .from(schema.payments)
        .where(
          and(
            eq(schema.payments.playerId, args.playerId),
            eq(schema.payments.weekStart, weekStart),
          ),
        )
        .limit(1);
      const status = args.paid ? ("paid" as const) : ("unpaid" as const);
      const paidDate = args.paid ? (args.paidDate ?? todayStr()) : null;
      if (existing[0]) {
        await db
          .update(schema.payments)
          .set({ status, paidDate, amount: WEEKLY_FEE })
          .where(eq(schema.payments.id, existing[0].id));
      } else {
        await db.insert(schema.payments).values({
          playerId: args.playerId,
          weekStart,
          amount: WEEKLY_FEE,
          status,
          paidDate,
        });
      }
      await logActivity(
        db,
        args.paid
          ? `₹${WEEKLY_FEE} collected from ${player.fullName} (week of ${weekStart})`
          : `Payment unmarked for ${player.fullName} (week of ${weekStart})`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- committee ----------

  getCommittees: defineAction({
    description: "Returns all yearly committees with their members.",
    request: z.object({}),
    response: z.object({
      positions: z.array(z.string()),
      committees: z.array(
        z.object({
          year: z.number(),
          members: z.array(
            z.object({
              playerId: z.number(),
              playerName: z.string(),
              position: z.string(),
            }),
          ),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.committees)
        .orderBy(desc(schema.committees.year));
      const committees = [];
      for (const c of rows) {
        const members = await db
          .select({
            playerId: schema.committeeMembers.playerId,
            playerName: schema.players.fullName,
            position: schema.committeeMembers.position,
          })
          .from(schema.committeeMembers)
          .innerJoin(
            schema.players,
            eq(schema.committeeMembers.playerId, schema.players.id),
          )
          .where(eq(schema.committeeMembers.committeeId, c.id));
        committees.push({ year: c.year, members });
      }
      return { positions: [...COMMITTEE_POSITIONS], committees };
    },
  }),

  saveCommittee: defineAction({
    description:
      "Admin or editor: creates or replaces a year's committee from registered players.",
    request: z.object({
      token: z.string().min(1),
      year: z.number().int().min(2000).max(2100),
      allowMultipleRoles: z.boolean(),
      members: z
        .array(
          z.object({
            playerId: z.number().int().positive(),
            position: z.string().trim().min(1).max(40),
          }),
        )
        .min(1, "Add at least one committee member")
        .max(30),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireEditorOrAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      if (!args.allowMultipleRoles) {
        const seen = new Set<number>();
        for (const m of args.members) {
          if (seen.has(m.playerId)) {
            throw new Error(
              "The same player is assigned to more than one position. Enable “allow multiple roles” or change the selection.",
            );
          }
          seen.add(m.playerId);
        }
      }
      const playerIds = new Set(
        (await db.select({ id: schema.players.id }).from(schema.players)).map(
          (p) => p.id,
        ),
      );
      for (const m of args.members) {
        if (!playerIds.has(m.playerId)) {
          throw new Error("Every committee member must be a registered player.");
        }
      }
      const existing = await db
        .select()
        .from(schema.committees)
        .where(eq(schema.committees.year, args.year))
        .limit(1);
      let committeeId: number;
      if (existing[0]) {
        committeeId = existing[0].id;
      } else {
        const inserted = await db
          .insert(schema.committees)
          .values({ year: args.year })
          .returning({ id: schema.committees.id });
        const row = inserted[0];
        if (!row) throw new Error("Could not save the committee.");
        committeeId = row.id;
      }
      const statements: BatchItem<"sqlite">[] = [
        db
          .delete(schema.committeeMembers)
          .where(eq(schema.committeeMembers.committeeId, committeeId)),
        ...args.members.map((m) =>
          db.insert(schema.committeeMembers).values({
            committeeId,
            playerId: m.playerId,
            position: m.position,
          }),
        ),
      ];
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      await logActivity(db, `Committee saved for ${args.year}`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteCommittee: defineAction({
    description: "Admin or editor: deletes one year's committee.",
    request: z.object({
      token: z.string().min(1),
      year: z.number().int(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireEditorOrAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.committees)
        .where(eq(schema.committees.year, args.year))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new Error("Committee not found.");
      const statements: BatchItem<"sqlite">[] = [
        db
          .delete(schema.committeeMembers)
          .where(eq(schema.committeeMembers.committeeId, existing.id)),
        db.delete(schema.committees).where(eq(schema.committees.id, existing.id)),
      ];
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      await logActivity(db, `Committee for ${args.year} deleted`);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- awards ----------

  getAwardsData: defineAction({
    description:
      "Returns saved annual awards plus goal rankings and goalkeeper candidates for the awards page.",
    request: z.object({}),
    response: z.object({
      awards: z.array(
        z.object({
          id: z.number(),
          year: z.number(),
          awardType: z.string(),
          playerId: z.number(),
          playerName: z.string(),
          playerPosition: z.string(),
          photoUrl: z.string().nullable(),
          description: z.string(),
          detailStats: z.record(z.string(), z.union([z.string(), z.number()])),
          published: z.boolean(),
        }),
      ),
      goalRanking: z.array(
        z.object({
          playerId: z.number(),
          playerName: z.string(),
          goals: z.number(),
          assists: z.number(),
          matches: z.number(),
        }),
      ),
      goalkeepers: z.array(
        z.object({
          playerId: z.number(),
          playerName: z.string(),
          matches: z.number(),
          performance: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const awardRows = await db
        .select({
          id: schema.awards.id,
          year: schema.awards.year,
          awardType: schema.awards.awardType,
          playerId: schema.awards.playerId,
          description: schema.awards.description,
          detailStats: schema.awards.detailStats,
          published: schema.awards.published,
          playerName: schema.players.fullName,
          playerPosition: schema.players.position,
          photoBlobKey: schema.players.photoBlobKey,
        })
        .from(schema.awards)
        .innerJoin(
          schema.players,
          eq(schema.awards.playerId, schema.players.id),
        )
        .orderBy(desc(schema.awards.year));
      const awards = await Promise.all(
        awardRows.map(async (a) => {
          let detail: Record<string, string | number> = {};
          try {
            const parsed: unknown = JSON.parse(a.detailStats);
            if (typeof parsed === "object" && parsed !== null) {
              for (const [k, v] of Object.entries(
                parsed as Record<string, unknown>,
              )) {
                if (typeof v === "string" || typeof v === "number") {
                  detail[k] = v;
                }
              }
            }
          } catch {
            detail = {};
          }
          return {
            id: a.id,
            year: a.year,
            awardType: a.awardType,
            playerId: a.playerId,
            playerName: a.playerName,
            playerPosition: a.playerPosition,
            photoUrl: await photoUrl(ctx, a.photoBlobKey),
            description: a.description,
            detailStats: detail,
            published: a.published === 1,
          };
        }),
      );

      const statRows = await db.select().from(schema.playerStats);
      const playerRows = await db.select().from(schema.players);
      const nameOf = new Map(playerRows.map((p) => [p.id, p.fullName]));
      const goalRanking = statRows
        .map((s) => ({
          playerId: s.playerId,
          playerName: nameOf.get(s.playerId) ?? "Unknown",
          goals: s.goals,
          assists: s.assists,
          matches: s.matchesPlayed,
        }))
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists);
      const gkStats = new Map(statRows.map((s) => [s.playerId, s]));
      const goalkeepers = playerRows
        .filter((p) => p.position.toLowerCase().includes("goalkeeper"))
        .map((p) => ({
          playerId: p.id,
          playerName: p.fullName,
          matches: gkStats.get(p.id)?.matchesPlayed ?? 0,
          performance: gkStats.get(p.id)?.performance ?? 0,
        }))
        .sort((a, b) => b.performance - a.performance);
      return { awards, goalRanking, goalkeepers };
    },
  }),

  saveAward: defineAction({
    description:
      "Admin only: creates or updates one annual award winner (one winner per award per year).",
    request: z.object({
      token: z.string().min(1),
      year: z.number().int().min(2000).max(2100),
      awardType: z.enum(["ballon_dor", "golden_boot", "golden_gloves"]),
      playerId: z.number().int().positive(),
      description: z.string().trim().max(600),
      detailStats: z.record(
        z.string().max(40),
        z.union([z.string().max(60), z.number()]),
      ),
      published: z.boolean(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const playerRows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const player = playerRows[0];
      if (!player) throw new Error("Winner must be a registered player.");
      const values = {
        year: args.year,
        awardType: args.awardType,
        playerId: args.playerId,
        description: args.description,
        detailStats: JSON.stringify(args.detailStats),
        published: args.published ? 1 : 0,
      };
      const existing = await db
        .select()
        .from(schema.awards)
        .where(
          and(
            eq(schema.awards.year, args.year),
            eq(schema.awards.awardType, args.awardType),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.awards)
          .set(values)
          .where(eq(schema.awards.id, existing[0].id));
      } else {
        await db.insert(schema.awards).values(values);
      }
      const label =
        args.awardType === "ballon_dor"
          ? "Ballon d'Or"
          : args.awardType === "golden_boot"
            ? "Golden Boot"
            : "Golden Gloves";
      await logActivity(
        db,
        `${args.year} KUC ${label} ${args.published ? "published" : "saved"}: ${player.fullName}`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteAward: defineAction({
    description: "Admin only: deletes one award record.",
    request: z.object({
      token: z.string().min(1),
      awardId: z.number().int().positive(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      await db.delete(schema.awards).where(eq(schema.awards.id, args.awardId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- internal search (KUC GOOGLE) ----------

  searchClub: defineAction({
    description:
      "Searches only the KUC club database: players, statistics, payments, committees and awards.",
    request: z.object({ query: z.string().trim().min(1).max(80) }),
    response: z.object({
      results: z.array(
        z.object({
          kind: z.string(),
          title: z.string(),
          snippet: z.string(),
          section: z.string(),
          playerId: z.number().nullable(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const q = args.query.toLowerCase();
      const pattern = `%${args.query}%`;
      const results: {
        kind: string;
        title: string;
        snippet: string;
        section: string;
        playerId: number | null;
      }[] = [];

      const playerHits = await db
        .select()
        .from(schema.players)
        .where(
          or(
            like(schema.players.fullName, pattern),
            like(schema.players.playerCode, pattern),
            like(schema.players.position, pattern),
          ),
        )
        .limit(10);
      for (const p of playerHits) {
        results.push({
          kind: "Player",
          title: `${p.fullName} (${p.playerCode})`,
          snippet: `${p.position} · Age ${p.age} · ${p.status} · Joined ${p.joiningDate}`,
          section: "players",
          playerId: p.id,
        });
      }

      const statRows = await db.select().from(schema.playerStats);
      const playerRows = await db.select().from(schema.players);
      const byId = new Map(playerRows.map((p) => [p.id, p]));
      if ("goalscorer top scorer best player".includes(q) || q.length >= 3) {
        for (const s of statRows) {
          const p = byId.get(s.playerId);
          if (!p) continue;
          const hay =
            `${p.fullName} ${s.goals} goals ${s.assists} assists ${s.matchesPlayed} matches`.toLowerCase();
          if (
            hay.includes(q) ||
            (q.includes("goal") && s.goals > 0) ||
            (q.includes("top scorer") && s.goals > 0)
          ) {
            results.push({
              kind: "Statistics",
              title: `${p.fullName} — Statistics`,
              snippet: `${s.matchesPlayed} matches · ${s.goals} goals · ${s.assists} assists · Performance ${s.performance}/10`,
              section: "stats",
              playerId: p.id,
            });
          }
        }
      }

      const payRows = await db
        .select()
        .from(schema.payments)
        .orderBy(desc(schema.payments.weekStart))
        .limit(200);
      for (const pay of payRows) {
        const p = byId.get(pay.playerId);
        if (!p) continue;
        const hay =
          `${p.fullName} payment ${pay.weekStart} ${pay.status} ₹${pay.amount}`.toLowerCase();
        if (hay.includes(q) || (q.includes("payment") && pay.status === "paid")) {
          results.push({
            kind: "Money",
            title: `${p.fullName} — Week of ${pay.weekStart}`,
            snippet: `₹${pay.amount} · ${pay.status.toUpperCase()}${pay.paidDate ? ` · Paid on ${pay.paidDate}` : ""}`,
            section: "money",
            playerId: p.id,
          });
          if (results.length > 30) break;
        }
      }

      const memberRows = await db
        .select({
          year: schema.committees.year,
          position: schema.committeeMembers.position,
          playerId: schema.committeeMembers.playerId,
          playerName: schema.players.fullName,
        })
        .from(schema.committeeMembers)
        .innerJoin(
          schema.committees,
          eq(schema.committeeMembers.committeeId, schema.committees.id),
        )
        .innerJoin(
          schema.players,
          eq(schema.committeeMembers.playerId, schema.players.id),
        );
      for (const m of memberRows) {
        const hay = `${m.playerName} ${m.position} committee ${m.year}`.toLowerCase();
        if (hay.includes(q)) {
          results.push({
            kind: "Committee",
            title: `${m.playerName} — ${m.position}`,
            snippet: `${m.year} Committee`,
            section: "committee",
            playerId: m.playerId,
          });
        }
      }

      const awardRows = await db
        .select({
          year: schema.awards.year,
          awardType: schema.awards.awardType,
          playerId: schema.awards.playerId,
          playerName: schema.players.fullName,
        })
        .from(schema.awards)
        .innerJoin(
          schema.players,
          eq(schema.awards.playerId, schema.players.id),
        );
      const awardLabel = (t: string) =>
        t === "ballon_dor"
          ? "KUC Ballon d'Or"
          : t === "golden_boot"
            ? "KUC Golden Boot"
            : "KUC Golden Gloves";
      for (const a of awardRows) {
        const hay = `${a.playerName} ${awardLabel(a.awardType)} award ${a.year}`.toLowerCase();
        if (hay.includes(q)) {
          results.push({
            kind: "Award",
            title: `${a.playerName} — ${awardLabel(a.awardType)}`,
            snippet: `${a.year} Annual Awards`,
            section: "awards",
            playerId: a.playerId,
          });
        }
      }

      if (
        "kuc kalanja united club".includes(q) ||
        q.includes("kalanja") ||
        q.includes("club")
      ) {
        results.push({
          kind: "Club",
          title: "KUC – Kalanja United Club",
          snippet: `${playerRows.length} registered players · Weekly contribution ₹${WEEKLY_FEE} per player`,
          section: "home",
          playerId: null,
        });
      }

      return { results: results.slice(0, 30) };
    },
  }),

  // ---------- admin auth ----------

  getAuthStatus: defineAction({
    description: "Reports whether an admin password exists and whether the given session token is valid.",
    request: z.object({ token: z.string().optional() }),
    response: z.object({ setupDone: z.boolean(), isAdmin: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.adminAuth).limit(1);
      let isAdmin = false;
      if (args.token) {
        const sessions = await db
          .select()
          .from(schema.adminSessions)
          .where(eq(schema.adminSessions.token, args.token))
          .limit(1);
        isAdmin = sessions.length > 0;
      }
      return { setupDone: authRows.length > 0, isAdmin };
    },
  }),

  setupAdmin: defineAction({
    description:
      "First-run only: the admin creates the admin password and is logged in.",
    request: z.object({ password: z.string().min(6).max(100) }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.adminAuth).limit(1);
      if (authRows.length > 0) {
        throw new Error("Admin password is already set. Please log in.");
      }
      const salt = randomHex(16);
      const passwordHash = await hashPassword(args.password, salt);
      await db.insert(schema.adminAuth).values({ id: 1, passwordHash, salt });
      const token = randomHex(32);
      await db.insert(schema.adminSessions).values({ token });
      await logActivity(db, "Admin account created");
      return { token };
    },
  }),

  loginAdmin: defineAction({
    description: "Logs the admin in with the admin password.",
    request: z.object({ password: z.string().min(1).max(100) }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.adminAuth).limit(1);
      const auth = authRows[0];
      if (!auth) {
        throw new Error("No admin password has been set up yet.");
      }
      const attempt = await hashPassword(args.password, auth.salt);
      if (attempt !== auth.passwordHash) {
        throw new Error("Incorrect password. Please try again.");
      }
      const token = randomHex(32);
      await db.insert(schema.adminSessions).values({ token });
      return { token };
    },
  }),

  logoutAdmin: defineAction({
    description: "Ends the admin session.",
    request: z.object({ token: z.string().min(1) }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.adminSessions)
        .where(eq(schema.adminSessions.token, args.token));
      return { ok: true as const };
    },
  }),

  changePassword: defineAction({
    description: "Admin only: changes the admin password after verifying the current one.",
    request: z.object({
      token: z.string().min(1),
      currentPassword: z.string().min(1).max(100),
      newPassword: z.string().min(6).max(100),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.adminAuth).limit(1);
      const auth = authRows[0];
      if (!auth) throw new Error("No admin account found.");
      const attempt = await hashPassword(args.currentPassword, auth.salt);
      if (attempt !== auth.passwordHash) {
        throw new Error("Current password is incorrect.");
      }
      const salt = randomHex(16);
      const passwordHash = await hashPassword(args.newPassword, salt);
      await db
        .update(schema.adminAuth)
        .set({ passwordHash, salt })
        .where(eq(schema.adminAuth.id, auth.id));
      await logActivity(db, "Admin password changed");
      return { ok: true as const };
    },
  }),

  // ---------- editor auth ----------

  getEditorInfo: defineAction({
    description:
      "Reports whether an editor password has been set and whether the given editor session token is valid.",
    request: z.object({ editorToken: z.string().optional() }),
    response: z.object({ editorSet: z.boolean(), isEditor: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.editorAuth).limit(1);
      let isEditor = false;
      if (args.editorToken) {
        const sessions = await db
          .select()
          .from(schema.editorSessions)
          .where(eq(schema.editorSessions.token, args.editorToken))
          .limit(1);
        isEditor = sessions.length > 0;
      }
      return { editorSet: authRows.length > 0, isEditor };
    },
  }),

  setEditorPassword: defineAction({
    description:
      "Admin only: creates or changes the editor password (stored only as a salted hash).",
    request: z.object({
      token: z.string().min(1),
      password: z.string().min(6).max(100),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      await requireAdmin(ctx, args.token);
      const db = ctx.db<typeof schema>();
      const salt = randomHex(16);
      const passwordHash = await hashPassword(args.password, salt);
      const existing = await db.select().from(schema.editorAuth).limit(1);
      if (existing[0]) {
        await db
          .update(schema.editorAuth)
          .set({ passwordHash, salt })
          .where(eq(schema.editorAuth.id, existing[0].id));
        // A new editor password ends any editor sessions already open.
        await db.delete(schema.editorSessions);
        await logActivity(db, "Editor password changed by admin");
      } else {
        await db.insert(schema.editorAuth).values({ id: 1, passwordHash, salt });
        await logActivity(db, "Editor password created by admin");
      }
      return { ok: true as const };
    },
  }),

  loginEditor: defineAction({
    description:
      "Logs an editor in with the editor password; the session unlocks Committee, Stats and Money editing only.",
    request: z.object({ password: z.string().min(1).max(100) }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const authRows = await db.select().from(schema.editorAuth).limit(1);
      const auth = authRows[0];
      if (!auth) {
        throw new Error("No editor password has been set up yet.");
      }
      const attempt = await hashPassword(args.password, auth.salt);
      if (attempt !== auth.passwordHash) {
        throw new Error("Incorrect editor password. Please try again.");
      }
      const token = randomHex(32);
      await db.insert(schema.editorSessions).values({ token });
      return { token };
    },
  }),

  logoutEditor: defineAction({
    description: "Ends the editor session.",
    request: z.object({ token: z.string().min(1) }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.editorSessions)
        .where(eq(schema.editorSessions.token, args.token));
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;
