const UC_TZ = 'Europe/Paris';
const UC_H5 = 5 * 3600e3;
const UC_TOL = 15 * 60e3;

const p2 = (n) => String(n).padStart(2, '0');

function heure(ms) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: UC_TZ, hour: '2-digit', minute: '2-digit' }).format(ms);
}

function libelleJour(ms, now) {
  const jour = (t) => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: UC_TZ }).format(t).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const ecart = Math.round((jour(ms) - jour(now)) / 864e5);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return 'demain';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: UC_TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(ms);
}

function duree(ms) {
  const s = Math.floor(ms / 1000);
  if (s <= 0) return '0 s';
  const j = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  if (j) return `${j} j ${p2(h)} h ${p2(m)} min`;
  if (h) return `${h} h ${p2(m)} min ${p2(r)} s`;
  if (m) return `${m} min ${p2(r)} s`;
  return `${r} s`;
}

function age(ms) {
  if (ms < 60e3) return "à l'instant";
  if (ms < 3600e3) return `il y a ${Math.floor(ms / 60e3)} min`;
  return `il y a ${Math.floor(ms / 3600e3)} h`;
}

function pct(v) {
  if (!Number.isFinite(v)) return '—';
  return Math.min(100, Math.max(0, Math.round(v))) + ' %';
}

function etatFenetre(w, now) {
  if (!w) return 'absente';
  return w.resets_at_ms <= now ? 'terminee' : 'active';
}

function prochainsResets(w, now, n = 4) {
  const active = etatFenetre(w, now) === 'active';
  const base = active ? w.resets_at_ms : now + UC_H5;
  return Array.from({ length: n }, (_, i) => ({ at: base + i * UC_H5, reel: active && i === 0 }));
}

function lireFenetre(w) {
  if (!w || typeof w !== 'object') return null;
  const { used_percentage: u, resets_at: r } = w;
  if (!Number.isFinite(u) || !Number.isFinite(r) || r <= 0) return null;
  return { used_percentage: u, resets_at_ms: r * 1000 };
}

function fusionner(old, inc) {
  if (!inc) return old ?? null;
  if (old && Math.abs(inc.resets_at_ms - old.resets_at_ms) <= UC_TOL) {
    return { used_percentage: Math.max(old.used_percentage, inc.used_percentage), resets_at_ms: inc.resets_at_ms };
  }
  return inc;
}

function majUsage(prev, entree, now) {
  const rl = entree?.rate_limits;
  if (!rl) return null;
  return {
    vu_ms: now,
    five_hour: fusionner(prev?.five_hour, lireFenetre(rl.five_hour)),
    seven_day: fusionner(prev?.seven_day, lireFenetre(rl.seven_day)),
  };
}

function ligneStatut(u, now) {
  if (!u) return 'usage: en attente';
  const f = u.five_hour, s = u.seven_day;
  const e5 = etatFenetre(f, now), e7 = etatFenetre(s, now);
  const a = e5 === 'active' ? `5h ${pct(f.used_percentage)} (reset ${heure(f.resets_at_ms)})` : e5 === 'terminee' ? '5h terminée' : '5h n/d';
  const b = e7 === 'active' ? `7j ${pct(s.used_percentage)}` : e7 === 'terminee' ? '7j terminée' : '7j n/d';
  return `${a} | ${b}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UC_TZ, UC_H5, UC_TOL, heure, libelleJour, duree, age, pct, etatFenetre, prochainsResets, lireFenetre, fusionner, majUsage, ligneStatut };
}
