#!/usr/bin/env node
/**
 * Guards the Persian translation: every `t('…')` call in the UI files must have
 * an entry in src/i18n.js. Run it after touching any screen.
 *
 *   node scripts/check-i18n.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const UI_FILES = [
  'App.js',
  path.join('src', 'screens', 'HomeScreen.js'),
  path.join('src', 'screens', 'SettingsScreen.js'),
  path.join('src', 'screens', 'HelpScreen.js'),
  path.join('src', 'screens', 'LockScreen.js'),
  path.join('src', 'components', 'Drawer.js'),
  path.join('src', 'components', 'DonateSheet.js'),
  path.join('src', 'components', 'DebugLogSection.js'),
  path.join('src', 'components', 'ui.js'),
];

function loadDictionary() {
  const source = fs
    .readFileSync(path.join(root, 'src', 'i18n.js'), 'utf8')
    .replace(/export\s+/g, '');
  const sandbox = { module: { exports: {} }, exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', `${source}\nmodule.exports.KEYS = Object.keys(FA);`)(
    sandbox.module,
    sandbox.exports
  );
  return new Set(sandbox.module.exports.KEYS);
}

function usedKeys() {
  const keys = new Set();
  for (const relative of UI_FILES) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const matcher = /(?:^|[^\w.])t\(\s*'((?:[^'\\]|\\.)*)'/gs;
    let match;
    while ((match = matcher.exec(source)) !== null) {
      keys.add(match[1].replace(/\\'/g, "'"));
    }
  }
  return keys;
}

const dictionary = loadDictionary();
const used = usedKeys();
const missing = [...used].filter((key) => !dictionary.has(key)).sort();

if (missing.length > 0) {
  console.error(`${missing.length} untranslated string(s):`);
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}

console.log(`i18n OK — ${used.size} UI strings, ${dictionary.size} translations.`);
