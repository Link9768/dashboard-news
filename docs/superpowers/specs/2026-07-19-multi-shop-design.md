# Multi-Shop — Agrégateur de recherche produits (Design)

**Date** : 2026-07-19 (mis à jour au fil des itérations)
**Statut** : En production, itéré au fil des retours

## Résumé

Application desktop Windows (Electron) : une barre de recherche unique lance la même recherche produit simultanément sur plusieurs sites marchands (Amazon, AliExpress, Temu, Cdiscount), chacun affiché en **vraie page** dans une fenêtre d'une grille.

## Pourquoi Electron (et pas une page web)

Les sites marchands bloquent l'embarquement de leurs pages dans des iframes (X-Frame-Options). Une page web (type GitHub Pages) ne peut donc pas les afficher côte à côte. Les `<webview>` Electron contournent cette limite car l'app tourne localement. Conséquence assumée : app locale lancée par double-clic, pas de lien web.

## Interface

- **Barre du haut** — fusionnée dans la barre de titre Windows native (`titleBarOverlay`), à droite du nom "Multi-Shop /" :
  - Champ de recherche unique (Entrée = lancer la recherche partout)
  - Bouton 🔗 scroll lié (toggle on/off)
  - Bouton ➕ ajouter un site
  - Sélecteur de grille : 2 / 4 / 6 / 8 fenêtres
  - Zone restante "draggable" (déplacement fenêtre), espace réservé à droite pour les boutons système Windows (`_ □ X`)
- **Menu natif Electron (File/Edit/View...)** : supprimé (`Menu.setApplicationMenu(null)`), jugé inutile
- **Grille** :
  - 2 : plein écran gauche/droite, avec pagination — flèche ▼ en bas au milieu pour révéler les sites suivants (3+4), flèche ▲ en haut au milieu pour revenir
  - 4 : 2x2 (défaut)
  - 6 : 2x3, 8 : 2x4
- **Chaque fenêtre** : en-tête avec nom du site + trois boutons (⛶ plein écran, 🔍− zoom 50%/100%, ✕ retirer le site), `<webview>` avec la vraie page, scroll indépendant
- **Ordre des sites par défaut** : Amazon, AliExpress, Temu, Cdiscount (les deux premiers voulus ensemble en grille 2)

## Comportements

### Recherche
Le terme saisi est mémorisé (`lastSearchTerm`) et injecté dans l'URL de recherche de **tous** les sites configurés, y compris ceux masqués par la pagination de la grille 2 — pas seulement les webviews actuellement visibles. Réappliqué automatiquement à chaque nouvelle webview créée (changement de grille, de page, de fullscreen).

### Scroll lié
Toggle off par défaut. Activé : un scroll dans une fenêtre est répliqué (même distance en pixels) dans toutes les autres via injection JS (`executeJavaScript` + `scrollBy`). Limite connue et acceptée : les pages n'ayant pas la même longueur, la synchronisation dérive naturellement en bas de page.

### Plein écran par fenêtre (⛶)
Immersif total : cache la barre de titre/recherche, cache l'en-tête (nom du site) de la fenêtre ciblée, retire bordures/espacement — ne reste que la page web, sur tout l'écran. Sortie uniquement via la touche **Échap** (le bouton ⛶ est lui-même masqué en fullscreen).

### Zoom par fenêtre (🔍−)
Bascule le zoom de la webview entre 100% et 50% (`webview.setZoomFactor`), persiste après un rechargement de page (recherche relancée).

### Gestion des sites
- Formulaire ➕ : nom + URL de recherche contenant `%s`
- Sites de départ pré-configurés : Amazon.fr, AliExpress, Temu, Cdiscount
- Persistance locale (`electron-store`) : liste des sites conservée entre les lancements

### Sessions
Session persistante partagée par les webviews (`partition: persist:multishop`) : cookies et connexions (compte Amazon, etc.) conservés entre les lancements.

## Livraison

- Exe portable généré via `electron-packager` (pas `electron-builder` — bloqué par un problème de symlinks Windows sur le package `winCodeSign`, inutile de toute façon en mode non signé)
- Raccourci bureau vers `dist\Multi-Shop-win32-x64\Multi-Shop.exe`
- Code dans le repo git local `multi-shop-repo` (hors dossier N8N consultant, comme tv-showtime) — **repo GitHub distant non créé** : `gh` CLI absent de la machine, à créer et pousser manuellement si besoin

## Points d'attention

- Amazon peut proposer une connexion par clé d'accès (passkey/WebAuthn) relayée par Windows Hello — comportement normal du site, sans lien avec la config de l'app ; "Annuler" et se connecter par mot de passe classique fonctionne
- Temu et consorts peuvent afficher un captcha à la première visite : à résoudre une fois manuellement dans la fenêtre, mémorisé ensuite
- Le scraping/anti-bot n'est pas un sujet ici : on affiche les vraies pages, comme un navigateur normal
- Sous Git Bash / PowerShell de l'environnement de dev, la variable `ELECTRON_RUN_AS_NODE` doit être neutralisée (`$env:ELECTRON_RUN_AS_NODE = $null`) pour lancer l'app en mode Electron réel plutôt qu'en mode Node pur
- Hors périmètre (YAGNI) : comparaison de prix automatique, historique de recherches, version mobile
