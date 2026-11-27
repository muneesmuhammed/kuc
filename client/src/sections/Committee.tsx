import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { api, type ApiResponse } from "../api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../../server/src/actions";
import {
EditorGate,
FieldError,
FormLock,
GhostButton,
GoldButton,
Modal,
useClub,
} from "../lib";

const FIELDS = actionFields<typeof Actions>();

type CommitteesData = ApiResponse<typeof api, "getCommittees">;

const CURRENT_YEAR = new Date().getFullYear();

function CommitteeForm({
  positions,
  existing,
  onDone,
}: {
  positions: string[];
  existing?: CommitteesData["committees"][number];
  onDone: () => void;
}) {
  const { editToken } = useClub();
  const queryClient = useQueryClient();
  const playersQuery = useQuery({
    queryKey: ["players"],
    queryFn: () => api.listPlayers({}),
  });
  const players = playersQuery.data?.players ?? [];

  const [year, setYear] = useState(existing?.year ?? CURRENT_YEAR);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [rows, setRows] = useState<{ playerId: string; position: string }[]>(
    existing
      ? existing.members.map((m) => ({
          playerId: String(m.playerId),
          position: m.position,
        }))
      : positions.map((p) => ({ playerId: "", position: p })),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      await api.saveCommittee({
        token: editToken ?? "",
        year,
        allowMultipleRoles: allowMultiple,
        members: rows
          .filter((r) => r.playerId)
          .map((r) => ({ playerId: Number(r.playerId), position: r.position })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const chosen = rows.filter((r) => r.playerId);
    if (chosen.length === 0) {
      setError("Select at least one player for the committee.");
      return;
    }
    if (!allowMultiple) {
      const ids = chosen.map((r) => r.playerId);
      if (new Set(ids).size !== ids.length) {
        setError(
          "The same player is picked for two positions. Change a selection or allow multiple roles.",
        );
        return;
      }
    }
    setError(null);
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="cf-year">Committee year</label>
        <input
          {...FIELDS.saveCommittee.year}
          id="cf-year"
            aria-label="Committee year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="w-36 shrink-0">
            <label htmlFor={`cf-pos-${i}`}>Position</label>
            <select
              id={`cf-pos-${i}`}
              aria-label={`Position for row ${i + 1}`}
              value={row.position}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, position: e.target.value } : r)))
              }
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor={`cf-player-${i}`}>Player</label>
            <select
              id={`cf-player-${i}`}
              aria-label={`Player for row ${i + 1}`}
              value={row.playerId}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, playerId: e.target.value } : r)))
              }
            >
              <option value="">— Select player —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.playerCode})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            aria-label={`Remove position row ${i + 1}`}
            className="p-2 shrink-0"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm gold-text inline-flex items-center gap-1"
        onClick={() => setRows([...rows, { playerId: "", position: "Executive Member" }])}
      >
        <Plus size={14} /> Add another position
      </button>
      <label className="flex items-center gap-2 normal-case tracking-normal text-sm text-[var(--text)]">
        <input
          type="checkbox"
          className="w-5 h-5"
          style={{ width: 20 }}
          checked={allowMultiple}
          onChange={(e) => setAllowMultiple(e.target.checked)}
        />
        Allow the same player to hold multiple positions
      </label>
      <FieldError message={error} />
      <GoldButton type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save committee"}
      </GoldButton>
    </form>
  );
}

export function CommitteeSection() {
  const { canEdit, editToken } = useClub();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [confirmDeleteYear, setConfirmDeleteYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["committees"],
    queryFn: () => api.getCommittees({}),
  });
  const committees = useMemo(() => data.data?.committees ?? [], [data.data]);
  const positions = data.data?.positions ?? [];
  const current = committees.find((c) => c.year === CURRENT_YEAR) ?? committees[0];
  const editing = committees.find((c) => c.year === editingYear);

  const del = useMutation({
    mutationFn: async (year: number) =>
      await api.deleteCommittee({ token: editToken ?? "", year }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setConfirmDeleteYear(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed."),
  });

  const order = (pos: string) => {
    const i = positions.indexOf(pos);
    return i === -1 ? 99 : i;
  };

  return (
    <section className="rise">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2">
          <Landmark className="gold-text" /> Committee
        </h2>
        <GoldButton onClick={() => setCreating(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> New committee
          </span>
        </GoldButton>
      </div>
      <div className="mb-4"><EditorGate what="create or edit committees" /></div>

      {data.isPending ? (
        <p className="text-[var(--dim)]">Loading committees…</p>
      ) : committees.length === 0 ? (
        <div className="card p-8 text-center">
          <Landmark size={36} className="mx-auto gold-text mb-2" />
          <p className="font-display text-2xl uppercase tracking-wide">No committee yet</p>
          <p className="text-[var(--dim)] text-sm mt-1">
            {canEdit
              ? "Create this year's committee by assigning registered players to each position."
              : "The committee for this year has not been announced yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {committees.map((c) => (
            <div key={c.year} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-display text-2xl font-semibold">
                  {c.year} Committee
                </h3>
                {current && c.year === current.year && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent)", color: "#131313" }}
                  >
                    CURRENT
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <GhostButton onClick={() => setEditingYear(c.year)}>Edit</GhostButton>
                  {canEdit &&
                    (confirmDeleteYear === c.year ? (
                      <GhostButton danger onClick={() => del.mutate(c.year)} disabled={del.isPending}>
                        Confirm delete
                      </GhostButton>
                    ) : (
                      <GhostButton danger onClick={() => setConfirmDeleteYear(c.year)}>
                        Delete
                      </GhostButton>
                    ))}
                </div>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {[...c.members]
                  .sort((a, b) => order(a.position) - order(b.position))
                  .map((m, i) => (
                    <li key={`${m.position}-${m.playerId}-${i}`} className="flex justify-between gap-2 border-b border-[var(--border)] pb-1.5">
                      <span className="text-[var(--dim)]">{m.position}</span>
                      <span className="font-semibold">{m.playerName}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <FieldError message={error} />
        </div>
      )}

      {creating && (
        <Modal title="Create committee" onClose={() => setCreating(false)}>
          {canEdit ? (
            <CommitteeForm positions={positions} onDone={() => setCreating(false)} />
          ) : (
            <FormLock what="create or edit committees" />
          )}
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.year} committee`} onClose={() => setEditingYear(null)}>
          {canEdit ? (
            <CommitteeForm
              positions={positions}
              existing={editing}
              onDone={() => setEditingYear(null)}
            />
          ) : (
            <FormLock what="create or edit committees" />
          )}
        </Modal>
      )}
    </section>
  );
}
