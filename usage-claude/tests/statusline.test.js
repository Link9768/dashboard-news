const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SL = path.join(__dirname, '..', 'statusline.js');
const lancer = (input, dir) => spawnSync(process.execPath, [SL], { input, env: { ...process.env, USAGE_CLAUDE_DIR: dir }, encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'uc-sl-'));
const entree = (pct) => {
  const N = Math.floor(Date.now() / 1000);
  return JSON.stringify({ rate_limits: { five_hour: { used_percentage: pct, resets_at: N + 6125 }, seven_day: { used_percentage: 41.2, resets_at: N + 270000 } } });
};

test('entrée valide : ligne, usage.json et last-stdin.json', () => {
  const dir = tmp(), inp = entree(23.5);
  const r = lancer(inp, dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^5h 24 % \(reset \d\d:\d\d\) \| 7j 41 %\n$/);
  const u = JSON.parse(fs.readFileSync(path.join(dir, 'usage.json'), 'utf8'));
  assert.equal(u.five_hour.resets_at_ms, JSON.parse(inp).rate_limits.five_hour.resets_at * 1000);
  assert.equal(fs.readFileSync(path.join(dir, 'last-stdin.json'), 'utf8'), inp);
});

test('même fenêtre, % plus bas : garde le max', () => {
  const dir = tmp();
  lancer(entree(23.5), dir);
  lancer(entree(10), dir);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'usage.json'), 'utf8')).five_hour.used_percentage, 23.5);
});

test('sans rate_limits : fichier inchangé, ligne depuis le fichier', () => {
  const dir = tmp();
  lancer(entree(23.5), dir);
  const avant = fs.readFileSync(path.join(dir, 'usage.json'));
  const r = lancer('{"model":"x"}', dir);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'usage.json')), avant);
  assert.match(r.stdout, /^5h 24 %/);
});

test('JSON invalide : code 0, usage.json inchangé', () => {
  const dir = tmp();
  lancer(entree(23.5), dir);
  const avant = fs.readFileSync(path.join(dir, 'usage.json'));
  const r = lancer('pas du json', dir);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'usage: JSON invalide\n');
  assert.deepEqual(fs.readFileSync(path.join(dir, 'usage.json')), avant);
});

test('stdin vide : code 0, sortie non vide', () => {
  const r = lancer('', tmp());
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length > 1);
});

test('BOM accepté', () => {
  const r = lancer('\uFEFF' + entree(23.5), tmp());
  assert.match(r.stdout, /^5h 24 %/);
});
