import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sourcePath = new URL(
  '../modules/focus-guard/android/src/main/java/com/focusblocker/guard/AdultFilter.kt',
  import.meta.url,
);
const source = readFileSync(sourcePath, 'utf8');

function parseAdultDomains(text) {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    /val\s+DOMAINS\s*:\s*List<String>\s*=\s*listOf\s*\(/.test(line),
  );
  assert.notEqual(startIndex, -1, 'AdultFilter.DOMAINS list was not found');

  const domains = [];
  let closed = false;

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('//')) continue;
    if (/^\)\s*$/.test(line)) {
      closed = true;
      break;
    }

    const match = line.match(/^"([^"]+)"\s*,?$/);
    if (!match) continue;

    const domain = match[1];
    if (!/^[a-z0-9.-]+$/.test(domain)) continue;
    if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) continue;
    if (domain === 'localhost' || domain === '*') continue;

    domains.push(domain);
  }

  assert.equal(closed, true, 'AdultFilter.DOMAINS closing parenthesis was not found');
  return domains;
}

test('AdultFilter.DOMAINS has 500+ clean, deduplicated, low-false-positive entries', () => {
  const domains = parseAdultDomains(source);
  const unique = [...new Set(domains)];

  assert.ok(
    domains.length >= 500,
    `expected at least 500 parsed domains, got ${domains.length}`,
  );
  assert.equal(unique.length, domains.length, 'duplicate domains found');
  assert.ok(
    domains.every((domain) => domain === domain.toLowerCase()),
    'non-lowercase domain found',
  );
  assert.ok(domains.every((domain) => domain.includes('.')), 'bare hostname without a dot found');
  assert.ok(domains.every((domain) => !domain.startsWith('www.')), 'www-prefixed domain found');

  for (const falsePositive of ['avaparse.ir', 'jannatkhah.ir']) {
    assert.ok(!domains.includes(falsePositive), `known false positive present: ${falsePositive}`);
  }
  for (const required of ['persiankitty.com', 'zooxhamster.com']) {
    assert.ok(domains.includes(required), `expected boundary domain missing: ${required}`);
  }
});

function parseAdultKeywords(text) {
  const start = text.indexOf('val KEYWORDS');
  assert.notEqual(start, -1, 'AdultFilter.KEYWORDS list was not found');
  const end = text.indexOf('val DOMAINS', start);
  const block = text.slice(start, end === -1 ? undefined : end);
  // Comment lines mention words like "animal" as examples; they are prose, not
  // keywords, so they must never be parsed as entries.
  return block
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .flatMap((line) => [...line.matchAll(/"([^"\n]+)"/g)].map((match) => match[1]));
}

test('bestiality coverage: domains are present and keywords stay explicit', () => {
  const domains = parseAdultDomains(source);
  const keywords = parseAdultKeywords(source);

  // Any domain whose own labels name the act, with an explicit sexual token.
  const explicit = /(bestial|beastial|zoophil|zoofil|zoosex|zooporn|zoo-|zoo\.|^zoo|animal)/;
  const sexual = /(sex|porn|xxx|nude|hardcore|xvideo|xnxx|tube|fuck|movie|video|clip|porno)/;
  const bestiality = domains.filter((domain) => {
    const labels = domain.split('.').slice(0, -1).join('.');
    return explicit.test(labels) && sexual.test(labels);
  });

  assert.ok(
    bestiality.length >= 150,
    `expected at least 150 bestiality-family domains, got ${bestiality.length}`,
  );

  for (const required of [
    'animalpornxxxsexvideos.club',
    'bestiality-sex.com',
    'zooporn.vip',
    'zoo-xvideos.com',
    'petsexvideos.com',
  ]) {
    assert.ok(domains.includes(required), `expected bestiality domain missing: ${required}`);
  }

  // English keyword layer must name the act outright.
  for (const required of ['bestiality', 'beastiality', 'zoophilia', 'animal sex', 'zoo porn']) {
    assert.ok(keywords.includes(required), `expected bestiality keyword missing: ${required}`);
  }

  // Persian keyword layer: «سکس» already covers every «سکس ...» phrase, so only
  // the words that do not contain it are needed.
  for (const required of ['حیوان‌بازی', 'حیوان‌خواهی', 'زوفیلیا']) {
    assert.ok(keywords.includes(required), `expected Persian bestiality keyword missing: ${required}`);
  }

  // False-positive guard: a bare animal word must never become a keyword — it
  // would close veterinary, pet-shop and wildlife pages.
  for (const forbidden of ['animal', 'dog', 'horse', 'zoo', 'حیوان', 'سگ', 'اسب']) {
    assert.ok(
      !keywords.includes(forbidden),
      `bare animal keyword must not be in the list: ${forbidden}`,
    );
  }
});
