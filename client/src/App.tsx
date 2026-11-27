import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
Activity,
Award as AwardIcon,
BarChart3,
Landmark,
Lock,
Search,
ShieldCheck,
Trophy,
Users,
Wallet,
} from "lucide-react";
import { api } from "./api";
import {
ClubContext,
awardLabel,
formatDate,
formatDateTime,
type ClubState,
type Section,
} from "./lib";
import { PlayersSection } from "./sections/Players";
import { StatsSection } from "./sections/Stats";
import { MoneySection } from "./sections/Money";
import { SearchSection } from "./sections/Search";
import { CommitteeSection } from "./sections/Committee";
import { AwardsSection } from "./sections/Awards";
import { AdminSection } from "./sections/Admin";
import { LockScreen } from "./sections/LockScreen";
import logoUrl from "./assets/logo.png";

const TOKEN_KEY = "kuc-admin-token";
const GATE_KEY = "kuc-site-unlocked";

const NAV: {
  id: Section;
  label: string;
  icon: typeof Users;
  lockable: boolean;
}[] = [
  { id: "players", label: "Players", icon: Users, lockable: false },
  { id: "stats", label: "Stats", icon: BarChart3, lockable: true },
  { id: "money", label: "Money", icon: Wallet, lockable: true },
  { id: "google", label: "Google", icon: Search, lockable: true },
  { id: "committee", label: "Committee", icon: Landmark, lockable: true },
  { id: "awards", label: "Awards", icon: Trophy, lockable: true },
];

function Dashboard({ go, unlocked }: { go: ClubState["go"]; unlocked: boolean }) {
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard({}),
  });
  const d = dash.data;

  const tiles: {
    id: Section;
    label: string;
    icon: typeof Users;
    blurb: string;
    lockable: boolean;
  }[] = [
    {
      id: "players",
      label: "PLAYERS",
      icon: Users,
      blurb: d ? `${d.playerCount} registered · ${d.activeCount} active` : "",
      lockable: false,
    },
    {
      id: "stats",
      label: "STATS",
      icon: BarChart3,
      blurb: "Rankings, top scorer & charts",
      lockable: true,
    },
    {
      id: "money",
      label: "MONEY",
      icon: Wallet,
      blurb: d ? `₹${d.totalCollected} collected so far` : "",
      lockable: true,
    },
    {
      id: "google",
      label: "GOOGLE",
      icon: Search,
      blurb: "Search the club records",
      lockable: true,
    },
    {
      id: "committee",
      label: "COMMITTEE",
      icon: Landmark,
      blurb: d?.currentCommittee
        ? `${d.currentCommittee.year} committee in office`
        : "No committee formed yet",
      lockable: true,
    },
  ];

  return (
    <div className="rise">
      {/* Hero */}
      <div className="relative text-center pt-2 pb-5">
        <div
          aria-hidden
          className="crescent absolute top-0 right-2 sm:right-10 w-12 h-12 sm:w-16 sm:h-16 opacity-90"
        />
        <img
          src={logoUrl}
          alt="KUC Kalanja club logo — a black-and-white striped shield with a football, five gold stars and a gold crescent moon"
          className="mx-auto w-40 sm:w-52 h-auto rounded-[18px] gold-ring"
        />
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wide mt-3">
          KUC <span className="gold-text">– KALANJA UNITED CLUB</span>
        </h1>
        <p className="text-[var(--dim)] mt-1 text-sm sm:text-base">
          One club. Every player, every rupee, every honour — in one place.
        </p>
      </div>

      {/* Five main sections */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        {tiles.map((t, i) => {
          const locked = t.lockable && !unlocked;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-label={
                locked
                  ? `${t.label} (locked — add a player first)`
                  : `Open ${t.label}`
              }
              className={`card p-4 sm:p-5 text-left relative hover:border-[var(--accent)] transition-colors ${
                i === 0 ? "col-span-2 lg:col-span-1 gold-ring" : ""
              }`}
            >
              <Icon size={30} className="gold-text mb-2" />
              <div className="font-display text-xl sm:text-2xl font-semibold tracking-wide">
                {t.label}
              </div>
              <p className="text-sm text-[var(--dim)] leading-snug">{t.blurb}</p>
              {locked && (
                <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">
                  <Lock size={14} /> Locked
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Awards banner */}
      <button
        type="button"
        onClick={() => go("awards")}
        aria-label={
          unlocked
            ? "Open KUC Annual Awards"
            : "KUC Annual Awards (locked — add a player first)"
        }
        className="card gold-ring w-full p-4 sm:p-5 mb-5 flex items-center gap-4 text-left hover:border-[var(--accent)] transition-colors"
      >
        <AwardIcon size={34} className="gold-text shrink-0" />
        <div className="flex-1">
          <div className="font-display text-2xl font-semibold tracking-wide gold-text">
            KUC ANNUAL AWARDS
          </div>
          <p className="text-sm text-[var(--dim)]">
            Ballon d'Or · Golden Boot · Golden Gloves
            {d && d.latestAwards.length > 0
              ? ` — latest: ${d.latestAwards
                  .map((a) => `${awardLabel(a.awardType)} ${a.year}: ${a.playerName}`)
                  .join(" · ")}`
              : ""}
          </p>
        </div>
        {!unlocked && <Lock size={18} className="text-[var(--dim)] shrink-0" />}
      </button>

      {!unlocked && (
        <div
          className="card p-4 mb-5 text-sm"
          style={{ borderColor: "var(--accent)" }}
          role="note"
        >
          <strong className="gold-text">Player-first club:</strong> STATS, MONEY,
          GOOGLE, COMMITTEE and AWARDS unlock as soon as the first player is
          registered in PLAYERS.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          ["Total players", d ? String(d.playerCount) : "—"],
          ["Total money collected", d ? `₹${d.totalCollected}` : "—"],
          [
            "Expected this week",
            d ? `₹${d.expectedThisWeek} (${d.playerCount} × ₹10)` : "—",
          ],
          ["Pending this week", d ? `₹${d.pendingThisWeek}` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="font-display text-2xl sm:text-3xl font-semibold">{value}</div>
            <div className="text-xs uppercase tracking-wide text-[var(--dim)]">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Current committee */}
        <div className="card p-4">
          <h2 className="font-display text-xl uppercase tracking-wide flex items-center gap-2 mb-2">
            <Landmark size={18} className="gold-text" /> Current committee
          </h2>
          {d?.currentCommittee ? (
            <>
              <p className="text-sm text-[var(--dim)] mb-2">
                {d.currentCommittee.year} committee
              </p>
              <ul className="text-sm space-y-1">
                {d.currentCommittee.members.slice(0, 7).map((m, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-[var(--dim)]">{m.position}</span>
                    <span className="font-semibold">{m.playerName}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="text-sm gold-text underline mt-2"
                onClick={() => go("committee")}
              >
                View full committee
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--dim)]">
              No committee has been formed yet.
              {unlocked ? " The admin can create one in COMMITTEE." : ""}
            </p>
          )}
        </div>

        {/* Activity */}
        <div className="card p-4">
          <h2 className="font-display text-xl uppercase tracking-wide flex items-center gap-2 mb-2">
            <Activity size={18} className="gold-text" /> Club activity
          </h2>
          {d && d.activity.length > 0 ? (
            <ul className="text-sm space-y-2">
              {d.activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{a.message}</span>
                  <span className="text-[var(--dim)] shrink-0">
                    {formatDateTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--dim)]">
              Nothing yet — club activity will appear here as players are
              registered and payments are recorded.
              {d ? ` Current week starts ${formatDate(d.currentWeekStart)}.` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [section, setSection] = useState<Section>("home");
  const [focusPlayerId, setFocusPlayerId] = useState<number | null>(null);
  const [gateOpen, setGateOpenState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(GATE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const setGateOpen = (open: boolean) => {
    setGateOpenState(open);
    try {
      // Session-only: the lock screen greets every new visit; the unlock
      // lasts for this browser session (reloads included), never longer.
      if (open) sessionStorage.setItem(GATE_KEY, "1");
      else sessionStorage.removeItem(GATE_KEY);
    } catch {
      // storage unavailable; unlock lasts for this visit only
    }
  };
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const setToken = (t: string | null) => {
    setTokenState(t);
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage unavailable; session lasts for this visit only
    }
  };

  // Editor session: memory only — never stored, so editor mode ends when
  // the page is closed or reloaded.
  const [editorToken, setEditorToken] = useState<string | null>(null);

  const auth = useQuery({
    queryKey: ["auth-status", token],
    queryFn: () => api.getAuthStatus(token ? { token } : {}),
  });
  const isAdmin = auth.data?.isAdmin ?? false;

  const editorInfo = useQuery({
    queryKey: ["editor-info", editorToken],
    queryFn: () => api.getEditorInfo(editorToken ? { editorToken } : {}),
  });
  const isEditor = editorInfo.data?.isEditor ?? false;
  const canEdit = isAdmin || isEditor;
  const editToken = isAdmin ? token : editorToken;

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard({}),
  });
  const unlocked = dash.data?.unlocked ?? false;

  const go: ClubState["go"] = (target, playerId) => {
    const lockable = NAV.find((n) => n.id === target)?.lockable ?? false;
    if (lockable && !unlocked) {
      setSection("players");
      setFocusPlayerId(null);
      window.scrollTo({ top: 0 });
      return;
    }
    setSection(target);
    setFocusPlayerId(playerId ?? null);
    window.scrollTo({ top: 0 });
  };

  const club = useMemo<ClubState>(
    () => ({
      token,
      isAdmin,
      setToken,
      editorToken,
      isEditor,
      setEditorToken,
      canEdit,
      editToken,
      go,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, isAdmin, editorToken, isEditor, canEdit, editToken, unlocked],
  );

  const navButton = (item: (typeof NAV)[number]) => {
    const locked = item.lockable && !unlocked;
    const active = section === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.id)}
        aria-current={active ? "page" : undefined}
        aria-label={locked ? `${item.label} (locked)` : item.label}
        className="relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-1.5 rounded-[10px] font-display font-semibold tracking-wide uppercase text-[13px] sm:text-base flex-1 sm:flex-none"
        style={{
          color: active ? "#131313" : locked ? "var(--dim)" : "var(--text)",
          background: active ? "var(--accent)" : "transparent",
        }}
      >
        <Icon size={18} />
        <span>{item.label}</span>
        {locked && <Lock size={11} className="absolute top-0.5 right-0.5" />}
      </button>
    );
  };

  return (
    <ClubContext.Provider value={club}>
      {!gateOpen ? (
        <LockScreen onUnlock={() => setGateOpen(true)} />
      ) : (
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 pt-safe bg-black/95 backdrop-blur border-b border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go("home")}
              className="flex items-center gap-2.5 min-w-0"
              aria-label="KUC home"
            >
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-auto rounded-[6px] shrink-0"
              />
              <span className="font-display font-bold text-base sm:text-xl tracking-wide truncate">
                KUC <span className="gold-text">– KALANJA UNITED CLUB</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => go("admin")}
              aria-label={isAdmin ? "Admin (logged in)" : "Admin login"}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border shrink-0"
              style={{
                borderColor: isAdmin ? "var(--accent)" : "var(--border)",
                color: isAdmin ? "var(--accent)" : "var(--text)",
              }}
            >
              <ShieldCheck size={16} />
              <span className="hidden sm:inline">{isAdmin ? "Admin ✓" : "Admin"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGateOpen(false);
                setSection("home");
                setFocusPlayerId(null);
              }}
              aria-label="Lock site"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border shrink-0"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              <Lock size={16} />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
          {/* Desktop nav */}
          <nav
            aria-label="Club sections"
            className="hidden sm:flex max-w-6xl mx-auto px-4 pb-2 gap-1"
          >
            <button
              type="button"
              onClick={() => go("home")}
              aria-current={section === "home" ? "page" : undefined}
              className="px-3 py-1.5 rounded-[10px] font-display font-semibold tracking-wide uppercase text-base"
              style={{
                color: section === "home" ? "#131313" : "var(--text)",
                background: section === "home" ? "var(--accent)" : "transparent",
              }}
            >
              Home
            </button>
            {NAV.map(navButton)}
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 pt-4 pb-24 sm:pb-10">
          {section === "home" && <Dashboard go={go} unlocked={unlocked} />}
          {section === "players" && (
            <PlayersSection focusPlayerId={focusPlayerId} />
          )}
          {section === "stats" && <StatsSection />}
          {section === "money" && <MoneySection />}
          {section === "google" && <SearchSection />}
          {section === "committee" && <CommitteeSection />}
          {section === "awards" && <AwardsSection />}
          {section === "admin" && <AdminSection />}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Club sections"
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] pb-safe"
        >
          <div className="flex px-1 py-1">{NAV.map(navButton)}</div>
        </nav>
      </div>
      )}
    </ClubContext.Provider>
  );
}
