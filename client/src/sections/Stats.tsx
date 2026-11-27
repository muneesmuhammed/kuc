import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
Bar,
BarChart,
CartesianGrid,
Cell,
Pie,
PieChart,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { BarChart3, Crown, Minus, Plus, Star } from "lucide-react";
import { api } from "../api";
import {
Avatar,
EditorGate,
FieldError,
FormLock,
GhostButton,
GoldButton,
Modal,
useClub,
type Player,
type PlayerStats,
} from "../lib";

const NUM_FIELDS: { key: keyof PlayerStats; label: string; max: number; step?: number }[] = [
  { key: "matchesPlayed", label: "Matches played", max: 10000 },
  { key: "goals", label: "Goals", max: 10000 },
  { key: "assists", label: "Assists", max: 10000 },
  { key: "wins", label: "Wins", max: 10000 },
  { key: "losses", label: "Losses", max: 10000 },
  { key: "draws", label: "Draws", max: 10000 },
  { key: "yellowCards", label: "Yellow cards", max: 10000 },
  { key: "redCards", label: "Red cards", max: 10000 },
  { key: "performance", label: "Performance (0–10)", max: 10, step: 0.1 },
  { key: "attendance", label: "Attendance (%)", max: 100 },
];

function StatsForm({
  player,
  stats,
  onDone,
}: {
  player: Player;
  stats: PlayerStats;
  onDone: () => void;
}) {
  const { editToken } = useClub();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUM_FIELDS.map((f) => [f.key, String(stats[f.key] ?? 0)])),
  );
  const [custom, setCustom] = useState<{ label: string; value: string }[]>(
    stats.customStats,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      await api.updateStats({
        token: editToken ?? "",
        playerId: player.id,
        matchesPlayed: Number(values.matchesPlayed ?? 0),
        goals: Number(values.goals ?? 0),
        assists: Number(values.assists ?? 0),
        wins: Number(values.wins ?? 0),
        losses: Number(values.losses ?? 0),
        draws: Number(values.draws ?? 0),
        yellowCards: Number(values.yellowCards ?? 0),
        redCards: Number(values.redCards ?? 0),
        performance: Number(values.performance ?? 0),
        attendance: Number(values.attendance ?? 0),
        customStats: custom.filter((c) => c.label.trim()),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    for (const f of NUM_FIELDS) {
      const n = Number(values[f.key]);
      if (Number.isNaN(n) || n < 0 || n > f.max) {
        setError(`${f.label} must be between 0 and ${f.max}.`);
        return;
      }
    }
    setError(null);
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {NUM_FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`sf-${f.key}`}>{f.label}</label>
            <input
              id={`sf-${f.key}`}
              aria-label={f.label}
              className="white-field"
              type="number"
              min={0}
              max={f.max}
              step={f.step ?? 1}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)] mb-1">
          Custom statistics
        </p>
        {custom.map((c, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              aria-label={`Custom stat ${i + 1} name`}
              className="white-field"
              placeholder="Name (e.g. Clean sheets)"
              value={c.label}
              maxLength={40}
              onChange={(e) =>
                setCustom(custom.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <input
              aria-label={`Custom stat ${i + 1} value`}
              className="white-field"
              placeholder="Value"
              value={c.value}
              maxLength={60}
              onChange={(e) =>
                setCustom(custom.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
            />
            <button
              type="button"
              aria-label={`Remove custom stat ${i + 1}`}
              className="px-2 shrink-0"
              onClick={() => setCustom(custom.filter((_, j) => j !== i))}
            >
              <Minus size={16} />
            </button>
          </div>
        ))}
        {custom.length < 12 && (
          <button
            type="button"
            className="text-sm gold-text inline-flex items-center gap-1"
            onClick={() => setCustom([...custom, { label: "", value: "" }])}
          >
            <Plus size={14} /> Add custom statistic
          </button>
        )}
      </div>
      <FieldError message={error} />
      <GoldButton type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save statistics"}
      </GoldButton>
    </form>
  );
}

export function StatsSection() {
  const { canEdit } = useClub();
  const [editing, setEditing] = useState<{ player: Player; stats: PlayerStats } | null>(null);
  const data = useQuery({ queryKey: ["stats"], queryFn: () => api.getStatsData({}) });

  const ranked = useMemo(() => {
    const rows = [...(data.data?.players ?? [])];
    rows.sort(
      (a, b) =>
        b.stats.goals - a.stats.goals ||
        b.stats.assists - a.stats.assists ||
        b.stats.performance - a.stats.performance,
    );
    return rows;
  }, [data.data]);

  const chartData = ranked
    .slice(0, 8)
    .map((r) => ({
      name: r.player.fullName.split(" ")[0] ?? r.player.fullName,
      Goals: r.stats.goals,
      Assists: r.stats.assists,
    }))
    .filter((d) => d.Goals > 0 || d.Assists > 0);

  const totals = data.data?.totals;
  const pieData = totals
    ? [
        { name: "Wins", value: totals.wins },
        { name: "Draws", value: totals.draws },
        { name: "Losses", value: totals.losses },
      ].filter((d) => d.value > 0)
    : [];
  const PIE_COLORS = ["#ffffff", "#8c8c8c", "#404040"];

  const topScorer = ranked.find((r) => r.player.id === data.data?.topScorerId);
  const bestPlayer = ranked.find((r) => r.player.id === data.data?.bestPlayerId);

  return (
    <section className="rise">
      <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2 mb-4">
        <BarChart3 className="gold-text" /> Stats
      </h2>
      <div className="mb-4"><EditorGate what="update player statistics" /></div>

      {data.isPending ? (
        <p className="text-[var(--dim)]">Loading statistics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              ["Total matches", totals?.matches ?? 0],
              ["Total goals", totals?.goals ?? 0],
              ["Total assists", totals?.assists ?? 0],
              ["Wins / Draws / Losses", `${totals?.wins ?? 0} / ${totals?.draws ?? 0} / ${totals?.losses ?? 0}`],
            ].map(([label, value]) => (
              <div key={label} className="card p-4">
                <div className="font-display text-3xl font-semibold">{value}</div>
                <div className="text-xs uppercase tracking-wide text-[var(--dim)]">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="card gold-ring p-4 flex items-center gap-3">
              <Crown className="gold-text shrink-0" size={28} />
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--dim)]">Top scorer</div>
                <div className="font-display text-2xl font-semibold leading-tight">
                  {topScorer ? `${topScorer.player.fullName} · ${topScorer.stats.goals} goals` : "No goals yet"}
                </div>
              </div>
            </div>
            <div className="card gold-ring p-4 flex items-center gap-3">
              <Star className="gold-text shrink-0" size={28} />
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--dim)]">Best player</div>
                <div className="font-display text-2xl font-semibold leading-tight">
                  {bestPlayer
                    ? `${bestPlayer.player.fullName} · ${bestPlayer.stats.performance}/10`
                    : "No ratings yet"}
                </div>
              </div>
            </div>
          </div>

          {(chartData.length > 0 || pieData.length > 0) && (
            <div className="grid lg:grid-cols-2 gap-3 mb-4">
              {chartData.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-display text-xl uppercase tracking-wide mb-2">
                    Goals &amp; assists
                  </h3>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid stroke="#333333" strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="#a6a6a6" fontSize={12} />
                        <YAxis stroke="#a6a6a6" fontSize={12} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#0a0a0a",
                            border: "1px solid #333333",
                            color: "#ffffff",
                          }}
                        />
                        <Bar dataKey="Goals" fill="#ffffff" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Assists" fill="#8c8c8c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {pieData.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-display text-xl uppercase tracking-wide mb-2">
                    Results breakdown
                  </h3>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0a0a0a",
                            border: "1px solid #333333",
                            color: "#ffffff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          <h3 className="font-display text-2xl uppercase tracking-wide mb-2">Player rankings</h3>
          <div className="space-y-2">
            {ranked.map((r, i) => (
              <div key={r.player.id} className="card p-3 flex items-center gap-3">
                <span className="font-display text-2xl font-semibold w-8 text-center gold-text">
                  {i + 1}
                </span>
                <Avatar name={r.player.fullName} photoUrl={r.player.photoUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {r.player.fullName}
                    <span className="text-[var(--dim)] font-normal text-sm">
                      {" "}
                      · {r.player.position}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--dim)]">
                    {r.stats.matchesPlayed} matches · {r.stats.goals} goals ·{" "}
                    {r.stats.assists} assists · W{r.stats.wins} D{r.stats.draws} L
                    {r.stats.losses} · Yellow {r.stats.yellowCards} · Red{" "}
                    {r.stats.redCards} · Attendance {r.stats.attendance}%
                  </p>
                  {r.stats.customStats.length > 0 && (
                    <p className="text-sm text-[var(--dim)]">
                      {r.stats.customStats.map((c) => `${c.label}: ${c.value}`).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-xl font-semibold">
                    {r.stats.performance}/10
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                    Rating
                  </div>
                </div>
                <GhostButton onClick={() => setEditing({ player: r.player, stats: r.stats })}>
                  Update
                </GhostButton>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <Modal
          title={`Statistics — ${editing.player.fullName}`}
          onClose={() => setEditing(null)}
        >
          {canEdit ? (
            <StatsForm
              player={editing.player}
              stats={editing.stats}
              onDone={() => setEditing(null)}
            />
          ) : (
            <FormLock what="update player statistics" />
          )}
        </Modal>
      )}
    </section>
  );
}
