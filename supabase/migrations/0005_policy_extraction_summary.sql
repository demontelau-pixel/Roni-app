-- RONI M3.3 — migration 5: RONI Summary column
--
-- WHY THIS EXISTS: the M3.2 and M3.3 briefs both ask for a "RONI
-- Summary" — a factual, plain-language summary derived only from the
-- extracted policy facts — while also requiring (M3.2 principle 2,
-- restated in M3.3 §2) that "facts must be separated from AI
-- interpretation" and that "an AI opinion must never be stored as if
-- it were a contractual policy fact."
--
-- The summary is exactly that: an AI-authored piece of ANALYSIS, not
-- a fact the document asserts. Storing it as one more field inside
-- `policy_extracted_data.data` (the `AutoPolicyFacts` JSON) would
-- physically commingle it with real policy facts in the one place the
-- whole rest of this app treats as "structured facts, safe to read
-- without a disclaimer." Instead it gets its own column, right next
-- to `extracted_by`/`overall_confidence` (which are already
-- metadata-about-the-extraction, not facts-from-the-document) — a
-- structural separation, not just a documentation convention.
--
-- Additive and idempotent, same conventions as every migration here:
-- safe to run more than once, and safe on a database that already has
-- rows in `policy_extracted_data` (a `NULL` summary on an old row
-- means exactly what NULL already means everywhere else in this
-- schema — "not determined" — never "RONI has nothing to say").

alter table public.policy_extracted_data
  add column if not exists roni_summary text;

comment on column public.policy_extracted_data.roni_summary is
  'A plain-language, factual summary derived only from this row''s extracted facts. AI-authored analysis, not a policy fact — never treated as evidence-backed and never overwrites/is overwritten by manually-verified facts.';
