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

- ~~**M2** — Marketplace: category picker, quote flow, ranked results.~~ ✅ done, see below.
- **M3** — Wallet: policy list, upload flow, policy detail (coverage /
  deductibles / benefits / exclusions / documents / renewal /
  activity).
- **M4** — Ask Roni (scripted, no real AI yet) + Profile (needs,
  privacy, rewards).
- **Later, explicitly not before this is stable**: Supabase
  (auth + database), real AI for Ask Roni and policy-photo reading,
  and real insurance quoting APIs.

---

## M2 — Marketplace, with Auto as the first working vertical

M2 makes **Auto** a complete, click-through fictional quoting
experience, and lays out the architecture every other category will
reuse. Per the M2 brief: still no Supabase, no real auth, no real
insurance APIs, no real AI, no payments.

### What M2 adds

```
src/app/(app)/market/
├── page.tsx                        REPLACED: real 8-category grid (was a placeholder)
└── auto/
    ├── layout.tsx                    wraps the flow in AutoQuoteProvider
    ├── page.tsx                       Step 1 — Vehicle
    ├── driver/page.tsx                 Step 2 — Driver
    ├── priorities/page.tsx              Step 3 — Priorities
    └── results/
        ├── page.tsx                      ranked/sortable results + compare bar
        ├── [optionId]/page.tsx            plan details
        └── compare/page.tsx                side-by-side comparison (?ids=a,b,c)

src/lib/
├── types.ts                        + InsuranceOption, PurchaseMode, PriorityKey,
│                                      AutoVehicleAnswers, AutoDriverAnswers
├── data/
│   ├── auto-options.ts               FICTIONAL Auto catalog (Plan A/B/C + sponsored)
│   └── categories.ts                 + full 8-category Marketplace metadata
├── services/
│   └── quote-provider.ts              InsuranceQuoteProvider interface — the seam
│                                       a real Bindable/carrier integration plugs
│                                       into later, without touching any UI
├── logic/
│   ├── rank-options.ts                transparent priority-based ranking + sorting
│   └── ask-roni-scripted.ts           scripted (non-AI) contextual Q&A about a quote
└── state/
    └── auto-quote-context.tsx         React Context: vehicle/driver/priorities
                                        survive navigation within the Auto flow

src/components/
├── ui/  TextField, SelectField, Modal                (new, generic)
└── roni/ PriorityPicker, StepProgress, OptionResultCard,
         CompareTable, OptionAskRoni, PurchaseActionSheet,
         HowRoniMakesMoney                              (new, product-specific)
```

### Files modified (not new)

- `src/components/ui/Icon.tsx` — added `moto`, `plane`, `chevronDown`,
  `close`, `info`, `lock`, `compare` icons (needed for the Marketplace
  grid and the new screens). Every M1 icon is untouched.
- `src/components/ui/Button.tsx` — added a `disabled` visual state
  (`opacity-40`, no pointer events). Purely additive.
- `src/lib/types.ts` — added the M2 types listed above, after the
  existing M1 types. Nothing M1 already used was changed or removed.
- `src/lib/data/categories.ts` — added `MARKETPLACE_CATEGORY_META` and
  `MARKETPLACE_CATEGORY_ORDER` for the 8-category grid. `CATEGORY_META`
  (what Home uses) is untouched.
- `src/components/roni/MonitoringTeaser.tsx` — **one line**: the
  "Compare options" button on Home now links to
  `/market/auto/results` instead of `/market`, since that page now
  exists and is what that button always meant to point at. This is the
  only change to the M1 Home experience, and it's the specific
  exception the M2 brief allowed ("do not modify... unless technically
  necessary").
- `src/app/(app)/market/page.tsx` — replaced the M1 "Coming soon"
  placeholder with the real Marketplace grid described above.

### Architecture decisions

- **`InsuranceQuoteProvider`** (M2 spec §11): an interface with one
  method, `getOptions(category)`. Today only
  `FictionalQuoteProvider` exists, returning the fixed Auto catalog.
  When a real data partner is ready, a new class implementing the same
  interface (e.g. `BindableQuoteProvider`) replaces the one line that
  constructs `quoteProvider` — no page or component changes.
- **Ranking is transparent, not a black box** (§5, §14): `rankOptions`
  returns, for every option, *which* of the user's priorities it
  scores well on (`strongPriorities`), so the UI can say "matches your
  priorities: lower price" instead of just reordering things silently.
  Nothing is ever labeled "best."
- **Ask Roni stays scripted** (§9): `answerScriptedQuestion` is a pure
  function over the fictional catalog already in `lib/data` — there is
  no network call, no AI SDK, nothing async about it.
- **Compare state lives in the URL** (`?ids=a,b,c`), not in React
  Context — so the comparison page works on refresh/share within the
  session, without needing any backend to persist it.
- **Vehicle/driver/priority answers live in React Context**
  (`AutoQuoteProvider`), scoped to `/market/auto/*` via that route's
  own `layout.tsx`. Per the brief (§12): no database persistence,
  session-only, and it resets if you leave and come back later.

### What was verified, and what wasn't

Same limitation as M1: no internet access in the environment this was
written in, so `npm install` / `next build` / `tsc` could not be run
against the real packages. What was checked by hand/script instead:

- Every `@/...` import across the **entire** project (M1 + M2) resolves
  to a file that exports the name being imported.
- Every `href` / `router.push` target used anywhere in the app has a
  matching `page.tsx`.
- Every component using React hooks is marked `"use client"`.
- No secrets anywhere in the new files.
- Every new fictional-data file/module is labeled as such, and every
  `InsuranceOption` carries `isFictional: true`.

**The Vercel build (after you push) is still the real test.** If it
fails, paste the exact error back.

### Known limitations of this milestone

- Only Auto has a working quote flow. The other 7 categories show
  "Coming soon" and are intentionally not clickable.
- The Auto catalog is fixed (4 fictional options) — sorting and
  ranking work, but there's no pagination or filtering by carrier.
- "Continue with carrier" and "Buy with RONI" only open an explanatory
  modal — no real handoff exists yet (there's nowhere real to hand off
  to).
- Refreshing a step of the quote flow (vehicle/driver/priorities)
  loses progress on that step, by design — nothing is saved until a
  real backend exists.
- The comparison page trusts whatever `ids` are in the URL; unknown or
  malformed ids are silently dropped rather than erroring, which is
  intentional for a prototype but would want tightening later.

---

## M2.5 Phase A — Health, powered by the real CMS Marketplace API

This is RONI's first category backed by **real external data** — no
fictional catalog. Everything else (Auto, Home dashboard, the rest of
the app) is unchanged.

### 1. Files added

```
src/lib/
├── types.ts                              + Health types (see §2 below) — additive only
├── utils.ts                              + formatMoneyOrUnavailable() — additive only
├── logic/
│   └── validate-health-criteria.ts        request-shape validation, no schema library
├── services/
│   ├── quote-provider.ts                  doc comment only — no behavior change
│   ├── health-quote-provider.ts           HealthQuoteProvider interface + CMSMarketplaceProvider
│   └── cms/
│       ├── types.ts                        raw CMS wire types, isolated from RONI's types
│       ├── client.ts                       SERVER-ONLY CMS HTTP client (imports `server-only`)
│       └── normalize.ts                    pure CMS → HealthPlan mapping, no I/O
└── state/
    └── health-quote-context.tsx            React Context for the Health quote flow

src/app/
├── api/health/
│   ├── market-years/route.ts               GET  — coverage years (cached 1h, no PII)
│   ├── counties/route.ts                   POST — ZIP → county/counties
│   ├── search/route.ts                     POST — real plan search
│   └── plans/[planId]/route.ts             POST — real plan details w/ premium
└── (app)/market/health/
    ├── layout.tsx                          wraps the flow in HealthQuoteProvider
    ├── page.tsx                             Step 1 — Location (real county lookup)
    ├── about-you/page.tsx                    Step 2 — Applicant
    ├── household/page.tsx                     Step 3 — Household size + income
    └── results/
        ├── page.tsx                            real plans, sort/filter, CMS attribution
        └── [planId]/page.tsx                    real plan details

src/components/roni/
├── CmsAttribution.tsx        "data provided by CMS" badge (two sizes)
├── HealthQuoteErrorState.tsx  friendly error display + optional retry
└── HealthPlanCard.tsx         result card for a real plan
```

### Files modified

- `package.json` — added one dependency: **`server-only`** (official,
  tiny Next.js package). Importing it in `cms/client.ts` and
  `health-quote-provider.ts` makes the **build itself fail** if either
  file is ever pulled into a client bundle — this isn't just a
  convention, it's enforced.
- `.env.example` — added `CMS_MARKETPLACE_API_KEY=` with no value, and
  a comment warning never to prefix it `NEXT_PUBLIC_`.
- `src/lib/data/categories.ts` — removed the `comingSoon: true`
  override for `health`, so it's now clickable from the Marketplace
  grid. Nothing else in that file changed.
- `src/app/(app)/market/page.tsx` — **one bug fix**: every functional
  category card used to link to the hardcoded `/market/auto`. With
  two functional categories now, each card links to `/market/${key}`
  instead. Auto's behavior is unaffected (`/market/auto` either way).
- `src/lib/services/quote-provider.ts` — doc-comment only, explaining
  how `HealthQuoteProvider` relates to it. No exported symbol changed.

**The Auto quote flow itself (`/market/auto/*`) was not touched.**

### 2. Architecture

```
Browser (client components)
    │  fetch("/api/health/search", { method: "POST", body: criteria })
    │  — same-origin request, no API key anywhere in this call
    ▼
RONI Route Handlers  (src/app/api/health/*/route.ts)
    │  validate the request shape, call the provider
    ▼
HealthQuoteProvider interface  (src/lib/services/health-quote-provider.ts)
    │  only implementation today: CMSMarketplaceProvider
    ▼
CMS client  (src/lib/services/cms/client.ts)  ← the ONLY file that reads
    │  reads process.env.CMS_MARKETPLACE_API_KEY, adds it as a query
    │  param, calls CMS, enforces a 10s timeout, throws typed errors
    ▼
CMS Marketplace API (marketplace.api.healthcare.gov)
    │  raw JSON response
    ▼
Normalizer  (src/lib/services/cms/normalize.ts)  — pure functions,
    │  CMS's raw `Plan` shape → RONI's `HealthPlan`, nulls for
    │  anything CMS didn't return
    ▼
HealthQuoteProvider returns `HealthPlan[]` back up through the route
handler → JSON response → client components render `HealthPlanCard`
```

Two design choices worth calling out:

- **`HealthQuoteProvider` is a sibling of `InsuranceQuoteProvider`
  (Auto), not the same interface.** Auto's `getOptions(category)` has
  no room for a real household/place/year, which CMS requires. Both
  are the same *pattern* — one interface, one real or fictional
  implementation behind it — applied to two different request shapes.
  A future private Health carrier provider would implement
  `HealthQuoteProvider`, the same way a future `BindableQuoteProvider`
  would implement `InsuranceQuoteProvider`.
- **Real data gets the same transparency treatment as fictional
  data.** Every `HealthPlan` carries `isReal: true`, `source: "cms"`,
  and a year — the mirror image of `InsuranceOption`'s
  `isFictional: true`. Nothing in RONI's data layer is ever
  ambiguous about where it came from.

### 3. Exact CMS endpoints used

All from CMS's published spec
(`developer.cms.gov/public-apis/documentation/marketplace-api`), base
URL `https://marketplace.api.healthcare.gov/api/v1`:

| Endpoint | Method | Used for |
|---|---|---|
| `/market-years` | GET | Populating the coverage-year selector |
| `/counties/by/zip/{zipcode}` | GET | Resolving a ZIP to its county/counties (CMS requires county FIPS, not just ZIP) |
| `/plans/search` | POST | The results list — `household`, `market: "Individual"`, `place`, `year` |
| `/plans/{plan_id}` | POST | Plan details, with premium/tax-credit calculated for the household |

Nothing invented — no endpoint here is assumed; each one is named and
shaped exactly as CMS's own OpenAPI spec documents it (e.g. auth is a
query parameter named `apikey`, not a header, because that's what CMS
requires).

### 4. What's real vs. calculated

- **Directly from CMS, unmodified:** issuer name, plan name, plan
  type, metal level, `premium` (before credit), deductible amounts,
  max out-of-pocket amounts, benefit cost-sharing text, HSA
  eligibility, national network flag, quality rating, benefit/network
  URLs.
- **Also from CMS, but only when household income was provided:**
  `premium_w_credit` (premium after an estimated tax credit) — this
  number comes from CMS's own subsidy calculation, not RONI's.
- **Calculated by RONI, not returned by CMS directly:**
  `estimatedTaxCredit` is simple subtraction
  (`monthlyPremiumBeforeCredit − monthlyPremium`), computed
  client-invisible on the server so the UI can say "~$X/mo estimated
  credit" without asking the person to do math. This is the only
  derived number in the whole Health flow.
- **Never fabricated:** any CMS field RONI's normalizer doesn't find
  becomes `null`, and the UI shows "Not available" — never a guess,
  never a zero standing in for "unknown."

### 5. Security — the API key never reaches client code

- The key is read in exactly one place: `process.env.CMS_MARKETPLACE_API_KEY`
  inside `src/lib/services/cms/client.ts`, a file that starts with
  `import "server-only"`. That import makes Next.js **refuse to
  build** if this file (or anything that imports it) is ever bundled
  for the browser — this is a compiler-enforced guarantee, not just a
  promise in a comment.
- No client component (`"use client"`) imports `lib/services/cms/*`
  or `lib/services/health-quote-provider.ts` anywhere — verified by
  script, not just by eye (see §7).
- The browser only ever calls RONI's own `/api/health/*` routes,
  same-origin, with no key in the request.
- Every route handler returns RONI's own typed `{ ok, data | error }`
  envelope — never CMS's raw response body or raw error object — so
  there's no path by which a CMS-side detail (let alone the key) could
  leak through a response.
- The key is never logged anywhere (checked — see §7) and never
  returned in a response body.
- `.env.local` stays in `.gitignore` (inherited from M1, confirmed
  still present); `.env.example` only documents the variable's name.

### 6. Known limitations

- **One applicant only.** The Health flow quotes for a single person;
  adding a spouse or dependents to the household is future work — CMS
  supports it, RONI's UI doesn't collect it yet.
- **County disambiguation only, no address-level precision.** Some
  ZIP codes span multiple counties/rate areas; RONI asks the person to
  pick when that happens, but doesn't do a full address lookup.
- **No provider/drug search.** "Network" only shows CMS's
  `has_national_network` flag — a real provider-directory or drug-
  coverage lookup (CMS has endpoints for both) is out of scope here.
- **CMS API keys expire every 60 days** (per CMS's own docs) — this is
  an operational note for whoever manages the production key, not
  something RONI's code can prevent.
- **No caching of search results** beyond the market-years endpoint —
  every search/detail request hits CMS live, which is what CMS's docs
  say the API is meant for, but it does mean no offline fallback.
- Household income, if entered, is sent to CMS for that one request
  and is not stored by RONI anywhere (no database yet in this
  milestone) — worth keeping in mind once persistence exists later.

### 7. Testing instructions

Same constraint as M1/M2: no internet access in the environment this
was written in, so `npm install` / `next build` / `tsc` could not be
run against the real packages, and no live CMS request could be made
(also no API key available here). What **was** verified, by script:

- Every `@/...` import across the whole project resolves to a real
  export (including every new M2.5 file).
- Every route/layout/API route file is where Next.js expects it.
- Every component using React hooks is `"use client"`.
- `CMS_MARKETPLACE_API_KEY` appears in exactly two places: the reader
  in `cms/client.ts`, and the empty declaration in `.env.example` —
  nowhere else in the codebase, and never with a `NEXT_PUBLIC_` prefix.
- No `"use client"` file imports anything from `lib/services/cms/` or
  `health-quote-provider.ts`.
- No `console.log/warn/error` calls exist in the CMS client or the
  Health provider.
- Every API route's error responses use RONI's own written messages,
  never a CMS response passed through.

**What you need to actually test it end-to-end:**

1. Confirm `CMS_MARKETPLACE_API_KEY` is set in your Vercel project's
   environment variables (Production **and** Preview, if you test on
   a preview deploy) — Settings → Environment Variables. If you're
   testing locally instead, put it in `.env.local` (already
   git-ignored).
2. `npm install` (pulls in the one new dependency, `server-only`).
3. `npm run build` — this is the real test: it will fail loudly if
   anything is structurally wrong, and it's also the build that would
   catch the key ever ending up somewhere it shouldn't.
4. Once deployed: go to Marketplace → Health → enter a real US ZIP
   code (e.g. `43215`) → continue through the three steps → you
   should see real plans with real prices. Try a ZIP with no
   Marketplace plans, or skipping income, to see the empty-state and
   before/after-credit UI.
5. To confirm the key truly never reaches the browser: open browser
   dev tools → Network tab while using the Health flow → inspect the
   `/api/health/search` request and response — there should be no
   `apikey` parameter and no key value anywhere in what the browser
   sent or received.

Do not consider this milestone complete until `npm run build` passes
in your environment — paste the exact error back here if it doesn't,
and it'll be fixed against that specific error.

---

## M2.5 Phase A — post-review correction

Two issues were found on review of the overlay before installation.
This section documents what was actually wrong, what wasn't, and
exactly what changed.

### 1. Plan details endpoint — verified, not changed

**Finding as reported:** the current CMS docs show plan details as
`GET /plans/{plan_id}`, but the implementation used `POST`.

**What was actually verified** (live re-fetch of
`developer.cms.gov/public-apis/documentation/marketplace-api` during
this correction, not from memory): CMS's current published OpenAPI
spec documents **two** operations at the same path,
`/plans/{plan_id}`:

- `GET` — *"Get a plan's basic details, no premium or APTC
  calculated."*
- `POST` — *"Get a plan's details, with premium and tax credit
  calculated,"* body: `household`, `place`, `market`, `year` (the same
  shape `/plans/search` takes), x-summary: *"Get plan details with
  premiums for a household."*

RONI's implementation already used the documented `POST` operation —
correctly, on purpose, so the plan-details page can show the same
household-specific premium the results list showed, rather than
falling back to an unsubsidized, one-size-fits-all price. This is not
an invented endpoint; it's CMS's own documented household-aware
variant of plan details, sitting at the same path as the simpler
`GET`. The likely source of the discrepancy: CMS's own "Quickstart"
narrative section on that page only walks through the plain `GET`
example — the `POST` variant is real but easy to miss unless you read
the full path listing.

**Change made:** none to the endpoint or method. Added a code comment
in `cms/client.ts` quoting the spec directly next to `cmsPlanDetails`,
so this doesn't need re-verifying from scratch again.

### 2. Household size — real bug, fixed

**Finding confirmed correct.** `toCmsHousehold()` built
`people: [toCmsPerson(criteria)]` — always exactly one person — no
matter what the (cosmetic, never-actually-sent) "household size" field
on the Household step said. Every search for a household of 2+ was
silently priced as a household of 1.

**Root cause:** the Household step collected a headcount instead of
real per-person data, because CMS doesn't price a household from a
headcount at all — it needs each person's own age/dob and tobacco use
to calculate an accurate premium and subsidy.

**Fix, following CMS's own household guidance:** the fake "size"
field is gone. In its place, the Household step now lets the person
add real household members one at a time, each with their own date of
birth and tobacco-use answer — the same two fields (plus optional
gender) already collected for the primary applicant in "About you."
Nothing is fabricated: a member isn't included in the CMS request
until those fields are actually filled in (enforced by
`householdComplete` in the Health quote context and by
`validateHealthSearchCriteria` server-side). `relationship` is
deliberately still omitted — CMS's own docs say it's optional and that
omitting it just means "as accurate an eligibility determination as
possible without it," which is a legitimate, non-fabricated path,
not a gap RONI should paper over with a guessed value.

**Files changed:**
- `src/lib/types.ts` — `HealthHousehold` no longer has `size`; it now
  has `additionalMembers: HealthMember[]`, plus the new `HealthMember`
  type and an `emptyHealthMember()` helper.
- `src/lib/state/health-quote-context.tsx` — replaced `setHousehold`
  with `setIncome`, `addMember`, `updateMember`, `removeMember`, and a
  new `householdComplete` flag.
- `src/lib/services/health-quote-provider.ts` — `toCmsHousehold()`
  rewritten to build one real `CmsPerson` per applicant + each
  completed additional member, instead of just the applicant.
- `src/lib/logic/validate-health-criteria.ts` — validates
  `household.additionalMembers` (each needs age-or-dob and a
  tobacco-use answer) instead of the old free-text `size`.
- `src/app/(app)/market/health/household/page.tsx` — rebuilt: an
  "Add a household member" flow with a small card per person (date of
  birth, optional gender, tobacco use) instead of a number field.
- `src/lib/services/cms/client.ts` — comment only (see §1 above), no
  behavior change.

**Not changed:** the primary applicant's own fields, the Location and
About You steps, the search/results/details flow's structure, Auto,
Home, or anything outside Health.

### Exact CMS endpoints/methods in use after this correction

Unchanged from the original M2.5 delivery — all confirmed against a
fresh, live re-fetch of CMS's spec during this correction:

| Endpoint | Method |
|---|---|
| `/market-years` | GET |
| `/counties/by/zip/{zipcode}` | GET |
| `/plans/search` | POST |
| `/plans/{plan_id}` | POST *(the household-aware variant, confirmed documented — see §1 above)* |

### Verification performed for this patch

Same method as the original M2.5 delivery (no internet access in this
environment, so no `npm install`/`next build`/live CMS call could be
run here):

- Full-project import/export resolution re-checked after the patch —
  clean.
- No leftover code references to the removed `household.size` field
  (only an explanatory comment mentions the old name).
- Every component using React hooks still correctly marked
  `"use client"`.
- `CMS_MARKETPLACE_API_KEY` still appears in exactly the same two
  places as before (the reader in `cms/client.ts`, the empty
  declaration in `.env.example`) — this patch touches no
  authentication code.

`npm run build` in your environment is still the authoritative check.

