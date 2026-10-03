/**
 * RONI Bloque 1 (corrección) — vendored, local replacement for the
 * upstream `node-ensure` npm package.
 *
 * WHY THIS EXISTS: `pdf-parse@1.1.1` (this app's PDF text-extraction
 * dependency, see `lib/services/document-text/pdf-parse-extractor.ts`)
 * lists `node-ensure@^0.0.0` as a hard, non-optional dependency in its
 * own `package.json` — confirmed by reading pdf-parse's real
 * `package.json` directly. `node-ensure` is not something pdf-parse's
 * own PDF-parsing logic calls directly; it's a shim for webpack's
 * `require.ensure(...)` code-splitting syntax, needed only because
 * pdf-parse vendors an old build of Mozilla's pdf.js that still
 * contains a `require.ensure(...)` call on one lazy-loaded code path.
 * `npm ci`/`npm install` failed trying to fetch this exact upstream
 * package from the registry (`pdf-parse@1.1.4` and `node-ensure@0.0.0`
 * in the reported error) — this file replaces the ENTIRE package with a
 * local, `file:`-referenced one (see the root `package.json`'s
 * `overrides` field), so npm never needs to reach the registry for it
 * at all, regardless of the exact reason the real one couldn't be
 * fetched there.
 *
 * FUNCTIONALLY IDENTICAL to the real thing: `node-ensure`'s own README
 * describes it as "super slim" — its entire job is patching
 * `require.ensure` onto Node's `require` when it isn't already present
 * (Node has no native `require.ensure`; only webpack's bundled
 * `require` does), so that a `require.ensure([...], callback)` call
 * written for webpack still runs correctly under plain Node — it just
 * calls the callback immediately and synchronously, since Node has no
 * separate "chunk" to lazily fetch in the first place. This is the same
 * minimal shim pattern used by equivalent, independently-published npm
 * packages solving this exact same webpack/Node compatibility gap.
 *
 * If pdf-parse's actual PDF-parsing code (used throughout this app's
 * real extraction, both automatic Anthropic-provider runs and the
 * `text-extract` fallback provider) never exercises that one
 * lazy-loaded pdf.js code path, this file is never even called at
 * runtime — it only has to exist so `require('node-ensure')` resolves
 * to *something* at install/require time.
 */
if (typeof require.ensure !== "function") {
  require.ensure = function nodeRequireEnsureShim(_modules, callback) {
    callback(require);
  };
}

module.exports = require.ensure;
