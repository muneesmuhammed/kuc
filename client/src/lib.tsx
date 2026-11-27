import {
  createContext,
  useContext,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { Lock, LogOut, PencilLine, X } from "lucide-react";
import { api, type ApiResponse } from "./api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";

const FIELDS = actionFields<typeof Actions>();

export type Section =
  | "home"
  | "players"
  | "stats"
  | "money"
  | "google"
  | "committee"
  | "awards"
  | "admin";

export type Player = ApiResponse<typeof api, "listPlayers">["players"][number];
export type PlayerStats =
  ApiResponse<typeof api, "getStatsData">["players"][number]["stats"];

export interface ClubState {
  token: string | null;
  isAdmin: boolean;
  setToken: (t: string | null) => void;
  /** Editor session token — kept in memory only, so editor mode ends when
   *  the page is closed or reloaded. */
  editorToken: string | null;
  isEditor: boolean;
  setEditorToken: (t: string | null) => void;
  /** True when the visitor may edit Committee, Stats and Money (admin or editor). */
  canEdit: boolean;
  /** Token to send with committee/stats/money mutations: admin token first, else editor token. */
  editToken: string | null;
  go: (section: Section, playerId?: number) => void;
}

export const ClubContext = createContext<ClubState>({
  token: null,
  isAdmin: false,
  setToken: () => {},
  editorToken: null,
  isEditor: false,
  setEditorToken: () => {},
  canEdit: false,
  editToken: null,
  go: () => {},
});

export function useClub(): ClubState {
  return useContext(ClubContext);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  photoUrl,
  size = 56,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Photo of ${name}`}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="rounded-full flex items-center justify-center shrink-0 font-display font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "linear-gradient(145deg, #2e2e2e, #0a0a0a)",
        color: "var(--accent)",
        border: "1px solid var(--border)",
      }}
    >
      {initials(name)}
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function awardLabel(type: string): string {
  return type === "ballon_dor"
    ? "KUC Ballon d'Or"
    : type === "golden_boot"
      ? "KUC Golden Boot"
      : "KUC Golden Gloves";
}

export async function photoFromFile(
  file: File,
): Promise<{ dataBase64: string; mimeType: string }> {
  const result = await fileToBase64(file);
  return { dataBase64: result.dataBase64, mimeType: result.mimeType };
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card gold-ring w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-[14px] rise">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-[var(--surface)] z-10">
          <h3 className="font-display text-xl font-semibold tracking-wide uppercase">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-[var(--surface-2)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function GoldButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-[10px] font-semibold text-sm disabled:opacity-50"
      style={{ background: "var(--accent)", color: "#131313" }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-[10px] font-semibold text-sm border disabled:opacity-50"
      style={{
        borderColor: danger ? "var(--danger)" : "var(--border)",
        color: danger ? "var(--danger)" : "var(--text)",
        background: "var(--surface-2)",
      }}
    >
      {children}
    </button>
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm mt-2" style={{ color: "var(--danger)" }} role="alert">
      {message}
    </p>
  );
}

export function AdminGate({ what }: { what: string }) {
  const { go } = useClub();
  return (
    <div className="card p-4 flex flex-wrap items-center gap-3 justify-between">
      <p className="text-sm text-[var(--dim)]">
        Only the club admin can {what}. Log in to make changes — everything
        here stays visible to everyone.
      </p>
      <GoldButton onClick={() => go("admin")}>Admin login</GoldButton>
    </div>
  );
}

/**
 * Gate for the three editor sections (Committee, Stats, Money). Admins pass
 * silently; editors see their active-session bar; everyone else gets an
 * Editor Login form (or a note that the admin has not set an editor
 * password yet, with the admin login offered instead).
 */
export function EditorGate({ what }: { what: string }) {
  const { isAdmin, isEditor, editorToken, setEditorToken, go } = useClub();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ["editor-info", editorToken],
    queryFn: () =>
      api.getEditorInfo(editorToken ? { editorToken } : {}),
    enabled: !isAdmin,
  });

  const login = useMutation({
    mutationFn: async () => await api.loginEditor({ password }),
    onSuccess: (data) => {
      setEditorToken(data.token);
      setPassword("");
      setError(null);
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Editor login failed."),
  });
  const logout = useMutation({
    mutationFn: async () => await api.logoutEditor({ token: editorToken ?? "" }),
    onSuccess: () => {
      setEditorToken(null);
      void queryClient.invalidateQueries();
    },
  });

  if (isAdmin) return null;

  if (isEditor) {
    return (
      <div className="card p-4 flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm flex items-center gap-2">
          <PencilLine size={16} className="gold-text shrink-0" />
          Editor mode is on for this visit — you can {what}. It ends when
          this page is closed.
        </p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold underline"
        >
          <LogOut size={15} /> End editor session
        </button>
      </div>
    );
  }

  const editorSet = info.data?.editorSet ?? false;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-[var(--dim)]">
          {editorSet
            ? `Only the editor or the club admin can ${what}. Everything here stays visible to everyone.`
            : `Only the club admin can ${what} right now — no editor password has been set yet. Everything here stays visible to everyone.`}
        </p>
        <div className="flex gap-2">
          {editorSet && (
            <GoldButton onClick={() => setOpen(!open)}>Editor Login</GoldButton>
          )}
          <GhostButton onClick={() => go("admin")}>Admin login</GhostButton>
        </div>
      </div>
      {editorSet && open && (
        <form
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!password) {
              setError("Type the editor password.");
              return;
            }
            setError(null);
            login.mutate();
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 min-w-52">
            <label htmlFor="editor-login-pw">Editor password</label>
            <input
              {...FIELDS.loginEditor.password}
              id="editor-login-pw"
              aria-label="Editor password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <GoldButton type="submit" disabled={login.isPending}>
            {login.isPending ? "Logging in…" : "Log in as editor"}
          </GoldButton>
          <FieldError message={error} />
        </form>
      )}
    </div>
  );
}

/**
 * Lock prompt shown in place of an update form (player statistics,
 * committee, money) when the visitor is neither the admin nor an
 * unlocked editor. The form's fields are not rendered at all while this
 * is shown, so nothing can be changed or saved. Entering the editor
 * password unlocks editing for the visit (the same editor session the
 * section gates use); the admin login unlocks it too.
 */
export function FormLock({ what }: { what: string }) {
  const { setEditorToken, go } = useClub();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pwId = useId();

  const info = useQuery({
    queryKey: ["editor-info", "form-lock"],
    queryFn: () => api.getEditorInfo({}),
  });
  const editorSet = info.data?.editorSet ?? false;

  const login = useMutation({
    mutationFn: async () => await api.loginEditor({ password }),
    onSuccess: (data) => {
      setEditorToken(data.token);
      setPassword("");
      setError(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Editor login failed."),
  });

  return (
    <div className="text-center py-4">
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
        Locked
      </h4>
      <p className="text-sm text-[var(--dim)] mb-4 max-w-sm mx-auto">
        This screen is locked — you cannot change or save anything here yet.
        Enter the editor password to {what}, or log in as the club admin.
      </p>
      {info.isPending ? (
        <p className="text-sm text-[var(--dim)]">Checking…</p>
      ) : editorSet ? (
        <form
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!password) {
              setError("Type the editor password.");
              return;
            }
            setError(null);
            login.mutate();
          }}
          className="text-left space-y-3 max-w-sm mx-auto"
        >
          <div>
            <label htmlFor={pwId}>Editor password</label>
            <input
              {...FIELDS.loginEditor.password}
              id={pwId}
              aria-label="Editor password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FieldError message={error} />
          <div className="flex flex-wrap gap-2">
            <GoldButton type="submit" disabled={login.isPending}>
              {login.isPending ? "Unlocking…" : "Unlock"}
            </GoldButton>
            <GhostButton onClick={() => go("admin")}>Admin login</GhostButton>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--dim)] max-w-sm mx-auto">
            No editor password has been set yet, so only the club admin can
            unlock this screen.
          </p>
          <GhostButton onClick={() => go("admin")}>Admin login</GhostButton>
        </div>
      )}
    </div>
  );
}

export const POSITIONS = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
  "Winger",
  "Striker",
  "All-Rounder",
];
