// utils/partyKey.test.ts
// Unit tests for partyKey normalizer. Run with:
//   npx tsx --test src/utils/partyKey.test.ts
//
// All examples from Phase 2 v2.0 spec §8.2 are covered, plus edge cases.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { partyKey } from './partyKey';

describe('partyKey — spec §8.2 examples', () => {
  it('OLBERT METAL → olbert-metal', () => {
    assert.equal(partyKey('OLBERT METAL'), 'olbert-metal');
  });

  it('Olbert Metal Ltd. → olbert-metal', () => {
    assert.equal(partyKey('Olbert Metal Ltd.'), 'olbert-metal');
  });

  it('FedEx Freight Canada → fedex-freight-canada', () => {
    assert.equal(partyKey('FedEx Freight Canada'), 'fedex-freight-canada');
  });

  it('파인트리익스프레스(주) → 파인트리익스프레스', () => {
    assert.equal(partyKey('파인트리익스프레스(주)'), '파인트리익스프레스');
  });

  it('주식회사 ABC → abc', () => {
    assert.equal(partyKey('주식회사 ABC'), 'abc');
  });

  it('(유)한국물류 → 한국물류', () => {
    assert.equal(partyKey('(유)한국물류'), '한국물류');
  });

  it('empty string → unknown-party', () => {
    assert.equal(partyKey(''), 'unknown-party');
  });

  it('null → unknown-party', () => {
    assert.equal(partyKey(null), 'unknown-party');
  });

  it('undefined → unknown-party', () => {
    assert.equal(partyKey(undefined), 'unknown-party');
  });
});

describe('partyKey — English suffix edge cases', () => {
  it('strips trailing INC without punctuation', () => {
    assert.equal(partyKey('Acme INC'), 'acme');
  });

  it('strips trailing Inc.', () => {
    assert.equal(partyKey('Acme Inc.'), 'acme');
  });

  it('strips trailing LLC', () => {
    assert.equal(partyKey('Big Trucking LLC'), 'big-trucking');
  });

  it('strips multiple stacked suffixes', () => {
    // "Acme Co Ltd" should peel both
    assert.equal(partyKey('Acme Co Ltd'), 'acme');
  });

  it('does NOT strip suffix appearing mid-name', () => {
    // "Income Logistics" must not become "ome Logistics"
    assert.equal(partyKey('Income Logistics'), 'income-logistics');
  });

  it('does NOT strip "Inco" (suffix-like but longer)', () => {
    assert.equal(partyKey('Inco Group'), 'inco-group');
  });

  it('handles comma before suffix', () => {
    assert.equal(partyKey('Acme, Inc.'), 'acme');
  });
});

describe('partyKey — Korean suffix edge cases', () => {
  it('handles (주) at start', () => {
    assert.equal(partyKey('(주)현대물류'), '현대물류');
  });

  it('handles (주) at end', () => {
    assert.equal(partyKey('현대물류(주)'), '현대물류');
  });

  it('strips both Korean and English suffixes', () => {
    // Hypothetical mixed-form name
    assert.equal(partyKey('(주)Pinetree Express LTD'), 'pinetree-express');
  });

  it('handles 주식회사 with surrounding spaces', () => {
    assert.equal(partyKey('  주식회사   삼성   '), '삼성');
  });
});

describe('partyKey — character cleanup', () => {
  it('replaces & and other punctuation', () => {
    assert.equal(partyKey('S&J Transport'), 's-j-transport');
  });

  it('collapses multiple separators', () => {
    assert.equal(partyKey('A   B   C'), 'a-b-c');
  });

  it('trims leading/trailing whitespace', () => {
    assert.equal(partyKey('  Spaced  '), 'spaced');
  });

  it('handles digits', () => {
    assert.equal(partyKey('Logistics 2024'), 'logistics-2024');
  });

  it('handles unicode letters (Korean + English mix)', () => {
    assert.equal(partyKey('한국 Logistics'), '한국-logistics');
  });

  it('punctuation-only input → unknown-party', () => {
    assert.equal(partyKey('---'), 'unknown-party');
  });

  it('parens-only input → unknown-party', () => {
    assert.equal(partyKey('()'), 'unknown-party');
  });
});

describe('partyKey — case insensitivity', () => {
  it('case-insensitive on suffix detection', () => {
    assert.equal(partyKey('Acme inc'), 'acme');
    assert.equal(partyKey('Acme Inc'), 'acme');
    assert.equal(partyKey('Acme INC'), 'acme');
    assert.equal(partyKey('Acme InC.'), 'acme');
  });

  it('output is always lowercased for ASCII', () => {
    assert.equal(partyKey('UPPER CASE NAME'), 'upper-case-name');
    assert.equal(partyKey('MixedCase'), 'mixedcase');
  });
});

describe('partyKey — stability and idempotency', () => {
  it('is idempotent (running twice gives same result)', () => {
    const once = partyKey('Acme Industries Ltd.');
    const twice = partyKey(once);
    assert.equal(once, twice);
  });

  it('produces URL-safe output (no slashes, no spaces, no quotes)', () => {
    const inputs = [
      'Some/Slash Co.',
      'Tab\tinside',
      'Quoted "Name"',
      "Apostrophe's Co",
    ];
    for (const input of inputs) {
      const key = partyKey(input);
      assert.match(key, /^[\p{L}\p{N}-]+$/u, `"${input}" produced "${key}"`);
    }
  });
});
