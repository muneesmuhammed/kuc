# KUC – Kalanja United Club

Official club management website for KUC (Kalanja United Club): players, stats,
money, internal club search, annual committees and annual awards.

## What it is

A full-stack app: a React client (`client/`), a Bun server (`server/`) and
Drizzle database migrations (`drizzle/`).

- **PLAYERS** — registered player profiles (photo, name, ID, age, position,
  phone, joining date, status). Only the admin can add, edit or remove players.
- **STATS** — per-player statistics, rankings, top scorer and best player.
- **MONEY** — weekly contribution of ₹10 per player, with PAID/UNPAID tracking.
- **GOOGLE** — internal-only search of the club database (never external results).
- **COMMITTEE** — annual committees (President, Vice President, Secretary,
  Joint Secretary, Treasurer, Joint Treasurer, Executive Members).
- **KUC ANNUAL AWARDS** — Ballon d'Or, Golden Boot, Golden Gloves.
- **Access** — the site opens through a barcode lock (code `KUC-REG-2025-001`).
  The admin password is created on first Admin visit; a separate editor
  password unlocks updating Committee, Stats and Money only.

## Run

Requires [Bun](https://bun.sh) 1.3+.

```sh
bun install
bun run typecheck
bun run build
```

## Notes

- Binary images (`client/src/assets/logo.png`, `crest.webp`, trophy images)
  are not in this repo — add them under `client/src/assets/` to restore the
  logo and trophy pictures.
- `drizzle/0005_set_admin_password_per_owner_request.sql` is intentionally
  not in this repo: it carries the live site's admin password hash. On a
  fresh setup the admin creates a password on first visit instead.
