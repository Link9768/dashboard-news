# Pourquoi PostgreSQL plutôt qu'Excel ou Data Table n8n

Contexte : choix de stockage pour le dispositif d'attribution automatique de coachs
([2026-09-01-coaching-auto-design.md](superpowers/specs/2026-09-01-coaching-auto-design.md)).
Le raisonnement s'applique à tout futur workflow qui **écrit** de la donnée métier durable
(pas un simple export en lecture).

## Le bon test : qui écrit, et combien de fois ?

| | Lecture seule, 1 rafraîchissement/jour | Écritures multiples, concurrentes, historisées |
|---|---|---|
| Excel / Google Sheets | ✅ suffisant | ❌ corruption, pas d'historique propre |
| Data Table n8n | ⚠️ acceptable pour du jetable | ❌ couplé au cycle de vie de n8n |
| PostgreSQL externe | overkill mais sans coût | ✅ conçu pour ça |

## vs Excel / Google Sheets

- **Écritures concurrentes** : un fichier ne gère pas deux processus qui écrivent en même
  temps (ex. le batch n8n de nuit + une validation humaine dans le même créneau) → corruption
  ou perte de données garantie. Une base gère ça nativement (transactions).
- **Historique sans écrasement** : modifier une cellule écrase la valeur précédente. Pour
  garder une trace ("qui a coaché qui, quand, pourquoi ça s'est arrêté"), il faudrait ajouter
  une ligne à chaque changement sans jamais rien modifier — à ce stade on réinvente une base
  de données, sans les garanties (types, contraintes, clés étrangères).
- **Requêtes** : croiser plusieurs critères (grade, ancienneté, capacité, mission, historique)
  est une jointure SQL. Dans un Excel piloté par n8n, il faut télécharger le fichier entier,
  le parser en mémoire, filtrer en code — plus lent, plus fragile, cassé dès qu'un humain
  modifie une colonne pendant l'exécution.

## vs Data Table n8n

Les Data Tables sont aussi du Postgres en coulisses — mais dans le schéma interne de n8n,
géré par n8n, pas par toi.

- **Cycle de vie couplé** : migration de version, changement de VPS, réinitialisation d'une
  instance n8n cassée (déjà vécu — cf. incident Gateway Timeout) emportent les Data Tables
  avec eux. Une base externe survit à n8n.
- **Sauvegarde et permissions séparées** : une donnée RH nominative mérite sa propre politique
  de sauvegarde/accès, pas celle générique de l'outil d'automatisation — point pertinent dans
  une démarche ISO 27001.
- **Portabilité** : un Postgres externe est accessible directement par n'importe quel outil
  (Frame Dust, reporting futur). Une Data Table n'est accessible qu'en passant par l'API n8n.

Les Data Tables restent le bon choix pour du stockage jetable, propre à un seul workflow,
sans enjeu de durée (cache technique, file d'attente).

## Le coût réel ici

Nul. Postgres tourne déjà sur le VPS pour n8n — créer un schéma séparé dessus est une
commande, pas une nouvelle infrastructure à payer ou maintenir.
