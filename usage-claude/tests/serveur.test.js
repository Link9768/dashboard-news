const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { creerServeur } = require('../serveur.js');

test('serveur : liste blanche et usage.json', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-srv-'));
  fs.writeFileSync(path.join(dir, 'last-stdin.json'), '{}');
  const srv = creerServeur(dir);
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    let r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.equal((await fetch(base + '/lib/usage.js')).status, 200);
    assert.equal((await fetch(base + '/usage.json')).status, 404);
    fs.writeFileSync(path.join(dir, 'usage.json'), '{"vu_ms":1}');
    r = await fetch(base + '/usage.json');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(await r.text(), '{"vu_ms":1}');
    assert.equal((await fetch(base + '/usage.json?t=1')).status, 200);
    assert.equal((await fetch(base + '/serveur.js')).status, 404);
    assert.equal((await fetch(base + '/last-stdin.json')).status, 404);
  } finally {
    srv.close();
    srv.closeAllConnections();
  }
});
