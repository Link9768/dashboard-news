const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { majUsage, ligneStatut } = require('./lib/usage.js');

const dir = process.env.USAGE_CLAUDE_DIR || path.join(os.homedir(), '.claude', 'usage-claude');
const lire = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
let ligne;
try {
  const brut = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last-stdin.json'), brut);
  const prev = lire('usage.json');
  let entree = null;
  try { entree = JSON.parse(brut); } catch { ligne = 'usage: JSON invalide'; }
  if (!ligne) {
    const u = majUsage(prev, entree, Date.now());
    if (u) fs.writeFileSync(path.join(dir, 'usage.json'), JSON.stringify(u));
    ligne = ligneStatut(u || prev, Date.now());
  }
} catch { ligne = 'usage: erreur'; }
process.stdout.write(ligne + '\n');
