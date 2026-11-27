import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, IndianRupee, Lock, Wallet, X } from "lucide-react";
import { api, type ApiResponse } from "../api";
import {
  Avatar,
  EditorGate,
  FieldError,
  FormLock,
  Modal,
  formatDate,
  useClub,
} from "../lib";

type MoneyData = ApiResponse<typeof api, "getMoneyData">;

function WeekRow({
  row,
  weekStart,
  onLock,
}: {
  row: MoneyData["rows"][number];
  weekStart: string;
  onLock: () => void;
}) {
  const { canEdit, editToken } = useClub();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const paid = row.status === "paid";

  const setPay = useMutation({
    mutationFn: async (nextPaid: boolean) =>
      await api.setPayment({
        token: editToken ?? "",
        playerId: row.player.id,
        weekStart,
        paid: nextPaid,
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update."),
  });

  return (
    <div className="card p-3 flex items-center gap-3">
      <Avatar name={row.player.fullName} photoUrl={row.player.photoUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">
          {row.player.fullName}
          <span className="text-[var(--dim)] font-normal text-sm">
            {" "}
            · {row.player.playerCode}
          </span>
        </p>
        <p className="text-sm text-[var(--dim)]">
          {paid
            ? `Paid ₹${row.amount}${row.paidDate ? ` on ${formatDate(row.paidDate)}` : ""}`
            : `₹${row.amount} due this week`}
        </p>
        <FieldError message={error} />
      </div>
      <span
        className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
        style={{
          background: paid ? "rgba(63,191,114,0.15)" : "rgba(224,82,82,0.15)",
          color: paid ? "var(--success)" : "var(--danger)",
        }}
      >
        {paid ? "PAID" : "UNPAID"}
      </span>
      {canEdit ? (
        <button
          type="button"
          disabled={setPay.isPending}
          onClick={() => setPay.mutate(!paid)}
          aria-label={
            paid
              ? `Mark ${row.player.fullName} as unpaid`
              : `Mark ${row.player.fullName} as paid`
          }
          className="p-2.5 rounded-full shrink-0 disabled:opacity-50"
          style={{
            background: paid ? "var(--surface-2)" : "var(--accent)",
            color: paid ? "var(--danger)" : "#131313",
            border: "1px solid var(--border)",
          }}
        >
          {paid ? <X size={18} /> : <Check size={18} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLock}
          aria-label={`Locked — unlock to mark ${row.player.fullName} as ${paid ? "unpaid" : "paid"}`}
          className="p-2.5 rounded-full shrink-0"
          style={{
            background: "var(--surface-2)",
            color: "var(--dim)",
            border: "1px solid var(--border)",
          }}
        >
          <Lock size={18} />
        </button>
      )}
    </div>
  );
}

export function MoneySection() {
  const { canEdit } = useClub();
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [reportTab, setReportTab] = useState<"weekly" | "yearly">("weekly");
  const [lockOpen, setLockOpen] = useState(false);
  const data = useQuery({
    queryKey: ["money", week],
    queryFn: () => api.getMoneyData(week ? { weekStart: week } : {}),
  });
  const d = data.data;

  return (
    <section className="rise">
      <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2 mb-4">
        <Wallet className="gold-text" /> Money
      </h2>
      <div className="mb-4"><EditorGate what="manage payment records" /></div>

      {data.isPending || !d ? (
        <p className="text-[var(--dim)]">Loading money records…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              ["Total collected", `₹${d.totalCollected}`],
              ["Collected this week", `₹${d.collectedThisWeek}`],
              ["Expected / week", `₹${d.expectedThisWeek}`],
              ["Pending this week", `₹${d.pendingThisWeek}`],
            ].map(([label, value]) => (
              <div key={label} className="card p-4">
                <div className="font-display text-3xl font-semibold gold-text">{value}</div>
                <div className="text-xs uppercase tracking-wide text-[var(--dim)]">{label}</div>
              </div>
            ))}
          </div>

          <p className="text-sm text-[var(--dim)] mb-4 flex items-center gap-1.5">
            <IndianRupee size={15} className="gold-text" />
            Weekly contribution is ₹{d.weeklyFee} per player — {d.rows.length} players × ₹
            {d.weeklyFee} = ₹{d.expectedThisWeek} expected every week.
          </p>

          <div className="flex items-center gap-3 mb-3">
            <label htmlFor="money-week">Week starting</label>
            <select
              id="money-week"
            aria-label="Week starting"
              value={d.selectedWeek}
              onChange={(e) => setWeek(e.target.value)}
              className="max-w-56"
            >
              {d.weeks.map((w) => (
                <option key={w} value={w}>
                  {formatDate(w)}
                  {w === d.currentWeekStart ? " (this week)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 mb-6">
            {d.rows.map((row) => (
              <WeekRow
                key={row.player.id}
                row={row}
                weekStart={d.selectedWeek}
                onLock={() => setLockOpen(true)}
              />
            ))}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-display text-xl uppercase tracking-wide">Reports</h3>
              <div className="ml-auto flex gap-1">
                {(["weekly", "yearly"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setReportTab(t)}
                    aria-pressed={reportTab === t}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold capitalize"
                    style={{
                      background: reportTab === t ? "var(--accent)" : "var(--surface-2)",
                      color: reportTab === t ? "#131313" : "var(--text)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {reportTab === "weekly" ? (
              d.weeklyReport.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">No weekly records yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {d.weeklyReport.map((w) => (
                    <li key={w.weekStart} className="py-2 flex justify-between gap-2">
                      <span>Week of {formatDate(w.weekStart)}</span>
                      <span className="text-[var(--dim)]">
                        {w.paidCount} paid · <span className="gold-text font-semibold">₹{w.collected}</span> collected
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : d.yearlyReport.length === 0 ? (
              <p className="text-sm text-[var(--dim)]">No payments collected yet this year.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {d.yearlyReport.map((y) => (
                  <li key={y.year} className="py-2 flex justify-between gap-2">
                    <span className="font-semibold">{y.year}</span>
                    <span className="text-[var(--dim)]">
                      {y.payments} payments · <span className="gold-text font-semibold">₹{y.collected}</span> collected
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {lockOpen && !canEdit && (
        <Modal title="Update payment — locked" onClose={() => setLockOpen(false)}>
          <FormLock what="mark payments paid or unpaid" />
        </Modal>
      )}
    </section>
  );
}
