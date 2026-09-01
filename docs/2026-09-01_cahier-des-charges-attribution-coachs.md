# Cahier des charges — Attribution automatique de coachs

Rédigé le 2026-09-01. Basé sur le design validé :
[2026-09-01-coaching-auto-design.md](superpowers/specs/2026-09-01-coaching-auto-design.md).

## 1. Objectif

Automatiser l'attribution d'un coach interne à chaque nouveau collaborateur qui rejoint Seize
Consulting, en respectant des règles de compatibilité (grade, ancienneté, mission, client) et
en laissant la décision finale à un humain.

## 2. Constat de départ

Le dispositif actuel repose sur un fichier Excel et un champ Furious (`cf_1_coach`) qui n'est
plus à jour : les délais de suivi (1 an) sont dépassés depuis longtemps, sans qu'aucune mise à
jour n'ait été faite. Il n'existe aucun historique fiable de qui a coaché qui, ni depuis quand.

## 3. Périmètre de la V1

Le dispositif traite **uniquement les nouveaux arrivants**, au fil de leur arrivée chez Seize.
Les collaborateurs déjà en poste sans coach ne sont pas repris dans cette première version.

Raison : sur l'effectif actuel, il y a davantage de personnes à coacher (56) que de coachs
disponibles (29) si on voulait traiter tout le monde d'un coup — un lancement en une fois
produirait des dizaines d'appairages non vérifiés le même jour, avec un risque élevé
d'erreurs visibles. Traiter les arrivées au fil de l'eau (quelques personnes par mois) permet
de vérifier que le système fonctionne correctement avant d'envisager, dans une V2, de reprendre
les collaborateurs déjà en poste.

## 4. Qui est concerné

**Sont coachés** (sur critère de grade) : Stagiaire, Consultant Junior, Consultant Expérimenté,
Consultant Sénior.

**Peuvent être coachs** : à partir du grade Manager, ainsi que les Consultants Juniors ayant au
moins 1 an d'ancienneté chez Seize (dans ce dernier cas, uniquement pour coacher un Stagiaire).

**Sont exclus du dispositif** : les fonctions support (Assistante de direction, Chargé de
recrutement, Marketing), les comptes techniques/test, et les grades qui n'entrent pas dans
l'échelle de coaching.

## 5. Règles d'attribution

| Règle | Description |
|---|---|
| Écart de grade | Le coach doit avoir au moins 2 grades d'écart avec le coaché. Si aucun coach disponible ne remplit cette condition, la règle s'assouplit à 1 grade d'écart minimum (jamais 0). |
| Ancienneté du coach | Au moins 1 an chez Seize, sans exception. |
| Capacité | Un coach ne suit qu'un seul coaché à la fois. |
| Mission différente | Un coach ne peut pas être sur la même mission que son coaché, quand cette information est disponible. C'est la règle de neutralité la plus importante : elle évite qu'un coach soit aussi le collègue quotidien de la personne qu'il coache. |
| Client différent | Préférence pour un coach chez un client différent de celui du coaché — non bloquant : un appairage même-client reste possible en dernier recours plutôt que de laisser quelqu'un sans coach. |
| Pôle différent | Bonus, non obligatoire : un coach d'un autre pôle/BU favorise l'échange transverse. |

**Cas particulier des arrivants sans mission connue** (stagiaires notamment, souvent staffés
1 à 2 mois après leur arrivée) : l'attribution se fait quand même, sur les critères de grade et
d'ancienneté uniquement. La règle de mission ne s'applique pas rétroactivement si la situation
change ensuite — un lien de coaching, une fois créé, n'est jamais remis en cause pour ce motif.

## 6. Durée du lien de coaching

Pas de durée fixe imposée. Un lien de coaching dure tant qu'il n'est pas rompu (départ de
l'une des deux personnes, ou demande explicite d'y mettre fin). Ce choix permet à un binôme qui
fonctionne bien de continuer au-delà d'un an, sans limite artificielle.

## 7. Processus d'attribution — décision humaine, pas automatique

Le système ne crée jamais de lien de coaching seul. Son rôle est de **proposer** le meilleur
candidat selon les règles ci-dessus. Un responsable (RH ou Office Manager) sollicite ensuite
le coach et le coaché pressentis, en direct. Ce n'est qu'après cet accord que la proposition est
validée dans l'outil et le lien devient actif.

Ce fonctionnement garantit qu'aucun appairage n'est imposé sans consentement, et laisse la place
au jugement humain pour des situations que le système ne peut pas connaître (conflit
interpersonnel, départ imminent, etc.).

## 8. Source des données

Toutes les informations viennent de l'ERP Furious, en lecture seule :

- **Identité et grade** des collaborateurs (nom, grade, business unit, date d'arrivée).
- **Affectation projet** : qui travaille sur quelle mission, via l'objet "Grille tarifaire
  projet" — c'est cette donnée qui permet d'appliquer la règle de mission/client différent.
- **Client de la mission**, via l'objet "Projet".

Le système **n'écrit jamais dans Furious**. Toute la logique d'attribution (qui coache qui,
depuis quand, avec quel score) est stockée dans une base de données dédiée, propriété du
dispositif, distincte de Furious et de l'outil d'automatisation.

## 9. Détection des arrivées et des départs

Furious ne signale pas fiablement les départs de collaborateurs (le champ prévu à cet effet
n'est pas renseigné en pratique). Le système compare donc chaque jour la liste des
collaborateurs actifs à celle de la veille : une personne qui apparaît est une nouvelle
arrivée, une personne qui disparaît est considérée comme partie (et son coaching en cours, le
cas échéant, est clôturé).

Par sécurité, si plus de 5 disparitions sont détectées en une seule nuit, aucune clôture
automatique n'est faite — le cas est signalé pour vérification humaine, afin d'éviter qu'un
problème technique passager (panne de l'API) soit interprété à tort comme des départs massifs.

## 10. Interface

Les responsables RH consultent et valident les propositions via une interface dédiée (un
"Frame" sur la plateforme Dust), connectée en direct à l'automatisation. Cette interface permet
de voir les propositions en attente, leur justification (score, mission, client), et de les
valider ou de les rejeter.

## 11. Ce que cette V1 ne couvre pas

- Les collaborateurs déjà en poste sans coach (report en V2).
- Le recueil du volontariat des coachs : cette démarche reste faite en interne, de vive voix,
  en dehors du système.
- Un contrôle automatique de la neutralité mission/client dans les cas où l'affectation n'est
  pas encore connue au moment de l'attribution.
- Une alerte en cas de coach systématiquement refusé par les personnes sollicitées.

## 12. Prochaine étape

Rédaction du plan d'implémentation technique (workflow d'automatisation, structure de la base
de données, sécurisation des accès).
