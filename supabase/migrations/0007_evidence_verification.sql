-- RONI Bloque 1 (corrección) — migration 7: evidence verification flags
--
-- WHY THIS EXISTS: `policy_extracted_data_evidence` stored exactly what
-- the AI provider claimed — a page number and a snippet it says backs
-- a fact — and the Wallet UI presented every row identically, as if
-- "the model cited page 6" and "RONI independently confirmed page 6
-- exists and contains this text" were the same claim. They are not.
-- The reviewer's note: "no presentar una referencia inventada como
-- evidencia" and "no tratar la confianza declarada por el modelo como
-- garantía de precisión."
--
-- These two columns are set ONLY by server code, AFTER the model has
-- already responded — never part of the tool schema the model fills
-- in, so the model itself cannot mark its own citation "verified" (see
-- `lib/services/policy-extraction/verify-evidence.ts`):
--
--   page_verified    — true only when the cited page number is a real,
--                       in-range page of THIS document, checked against
--                       this app's own page count (from `pdf-parse`,
--                       independent of anything the model said). `null`
--                       when the document's real page count itself
--                       couldn't be determined (e.g. `pdf-parse` isn't
--                       available) — "unknown," never defaulted to true.
--   snippet_verified — true only when the cited snippet text was found,
--                      case/whitespace-insensitively, inside this app's
--                      own OCR text for that same page. `null` when no
--                      OCR text exists for that page to check against
--                      (e.g. a scanned page with no text layer) — not
--                      automatically false, since the fact could still
--                      be correct even if the honest answer is "we
--                      can't independently confirm it," and not
--                      automatically true either.
--
-- A row with both `true` is what the Wallet UI is allowed to label
-- "Verified." Anything else — including every row from before this
-- migration, which backfills both to `null` — must render as
-- "Unverified reference," never silently upgraded.

alter table public.policy_extracted_data_evidence
  add column if not exists page_verified boolean,
  add column if not exists snippet_verified boolean;

comment on column public.policy_extracted_data_evidence.page_verified is
  'Set by server code only, after the model responds: true iff the cited page number is within this document''s real, independently-known page count. Never set by the model itself.';
comment on column public.policy_extracted_data_evidence.snippet_verified is
  'Set by server code only, after the model responds: true iff the cited snippet was actually found in this app''s own OCR text for that page. Null when there was no OCR text for that page to check against.';
