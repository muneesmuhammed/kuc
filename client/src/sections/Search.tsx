import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, type ApiResponse } from "../api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../../server/src/actions";
import { FieldError, useClub, type Section } from "../lib";

const FIELDS = actionFields<typeof Actions>();

type SearchResults = ApiResponse<typeof api, "searchClub">["results"];

const KIND_STYLE: Record<string, string> = {
  Player: "#ffffff",
  Statistics: "#c9c9c9",
  Money: "#a6a6a6",
  Committee: "#7d7d7d",
  Award: "#e8e8e8",
  Club: "#8c8c8c",
};

export function SearchSection() {
  const { go } = useClub();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useMutation({
    mutationFn: async (q: string) => await api.searchClub({ query: q }),
    onSuccess: (data) => setResults(data.results),
    onError: (e) => setError(e instanceof Error ? e.message : "Search failed."),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!query.trim()) {
      setError("Type something to search the club records.");
      return;
    }
    setError(null);
    search.mutate(query.trim());
  };

  return (
    <section className="rise max-w-2xl mx-auto">
      <div className="text-center pt-4 pb-6">
        <h2 className="font-display text-5xl font-bold tracking-wide">
          KUC <span className="gold-text">GOOGLE</span>
        </h2>
        <p className="text-[var(--dim)] mt-2 text-sm">
          Search players, statistics, payments, committees and awards — inside
          the KUC club records only.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dim)]"
          />
          <input
            aria-label="Search KUC club records"
            {...FIELDS.searchClub.query}
            placeholder="Try a player name, “top scorer”, “President”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 py-3 text-base rounded-full"
            style={{ borderRadius: 999 }}
          />
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="px-5 rounded-full font-semibold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#131313" }}
        >
          {search.isPending ? "Searching…" : "Search"}
        </button>
      </form>
      <FieldError message={error} />

      {results !== null &&
        (results.length === 0 ? (
          <p className="text-[var(--dim)] text-center py-8">
            No club records match “{query}”. Try a player name, a position like
            President, or a year.
          </p>
        ) : (
          <ul className="space-y-2 mt-4">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    go(r.section as Section, r.playerId ?? undefined)
                  }
                  className="card p-4 w-full text-left hover:border-[var(--accent)] transition-colors"
                >
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: KIND_STYLE[r.kind] ?? "var(--dim)" }}
                  >
                    {r.kind}
                  </span>
                  <p className="font-display text-xl font-semibold leading-snug">
                    {r.title}
                  </p>
                  <p className="text-sm text-[var(--dim)]">{r.snippet}</p>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
