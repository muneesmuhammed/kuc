import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Search, Trash2, Trophy, Users } from "lucide-react";
import { api, type ApiRequest } from "../api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../../server/src/actions";
import {
AdminGate,
Avatar,
FieldError,
GhostButton,
GoldButton,
Modal,
POSITIONS,
awardLabel,
formatDate,
photoFromFile,
useClub,
type Player,
} from "../lib";

const FIELDS = actionFields<typeof Actions>();

type PlayerFormState = {
  fullName: string;
  age: string;
  position: string;
  phone: string;
  joiningDate: string;
  status: "Active" | "Inactive";
};

const emptyForm: PlayerFormState = {
  fullName: "",
  age: "",
  position: "Midfielder",
  phone: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  status: "Active",
};

function PlayerForm({
  initial,
  playerId,
  onDone,
}: {
  initial: PlayerFormState;
  playerId?: number;
  onDone: () => void;
}) {
  const { token } = useClub();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlayerFormState>(initial);
  const [photo, setPhoto] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: ApiRequest<typeof api, "addPlayer"> = {
        token: token ?? "",
        fullName: form.fullName,
        age: Number(form.age),
        position: form.position,
        phone: form.phone,
        joiningDate: form.joiningDate,
        status: form.status,
        photo,
      };
      return playerId
        ? await api.updatePlayer({ ...payload, playerId, removePhoto })
        : await api.addPlayer(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!form.fullName.trim()) {
      setError("Enter the player's full name.");
      return;
    }
    if (!form.age || Number(form.age) < 5 || Number(form.age) > 100) {
      setError("Enter a valid age between 5 and 100.");
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="pf-name">Full name</label>
        <input
          {...FIELDS.addPlayer.fullName}
          id="pf-name"
            aria-label="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="e.g. Arun Kumar"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-age">Age</label>
          <input
            {...FIELDS.addPlayer.age}
            id="pf-age"
            aria-label="Age"
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pf-position">Position</label>
          <select
            id="pf-position"
            aria-label="Position"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pf-phone">Phone number</label>
        <input
          {...FIELDS.addPlayer.phone}
          id="pf-phone"
            aria-label="Phone number"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-join">Joining date</label>
          <input
            id="pf-join"
            aria-label="Joining date"
            type="date"
            value={form.joiningDate}
            onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pf-status">Status</label>
          <select
            id="pf-status"
            aria-label="Status"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as "Active" | "Inactive" })
            }
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pf-photo">Player photo</label>
        <input
          id="pf-photo"
            aria-label="Player photo"
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              setPhoto(await photoFromFile(file));
              setRemovePhoto(false);
            }
          }}
        />
        {playerId && !photo && (
          <button
            type="button"
            className="text-sm mt-1 underline text-[var(--dim)]"
            onClick={() => setRemovePhoto(true)}
          >
            {removePhoto ? "Photo will be removed on save" : "Remove current photo"}
          </button>
        )}
      </div>
      <FieldError message={error} />
      <div className="flex gap-2 pt-1">
        <GoldButton type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : playerId ? "Save changes" : "Add player"}
        </GoldButton>
      </div>
    </form>
  );
}

function PlayerProfile({ player, onClose }: { player: Player; onClose: () => void }) {
  const { isAdmin, token } = useClub();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ["player-profile", player.id],
    queryFn: () => api.getPlayerProfile({ playerId: player.id }),
  });

  const del = useMutation({
    mutationFn: async () => await api.deletePlayer({ token: token ?? "", playerId: player.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed."),
  });

  const data = profile.data;
  const stats = data?.stats;

  return (
    <Modal title={player.playerCode} onClose={onClose}>
      {editing ? (
        <PlayerForm
          playerId={player.id}
          initial={{
            fullName: player.fullName,
            age: String(player.age),
            position: player.position,
            phone: player.phone,
            joiningDate: player.joiningDate,
            status: player.status === "Inactive" ? "Inactive" : "Active",
          }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={player.fullName} photoUrl={player.photoUrl} size={84} />
            <div>
              <h4 className="font-display text-2xl font-semibold leading-tight">
                {player.fullName}
              </h4>
              <p className="text-[var(--dim)] text-sm">
                {player.position} · Age {player.age}
              </p>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background:
                    player.status === "Active"
                      ? "rgba(63,191,114,0.15)"
                      : "rgba(166,166,166,0.15)",
                  color: player.status === "Active" ? "var(--success)" : "var(--dim)",
                }}
              >
                {player.status}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-[var(--dim)]">Player ID</dt>
              <dd className="font-semibold">{player.playerCode}</dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Phone</dt>
              <dd className="font-semibold">{player.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Joined</dt>
              <dd className="font-semibold">{formatDate(player.joiningDate)}</dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Total paid</dt>
              <dd className="font-semibold gold-text">₹{data?.totalPaid ?? 0}</dd>
            </div>
          </dl>

          {stats && (
            <div>
              <h5 className="font-display uppercase tracking-wide text-lg mb-2">
                Statistics
              </h5>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ["Matches", stats.matchesPlayed],
                  ["Goals", stats.goals],
                  ["Assists", stats.assists],
                  ["Rating", `${stats.performance}/10`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[10px] bg-[var(--surface-2)] py-2">
                    <div className="font-display text-xl font-semibold">{value}</div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data && data.payments.length > 0 && (
            <div>
              <h5 className="font-display uppercase tracking-wide text-lg mb-2">
                Payment history
              </h5>
              <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
                {data.payments.map((p) => (
                  <li
                    key={p.weekStart}
                    className="flex justify-between rounded-[8px] bg-[var(--surface-2)] px-3 py-1.5"
                  >
                    <span>Week of {formatDate(p.weekStart)}</span>
                    <span
                      style={{
                        color: p.status === "paid" ? "var(--success)" : "var(--danger)",
                      }}
                      className="font-semibold"
                    >
                      {p.status === "paid" ? `₹${p.amount} PAID` : "UNPAID"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && data.committeeRoles.length > 0 && (
            <p className="text-sm">
              <span className="text-[var(--dim)]">Committee: </span>
              {data.committeeRoles.map((r) => `${r.position} (${r.year})`).join(", ")}
            </p>
          )}
          {data && data.awardsWon.length > 0 && (
            <p className="text-sm flex items-center gap-1.5">
              <Trophy size={15} className="gold-text" />
              {data.awardsWon.map((a) => `${awardLabel(a.awardType)} ${a.year}`).join(", ")}
            </p>
          )}

          {isAdmin && (
            <div className="pt-1">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: "var(--danger)" }}>
                    Remove {player.fullName} permanently? Their stats, payments,
                    committee seats and awards will also be removed.
                  </p>
                  <div className="flex gap-2">
                    <GhostButton danger onClick={() => del.mutate()} disabled={del.isPending}>
                      {del.isPending ? "Removing…" : "Yes, remove player"}
                    </GhostButton>
                    <GhostButton onClick={() => setConfirmDelete(false)}>Cancel</GhostButton>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <GoldButton onClick={() => setEditing(true)}>
                    <span className="inline-flex items-center gap-1.5">
                      <Pencil size={15} /> Edit player
                    </span>
                  </GoldButton>
                  <GhostButton danger onClick={() => setConfirmDelete(true)}>
                    <span className="inline-flex items-center gap-1.5">
                      <Trash2 size={15} /> Delete
                    </span>
                  </GhostButton>
                </div>
              )}
              <FieldError message={error} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function PlayersSection({ focusPlayerId }: { focusPlayerId: number | null }) {
  const { isAdmin, go } = useClub();
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editLockedPlayer, setEditLockedPlayer] = useState<Player | null>(null);

  const playersQuery = useQuery({
    queryKey: ["players"],
    queryFn: () => api.listPlayers({}),
  });
  const players = useMemo(() => playersQuery.data?.players ?? [], [playersQuery.data]);

  useEffect(() => {
    if (focusPlayerId != null && players.length > 0) {
      const found = players.find((p) => p.id === focusPlayerId);
      if (found) setSelected(found);
    }
  }, [focusPlayerId, players]);

  const filtered = players.filter((p) => {
    const matchesQuery =
      p.fullName.toLowerCase().includes(query.toLowerCase()) ||
      p.playerCode.toLowerCase().includes(query.toLowerCase());
    const matchesPos = positionFilter === "All" || p.position === positionFilter;
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesQuery && matchesPos && matchesStatus;
  });

  const positions = Array.from(new Set(players.map((p) => p.position))).sort();

  return (
    <section className="rise">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2">
          <Users className="gold-text" /> Players
        </h2>
        {isAdmin && (
          <GoldButton onClick={() => setAdding(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} /> Add player
            </span>
          </GoldButton>
        )}
      </div>

      {!isAdmin && <div className="mb-4"><AdminGate what="add, edit or remove players" /></div>}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]"
          />
          <input
            aria-label="Search players"
            placeholder="Search by name or player ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter by position"
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="All">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-40"
        >
          <option value="All">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {playersQuery.isPending ? (
        <p className="text-[var(--dim)]">Loading players…</p>
      ) : players.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={36} className="mx-auto gold-text mb-2" />
          <p className="font-display text-2xl uppercase tracking-wide">
            No players registered yet
          </p>
          <p className="text-[var(--dim)] text-sm mt-1">
            {isAdmin
              ? "Add the first player to unlock STATS, MONEY, GOOGLE, COMMITTEE and AWARDS."
              : "The admin has not registered any players yet. Once the first player is added, every section of the club opens."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--dim)]">No players match your search or filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="card p-4 hover:border-[var(--accent)] transition-colors flex flex-col"
            >
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="text-left w-full"
                aria-label={`View profile of ${p.fullName}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.fullName} photoUrl={p.photoUrl} size={60} />
                  <div className="min-w-0">
                    <p className="font-display text-xl font-semibold leading-tight truncate">
                      {p.fullName}
                    </p>
                    <p className="text-sm text-[var(--dim)]">
                      {p.playerCode} · {p.position}
                    </p>
                  </div>
                  <span
                    className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                    style={{
                      background:
                        p.status === "Active"
                          ? "rgba(63,191,114,0.15)"
                          : "rgba(166,166,166,0.15)",
                      color: p.status === "Active" ? "var(--success)" : "var(--dim)",
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">Age</dt>
                    <dd className="font-semibold">{p.age}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">Phone</dt>
                    <dd className="font-semibold truncate">{p.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">Joined</dt>
                    <dd className="font-semibold">{formatDate(p.joiningDate)}</dd>
                  </div>
                </dl>
              </button>
              <button
                type="button"
                onClick={() =>
                  isAdmin ? setEditingPlayer(p) : setEditLockedPlayer(p)
                }
                aria-label={`Edit profile of ${p.fullName}`}
                className="mt-3 self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-sm font-semibold border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                }}
              >
                <Pencil size={14} /> Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add new player" onClose={() => setAdding(false)}>
          <PlayerForm initial={emptyForm} onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editingPlayer &&
        (() => {
          const p =
            players.find((pl) => pl.id === editingPlayer.id) ?? editingPlayer;
          return (
            <Modal
              title={`Edit player · ${p.playerCode}`}
              onClose={() => setEditingPlayer(null)}
            >
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={p.fullName} photoUrl={p.photoUrl} size={56} />
                <div>
                  <p className="font-display text-xl font-semibold leading-tight">
                    {p.fullName}
                  </p>
                  <p className="text-sm text-[var(--dim)]">
                    Player ID: {p.playerCode}
                  </p>
                </div>
              </div>
              <PlayerForm
                playerId={p.id}
                initial={{
                  fullName: p.fullName,
                  age: String(p.age),
                  position: p.position,
                  phone: p.phone,
                  joiningDate: p.joiningDate,
                  status: p.status === "Inactive" ? "Inactive" : "Active",
                }}
                onDone={() => setEditingPlayer(null)}
              />
            </Modal>
          );
        })()}
      {editLockedPlayer && (
        <Modal title="Edit player" onClose={() => setEditLockedPlayer(null)}>
          <div className="text-center py-2">
            <div
              aria-hidden
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Lock size={26} className="gold-text" />
            </div>
            <h4 className="font-display text-2xl font-semibold uppercase tracking-wide mb-1">
              Admin only
            </h4>
            <p className="text-sm text-[var(--dim)] mb-4 max-w-sm mx-auto">
              Only the club admin can edit player profiles — the editor
              password does not unlock player editing. Log in as the club
              admin to edit {editLockedPlayer.fullName}.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <GoldButton
                onClick={() => {
                  setEditLockedPlayer(null);
                  go("admin");
                }}
              >
                Admin login
              </GoldButton>
              <GhostButton onClick={() => setEditLockedPlayer(null)}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </Modal>
      )}
      {selected && (
        <PlayerProfile
          player={players.find((p) => p.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
