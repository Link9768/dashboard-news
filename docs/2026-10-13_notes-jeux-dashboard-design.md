# Notes Jeux — dashboard agrégateur de notes de jeux de société

Date : 2026-10-13 · Statut : design validé, à implémenter

## Objectif

Taper un nom de jeu dans une barre de recherche et voir en un écran :
- la note et le nombre d'avis sur **Esprit Jeu** et **Philibert** (/5) ;
- la note, le nombre de votes, la **durée** et la **difficulté (/5)** sur **BoardGameGeek** ;
- les annonces d'occasion **Okkazeo** à ≤ 10 km des Olympiades (Paris 13e).

Usage : PC et téléphone.

## Décisions

| Sujet | Décision |
|-------|----------|
| Hébergement | GitHub Pages, repo `Link9768/notes-jeux` → `https://link9768.github.io/notes-jeux/` |
| Données | Un workflow n8n « Notes Jeux — API » exposé en webhook GET, renvoie du JSON |
| Choix du produit | Automatique, **jeu de base par défaut** (l'utilisateur tape le nom de l'extension quand il la veut) |
| Garde-fou | Titre du produit retenu + lien ↗ affichés sous chaque note |
| Okkazeo | Pas d'iframe (vérifié : `X-Frame-Options: SAMEORIGIN`). Résumé + liste des annonces filtrées + bouton |
| Zone annonces | Codes postaux dont le centroïde est à ≤ 10 km des Olympiades (≈ 48.8266, 2.3658) |
| Layout | « B » responsive : notes à gauche / Okkazeo à droite sur PC, empilé sur mobile |
| Thème | Sombre uniquement |

## Architecture

```
index.html (GitHub Pages)
  │ GET <n8n>/webhook/notes-jeux?q=<nom>
  ▼
Webhook (webhookId UUID explicite)
  ├─ Esprit Jeu : recherche → choix produit → page produit → note, nb avis, titre, url
  ├─ Philibert  : recherche → choix produit → page produit → note, nb avis, titre, url
  ├─ BGG        : recherche → fiche → note, votes, durée, poids, année, joueurs, âge, image
  └─ Okkazeo    : recherche → page jeu → JSON-LD (total, min, max) + annonces
                  → filtre codes postaux 10 km
  → Merge → Code (assemblage) → Respond to Webhook (JSON + Access-Control-Allow-Origin: https://link9768.github.io)
```

### Règle de choix du produit (Esprit Jeu, Philibert, Okkazeo ; BGG : mêmes étapes 2–4, restreint au type `boardgame` hors extensions sauf si la requête vise l'extension)

1. Exclure les accessoires : titre contenant `sleeve`, `pochette`, `sticker`, `autocollant`, `pack de stickers`, `kit`, `feuille de score`, `piste de suivi`, `figurine`, `sac`.
2. Normaliser : minuscules, sans accents, sans ponctuation (`!`, `:`, `-`, `'`), espaces compactés.
3. Prendre le titre normalisé **égal** à la requête normalisée, version française en priorité.
4. Sinon, le titre le plus proche (le plus court qui commence par la requête, puis le premier résultat restant).

### Okkazeo (vérifié dans le navigateur le 2026-10-13 sur `/jeux/16977/clank`)

- Résumé dans le JSON-LD `Product.offers` (`AggregateOffer`) : `offerCount`, `lowPrice`, `highPrice`.
- Chaque annonce visible : état (« Jeu d'occasion (état excellent) »), prix (`40€00`), vendeur, ville + code postal (`Calais (62100)`), date (`30/08/2026`), mentions « bonne affaire » et « Envoi en France ».
- Liste des codes postaux à 10 km : calculée une fois via geo.api.gouv.fr, figée dans un nœud Code.

### Contrat JSON

```json
{
  "query": "clank",
  "espritjeu": { "note": 4.9, "avis": 16, "titre": "Clank!", "url": "…" },
  "philibert": { "note": 4.6, "avis": 23, "titre": "Clank! (VF)", "url": "…" },
  "bgg": { "note": 7.9, "votes": 939, "duree": "30–120", "poids": 2.66, "titre": "Clank!",
           "annee": 2016, "joueurs": "2–4", "age": "12+", "image": "…", "url": "…" },
  "okkazeo": { "total": 14, "min": 20, "max": 190, "url": "…",
               "annonces": [{ "prix": 20, "etat": "excellent", "ville": "Ivry-sur-Seine",
                              "cp": "94200", "date": "2026-09-02",
                              "bonneAffaire": true, "extensions": false }] }
}
```

Une source en échec vaut `null` : elle ne fait jamais échouer la réponse globale (`continueOnFail` / `alwaysOutputData` sur chaque branche).

## Interface

- Barre de recherche, puis en-tête du jeu (image, nom, année, joueurs, âge — source BGG).
- 3 tuiles de notes (Esprit Jeu /5, Philibert /5, BGG /10) avec garde-fou titre + lien.
- Sous les tuiles : durée et difficulté /5.
- Encart Okkazeo : `N près de Paris · T en France · min–max €`, annonces triées par prix croissant (prix, état, ville, date, badges « bonne affaire » / « + ext. »), bouton « Ouvrir sur Okkazeo ↗ ».
- États : squelettes pendant le chargement (réponse unique, attendue en 5–15 s, non mesuré) ; « indisponible » + lien de recherche si une source est `null` ; « 0 près de Paris » + lien vers les annonces France.
- Maquette de référence : `.superpowers/brainstorm/794-1791923382/content/interface-detail.html`.

## Ordre de construction

| # | Étape | Critère de réussite |
|---|-------|---------------------|
| 0 | Workflow de test jetable : fetch Okkazeo, Philibert, Esprit Jeu, BGG (Clank) depuis n8n | HTML/XML reçu, pas de 403. Sinon : stop, proposer une alternative |
| 1 | Liste des codes postaux ≤ 10 km des Olympiades | Ivry, Montreuil dedans ; Créteil, Versailles dehors |
| 2 | Branches n8n une par une (BGG → Philibert → Esprit Jeu → Okkazeo) | Exécution réelle par branche, sortie lue |
| 3 | Merge + Code + Respond to Webhook (CORS) | JSON complet pour les 3 jeux tests |
| 4 | `index.html` | Rendu vérifié dans Chrome, largeur PC et mobile |
| 5 | Repo + Pages (création et activation manuelles par l'utilisateur) | Page publique fonctionnelle sur téléphone |

**Jeux tests** : Clank! (beaucoup d'extensions), Drillers (récent, peu d'avis), Les Aventuriers du Rail (nom FR ≠ nom BGG).
**Cas d'erreur** : jeu inexistant (`azertyuiop`) → tout « indisponible » ; jeu sans annonce à Paris.

## Risques ouverts

1. **Cloudflare Okkazeo** : 403 constaté en curl depuis le poste. Si n8n est bloqué aussi → service de scraping (ex. Firecrawl).
2. **API BGG** : peut exiger une inscription / un token (supposé, à vérifier à l'étape 0).
3. **Esprit Jeu** (https://www.espritjeu.com/) : URL de recherche et emplacement de la note non vérifiés.
4. **Philibert** : la note /5 est visible en page de recherche (vérifié) ; le nombre d'avis n'y est pas, il faudra probablement la page produit.

## Hors périmètre

Historique des recherches, cache, note agrégée, autres boutiques.
