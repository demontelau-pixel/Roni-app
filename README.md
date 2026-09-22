# RONI — V0.1 (M1: Next.js migration)

**RONI — All your insurance. Made simple.**

This is the Next.js + TypeScript rebuild of the RONI prototype. It is
**M1 only**: a migration and an architecture foundation, not a
redesign and not a feature expansion. It intentionally does not yet
include Supabase, real authentication, real AI, or any insurance API —
see [Roadmap](#roadmap) below for what those look like.

## What's in this repo

```
roni-app/
├── legacy/                    the original single-file prototype, preserved as-is
│   ├── index.html               (byte-identical to the last published version)
│   └── PROTOTYPE-README.md
├── db-seed/                    fictional data previously used to seed the
│                                prototype's database — kept for reference /
│                                future migration, not read by the Next.js app
├── src/
│   ├── app/                    Next.js App Router
│   │   ├── layout.tsx            root HTML shell, fonts, metadata
│   │   ├── globals.css           design tokens (ported 1:1 from the prototype)
│   │   ├── page.tsx              welcome screen ("/")
│   │   └── (app)/                everything behind the nav
│   │       ├── layout.tsx          wraps children in AppStateProvider + AppShell
│   │       ├── home/page.tsx       ✅ built in M1 — the Home screen
│   │       ├── market/page.tsx     placeholder, real screen is M2
│   │       ├── wallet/page.tsx     placeholder, real screen is M3
│   │       ├── ask/page.tsx        placeholder, real screen is M4
│   │       └── profile/page.tsx    placeholder, real screen is M4
│   ├── components/
│   │   ├── layout/                Nav, AppShell (responsive app frame)
│   │   ├── ui/                    generic atoms: Button, Tag, Chip, Panel, Icon
│   │   └── roni/                  product-specific pieces: PolicyCard,
│   │                              InsuranceGlance, MonitoringTeaser,
│   │                              AskRoniTeaser, RoniAvatar, ComingSoon, Greeting
│   └── lib/
│       ├── types.ts               domain types (Policy, etc.)
│       ├── utils.ts                formatting helpers (money, dates)
│       ├── data/                  FICTIONAL sample data, isolated from logic
│       └── state/                 app-state.tsx — the one React Context in M1
├── public/roni-logo.webp        the official pug logo
├── package.json
├── next.config.ts / tsconfig.json / postcss.config.mjs / eslint.config.mjs
├── .env.example                  documents future env vars — no real values
└── .gitignore
```

## Architecture

```
UI (components/)
   ↓ reads types & calls formatting helpers from
application logic (lib/state, lib/utils)
   ↓ currently reads static, clearly-labeled
data (lib/data/*  — FICTIONAL SAMPLE DATA)
   ↓ will later be swapped for
future integrations (Supabase, auth, Ask Roni AI, insurance APIs)
```

Concretely, that means:

- **Every fictional value lives in `lib/data/`**, and every file/export
  there is commented `FICTIONAL SAMPLE DATA`. Components never
  hard-code carrier names, prices, or policy numbers inline.
- **`lib/types.ts`** describes the *shape* data must have — a `Policy`
  has a `isFictional: true` field today; a real policy from Supabase
  would satisfy the same `Policy` type without the UI changing.
- **State**: the only global client state is `lib/state/app-state.tsx`
  (a React Context holding the sample user). Per-screen interaction
  (like dismissing the "Roni found something" card) is local
  `useState` in the component that owns it — see `MonitoringTeaser.tsx`.
  No Redux/Zustand, per the agreed architecture.
- **Screens that don't exist yet** (Marketplace, Wallet, Ask Roni,
  Profile) render a small `ComingSoon` placeholder instead of 404ing,
  so the nav is fully clickable on both mobile and desktop widths.
  Every link that would normally point at one of those screens (e.g.
  "Open wallet") already points at the right route — the destination
  is just a placeholder until its milestone is built.

## Scope decisions made during the migration (per the M1 brief)

- **Tailwind v4, no `tailwind.config.ts`.** Tailwind 4 configures
  themes directly in CSS (`@theme` in `globals.css`) and no longer
  needs a JS config file for this project's needs — this is the
  current idiomatic setup, not a simplification of the original plan.
- **Nav breakpoint kept at exactly 900px** (`min-[900px]:` utilities),
  matching the original prototype's CSS breakpoint, rather than
  Tailwind's default `md:` (768px) — this preserves the original
  responsive behavior precisely.
- **The Home greeting ("Good morning, Alex.") is a small Client
  Component** (`Greeting.tsx`) that reads the visitor's local clock
  after mount. This matches the prototype's original behavior (which
  always used the browser's local time) and avoids a server/client
  time-zone mismatch that a Server Component couldn't avoid.
- **The "Roni found something" savings numbers** (3 comparable
  options, up to $37/month) are sourced from a small, explicitly
  labeled placeholder (`lib/data/monitoring.ts`) rather than a real
  ranking engine — the real engine is Marketplace/M2 scope.
- Rows/links that in the original prototype opened a specific policy
  or comparison screen (e.g. tapping a policy card) now point at the
  relevant M1 placeholder page (`/wallet`, `/market`) instead of a
  detail route that doesn't exist yet.

## Running locally (optional)

You said you want to avoid depending on local development, so this is
optional — the real verification for M1 is the Vercel build (see
below). If you do want to preview it locally:

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How to get this into GitHub (no local git required)

1. Go to your existing `roni-app` repository on GitHub.
2. Use **Add file → Upload files**, and drag in this whole project
   folder (`src/`, `public/`, `legacy/`, `db-seed/`, and every file at
   the root: `package.json`, `next.config.ts`, `tsconfig.json`,
   `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`,
   `.env.example`, this `README.md`). Modern GitHub's uploader accepts
   whole folders dragged from your file manager and preserves the
   folder structure.
3. If your browser doesn't let you drag a whole nested folder tree in
   one go, use the free **GitHub Desktop** app instead — it's a
   point-and-click GUI (no terminal): point it at your cloned/empty
   `roni-app` folder, copy these files in with your file manager, then
   click "Commit" and "Push" inside the app.
4. Commit directly to `main` (or a branch + pull request, if you'd
   rather review the diff before merging — GitHub's web UI supports
   creating a new branch from the same upload screen).

## How to connect Vercel (one-time)

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub login is
   simplest).
2. **Add New… → Project → Import Git Repository**, choose `roni-app`.
3. Vercel auto-detects Next.js — leave the default build settings
   (`next build`) as-is. No environment variables are required for M1
   (see `.env.example`; nothing in it is used yet).
4. Click **Deploy**. You'll get a public URL like
   `roni-app.vercel.app` (or `roni-app-<hash>.vercel.app`).
5. From then on, every push to `main` triggers a new deployment
   automatically — no further setup needed.

## What was verified, and what wasn't

I don't have internet/package-registry access in the environment I
wrote this in, so I could not run `npm install`, `next build`, or
`tsc` against the real Next.js/React/Tailwind packages. What I *did*
verify by hand:

- Every `@/...` import resolves to a file that exists and exports the
  name being imported (checked programmatically, not just by eye).
- Every internal `href="/..."` used in the app has a matching
  `page.tsx` under `src/app/`.
- Every component using React hooks (`useState`, `useEffect`,
  `usePathname`, `useRouter`, `useContext`) is marked `"use client"`.
- `package.json`, `tsconfig.json`, `next.config.ts`, and
  `postcss.config.mjs` were hand-reviewed for consistent, current,
  mutually-compatible versions (Next 15 / React 19 / TypeScript 5 /
  Tailwind 4).
- No API keys, passwords, or secrets anywhere in the repo (scanned
  programmatically); `.env.example` only documents variable *names*
  for later.
- Every fictional data file is explicitly commented as such, and
  `Policy` objects carry an `isFictional: true` field.
- `legacy/index.html` is byte-for-byte identical to the last published
  prototype (verified with a checksum).

**What I could not verify**, because it requires an actual Next.js
compiler and package installation:

- Whether `npm install` succeeds with these exact versions.
- Whether `next build` completes with zero TypeScript/ESLint errors.
- Whether the Tailwind v4 `@theme inline` mapping compiles to the CSS
  I expect.
- Actual rendering — no browser was used to look at this.

**The Vercel build is the authoritative check**, as agreed. If it
fails, paste the error output back and it'll be fixed directly against
that error rather than guessed at.

## Roadmap

- **M2** — Marketplace: category picker, quote flow, ranked results.
- **M3** — Wallet: policy list, upload flow, policy detail (coverage /
  deductibles / benefits / exclusions / documents / renewal /
  activity).
- **M4** — Ask Roni (scripted, no real AI yet) + Profile (needs,
  privacy, rewards).
- **Later, explicitly not before this is stable**: Supabase
  (auth + database), real AI for Ask Roni and policy-photo reading,
  and real insurance quoting APIs.
