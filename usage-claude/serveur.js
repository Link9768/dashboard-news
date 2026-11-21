const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATIQUE = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/lib/usage.js': ['lib/usage.js', 'text/javascript; charset=utf-8'],
};

function creerServeur(dir) {
  return http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    let fichier = null, type = 'application/json';
    if (STATIQUE[p]) [fichier, type] = [path.join(__dirname, STATIQUE[p][0]), STATIQUE[p][1]];
    else if (p === '/usage.json') fichier = path.join(dir, 'usage.json');
    let corps = null;
    try { if (fichier) corps = fs.readFileSync(fichier); } catch {}
    if (corps) { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); return res.end(corps); }
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(p === '/usage.json' ? '{"absent":true}' : '{}');
  });
}

module.exports = { creerServeur };

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 8765;
  const dir = process.env.USAGE_CLAUDE_DIR || path.join(os.homedir(), '.claude', 'usage-claude');
  const ouvrir = () => { if (!process.env.NO_OPEN) require('child_process').exec('start "" "http://127.0.0.1:' + PORT + '/"'); };
  const srv = creerServeur(dir);
  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.log('Déjà lancé : http://127.0.0.1:' + PORT + '/'); ouvrir(); process.exit(0); }
    console.error('Erreur : ' + e.message); process.exitCode = 1;
  });
  srv.listen(PORT, '127.0.0.1', () => { console.log('Usage Claude : http://127.0.0.1:' + PORT + '/  (Ctrl+C pour arrêter)'); ouvrir(); });
}
