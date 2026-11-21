const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../lib/usage.js');
const { UC_H5, UC_TOL } = U;
const D = Date.UTC;

test('heure', () => {
  assert.equal(U.heure(D(2026, 10, 21, 1, 9)), '02:09');
  assert.equal(U.heure(D(2026, 6, 1, 0, 9)), '02:09');
  assert.equal(U.heure(D(2026, 10, 24, 13, 0)), '14:00');
});

test('libelleJour', () => {
  assert.equal(U.libelleJour(D(2026, 10, 21, 1, 9), D(2026, 10, 20, 23, 30)), "aujourd'hui");
  assert.equal(U.libelleJour(D(2026, 11, 31, 23, 30), D(2026, 11, 31, 12, 0)), 'demain');
  assert.equal(U.libelleJour(D(2026, 10, 24, 13, 0), D(2026, 10, 21, 8, 47, 30)), 'mar. 24 nov.');
});

test('duree', () => {
  assert.equal(U.duree(6125000), '1 h 42 min 05 s');
  assert.equal(U.duree(2525000), '42 min 05 s');
  assert.equal(U.duree(5000), '5 s');
  assert.equal(U.duree(-1), '0 s');
  assert.equal(U.duree(274350000), '3 j 04 h 12 min');
});

test('age', () => {
  assert.equal(U.age(30e3), "à l'instant");
  assert.equal(U.age(180e3), 'il y a 3 min');
  assert.equal(U.age(7.5 * 3600e3), 'il y a 7 h');
});

test('pct', () => {
  assert.equal(U.pct(23.5), '24 %');
  assert.equal(U.pct(120), '100 %');
  assert.equal(U.pct(-3), '0 %');
  assert.equal(U.pct(NaN), '—');
  assert.equal(U.pct(undefined), '—');
  assert.ok(!U.pct(5).includes(' '));
});

test('etatFenetre', () => {
  const now = 1e12;
  assert.equal(U.etatFenetre(null, now), 'absente');
  assert.equal(U.etatFenetre({ resets_at_ms: now }, now), 'terminee');
  assert.equal(U.etatFenetre({ resets_at_ms: now + 1 }, now), 'active');
});

test('prochainsResets', () => {
  const hs = (r) => r.map((x) => U.heure(x.at));
  let now = D(2026, 10, 20, 23, 30);
  let r = U.prochainsResets({ resets_at_ms: D(2026, 10, 21, 1, 9) }, now);
  assert.deepEqual(hs(r), ['02:09', '07:09', '12:09', '17:09']);
  assert.deepEqual(r.map((x) => x.reel), [true, false, false, false]);

  now = D(2026, 10, 21, 20, 0);
  r = U.prochainsResets({ resets_at_ms: D(2026, 10, 21, 21, 0) }, now);
  assert.deepEqual(hs(r), ['22:00', '03:00', '08:00', '13:00']);
  assert.deepEqual(r.slice(1).map((x) => U.libelleJour(x.at, now)), ['demain', 'demain', 'demain']);

  for (const w of [null, { resets_at_ms: now - 1 }]) {
    r = U.prochainsResets(w, now);
    assert.deepEqual(r.map((x) => x.at), [1, 2, 3, 4].map((i) => now + i * UC_H5));
    assert.ok(r.every((x) => x.reel === false));
  }

  now = D(2027, 2, 27, 20, 0);
  assert.deepEqual(hs(U.prochainsResets({ resets_at_ms: D(2027, 2, 27, 23, 30) }, now)).slice(0, 2), ['00:30', '06:30']);
  now = D(2026, 9, 24, 20, 0);
  assert.deepEqual(hs(U.prochainsResets({ resets_at_ms: D(2026, 9, 24, 23, 30) }, now)).slice(0, 2), ['01:30', '05:30']);
});

test('lireFenetre', () => {
  assert.deepEqual(U.lireFenetre({ used_percentage: 23.5, resets_at: 1795000000 }), { used_percentage: 23.5, resets_at_ms: 1795000000000 });
  assert.equal(U.lireFenetre({ used_percentage: 5 }), null);
  assert.equal(U.lireFenetre({ used_percentage: 5, resets_at: 'abc' }), null);
  assert.equal(U.lireFenetre({ used_percentage: 5, resets_at: 0 }), null);
  assert.equal(U.lireFenetre(null), null);
});

test('fusionner', () => {
  const R = 1e12;
  const A = { used_percentage: 40, resets_at_ms: R };
  const B = { used_percentage: 5, resets_at_ms: R };
  assert.equal(U.fusionner(null, null), null);
  assert.deepEqual(U.fusionner(A, null), A);
  assert.deepEqual(U.fusionner(null, B), B);
  assert.deepEqual(U.fusionner(A, { used_percentage: 35, resets_at_ms: R + 60e3 }), { used_percentage: 40, resets_at_ms: R + 60e3 });
  const C = { used_percentage: 5, resets_at_ms: R + UC_H5 };
  assert.deepEqual(U.fusionner({ used_percentage: 90, resets_at_ms: R }, C), C);
  assert.ok(UC_TOL === 15 * 60e3);
});

test('majUsage', () => {
  const prev = { five_hour: { used_percentage: 10, resets_at_ms: 5e12 }, seven_day: { used_percentage: 20, resets_at_ms: 6e12 } };
  assert.equal(U.majUsage(prev, {}, 1), null);
  const u = U.majUsage(prev, { rate_limits: { five_hour: { used_percentage: 12, resets_at: 5e9 } } }, 42);
  assert.equal(u.vu_ms, 42);
  assert.deepEqual(u.seven_day, prev.seven_day);
  assert.equal(u.five_hour.used_percentage, 12);
});

test('ligneStatut', () => {
  const now = D(2026, 10, 20, 23, 30);
  const u = { five_hour: { used_percentage: 23.5, resets_at_ms: D(2026, 10, 21, 1, 9) }, seven_day: { used_percentage: 41.2, resets_at_ms: D(2026, 10, 24, 13, 0) } };
  assert.equal(U.ligneStatut(u, now), '5h 24 % (reset 02:09) | 7j 41 %');
  assert.equal(U.ligneStatut(u, D(2026, 10, 21, 2, 0)), '5h terminée | 7j 41 %');
  assert.equal(U.ligneStatut(null, now), 'usage: en attente');
  assert.equal(U.ligneStatut({ five_hour: null, seven_day: null }, now), '5h n/d | 7j n/d');
});
