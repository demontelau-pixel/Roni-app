# RONI Prototype v0.5 — complete source

This is the full source for the currently published RONI artifact
(https://claude.ai/artifact/4FXJc1ChVFiLJmn2HjW3EE).

## Directory structure

```
roni-source/
├── README.md              this file
├── index.html             the entire application (HTML + CSS + JS, single file)
└── db-seed/                JSON documents currently stored in the artifact's
    │                       database (Claude.ai's built-in per-artifact DB,
    │                       accessed at runtime via window.claude / the
    │                       `db` capability — see "How persistence works" below)
    ├── tpl_defaults.json    default profile/needs/settings for a brand-new account
    ├── tpl_wallet.json      the 3 starter policies (auto, renters, health)
    ├── tpl_uploads.json     the 3 sample policies offered in the upload flow
    ├── tpl_flows.json       the quote-flow questions per insurance category
    ├── catalog_auto.json    fictional auto insurance products
    ├── catalog_home.json    fictional home insurance products
    ├── catalog_renters.json fictional renters insurance products
    ├── catalog_life.json    fictional life insurance products
    ├── catalog_health.json  fictional health insurance products
    └── catalog_pet.json     fictional pet insurance products
```

## How to reproduce the app

1. Open `index.html` directly in a browser, or publish it as a Claude.ai
   artifact.
2. `index.html` alone renders every screen and works with an empty/no
   database (it falls back to an "offline" state), but to see it fully
   populated (sample wallet, catalog, AI-ready), the JSON files in
   `db-seed/` need to be written into the artifact's database under:
   - `templates/defaults`  ← tpl_defaults.json
   - `templates/wallet`    ← tpl_wallet.json
   - `templates/uploads`   ← tpl_uploads.json
   - `templates/flows`     ← tpl_flows.json
   - `catalog/auto`        ← catalog_auto.json
   - `catalog/home`        ← catalog_home.json
   - `catalog/renters`     ← catalog_renters.json
   - `catalog/life`        ← catalog_life.json
   - `catalog/health`      ← catalog_health.json
   - `catalog/pet`         ← catalog_pet.json

   Outside the claude.ai artifact runtime, there is no `db`/`user`/`sample`
   capability available — those are specific to how Claude.ai hosts
   artifacts. Running `index.html` on a plain web server will show the
   UI, but account creation, the AI assistant, and the policy-photo
   reader will not function (see below).

## How persistence and AI work in this file (important caveat)

This prototype is built against Claude.ai's **artifact runtime
capabilities**, not a general-purpose backend:

- `window.claude.use('db')` — a per-artifact key/value database
  (`DB.db` in the code), used to store the catalog/templates and each
  user's private `profile`/`wallet` documents.
- `window.claude.use('user')` — gives the current viewer's id and
  whether they're the artifact owner/admin (`DB.user`).
- `window.claude.use('sample')` — lets the page ask a Claude model a
  question and get JSON back (`DB.sample`), used for the Ask Roni
  assistant and for reading policy photos.

These three only exist when the HTML is running **inside a published
Claude.ai artifact**. They are not real API endpoints you can call from
a normal website, there are no API keys embedded anywhere in the file,
and nothing here is a production backend. This is why the previous
messages in this conversation recommended treating this file as a
design/UX reference and rebuilding the real product on your own stack
(your own database, your own auth, your own server-side AI calls) —
see the earlier "plan" message for that roadmap.

## File count / size

- `index.html`: 1,451 lines / ~150 KB (HTML + inline `<style>` + inline
  `<script>`, no build step, no external JS dependencies except Google
  Fonts by CSS `@import`/`<link>`).
- `db-seed/*.json`: 10 files, ~26 KB total, fictional data only.

## Fictional data notice

Every carrier name, price, policy, and person in this prototype
(including the seed data) is fictional and was invented for this demo.
None of it reflects real insurance products or real quotes.
