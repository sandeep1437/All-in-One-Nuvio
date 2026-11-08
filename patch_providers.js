/**
 * patch_providers.js
 * ==================
 * Run this ONCE after forking the repo.
 * It automatically adds filterStreams() to every provider file.
 *
 * Usage:
 *   node patch_providers.js
 *
 * It is safe to run multiple times — it skips already-patched files.
 */

const fs   = require('fs');
const path = require('path');

const PROVIDERS_DIR = path.join(__dirname, 'providers');
const FILTER_IMPORT = `const { filterStreams } = require('./_filters');\n`;

// Files to skip — these are utility/filter files, not scrapers
const SKIP_FILES = ['_filters.js'];

// ── Patch strategies ─────────────────────────────────────────────────────────
// We try multiple return patterns since providers are written differently.
// Each strategy is tried in order; first match wins.

const RETURN_PATTERNS = [
  // Pattern 1: "return streams;" or "return results;" or "return streamList;" etc.
  {
    regex: /(\breturn\s+)(streams|results|streamList|streamResults|finalStreams|allStreams|streamData|data|output|links|list|arr)(\s*;)/g,
    replace: (match, ret, varName, semi) => `${ret}filterStreams(${varName})${semi}`,
  },
  // Pattern 2: "return []" or "return [...]" (inline array return at end of getStreams)
  // Only inside getStreams-like functions — handled carefully below
  {
    regex: /(\breturn\s+\[\s*\]\s*;)/g,
    replace: (match) => match, // skip empty returns — nothing to filter
  },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
let patched   = 0;
let skipped   = 0;
let alreadyDone = 0;
let errors    = 0;

// ── Main ──────────────────────────────────────────────────────────────────────

function patchFile(filePath) {
  const fileName = path.basename(filePath);

  if (SKIP_FILES.includes(fileName)) {
    console.log(`  ⏭  Skipped (utility):  ${fileName}`);
    skipped++;
    return;
  }

  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error(`  ✗  Read error:         ${fileName} — ${e.message}`);
    errors++;
    return;
  }

  // ── Already patched? ──────────────────────────────────────────────────────
  if (src.includes("require('./_filters')") || src.includes('require("./_filters")')) {
    console.log(`  ✓  Already patched:    ${fileName}`);
    alreadyDone++;
    return;
  }

  // ── Does this file have a getStreams function? ────────────────────────────
  const hasGetStreams = /function\s+getStreams\b/.test(src) ||
                        /getStreams\s*[:=]\s*(async\s+)?function/.test(src) ||
                        /getStreams\s*[:=]\s*(async\s+)?\(/.test(src) ||
                        /async\s+function\s+getStreams\b/.test(src);

  if (!hasGetStreams) {
    console.log(`  ⚠  No getStreams():    ${fileName} — skipping`);
    skipped++;
    return;
  }

  let modified = src;
  let returnPatched = false;

  // ── Apply return pattern replacements ────────────────────────────────────
  for (const strategy of RETURN_PATTERNS) {
    const regex = new RegExp(strategy.regex.source, strategy.regex.flags);
    const newSrc = modified.replace(regex, strategy.replace);
    if (newSrc !== modified) {
      modified = newSrc;
      returnPatched = true;
    }
  }

  // ── Fallback: wrap module.exports = { getStreams } style ─────────────────
  // Some providers use Promise chains ending in .then(streams => streams)
  // Try to find the last meaningful return inside getStreams scope
  if (!returnPatched) {
    // Try wrapping ".then(function(streams) { return streams; })" style
    const thenReturn = modified.replace(
      /\.then\(\s*(function\s*\([^)]*\)\s*\{[\s\S]*?\breturn\s+)([\w.[\]]+)(\s*;[\s\S]*?\})/g,
      (match, pre, varName, post) => {
        if (/filterStreams/.test(match)) return match; // already patched
        returnPatched = true;
        return match.replace(
          new RegExp(`\\breturn\\s+${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`),
          `return filterStreams(${varName});`
        );
      }
    );
    if (thenReturn !== modified) {
      modified = thenReturn;
      returnPatched = true;
    }
  }

  if (!returnPatched) {
    console.log(`  ⚠  No return found:    ${fileName} — import added, manual return wrap needed`);
    // Still add the import so the user just needs to wrap the return
  }

  // ── Add the import at the top ─────────────────────────────────────────────
  // Insert after any existing top-of-file require/import block
  // or just prepend if none exists
  if (modified.match(/^(const|var|let|import)\s+/m)) {
    // Add after the last top-level require/const block before functions
    modified = FILTER_IMPORT + modified;
  } else {
    modified = FILTER_IMPORT + '\n' + modified;
  }

  // ── Write back ────────────────────────────────────────────────────────────
  try {
    fs.writeFileSync(filePath, modified, 'utf8');
    if (returnPatched) {
      console.log(`  ✅ Patched:            ${fileName}`);
    } else {
      console.log(`  ⚠  Import only:        ${fileName} — wrap the return manually`);
    }
    patched++;
  } catch (e) {
    console.error(`  ✗  Write error:        ${fileName} — ${e.message}`);
    errors++;
  }
}

function run() {
  console.log('\n🔧 Nuvio Provider Patcher\n' + '─'.repeat(50));

  if (!fs.existsSync(PROVIDERS_DIR)) {
    console.error('\n✗ Could not find providers/ folder.');
    console.error('  Make sure you run this script from the ROOT of your forked repo.');
    console.error('  e.g.  cd All-in-One-Nuvio && node patch_providers.js\n');
    process.exit(1);
  }

  // Check _filters.js is present
  const filterPath = path.join(PROVIDERS_DIR, '_filters.js');
  if (!fs.existsSync(filterPath)) {
    console.error('\n✗ providers/_filters.js not found.');
    console.error('  Add _filters.js to your providers/ folder first, then re-run.\n');
    process.exit(1);
  }

  const files = fs.readdirSync(PROVIDERS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  console.log(`\nFound ${files.length} .js files in providers/\n`);

  for (const file of files) {
    patchFile(path.join(PROVIDERS_DIR, file));
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Patched:        ${patched}`);
  console.log(`✓  Already done:   ${alreadyDone}`);
  console.log(`⏭  Skipped:        ${skipped}`);
  if (errors > 0) {
    console.log(`✗  Errors:         ${errors}`);
  }
  console.log('\nDone! Commit and push your changes to GitHub.');
  console.log('Your Nuvio app will pick them up from your manifest URL.\n');
}

run();
