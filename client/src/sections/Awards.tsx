import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award as AwardIcon, Pencil, Trash2 } from "lucide-react";
import { api, type ApiResponse } from "../api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../../server/src/actions";
import {
AdminGate,
Avatar,
FieldError,
GhostButton,
GoldButton,
Modal,
awardLabel,
useClub,
} from "../lib";
import ballonDorImg from "../assets/trophy-ballon-dor.webp";
import goldenBootImg from "../assets/trophy-golden-boot.webp";
import goldenGlovesImg from "../assets/trophy-golden-gloves.webp";

const FIELDS = actionFields<typeof Actions>();

type AwardsData = ApiResponse<typeof api, "getAwardsData">;
type AwardRow = AwardsData["awards"][number];
type AwardType = "ballon_dor" | "golden_boot" | "golden_gloves";

const AWARD_META: Record<
  AwardType,
  { title: string; subtitle: string; img: string; imgAlt: string }
> = {
  ballon_dor: {
    title: "KUC Ballon d'Or",
    subtitle: "Best Player of the Year",
    img: ballonDorImg,
    imgAlt: "Golden ball trophy on a pedestal",
  },
  golden_boot: {
    title: "KUC Golden Boot",
    subtitle: "Top Goal Scorer of the Year",
    img: goldenBootImg,
    imgAlt: "Golden football boot trophy on a pedestal",
  },
  golden_gloves: {
    title: "KUC Golden Gloves",
    subtitle: "Best Goalkeeper of the Year",
    img: goldenGlovesImg,
    imgAlt: "Golden goalkeeper gloves trophy on a pedestal",
  },
};

const CURRENT_YEAR = new Date().getFullYear();

function AwardForm({
  awardType,
  existing,
  onDone,
}: {
  awardType: AwardType;
  existing?: AwardRow;
  onDone: () => void;
}) {
  const { token } = useClub();
  const queryClient = useQueryClient();
  const playersQuery = useQuery({
    queryKey: ["players"],
    queryFn: () => api.listPlayers({}),
  });
  const awardsQuery = useQuery({
    queryKey: ["awards"],
    queryFn: () => api.getAwardsData({}),
  });
  const allPlayers = playersQuery.data?.players ?? [];
  const players =
    awardType === "golden_gloves"
      ? allPlayers.filter((p) => p.position.toLowerCase().includes("goalkeeper"))
      : allPlayers;

  const d = (existing?.detailStats ?? {}) as Record<string, string | number>;
  const [year, setYear] = useState(existing?.year ?? CURRENT_YEAR);
  const [playerId, setPlayerId] = useState(
    existing ? String(existing.playerId) : "",
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [published, setPublished] = useState(existing?.published ?? true);
  const [fields, setFields] = useState<Record<string, string>>({
    matches: String(d.matches ?? ""),
    goals: String(d.goals ?? ""),
    assists: String(d.assists ?? ""),
    cleanSheets: String(d.cleanSheets ?? ""),
    goalsConceded: String(d.goalsConceded ?? ""),
    saves: String(d.saves ?? ""),
    rating: String(d.rating ?? ""),
    achievements: String(d.achievements ?? ""),
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const detailStats: Record<string, string | number> = {};
      const put = (key: string, numeric: boolean) => {
        const v = (fields[key] ?? "").trim();
        if (v) detailStats[key] = numeric ? Number(v) : v;
      };
      if (awardType === "ballon_dor") {
        put("matches", true);
        put("goals", true);
        put("assists", true);
        put("achievements", false);
      } else if (awardType === "golden_boot") {
        put("goals", true);
        put("matches", true);
        put("assists", true);
      } else {
        put("matches", true);
        put("cleanSheets", true);
        put("goalsConceded", true);
        put("saves", true);
        put("rating", true);
      }
      return await api.saveAward({
        token: token ?? "",
        year,
        awardType,
        playerId: Number(playerId),
        description,
        detailStats,
        published,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!playerId) {
      setError("Select the winning player.");
      return;
    }
    setError(null);
    save.mutate();
  };

  const numField = (key: string, label: string, step?: number) => (
    <div>
      <label htmlFor={`af-${key}`}>{label}</label>
      <input
        id={`af-${key}`}
        aria-label={label}
        type="number"
        min={0}
        step={step ?? 1}
        value={fields[key] ?? ""}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="af-year">Award year</label>
          <input
            {...FIELDS.saveAward.year}
            id="af-year"
            aria-label="Award year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="af-player">Winning player</label>
          <select
            id="af-player"
            aria-label="Winning player"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">— Select player —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.playerCode})
              </option>
            ))}
          </select>
        </div>
      </div>
      {awardType === "golden_gloves" && players.length === 0 && (
        <p className="text-sm text-[var(--dim)]">
          No registered player has the Goalkeeper position yet — add one in
          PLAYERS first.
        </p>
      )}
      {awardType === "golden_boot" && (awardsQuery.data?.goalRanking.length ?? 0) > 0 && (
        <div className="rounded-[10px] bg-[var(--surface-2)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)] mb-1">
            Top scorers from player statistics
          </p>
          <ol className="text-sm space-y-0.5">
            {awardsQuery.data?.goalRanking.slice(0, 5).map((g, i) => (
              <li key={g.playerId} className="flex justify-between">
                <span>
                  {i + 1}. {g.playerName}
                </span>
                <span className="gold-text font-semibold">{g.goals} goals</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="text-sm gold-text underline mt-1"
            onClick={() => {
              const top = awardsQuery.data?.goalRanking[0];
              if (top) {
                setPlayerId(String(top.playerId));
                setFields((f) => ({ ...f, goals: String(top.goals), matches: String(top.matches), assists: String(top.assists) }));
              }
            }}
          >
            Use the top scorer
          </button>
        </div>
      )}
      {awardType === "golden_gloves" && (awardsQuery.data?.goalkeepers.length ?? 0) > 0 && (
        <div className="rounded-[10px] bg-[var(--surface-2)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)] mb-1">
            Goalkeeper ranking by performance rating
          </p>
          <ol className="text-sm space-y-0.5">
            {awardsQuery.data?.goalkeepers.map((g, i) => (
              <li key={g.playerId} className="flex justify-between">
                <span>
                  {i + 1}. {g.playerName}
                </span>
                <span className="gold-text font-semibold">{g.performance}/10</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {awardType === "ballon_dor" && (
          <>
            {numField("matches", "Matches")}
            {numField("goals", "Goals")}
            {numField("assists", "Assists")}
          </>
        )}
        {awardType === "golden_boot" && (
          <>
            {numField("goals", "Total goals scored")}
            {numField("matches", "Matches")}
            {numField("assists", "Assists")}
          </>
        )}
        {awardType === "golden_gloves" && (
          <>
            {numField("matches", "Matches played")}
            {numField("cleanSheets", "Clean sheets")}
            {numField("goalsConceded", "Goals conceded")}
            {numField("saves", "Saves")}
            {numField("rating", "Performance rating (0–10)", 0.1)}
          </>
        )}
      </div>
      {awardType === "ballon_dor" && (
        <div>
          <label htmlFor="af-achievements">Other achievements</label>
          <input
            id="af-achievements"
            aria-label="Other achievements"
            value={fields.achievements ?? ""}
            maxLength={60}
            onChange={(e) => setFields({ ...fields, achievements: e.target.value })}
            placeholder="e.g. Player of the tournament"
          />
        </div>
      )}
      <div>
        <label htmlFor="af-desc">Award description</label>
        <textarea
          {...FIELDS.saveAward.description}
          id="af-desc"
            aria-label="Award description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why this player earned the award…"
        />
      </div>
      <label className="flex items-center gap-2 normal-case tracking-normal text-sm text-[var(--text)]">
        <input
          type="checkbox"
          className="w-5 h-5"
          style={{ width: 20 }}
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        Publish this winner now
      </label>
      <FieldError message={error} />
      <GoldButton type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save winner"}
      </GoldButton>
    </form>
  );
}

function detailLine(a: AwardRow): string {
  const d = a.detailStats;
  const parts: string[] = [];
  const add = (key: string, label: string) => {
    const v = d[key];
    if (v !== undefined && v !== "") parts.push(`${label}: ${v}`);
  };
  add("matches", "Matches");
  add("goals", "Goals");
  add("assists", "Assists");
  add("cleanSheets", "Clean sheets");
  add("goalsConceded", "Conceded");
  add("saves", "Saves");
  add("rating", "Rating");
  add("achievements", "Achievements");
  return parts.join(" · ");
}

export function AwardsSection() {
  const { isAdmin, token } = useClub();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [formFor, setFormFor] = useState<AwardType | null>(null);
  const [editingAward, setEditingAward] = useState<AwardRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["awards"],
    queryFn: () => api.getAwardsData({}),
  });
  const awards = useMemo(() => data.data?.awards ?? [], [data.data]);
  const years = useMemo(() => {
    const set = new Set<number>([CURRENT_YEAR]);
    for (const a of awards) set.add(a.year);
    return Array.from(set).sort((a, b) => b - a);
  }, [awards]);

  const del = useMutation({
    mutationFn: async (id: number) =>
      await api.deleteAward({ token: token ?? "", awardId: id }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setConfirmDeleteId(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed."),
  });

  const types: AwardType[] = ["ballon_dor", "golden_boot", "golden_gloves"];
  const history = awards.filter((a) => a.year !== year);

  return (
    <section className="rise">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2">
          <AwardIcon className="gold-text" /> KUC Annual Awards
        </h2>
        <select
          aria-label="Award year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[var(--dim)] text-sm mb-4">
        The club's three highest honours, awarded every year to registered players.
      </p>
      {!isAdmin && <div className="mb-4"><AdminGate what="manage annual awards" /></div>}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {types.map((t) => {
          const meta = AWARD_META[t];
          const winner = awards.find((a) => a.year === year && a.awardType === t);
          const visible = winner && (winner.published || isAdmin);
          return (
            <article key={t} className="card gold-ring overflow-hidden flex flex-col">
              <img
                src={meta.img}
                alt={meta.imgAlt}
                className="w-full h-44 object-cover"
                loading="lazy"
              />
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-display text-2xl font-semibold gold-text leading-tight">
                  {meta.title}
                </h3>
                <p className="text-sm text-[var(--dim)] mb-3">{meta.subtitle}</p>
                {visible ? (
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar
                        name={winner.playerName}
                        photoUrl={winner.photoUrl}
                        size={52}
                      />
                      <div>
                        <p className="font-display text-xl font-semibold leading-tight">
                          {winner.playerName}
                        </p>
                        <p className="text-sm text-[var(--dim)]">{winner.playerPosition}</p>
                      </div>
                    </div>
                    {detailLine(winner) && (
                      <p className="text-sm mb-1">{detailLine(winner)}</p>
                    )}
                    {winner.description && (
                      <p className="text-sm text-[var(--dim)]">{winner.description}</p>
                    )}
                    {!winner.published && (
                      <p className="text-xs mt-2 font-semibold" style={{ color: "var(--accent)" }}>
                        Saved — not published yet
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--dim)] flex-1">
                    No winner announced for {year} yet.
                  </p>
                )}
                {isAdmin && (
                  <div className="flex gap-2 mt-3">
                    <GoldButton
                      onClick={() => {
                        setEditingAward(winner ?? null);
                        setFormFor(t);
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Pencil size={14} /> {winner ? "Edit winner" : "Set winner"}
                      </span>
                    </GoldButton>
                    {winner &&
                      (confirmDeleteId === winner.id ? (
                        <GhostButton danger onClick={() => del.mutate(winner.id)} disabled={del.isPending}>
                          Confirm
                        </GhostButton>
                      ) : (
                        <GhostButton danger onClick={() => setConfirmDeleteId(winner.id)}>
                          <Trash2 size={14} />
                        </GhostButton>
                      ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <FieldError message={error} />

      <h3 className="font-display text-2xl uppercase tracking-wide mb-2">Awards history</h3>
      {history.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">
          No winners from other years yet. Every year's winners stay recorded here.
        </p>
      ) : (
        <ul className="space-y-2">
          {history
            .filter((a) => a.published || isAdmin)
            .map((a) => (
              <li key={a.id} className="card p-3 flex items-center gap-3">
                <span className="font-display text-xl font-semibold gold-text w-14">
                  {a.year}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {awardLabel(a.awardType)} — {a.playerName}
                  </p>
                  <p className="text-sm text-[var(--dim)] truncate">
                    {detailLine(a) || a.description || a.playerPosition}
                    {!a.published ? " · Unpublished" : ""}
                  </p>
                </div>
                {isAdmin && (
                  <GhostButton
                    onClick={() => {
                      setEditingAward(a);
                      setFormFor(a.awardType as AwardType);
                      setYear(a.year);
                    }}
                  >
                    Edit
                  </GhostButton>
                )}
              </li>
            ))}
        </ul>
      )}

      {formFor && (
        <Modal
          title={`${AWARD_META[formFor].title} — ${editingAward ? "Edit" : "Set"} winner`}
          onClose={() => {
            setFormFor(null);
            setEditingAward(null);
          }}
        >
          <AwardForm
            awardType={formFor}
            existing={editingAward ?? undefined}
            onDone={() => {
              setFormFor(null);
              setEditingAward(null);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
