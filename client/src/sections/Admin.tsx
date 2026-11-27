import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, PencilLine, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../../server/src/actions";
import { FieldError, GoldButton, useClub } from "../lib";

const FIELDS = actionFields<typeof Actions>();

export function AdminSection() {
  const { token, isAdmin, setToken } = useClub();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["auth-status", token],
    queryFn: () => api.getAuthStatus(token ? { token } : {}),
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorPw, setEditorPw] = useState("");
  const [editorConfirm, setEditorConfirm] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);

  const editorInfo = useQuery({
    queryKey: ["editor-info", null],
    queryFn: () => api.getEditorInfo({}),
    enabled: isAdmin,
  });
  const editorSet = editorInfo.data?.editorSet ?? false;

  const finishAuth = (data: { token: string }) => {
    setToken(data.token);
    setPassword("");
    setConfirm("");
    setError(null);
    void queryClient.invalidateQueries();
  };

  const setup = useMutation({
    mutationFn: async () => await api.setupAdmin({ password }),
    onSuccess: finishAuth,
    onError: (e) => setError(e instanceof Error ? e.message : "Setup failed."),
  });
  const login = useMutation({
    mutationFn: async () => await api.loginAdmin({ password }),
    onSuccess: finishAuth,
    onError: (e) => setError(e instanceof Error ? e.message : "Login failed."),
  });
  const logout = useMutation({
    mutationFn: async () => await api.logoutAdmin({ token: token ?? "" }),
    onSuccess: () => {
      setToken(null);
      void queryClient.invalidateQueries();
    },
  });
  const change = useMutation({
    mutationFn: async () =>
      await api.changePassword({
        token: token ?? "",
        currentPassword: currentPw,
        newPassword: newPw,
      }),
    onSuccess: () => {
      setCurrentPw("");
      setNewPw("");
      setError(null);
      setNotice("Password changed. Use the new password next time you log in.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not change password."),
  });
  const saveEditorPw = useMutation({
    mutationFn: async () =>
      await api.setEditorPassword({ token: token ?? "", password: editorPw }),
    onSuccess: () => {
      setEditorPw("");
      setEditorConfirm("");
      setEditorError(null);
      setEditorNotice(
        editorSet
          ? "Editor password changed. Editors use the new password from now on."
          : "Editor password created. Share it only with the person who will update the committee, stats and money.",
      );
      void queryClient.invalidateQueries({ queryKey: ["editor-info"] });
    },
    onError: (e) =>
      setEditorError(e instanceof Error ? e.message : "Could not save the editor password."),
  });

  const setupDone = status.data?.setupDone;

  if (isAdmin) {
    return (
      <section className="rise max-w-xl mx-auto">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2 mb-4">
          <ShieldCheck className="gold-text" /> Admin
        </h2>
        <div className="card gold-ring p-5 mb-4">
          <p className="font-semibold flex items-center gap-2">
            <ShieldCheck size={18} className="gold-text" /> You are logged in as admin
          </p>
          <p className="text-sm text-[var(--dim)] mt-1">
            You can add and edit players, update statistics, manage money,
            create committees and publish awards. Visitors without the
            password can only view.
          </p>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>

        <div className="card p-5 mb-4">
          <h3 className="font-display text-xl uppercase tracking-wide flex items-center gap-2 mb-3">
            <PencilLine size={18} className="gold-text" /> Editor password
          </h3>
          <p className="text-sm text-[var(--dim)] mb-3">
            {editorSet
              ? "An editor password is set. A person with it can update the Committee, Stats and Money sections (including marking payments PAID/UNPAID) — nothing else. Set a new one below to change it; changing it ends any editor session already open."
              : "Set an editor password to let someone update the Committee, Stats and Money sections (including marking payments PAID/UNPAID) without the admin password. An editor cannot add or change players, awards or any password."}
          </p>
          <form
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              if (editorPw.length < 6) {
                setEditorError("Editor password must be at least 6 characters.");
                return;
              }
              if (editorPw !== editorConfirm) {
                setEditorError("The two passwords do not match.");
                return;
              }
              setEditorError(null);
              setEditorNotice(null);
              saveEditorPw.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="editor-new-pw">
                {editorSet ? "New editor password" : "Create editor password"}
              </label>
              <input
                {...FIELDS.setEditorPassword.password}
                id="editor-new-pw"
                aria-label={editorSet ? "New editor password" : "Create editor password"}
                type="password"
                autoComplete="new-password"
                value={editorPw}
                onChange={(e) => setEditorPw(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="editor-confirm-pw">Confirm editor password</label>
              <input
                {...FIELDS.setEditorPassword.password}
                id="editor-confirm-pw"
                aria-label="Confirm editor password"
                type="password"
                autoComplete="new-password"
                value={editorConfirm}
                onChange={(e) => setEditorConfirm(e.target.value)}
              />
            </div>
            <FieldError message={editorError} />
            {editorNotice && (
              <p className="text-sm" style={{ color: "var(--success)" }} role="status">
                {editorNotice}
              </p>
            )}
            <GoldButton type="submit" disabled={saveEditorPw.isPending}>
              {saveEditorPw.isPending
                ? "Saving…"
                : editorSet
                  ? "Change editor password"
                  : "Create editor password"}
            </GoldButton>
          </form>
        </div>

        <div className="card p-5">
          <h3 className="font-display text-xl uppercase tracking-wide flex items-center gap-2 mb-3">
            <KeyRound size={18} className="gold-text" /> Change admin password
          </h3>
          <form
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              if (newPw.length < 6) {
                setError("New password must be at least 6 characters.");
                return;
              }
              setError(null);
              setNotice(null);
              change.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="adm-current">Current password</label>
              <input
                {...FIELDS.changePassword.currentPassword}
                id="adm-current"
            aria-label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="adm-new">New password</label>
              <input
                {...FIELDS.changePassword.newPassword}
                id="adm-new"
            aria-label="New password"
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <FieldError message={error} />
            {notice && (
              <p className="text-sm" style={{ color: "var(--success)" }} role="status">
                {notice}
              </p>
            )}
            <GoldButton type="submit" disabled={change.isPending}>
              {change.isPending ? "Changing…" : "Change password"}
            </GoldButton>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="rise max-w-md mx-auto">
      <h2 className="font-display text-3xl font-semibold uppercase tracking-wide flex items-center gap-2 mb-4">
        <ShieldCheck className="gold-text" /> Admin login
      </h2>
      <div className="card p-5">
        {status.isPending ? (
          <p className="text-[var(--dim)]">Checking…</p>
        ) : setupDone ? (
          <form
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              setError(null);
              login.mutate();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-[var(--dim)]">
              Enter the admin password to manage the club. Visitors can browse
              everything without logging in.
            </p>
            <div>
              <label htmlFor="adm-login-pw">Admin password</label>
              <input
                {...FIELDS.loginAdmin.password}
                id="adm-login-pw"
            aria-label="Admin password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <FieldError message={error} />
            <GoldButton type="submit" disabled={login.isPending || !password}>
              {login.isPending ? "Logging in…" : "Log in"}
            </GoldButton>
          </form>
        ) : (
          <form
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              if (password.length < 6) {
                setError("Choose a password of at least 6 characters.");
                return;
              }
              if (password !== confirm) {
                setError("The two passwords do not match.");
                return;
              }
              setError(null);
              setup.mutate();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-[var(--dim)]">
              No admin password exists yet. Create one now — you will need it
              to add players and manage the club. Keep it private and do not
              share it; you can change it later from this page.
            </p>
            <div>
              <label htmlFor="adm-setup-pw">Create admin password</label>
              <input
                {...FIELDS.setupAdmin.password}
                id="adm-setup-pw"
            aria-label="Create admin password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="adm-setup-confirm">Confirm password</label>
              <input
                {...FIELDS.setupAdmin.password}
                id="adm-setup-confirm"
            aria-label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <FieldError message={error} />
            <GoldButton type="submit" disabled={setup.isPending}>
              {setup.isPending ? "Creating…" : "Create password & log in"}
            </GoldButton>
          </form>
        )}
      </div>
    </section>
  );
}
