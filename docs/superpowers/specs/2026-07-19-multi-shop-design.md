# Multi-Shop — Agrégateur de recherche produits (Design)

**Date** : 2026-07-19
**Statut** : Validé par Jules

## Résumé

Application desktop Windows (Electron) : une barre de recherche unique lance la même recherche produit simultanément sur plusieurs sites marchands (Amazon, Temu, AliExpress, Cdiscount), chacun affiché en **vraie page** dans une fenêtre d'une grille.

## Pourquoi Electron (et pas une page web)

Les sites marchands bloquent l'embarquement de leurs pages dans des iframes (X-Frame-Options). Une page web (type GitHub Pages) ne peut donc pas les afficher côte à côte. Les `<webview>` Electron contournent cette limite car l'app tourne localement. Conséquence assumée : app locale lancée par double-clic, pas de lien web.

## Interface

- **Barre du haut** :
  - Champ de recherche unique (Entrée = lancer la recherche partout)
  - Bouton 🔗 scroll lié (toggle on/off)
  - Bouton ➕ ajouter un site
  - Sélecteur de grille : 4 / 6 / 8 fenêtres
- **Grille** : 2x2 par défaut ; 2x3 (6) ou 2x4 (8) via le sélecteur
- **Chaque fenêtre** : en-tête avec nom du site (+ bouton retirer/remplacer le site), `<webview>` avec la vraie page, scroll indépendant

## Comportements

### Recherche
Le terme saisi est injecté dans l'URL de recherche de chaque site (template avec `%s`, encodage URL du terme). Chaque webview charge son URL.

### Scroll lié
Toggle off par défaut. Activé : un scroll dans une fenêtre est répliqué (même distance en pixels) dans toutes les autres via injection JS (`executeJavaScript` + `scrollBy`). Limite connue et acceptée : les pages n'ayant pas la même longueur, la synchronisation dérive naturellement en bas de page.

### Gestion des sites
- Formulaire ➕ : nom + URL de recherche contenant `%s`
- Sites de départ pré-configurés : Amazon.fr, Temu, AliExpress, Cdiscount (URLs de recherche fournies dans l'implémentation)
- Persistance locale (electron-store ou équivalent) : liste des sites conservée entre les lancements

### Sessions
Session persistante partagée par les webviews : cookies et connexions (compte Amazon, etc.) conservés entre les lancements.

## Livraison

- Exe portable dans un dossier + raccourci bureau (pas d'installateur)
- Code dans un repo GitHub séparé (comme tv-showtime), cloné hors du dossier N8N consultant

## Points d'attention

- Temu et consorts peuvent afficher un captcha à la première visite : à résoudre une fois manuellement dans la fenêtre, mémorisé ensuite
- Le scraping/anti-bot n'est pas un sujet ici : on affiche les vraies pages, comme un navigateur normal
- Hors périmètre (YAGNI) : comparaison de prix automatique, historique de recherches, version mobile
