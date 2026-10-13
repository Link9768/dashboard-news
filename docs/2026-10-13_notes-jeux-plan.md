# Notes Jeux — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page web (GitHub Pages) où l'on tape un nom de jeu et qui affiche les notes Esprit Jeu / Philibert / BGG et les annonces Okkazeo à ≤ 10 km des Olympiades, alimentée par un webhook n8n.

**Architecture:** Front mono-fichier `index.html` sans build (comme tv-showtime). Back = un workflow n8n linéaire : Webhook GET → BGG (2 HTTP Request avec credential éventuelle + 2 Code) → Code « Boutiques & Okkazeo » (requêtes concurrentes via `this.helpers.httpRequest` + `Promise.allSettled`) → Respond to Webhook (JSON + CORS). La logique de parsing vit dans `notes-jeux/lib/*.js`, testée localement avec `node --test`, puis concaténée dans les nodes Code par `scripts/bundle.mjs` (le code testé = le code en prod).

**Tech Stack:** HTML/CSS/JS vanilla, Node 24 (`node:test`), n8n (instance `https://n8n.srv1250642.hstgr.cloud`, MCP `n8n-mcp`), geo.api.gouv.fr, GitHub Pages (`Link9768`).

**Spec:** `docs/2026-10-13_notes-jeux-dashboard-design.md`

## Global Constraints

- Toute création/modif de workflow passe par les outils MCP `n8n-mcp` ; config de node confirmée par `get_node` avant écriture (CLAUDE.md R1, R6).
- Webhook : `webhookId` UUID explicite `7c1e4a52-9d3b-4f6e-8a21-5b0c9e3d7f14`, path `notes-jeux`, méthode GET, paramètre `q`.
- Aucun secret dans un paramètre de node ni dans un fichier versionné : token BGG éventuel → credential n8n « Header Auth ».
- Un node Code doit toujours renvoyer au moins 1 item (sinon la suite ne s'exécute pas — CLAUDE.md §5).
- Une source en échec = `null` dans la réponse, jamais d'échec global.
- Choix produit : jeu de base par défaut ; normalisation minuscules/sans accents/sans ponctuation ; FR prioritaire ; accessoires exclus.
- Zone Okkazeo : centre Olympiades `48.8266, 2.3658`, rayon `10` km.
- Thème sombre uniquement. Layout « B » : notes à gauche / Okkazeo à droite ≥ 760 px, empilé en dessous.
- Repo : `Link9768/notes-jeux`, URL `https://link9768.github.io/notes-jeux/`.
- Chaque affirmation de résultat est étiquetée **vérifié / déduit / supposé** (CLAUDE.md §3).

## Review Focus

1. **Noms avec accents / chiffres / ponctuation** (« Château Combo », « 7 Wonders Duel », « Dixit: Odyssey ») → URL encodée partout, normalisation correcte, bon jeu trouvé. Test : Task 3 (unitaire) + Task 6 (exécution réelle « 7 Wonders Duel »).
2. **Jeu absent d'Okkazeo ou 0 annonce** → `okkazeo: {total:0, annonces:[]}` ou `null`, jamais de crash, l'encart affiche « 0 près de Paris ». Test : Task 4 (fixture vide) + Task 6 (`azertyuiop`).
3. **Okkazeo paginé** (jeu très vendu) → le total vient du JSON-LD (juste) même si la liste parsée est partielle. Test : Task 6 compare `annonces parsées` vs `offerCount` sur « Catane ».
4. **Un site lent ou muet** → timeout 10 s par requête, la réponse part quand même. Test : Task 4 (`fetchSafe` sur URL non routable).
5. **Deux recherches rapides successives** → seule la dernière réponse s'affiche. Test : Task 7 (deux submits enchaînés).

---

## Structure des fichiers

```
notes-jeux/                      ← repo git propre → Link9768/notes-jeux (comme tv-showtime/)
  index.html                     front mono-fichier
  lib/match.js                   normalize, isAccessory, pickProduct
  lib/jsonld.js                  extractJsonLd, findProduct, ratingOf, offersOf
  lib/okkazeo.js                 htmlToLines, parseAnnonces, filterParis
  lib/bgg.js                     parseBggSearch, bggCandidates, parseBggThings, pickBgg
  lib/cp-paris-10km.json         généré par scripts/build-cp-list.mjs
  lib/sites.js                   parseurs spécifiques Philibert / Esprit Jeu / Okkazeo-recherche (Task 4)
  n8n/code/*.body.js             corps des nodes Code (sans les libs)
  n8n/Notes Jeux API.json        export final du workflow
  scripts/build-cp-list.mjs
  scripts/bundle.mjs             concatène libs + body → code prêt à coller dans n8n
  tests/*.test.js, tests/fixtures/*
  docs/sources.md                résultats de la sonde (URLs, statuts, structure)
  CLAUDE.md                      contexte projet (comme tv-showtime/CLAUDE.md)
```

Convention lib : chaque fichier `lib/*.js` déclare des `function` top-level et finit par
`if (typeof module !== 'undefined' && module.exports) module.exports = { ... };`
→ `require` marche en test, et le texte brut est collable tel quel dans un node Code.

---

### Task 1 : Sonde d'accès n8n (gate du projet)

**Files:**
- Create: `notes-jeux/docs/sources.md`, `notes-jeux/tests/fixtures/` (HTML capturés)
- n8n : workflow jetable « TEST Notes Jeux — sonde »

**Interfaces:**
- Produces : `docs/sources.md` avec, pour chaque site, l'URL de recherche exacte, le statut HTTP vu depuis n8n, la présence de `application/ld+json` / `aggregateRating`, et les fixtures `tests/fixtures/{philibert-search-clank,philibert-product-clank,espritjeu-search-clank,espritjeu-product-clank,okkazeo-search-clank,okkazeo-clank,bgg-search-clank,bgg-thing-clank}.{html,xml}`.

- [ ] **Step 1 : Initialiser le dossier projet**

```bash
cd "c:/Users/JulesBATAILLE/OneDrive - Seize Consulting/Bureau/Vrac/N8n WF/N8N consultant"
mkdir -p notes-jeux/{lib,n8n/code,scripts,tests/fixtures,docs}
cd notes-jeux && git init -b main
```

- [ ] **Step 2 : Vérifier la syntaxe HTTP du node Code**

Charger le skill `n8n-code-javascript` et confirmer que `this.helpers.httpRequest({ url, headers, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 10000 })` est disponible dans le node Code de l'instance (sinon utiliser la forme indiquée par le skill et la reporter dans `docs/sources.md`). Confirmer le schéma du node Code avec `get_node` (`nodes-base.code`).

- [ ] **Step 3 : Créer la sonde (MCP `n8n_create_workflow`)**

Nodes : `Manual Trigger` → `Code « Sonde »` (mode *Run Once for All Items*), code :

```js
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};
const URLS = {
  okkazeo_home: 'https://www.okkazeo.com/',
  okkazeo_clank: 'https://www.okkazeo.com/jeux/16977/clank',
  philibert_search: 'https://www.philibertnet.com/fr/recherche?search_query=clank',
  espritjeu_home: 'https://www.espritjeu.com/',
  bgg_search: 'https://boardgamegeek.com/xmlapi2/search?query=clank&type=boardgame,boardgameexpansion',
};
const probe = async (name, url) => {
  try {
    const r = await this.helpers.httpRequest({ url, headers: UA, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 10000, json: false });
    const body = String(r.body ?? '');
    return {
      name, url, status: r.statusCode, length: body.length,
      cloudflare: /cf-chl|Just a moment/i.test(body),
      jsonld: (body.match(/application\/ld\+json/g) || []).length,
      aggregateRating: /aggregateRating/.test(body),
      hasClankCatacombes: /Clank! Catacombes/i.test(body),
      forms: [...body.matchAll(/<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)<\/form>/gi)]
        .map(m => ({ action: m[1], inputs: [...m[2].matchAll(/<input[^>]*name="([^"]+)"/gi)].map(x => x[1]) })).slice(0, 5),
      body,
    };
  } catch (e) { return { name, url, error: e.message }; }
};
const res = await Promise.all(Object.entries(URLS).map(([n, u]) => probe(n, u)));
return res.map(json => ({ json }));
```

- [ ] **Step 4 : Exécuter et lire** — `n8n_test_workflow` (ou exécution manuelle par Jules si le Manual Trigger n'est pas déclenchable par MCP), puis `n8n_executions` action get, mode full. Pour chaque item noter `status`, `cloudflare`, `jsonld`, `aggregateRating`, `hasClankCatacombes`, `forms`.

- [ ] **Step 5 : Gate — décider avant de continuer**

| Constat | Action |
|---|---|
| Okkazeo `403` ou `cloudflare: true` | **STOP.** Rapporter à Jules. Option : service de scraping (ex. Firecrawl, clé en credential n8n). Ne pas continuer Okkazeo sans son accord. |
| Philibert `hasClankCatacombes: false` (résultats rendus en JS) | **STOP Philibert.** Chercher l'endpoint JSON de recherche (onglet Réseau du navigateur sur la page de recherche) et le noter dans `sources.md` avant Task 4. |
| BGG `401`/`403` | Jules crée une application + token sur `https://boardgamegeek.com/applications` ; créer une credential n8n *Header Auth* « BGG API » (`Authorization: Bearer <token>`) — saisie par Jules dans l'UI n8n. |
| Esprit Jeu : aucun `form` avec un champ texte | Trouver l'URL de recherche à la main sur https://www.espritjeu.com/ (taper « clank », copier l'URL) et la noter. |

- [ ] **Step 6 : Seconde passe** — ajouter dans `URLS` l'URL de recherche Okkazeo et Esprit Jeu trouvées, une page produit Philibert « Clank! » (VF), une page produit Esprit Jeu « Clank! », `https://boardgamegeek.com/xmlapi2/thing?id=201808&stats=1` (avec la credential si nécessaire : dans ce cas BGG est sondé par un node HTTP Request séparé). Ré-exécuter.

- [ ] **Step 7 : Sauver les fixtures** — pour chaque item, écrire `body` dans `tests/fixtures/<name>.html|xml` (récupéré depuis l'exécution). Remplacer dans les fixtures Okkazeo les pseudos vendeurs par `vendeurA`, `vendeurB`… (données perso inutiles).

- [ ] **Step 8 : Écrire `docs/sources.md`** (URL de recherche par site, statut, où se trouvent note / nb d'avis / titre / langue, étiquette vérifié). Commit :

```bash
git add docs/sources.md tests/fixtures && git commit -m "Sonde d'accès n8n : sources, statuts et fixtures"
```

La sonde reste dans n8n désactivée ; demander à Jules avant de la supprimer.

---

### Task 2 : Liste des codes postaux ≤ 10 km des Olympiades

**Files:**
- Create: `notes-jeux/scripts/build-cp-list.mjs`, `notes-jeux/lib/cp-paris-10km.json`, `notes-jeux/tests/cp.test.js`

**Interfaces:**
- Produces : `lib/cp-paris-10km.json` = `{ "center": {"lat":48.8266,"lon":2.3658}, "radiusKm": 10, "cps": ["75001", …], "communes": [{"cp","nom","km"}] }`

- [ ] **Step 1 : Test d'abord** — `tests/cp.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../lib/cp-paris-10km.json');

test('centre et rayon', () => {
  assert.deepEqual(data.center, { lat: 48.8266, lon: 2.3658 });
  assert.equal(data.radiusKm, 10);
});
test('dedans : Paris 13e, Ivry, Montreuil, Créteil', () => {
  for (const cp of ['75013', '75018', '94200', '93100', '94000']) assert.ok(data.cps.includes(cp), cp);
});
test('dehors : Versailles, Savigny-sur-Orge, Argenteuil', () => {
  for (const cp of ['78000', '91600', '95100']) assert.ok(!data.cps.includes(cp), cp);
});
```

- [ ] **Step 2 :** `cd notes-jeux && node --test tests/cp.test.js` → FAIL (`Cannot find module '../lib/cp-paris-10km.json'`).

- [ ] **Step 3 : Script** — `scripts/build-cp-list.mjs`

```js
// Usage : node scripts/build-cp-list.mjs  → écrit lib/cp-paris-10km.json
import { writeFileSync } from 'node:fs';

const CENTER = { lat: 48.8266, lon: 2.3658 }; // Olympiades, Paris 13e
const RADIUS_KM = 10;
const DEPTS = ['75', '77', '78', '91', '92', '93', '94', '95'];

function km(a, b) {
  const r = x => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const communes = [];
for (const d of DEPTS) {
  const res = await fetch(`https://geo.api.gouv.fr/communes?codeDepartement=${d}&fields=nom,codesPostaux,centre&format=json`);
  if (!res.ok) throw new Error(`geo.api ${d} : HTTP ${res.status}`);
  for (const c of await res.json()) {
    if (!c.centre) continue;
    const [lon, lat] = c.centre.coordinates;
    const dist = km(CENTER, { lat, lon });
    if (dist <= RADIUS_KM) for (const cp of c.codesPostaux) communes.push({ cp, nom: c.nom, km: Math.round(dist * 10) / 10 });
  }
}
communes.sort((a, b) => a.km - b.km);
const cps = [...new Set(communes.map(c => c.cp))].sort();
writeFileSync(new URL('../lib/cp-paris-10km.json', import.meta.url),
  JSON.stringify({ center: CENTER, radiusKm: RADIUS_KM, cps, communes }, null, 2));
console.log(`${cps.length} codes postaux, ${communes.length} lignes`);
```

- [ ] **Step 4 :** `node scripts/build-cp-list.mjs` puis `node --test tests/cp.test.js` → PASS. Relire `communes` à l'œil (les 5 plus lointaines doivent être à 9–10 km).

- [ ] **Step 5 :** `git add scripts/build-cp-list.mjs lib/cp-paris-10km.json tests/cp.test.js && git commit -m "Liste des codes postaux à 10 km des Olympiades"`

---

### Task 3 : Choix automatique du produit (`lib/match.js`)

**Files:**
- Create: `notes-jeux/lib/match.js`, `notes-jeux/tests/match.test.js`

**Interfaces:**
- Produces : `normalize(s: string): string`, `isAccessory(title: string): boolean`, `pickProduct(query: string, candidates: {title, url, lang?: 'fr'|'en'}[]): candidate | null`

- [ ] **Step 1 : Test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, isAccessory, pickProduct } = require('../lib/match.js');

const clank = [
  { title: 'Clank! Catacombes', url: 'catacombes', lang: 'fr' },
  { title: 'Clank!', url: 'clank-en', lang: 'en' },
  { title: 'Clank!', url: 'clank-fr', lang: 'fr' },
  { title: 'Clank! - Pack de Stickers', url: 'stickers', lang: 'fr' },
  { title: 'Kit de pochettes pour Clank!', url: 'pochettes' },
  { title: 'Clank! Catacombes - Les Enfers', url: 'enfers', lang: 'fr' },
];

test('normalize', () => {
  assert.equal(normalize('Clank! : Catacombes'), 'clank catacombes');
  assert.equal(normalize('Château Combo'), 'chateau combo');
  assert.equal(normalize('Dixit: Odyssey'), 'dixit odyssey');
  assert.equal(normalize('Clank! (VF)'), 'clank');
  assert.equal(normalize('7 Wonders Duel'), '7 wonders duel');
});
test('jeu de base, VF prioritaire', () => assert.equal(pickProduct('clank', clank).url, 'clank-fr'));
test('extension demandée explicitement', () => assert.equal(pickProduct('Clank catacombes', clank).url, 'catacombes'));
test('tous les mots présents → le plus court', () => assert.equal(pickProduct('catacombes enfers', clank).url, 'enfers'));
test('accessoires exclus', () => {
  assert.ok(isAccessory('Kit de pochettes pour Clank!'));
  assert.ok(isAccessory('Clank! - Pack de Stickers'));
  assert.ok(!isAccessory('Clank! Catacombes'));
  assert.equal(pickProduct('clank', [{ title: 'Clank! - Pack de Stickers', url: 'x' }]), null);
});
test('requête absurde → null', () => assert.equal(pickProduct('azertyuiop', clank), null));
test('liste vide / requête vide → null', () => {
  assert.equal(pickProduct('clank', []), null);
  assert.equal(pickProduct('', clank), null);
});
```

- [ ] **Step 2 :** `node --test tests/match.test.js` → FAIL (module absent).

- [ ] **Step 3 : Implémentation** — `lib/match.js`

```js
// Choix automatique du produit. Collé tel quel en tête des nodes Code n8n (voir scripts/bundle.mjs).
const ACCESSORY_RE = /sleeve|pochette|sticker|autocollant|\bkit\b|feuille de score|piste de suivi|figurine|\bsacs?\b|insert|organiseur|playmat|tapis de jeu|goodies/i;

function normalize(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((vf|vo|fr|en|version francaise|version anglaise)\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isAccessory(title) {
  return ACCESSORY_RE.test(title || '');
}

function pickProduct(query, candidates) {
  const q = normalize(query);
  const pool = (candidates || []).filter(c => c && c.title && !isAccessory(c.title));
  if (!q || pool.length === 0) return null;
  const frFirst = (a, b) => (a.lang === 'fr' ? 0 : 1) - (b.lang === 'fr' ? 0 : 1);
  const exact = pool.filter(c => normalize(c.title) === q).sort(frFirst);
  if (exact.length) return exact[0];
  const words = q.split(' ');
  const all = pool
    .filter(c => { const t = ` ${normalize(c.title)} `; return words.every(w => t.includes(` ${w} `)); })
    .sort((a, b) => normalize(a.title).length - normalize(b.title).length || frFirst(a, b));
  return all[0] || null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, isAccessory, pickProduct };
```

- [ ] **Step 4 :** `node --test tests/match.test.js` → PASS.
- [ ] **Step 5 :** `git add lib/match.js tests/match.test.js && git commit -m "Choix automatique du produit (jeu de base, VF, accessoires exclus)"`

---

### Task 4 : Parseurs JSON-LD, Okkazeo et boutiques

**Files:**
- Create: `notes-jeux/lib/jsonld.js`, `notes-jeux/lib/okkazeo.js`, `notes-jeux/lib/sites.js`, `notes-jeux/tests/jsonld.test.js`, `notes-jeux/tests/okkazeo.test.js`, `notes-jeux/tests/sites.test.js`, `notes-jeux/tests/fixtures/okkazeo-listing.txt`

**Interfaces:**
- Consumes : fixtures et `docs/sources.md` (Task 1), `pickProduct` (Task 3), `lib/cp-paris-10km.json` (Task 2).
- Produces :
  - `extractJsonLd(html): object[]`, `findProduct(objs): object|null`, `ratingOf(product): {note:number, avis:number|null}|null`, `offersOf(product): {total, min, max}|null`
  - `htmlToLines(html): string[]`, `parseAnnonces(lines): Annonce[]`, `filterParis(annonces, cps: string[]): Annonce[]` (triées prix croissant)
  - `Annonce = {prix:number, etat:string, ville:string|null, cp:string|null, date:'YYYY-MM-DD'|null, bonneAffaire:boolean, extensions:boolean, envoi:boolean}`
  - `parsePhilibertSearch(html): {title,url,lang,note}[]`, `parseEspritJeuSearch(html): {title,url,lang}[]`, `parseOkkazeoSearch(html): {title,url}[]`

- [ ] **Step 1 : Fixture texte Okkazeo** (texte réel vu le 2026-10-13, pseudos anonymisés) — `tests/fixtures/okkazeo-listing.txt` :

```
14 annonces
Filtrer par
Occasion (13)
Neuf (1)
Jeu d'occasion (état correct)
40€00
Vendu par vendeurA
Calais (62100)
30/08/2026
0
Jeu d'occasion (état excellent)
65€00
Vendu par vendeurB
Toulouse (31400)
04/10/2026
6
Jeu d'occasion (état excellent)
20€00  bonne affaire
Vendu par vendeurC
Besançon (25000)
02/09/2026
1
Jeu d'occasion (état correct)
20€00  bonne affaire
Vendu par vendeurD
Envoi en France
Perpignan (66000)
30/09/2026
6
Jeu d'occasion (état excellent)
30€00
Vendu par vendeurE
Ivry-sur-Seine (94200)
06/04/2026
0
```

- [ ] **Step 2 : Tests** — `tests/okkazeo.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { htmlToLines, parseAnnonces, filterParis } = require('../lib/okkazeo.js');
const lines = fs.readFileSync(__dirname + '/fixtures/okkazeo-listing.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

test('parse les 5 annonces', () => {
  const a = parseAnnonces(lines);
  assert.equal(a.length, 5);
  assert.deepEqual(a[0], { prix: 40, etat: 'correct', ville: 'Calais', cp: '62100', date: '2026-08-30', bonneAffaire: false, extensions: false, envoi: false });
  assert.equal(a[2].bonneAffaire, true);
  assert.equal(a[3].envoi, true);
  assert.equal(a[3].ville, 'Perpignan');
});
test('filtre Paris + tri prix', () => {
  const a = filterParis(parseAnnonces(lines), ['94200', '75013']);
  assert.deepEqual(a.map(x => x.ville), ['Ivry-sur-Seine']);
});
test('page sans annonce → []', () => assert.deepEqual(parseAnnonces(['0 annonce', 'Vendre le vôtre']), []));
test('htmlToLines garde prix et ville sur leurs lignes', () => {
  const l = htmlToLines('<div>Jeu d\'occasion (état correct)</div><div>40€00 <span>bonne affaire</span></div><p>Vendu par x</p><div>Paris (75011)</div><script>var a="1€00"</script>');
  assert.deepEqual(l, ["Jeu d'occasion (état correct)", '40€00 bonne affaire', 'Vendu par x', 'Paris (75011)']);
});
test('fixture HTML réelle : nb parsé cohérent avec le JSON-LD', () => {
  const html = fs.readFileSync(__dirname + '/fixtures/okkazeo-clank.html', 'utf8');
  const { extractJsonLd, findProduct, offersOf } = require('../lib/jsonld.js');
  const total = offersOf(findProduct(extractJsonLd(html))).total;
  const n = parseAnnonces(htmlToLines(html)).length;
  assert.ok(n > 0 && n <= total, `${n} parsées / ${total}`);
});
```

`tests/jsonld.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJsonLd, findProduct, ratingOf, offersOf } = require('../lib/jsonld.js');

const okk = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Clank!","offers":{"@type":"AggregateOffer","priceCurrency":"EUR","lowPrice":20,"highPrice":190,"offerCount":14}}</script>';

test('offres Okkazeo (structure vérifiée le 2026-10-13)', () => {
  assert.deepEqual(offersOf(findProduct(extractJsonLd(okk))), { total: 14, min: 20, max: 190 });
});
test('aggregateRating', () => {
  const html = '<script type="application/ld+json">[{"@type":"BreadcrumbList"},{"@type":"Product","aggregateRating":{"ratingValue":"4,6","reviewCount":"23"}}]</script>';
  assert.deepEqual(ratingOf(findProduct(extractJsonLd(html))), { note: 4.6, avis: 23 });
});
test('JSON invalide ignoré, pas de produit → null', () => {
  assert.equal(findProduct(extractJsonLd('<script type="application/ld+json">{oops</script>')), null);
  assert.equal(ratingOf(null), null);
  assert.equal(offersOf(null), null);
});
```

- [ ] **Step 3 :** `node --test tests/` → FAIL (modules absents).

- [ ] **Step 4 : Implémentation** — `lib/jsonld.js`

```js
function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    try {
      const v = JSON.parse(m[1].trim());
      for (const x of Array.isArray(v) ? v : (v['@graph'] || [v])) out.push(x);
    } catch (e) { /* bloc invalide ignoré */ }
  }
  return out;
}

function findProduct(objs) {
  return (objs || []).find(o => [].concat(o && o['@type']).includes('Product')) || null;
}

function ratingOf(product) {
  const r = product && product.aggregateRating;
  if (!r) return null;
  const note = parseFloat(String(r.ratingValue).replace(',', '.'));
  const avis = parseInt(r.reviewCount ?? r.ratingCount, 10);
  return Number.isFinite(note) ? { note: Math.round(note * 10) / 10, avis: Number.isFinite(avis) ? avis : null } : null;
}

function offersOf(product) {
  const o = product && product.offers;
  if (!o) return null;
  return { total: Number(o.offerCount ?? 0), min: o.lowPrice != null ? Number(o.lowPrice) : null, max: o.highPrice != null ? Number(o.highPrice) : null };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { extractJsonLd, findProduct, ratingOf, offersOf };
```

`lib/okkazeo.js`

```js
const PRICE_RE = /^(\d+)\s*€\s*(\d{2})\b/;

function htmlToLines(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h\d|tr|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&apos;/g, "'").replace(/&euro;/g, '€')
    .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseAnnonces(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].match(PRICE_RE);
    if (!p) continue;
    let j = i + 1;
    while (j < lines.length && j < i + 12 && !PRICE_RE.test(lines[j])) j++;
    const win = lines.slice(i + 1, j);
    const v = win.findIndex(l => /^Vendu par\b/i.test(l));
    if (v === -1) continue;
    const loc = win.map(l => l.match(/^(.+?) \((\d{5})\)$/)).find(Boolean);
    const d = win.map(l => l.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)).find(Boolean);
    const head = lines[i - 1] || '';
    const etat = (head.match(/état ([^)]+)\)/i) || [])[1] || (/neuf/i.test(head) ? 'neuf' : head);
    out.push({
      prix: Number(p[1]) + Number(p[2]) / 100,
      etat: etat.trim(),
      ville: loc ? loc[1].trim() : null,
      cp: loc ? loc[2] : null,
      date: d ? `${d[3]}-${d[2]}-${d[1]}` : null,
      bonneAffaire: /bonne affaire/i.test(lines[i]) || win.slice(0, v).some(l => /bonne affaire/i.test(l)),
      extensions: /extension/i.test(head),
      envoi: win.some(l => /Envoi en France/i.test(l)),
    });
  }
  return out;
}

function filterParis(annonces, cps) {
  const set = new Set(cps);
  return (annonces || []).filter(a => a.cp && set.has(a.cp)).sort((a, b) => a.prix - b.prix);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { htmlToLines, parseAnnonces, filterParis };
```

- [ ] **Step 5 :** `node --test tests/okkazeo.test.js tests/jsonld.test.js` → PASS. Si le test « fixture HTML réelle » échoue (0 annonce parsée), ouvrir `htmlToLines(fixture)` et ajuster **uniquement** la liste de balises de `htmlToLines` jusqu'à retrouver le motif prix / Vendu par / Ville (CP) / date ; relancer.

- [ ] **Step 6 : Tests parseurs boutiques** — `tests/sites.test.js` (attendus fixés par ce qui a été vu le 2026-10-13 : Philibert liste « Clank! » Français et Anglais, et « Clank! Catacombes »)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parsePhilibertSearch, parseEspritJeuSearch, parseOkkazeoSearch } = require('../lib/sites.js');
const { pickProduct } = require('../lib/match.js');
const fx = n => fs.readFileSync(`${__dirname}/fixtures/${n}`, 'utf8');

test('Philibert : candidats avec titre, url absolue, langue', () => {
  const c = parsePhilibertSearch(fx('philibert-search-clank.html'));
  assert.ok(c.length >= 10);
  assert.ok(c.every(x => x.title && /^https:\/\/www\.philibertnet\.com\//.test(x.url)));
  assert.ok(c.some(x => x.title === 'Clank!' && x.lang === 'fr'));
  assert.ok(c.some(x => x.title === 'Clank!' && x.lang === 'en'));
  assert.equal(pickProduct('clank', c).lang, 'fr');
});
test('Esprit Jeu : candidats et choix de Clank!', () => {
  const c = parseEspritJeuSearch(fx('espritjeu-search-clank.html'));
  assert.ok(c.length >= 1);
  assert.ok(c.every(x => x.title && /^https:\/\/www\.espritjeu\.com\//.test(x.url)));
  assert.equal(normalizeTitle(pickProduct('clank', c)), 'clank');
});
test('Okkazeo recherche : URL /jeux/16977/', () => {
  const c = parseOkkazeoSearch(fx('okkazeo-search-clank.html'));
  assert.ok(pickProduct('clank', c).url.includes('/jeux/16977/'));
});
function normalizeTitle(p) { return require('../lib/match.js').normalize(p && p.title); }
```

- [ ] **Step 7 :** `node --test tests/sites.test.js` → FAIL.

- [ ] **Step 8 : Implémentation `lib/sites.js`** — une fonction par site, même patron : repérer dans la fixture le bloc répété d'un produit (ouvrir le fichier, chercher « Clank! Catacombes »), en extraire lien + titre (+ langue « Français »/« Anglais » pour Philibert, + note « x/5 » si présente). Patron :

```js
function absUrl(base, href) { try { return new URL(href, base).href; } catch (e) { return null; } }
function clean(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim(); }

// PRODUCT_BLOCK_RE / TITLE_RE / LANG_RE : à écrire d'après tests/fixtures/philibert-search-clank.html
function parsePhilibertSearch(html) {
  const out = [];
  for (const block of String(html).split(PHILIBERT_BLOCK_SPLIT).slice(1)) {
    const a = block.match(PHILIBERT_TITLE_RE);              // capture [1]=href, [2]=titre
    if (!a) continue;
    const lang = /Français/.test(block) ? 'fr' : /Anglais/.test(block) ? 'en' : undefined;
    const n = block.match(/(\d(?:[.,]\d)?)\/5/);
    out.push({ title: clean(a[2]), url: absUrl('https://www.philibertnet.com/', a[1]), lang, note: n ? parseFloat(n[1].replace(',', '.')) : null });
  }
  return out;
}
```

Les constantes `PHILIBERT_BLOCK_SPLIT`, `PHILIBERT_TITLE_RE` (et équivalents Esprit Jeu / Okkazeo) sont **définies à partir du HTML réel de la fixture**, jamais de mémoire. Si une page n'a pas de bloc répétable exploitable (résultats chargés en JS), le Step 5 de Task 1 a déjà arrêté le projet sur ce site.

- [ ] **Step 9 :** `node --test tests/` → PASS (tous les fichiers).
- [ ] **Step 10 :** `git add lib tests && git commit -m "Parseurs JSON-LD, annonces Okkazeo et recherches boutiques"`

---

### Task 5 : BGG (`lib/bgg.js`)

**Files:**
- Create: `notes-jeux/lib/bgg.js`, `notes-jeux/tests/bgg.test.js`

**Interfaces:**
- Consumes : `normalize` (Task 3), fixtures `bgg-search-clank.xml`, `bgg-thing-clank.xml` (Task 1).
- Produces : `parseBggSearch(xml): {id, type, name}[]`, `bggCandidates(query, items): string[]` (≤ 20 ids), `parseBggThings(xml): Thing[]`, `pickBgg(things): bggOut|null` avec `bggOut = {note, votes, duree, poids, titre, annee, joueurs, age, image, url}`.

- [ ] **Step 1 : Test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBggSearch, bggCandidates, parseBggThings, pickBgg } = require('../lib/bgg.js');

const search = `<items total="3">
<item type="boardgame" id="201808"><name type="primary" value="Clank!: A Deck-Building Adventure"/><yearpublished value="2016"/></item>
<item type="boardgame" id="201809"><name type="alternate" value="Clank!"/><yearpublished value="2016"/></item>
<item type="boardgameexpansion" id="231000"><name type="primary" value="Clank!: Sunken Treasures"/></item>
</items>`;
const thing = `<items>
<item type="boardgame" id="201808"><thumbnail>t</thumbnail><image>https://cf.geekdo-images.com/x.jpg</image>
<name type="primary" sortindex="1" value="Clank!: A Deck-Building Adventure"/><name type="alternate" sortindex="1" value="Clank!"/>
<yearpublished value="2016"/><minplayers value="2"/><maxplayers value="4"/><minplaytime value="30"/><maxplaytime value="60"/><minage value="12"/>
<statistics page="1"><ratings><usersrated value="45678"/><average value="7.68"/><averageweight value="2.2367"/></ratings></statistics></item>
</items>`;

test('search', () => assert.deepEqual(parseBggSearch(search)[1], { id: '201809', type: 'boardgame', name: 'Clank!' }));
test('candidats : nom exact (alternate inclus)', () => assert.deepEqual(bggCandidates('clank', parseBggSearch(search)), ['201809']));
test('candidats : sinon tous les mots', () => assert.deepEqual(bggCandidates('clank sunken', parseBggSearch(search)), ['231000']));
test('candidats : rien → []', () => assert.deepEqual(bggCandidates('azertyuiop', parseBggSearch(search)), []));
test('fiche', () => {
  assert.deepEqual(pickBgg(parseBggThings(thing)), {
    note: 7.7, votes: 45678, duree: '30–60', poids: 2.24, titre: 'Clank!: A Deck-Building Adventure',
    annee: 2016, joueurs: '2–4', age: '12+', image: 'https://cf.geekdo-images.com/x.jpg',
    url: 'https://boardgamegeek.com/boardgame/201808',
  });
});
test('aucune fiche → null', () => assert.equal(pickBgg([]), null));
test('fixture réelle', () => {
  const fs = require('node:fs');
  const ids = bggCandidates('clank', parseBggSearch(fs.readFileSync(__dirname + '/fixtures/bgg-search-clank.xml', 'utf8')));
  assert.ok(ids.length >= 1 && ids.length <= 20);
});
```

- [ ] **Step 2 :** `node --test tests/bgg.test.js` → FAIL.

- [ ] **Step 3 : Implémentation** — `lib/bgg.js`

```js
function bggAttr(tag, name) { const m = String(tag).match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? bggDecode(m[1]) : null; }
function bggDecode(s) { return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function bggVal(body, tag) { const m = String(body).match(new RegExp(`<${tag}\\b[^>]*\\bvalue="([^"]*)"`)); return m ? m[1] : null; }

function parseBggSearch(xml) {
  return [...String(xml || '').matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)].map(([, a, body]) => ({
    id: bggAttr(a, 'id'), type: bggAttr(a, 'type'), name: bggAttr((body.match(/<name\b[^>]*>/) || [''])[0], 'value'),
  }));
}

function bggCandidates(query, items) {
  const q = normalize(query);
  if (!q) return [];
  let hit = items.filter(i => normalize(i.name) === q);
  if (!hit.length) {
    const words = q.split(' ');
    hit = items.filter(i => { const t = ` ${normalize(i.name)} `; return words.every(w => t.includes(` ${w} `)); });
  }
  return [...new Set(hit.map(i => i.id))].slice(0, 20);
}

function parseBggThings(xml) {
  return [...String(xml || '').matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)].map(([, a, b]) => {
    const n = k => { const v = bggVal(b, k); return v == null || v === '' ? null : Number(v); };
    const primary = (b.match(/<name\b[^>]*type="primary"[^>]*>/) || [''])[0];
    return {
      id: bggAttr(a, 'id'), type: bggAttr(a, 'type'), titre: bggAttr(primary, 'value'),
      image: ((b.match(/<image>([^<]*)<\/image>/) || [])[1] || '').trim() || null,
      annee: n('yearpublished'), minp: n('minplayers'), maxp: n('maxplayers'),
      mint: n('minplaytime'), maxt: n('maxplaytime'), age: n('minage'),
      votes: n('usersrated'), average: n('average'), poids: n('averageweight'),
    };
  });
}

function bggRange(a, b) { return a == null ? null : (b == null || a === b ? String(a) : `${a}–${b}`); }

function pickBgg(things) {
  const t = [...(things || [])].sort((x, y) => (x.type === 'boardgame' ? 0 : 1) - (y.type === 'boardgame' ? 0 : 1) || (y.votes || 0) - (x.votes || 0))[0];
  if (!t) return null;
  const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
  return {
    note: r1(t.average), votes: t.votes, duree: bggRange(t.mint, t.maxt),
    poids: t.poids == null ? null : Math.round(t.poids * 100) / 100, titre: t.titre,
    annee: t.annee, joueurs: bggRange(t.minp, t.maxp), age: t.age == null ? null : `${t.age}+`,
    image: t.image, url: `https://boardgamegeek.com/boardgame/${t.id}`,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  if (typeof normalize === 'undefined') global.normalize = require('./match.js').normalize;
  module.exports = { parseBggSearch, bggCandidates, parseBggThings, pickBgg };
}
```

- [ ] **Step 4 :** `node --test tests/bgg.test.js` → PASS. **Step 5 :** `git add lib/bgg.js tests/bgg.test.js && git commit -m "Parseur BGG (recherche, candidats, fiche)"`

---

### Task 6 : Workflow n8n « Notes Jeux — API »

**Files:**
- Create: `notes-jeux/scripts/bundle.mjs`, `notes-jeux/n8n/code/bgg-candidats.body.js`, `notes-jeux/n8n/code/bgg-fiche.body.js`, `notes-jeux/n8n/code/sources.body.js`
- n8n : workflow « Notes Jeux — API »

**Interfaces:**
- Consumes : toutes les libs (Tasks 2–5), URLs de `docs/sources.md`, credential « BGG API » si créée.
- Produces : `GET https://n8n.srv1250642.hstgr.cloud/webhook/notes-jeux?q=<nom>` → JSON (contrat de la spec) + `liens: {espritjeu, philibert, bgg, okkazeo}` (URLs de recherche, toujours présentes).

- [ ] **Step 1 : Bundler** — `scripts/bundle.mjs`

```js
// Usage : node scripts/bundle.mjs sources  → affiche le code complet du node Code
import { readFileSync } from 'node:fs';
const LIBS = {
  'bgg-candidats': ['lib/match.js', 'lib/bgg.js'],
  'bgg-fiche': ['lib/match.js', 'lib/bgg.js'],
  sources: ['lib/match.js', 'lib/jsonld.js', 'lib/okkazeo.js', 'lib/sites.js'],
};
const name = process.argv[2];
if (!LIBS[name]) { console.error('Nodes : ' + Object.keys(LIBS).join(', ')); process.exit(1); }
const root = new URL('..', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const parts = LIBS[name].map(p => `// ---- ${p}\n${read(p)}`);
if (name === 'sources') parts.push(`const CP_PARIS = ${JSON.stringify(JSON.parse(read('lib/cp-paris-10km.json')).cps)};`);
parts.push(`// ---- n8n/code/${name}.body.js\n${read(`n8n/code/${name}.body.js`)}`);
process.stdout.write(parts.join('\n\n'));
```

- [ ] **Step 2 : Corps des nodes Code**

`n8n/code/bgg-candidats.body.js` (après le node HTTP « BGG Search », réponse en texte dans `data`) :

```js
const xml = String($input.first().json.data ?? '');
const ids = bggCandidates($('Webhook').first().json.query.q, parseBggSearch(xml));
return [{ json: { ids: ids.join(',') } }]; // toujours 1 item, même vide
```

`n8n/code/bgg-fiche.body.js` (après « BGG Thing ») :

```js
const ids = $('BGG Candidats').first().json.ids;
const bgg = ids ? pickBgg(parseBggThings(String($input.first().json.data ?? ''))) : null;
return [{ json: { bgg } }];
```

`n8n/code/sources.body.js` (URLs de recherche Esprit Jeu / Okkazeo = celles notées dans `docs/sources.md` ; remplacer les deux constantes `*_SEARCH` par leur valeur exacte avant collage) :

```js
const q = String($('Webhook').first().json.query.q || '').trim();
const enc = encodeURIComponent(q);
const ESPRITJEU_SEARCH = 'https://www.espritjeu.com/'; // ← valeur exacte de docs/sources.md + enc
const OKKAZEO_SEARCH = 'https://www.okkazeo.com/';     // ← valeur exacte de docs/sources.md + enc
const liens = {
  espritjeu: ESPRITJEU_SEARCH + enc,
  philibert: 'https://www.philibertnet.com/fr/recherche?search_query=' + enc,
  bgg: 'https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=' + enc,
  okkazeo: OKKAZEO_SEARCH + enc,
};
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};
const get = async url => {
  const r = await this.helpers.httpRequest({ url, headers: UA, json: false, timeout: 10000, returnFullResponse: true, ignoreHttpStatusErrors: true });
  if (r.statusCode >= 400) throw new Error(`HTTP ${r.statusCode} ${url}`);
  return String(r.body ?? '');
};

async function boutique(searchUrl, parseSearch) {
  const p = pickProduct(q, parseSearch(await get(searchUrl)));
  if (!p) return null;
  const r = ratingOf(findProduct(extractJsonLd(await get(p.url))));
  return { note: r ? r.note : (p.note ?? null), avis: r ? r.avis : null, titre: p.title, url: p.url };
}

async function okkazeo() {
  const p = pickProduct(q, parseOkkazeoSearch(await get(liens.okkazeo)));
  if (!p) return { total: 0, min: null, max: null, url: liens.okkazeo, annonces: [] };
  const html = await get(p.url);
  const off = offersOf(findProduct(extractJsonLd(html))) || { total: 0, min: null, max: null };
  const toutes = parseAnnonces(htmlToLines(html));
  return { ...off, url: p.url, parsees: toutes.length, annonces: filterParis(toutes, CP_PARIS) };
}

const [ej, ph, ok] = await Promise.allSettled([
  boutique(liens.espritjeu, parseEspritJeuSearch),
  boutique(liens.philibert, parsePhilibertSearch),
  okkazeo(),
]);
const val = r => (r.status === 'fulfilled' ? r.value : null);
const erreurs = [ej, ph, ok].map((r, i) => r.status === 'rejected' ? `${['espritjeu', 'philibert', 'okkazeo'][i]}: ${r.reason.message}` : null).filter(Boolean);
return [{ json: { query: q, espritjeu: val(ej), philibert: val(ph), bgg: $('BGG Fiche').first().json.bgg, okkazeo: val(ok), liens, erreurs } }];
```

- [ ] **Step 3 : Schémas** — `get_node` sur `nodes-base.webhook`, `nodes-base.httpRequest`, `nodes-base.code`, `nodes-base.respondToWebhook` ; reprendre les versions utilisées par `tv-showtime/n8n/JustWatch Proxy.json` (webhook v2.1, httpRequest v4.4, code v2, respondToWebhook v1.5) si elles sont toujours valides.

- [ ] **Step 4 : Créer le workflow (MCP `n8n_create_workflow`)** — chaîne linéaire :

1. `Webhook` : GET, path `notes-jeux`, `responseMode: responseNode`, `webhookId: 7c1e4a52-9d3b-4f6e-8a21-5b0c9e3d7f14`.
2. `BGG Search` (HTTP Request) : `https://boardgamegeek.com/xmlapi2/search?query={{ encodeURIComponent($json.query.q) }}&type=boardgame,boardgameexpansion`, réponse format **texte** dans `data`, `neverError: true`, timeout 10000, `onError: continueRegularOutput`, credential « BGG API » si Task 1 l'a exigée.
3. `BGG Candidats` (Code) : `node scripts/bundle.mjs bgg-candidats`.
4. `BGG Thing` (HTTP Request) : `https://boardgamegeek.com/xmlapi2/thing?id={{ $json.ids || '0' }}&stats=1`, mêmes options que 2.
5. `BGG Fiche` (Code) : `node scripts/bundle.mjs bgg-fiche`.
6. `Sources` (Code) : `node scripts/bundle.mjs sources`.
7. `Respond JSON` : `respondWith: json`, `responseBody: ={{ $json }}`, en-tête `Access-Control-Allow-Origin: *` (comme tv-showtime ; données publiques, permet aussi de tester `index.html` en local).

- [ ] **Step 5 :** `n8n_validate_workflow` → 0 erreur bloquante ; `validate_node` sur chaque node ajouté.

- [ ] **Step 6 : Exécutions réelles** (workflow activé, appel du webhook prod) :

```bash
for q in "clank" "drillers" "les aventuriers du rail" "7 wonders duel" "catane" "azertyuiop"; do
  curl -s "https://n8n.srv1250642.hstgr.cloud/webhook/notes-jeux?q=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$q")" -o "../.tmp/notes-jeux-$q.json" -w "$q → %{http_code} %{time_total}s\n"
done
```

Attendus (à lire dans chaque JSON et dans `n8n_executions`) :
- `clank` : `philibert.titre` = « Clank! » VF, `bgg.titre` contient « Clank! », `okkazeo.total` ≥ 1, `annonces` toutes avec `cp` ∈ liste.
- `drillers` : `bgg.note` ≈ 7.9, `bgg.poids` ≈ 2.66, `bgg.duree` = « 30–120 ».
- `les aventuriers du rail` : `bgg.titre` = « Ticket to Ride » (si `null` : noter la limite dans `docs/sources.md`).
- `7 wonders duel` : aucun `null` dû à l'encodage.
- `catane` : comparer `okkazeo.parsees` et `okkazeo.total` ; si `parsees < total` → pagination, noter la limite dans `docs/sources.md`.
- `azertyuiop` : HTTP 200, toutes les sources `null` ou vides, `okkazeo.annonces = []`.
- Temps de réponse noté (spec : 5–15 s attendus, à confirmer).

- [ ] **Step 7 : Export et commit** — `n8n_get_workflow` → `n8n/Notes Jeux API.json` (vérifier qu'aucun secret n'y figure) ; `git add scripts/bundle.mjs n8n && git commit -m "Workflow n8n Notes Jeux — API"`

---

### Task 7 : Front `index.html`

**Files:**
- Create: `notes-jeux/index.html`

**Interfaces:**
- Consumes : `GET /webhook/notes-jeux?q=` (Task 6).

- [ ] **Step 1 : Écrire `index.html`**

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notes Jeux</title>
<style>
:root{--bg:#121214;--card:#1c1c20;--line:#2c2c32;--txt:#ececf1;--mut:#8b8b96;--acc:#4f8cff;--ej:#e3342f;--ph:#f08c00;--bgg:#1f6fb2;--okk:#ff8a00;--ok:#34c759}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}
form{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;min-width:0;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--txt);font-size:16px}
button{padding:12px 18px;border:0;border-radius:10px;background:var(--acc);color:#fff;font-weight:600;font-size:15px}
a{color:var(--acc)}
.layout{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}
.head{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.head img{width:64px;height:64px;object-fit:cover;border-radius:10px;background:var(--card)}
.head h1{font-size:20px;margin:0}
.mut{color:var(--mut);font-size:12px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;min-width:0}
.src{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);display:flex;gap:6px;align-items:center}
.dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.big{font-size:26px;font-weight:700;margin-top:4px}
.big small{font-size:13px;color:var(--mut);font-weight:400}
.match{font-size:11px;color:var(--mut);margin-top:6px;border-top:1px dashed var(--line);padding-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.na{color:var(--mut);font-style:italic;margin-top:6px}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.kv div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}
.kv b{font-size:17px}
.okk{border:2px solid var(--okk);border-radius:12px;overflow:hidden;align-self:start}
.okk header{background:var(--okk);color:#fff;padding:10px 12px}
.okk header b{font-size:15px}
.ann{display:grid;grid-template-columns:60px 1fr auto;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);align-items:center}
.tag{font-size:10px;padding:1px 6px;border-radius:10px;background:var(--line);color:var(--mut);margin-left:4px}
.tag.ok{background:#34c75933;color:var(--ok)}
.okk footer{padding:10px;text-align:center}
.okk footer a{color:var(--okk);font-weight:700}
.skel{height:14px;border-radius:6px;margin:8px 0;background:linear-gradient(90deg,var(--line),#3a3a42,var(--line));background-size:200% 100%;animation:sk 1.2s infinite}
@keyframes sk{to{background-position:-200% 0}}
@media (max-width:760px){.layout{grid-template-columns:1fr}.tile{padding:8px}.big{font-size:20px}.head img{width:44px;height:44px}}
</style>
</head>
<body>
<main>
  <form id="f"><input id="q" placeholder="Nom du jeu (ex. Clank)" autocomplete="off" enterkeyhint="search"><button>Rechercher</button></form>
  <div id="out"></div>
</main>
<script>
const API = 'https://n8n.srv1250642.hstgr.cloud/webhook/notes-jeux';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fr = n => String(n).replace('.', ',');
const ext = (url, txt) => `<a href="${esc(url)}" target="_blank" rel="noopener">${txt}</a>`;
let seq = 0;

function tile(name, color, d, scale, unit, searchUrl) {
  const src = `<div class="src"><span class="dot" style="background:${color}"></span>${name}</div>`;
  if (!d) return `<div class="tile">${src}<div class="na">indisponible</div><div class="match">${ext(searchUrl, 'chercher sur le site ↗')}</div></div>`;
  const val = d.note == null
    ? `<div class="na">pas encore d'avis</div>`
    : `<div class="big">${fr(d.note)}<small>/${scale}</small></div><div class="mut">${d.avis ?? d.votes ?? '?'} ${unit}</div>`;
  return `<div class="tile">${src}${val}<div class="match">« ${esc(d.titre)} » ${ext(d.url, '↗')}</div></div>`;
}

function okk(o, lien) {
  if (!o) return `<section class="okk"><header><b>Okkazeo</b><div>indisponible</div></header><footer>${ext(lien, 'Chercher sur Okkazeo ↗')}</footer></section>`;
  const rows = o.annonces.map(a => `<div class="ann"><b>${fr(a.prix)} €</b><span>${esc(a.etat)}${a.bonneAffaire ? '<span class="tag ok">bonne affaire</span>' : ''}${a.extensions ? '<span class="tag">+ ext.</span>' : ''}<br><span class="mut">${esc(a.ville)}</span></span><span class="mut">${a.date ? a.date.slice(8, 10) + '/' + a.date.slice(5, 7) : ''}</span></div>`).join('');
  const prix = o.total && o.min != null ? ` · ${fr(o.min)}–${fr(o.max)} €` : '';
  const pied = o.annonces.length ? 'Ouvrir sur Okkazeo ↗' : `Voir les ${o.total} annonces France ↗`;
  return `<section class="okk"><header><b>Okkazeo · ${o.annonces.length} près de Paris</b><div>${o.total} en France${prix}</div></header>${rows}<footer>${ext(o.url, pied)}</footer></section>`;
}

function render(d) {
  const b = d.bgg, L = d.liens;
  const head = b
    ? `<div class="head">${b.image ? `<img src="${esc(b.image)}" alt="">` : ''}<div><h1>${esc(b.titre)}</h1><div class="mut">${[b.annee, b.joueurs && b.joueurs + ' joueurs', b.age].filter(Boolean).map(esc).join(' · ')}</div></div></div>`
    : `<div class="head"><div><h1>${esc(d.query)}</h1></div></div>`;
  const tiles = `<div class="tiles">${tile('Esprit Jeu', 'var(--ej)', d.espritjeu, 5, 'avis', L.espritjeu)}${tile('Philibert', 'var(--ph)', d.philibert, 5, 'avis', L.philibert)}${tile('BGG', 'var(--bgg)', b, 10, 'votes', L.bgg)}</div>`;
  const kv = b ? `<div class="kv"><div><span class="mut">⏱ Durée</span><br><b>${esc(b.duree ?? '?')} min</b></div><div><span class="mut">⚖ Difficulté</span><br><b>${b.poids != null ? fr(b.poids) : '?'} / 5</b></div></div>` : '';
  $('#out').innerHTML = `<div class="layout"><div>${head}${tiles}${kv}</div>${okk(d.okkazeo, L.okkazeo)}</div>`;
}

function skeleton() {
  const t = n => `<div class="tile"><div class="src">${n}</div><div class="skel" style="width:50%;height:22px"></div><div class="skel" style="width:70%"></div></div>`;
  return `<div class="layout"><div><div class="tiles">${t('Esprit Jeu')}${t('Philibert')}${t('BGG')}</div></div><section class="okk"><header><b>Okkazeo</b></header><div style="padding:12px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></section></div>`;
}

$('#f').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (!q) return;
  const my = ++seq;
  $('#out').innerHTML = skeleton();
  try {
    const r = await fetch(API + '?q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (my === seq) render(d);
  } catch (err) {
    if (my === seq) $('#out').innerHTML = `<p class="na">Recherche impossible (${esc(err.message)}). Réessaie dans un instant.</p>`;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 2 : Vérifier dans Chrome** (fichier ouvert en local, CORS `*`) : rechercher « clank » → les 3 tuiles, durée/difficulté, encart Okkazeo ; `resize_window` 1280×800 puis 390×844 → layout côte à côte puis empilé, aucune barre de défilement horizontale.
- [ ] **Step 3 : Cas limites** : « azertyuiop » → 3 « indisponible » + Okkazeo « 0 près de Paris » sans erreur console ; lancer « clank » puis immédiatement « drillers » → seul Drillers s'affiche à la fin (Review Focus 5).
- [ ] **Step 4 :** `git add index.html && git commit -m "Front Notes Jeux (layout B, thème sombre)"`

---

### Task 8 : Mise en ligne et capitalisation

**Files:**
- Create: `notes-jeux/CLAUDE.md`
- Modify: `C:\Users\JulesBATAILLE\.claude\projects\...\memory\` (pointeur projet), `CLAUDE.md` racine §5 si un nouveau piège a été rencontré

- [ ] **Step 1 : Repo GitHub** — si `gh auth status` est OK : `gh repo create Link9768/notes-jeux --public --source . --push`. Sinon Jules crée le repo vide sur github.com/new, puis :

```bash
git remote add origin https://github.com/Link9768/notes-jeux.git && git push -u origin main
```

- [ ] **Step 2 : Pages** (Jules) : Settings → Pages → *Deploy from a branch* → `main` / `/ (root)` → Save.
- [ ] **Step 3 : Vérifier** `https://link9768.github.io/notes-jeux/?v=1` sur PC et sur le téléphone de Jules (recherche « clank »).
- [ ] **Step 4 : `notes-jeux/CLAUDE.md`** : URL publique, URL du webhook, ID du workflow n8n, rôle de chaque fichier, commande `node --test tests/`, procédure de mise à jour d'un node Code (`node scripts/bundle.mjs <node>` puis partial update MCP), limites constatées (pagination Okkazeo, noms FR sur BGG…). Commit + push.
- [ ] **Step 5 : Capitaliser** (CLAUDE.md §6) : pièges n8n nouveaux → §5 du CLAUDE.md racine ; mémoire projet « Notes Jeux » + pointeur dans `MEMORY.md`.
