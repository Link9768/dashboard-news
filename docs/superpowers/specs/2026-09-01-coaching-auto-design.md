# Attribution automatique de coachs — Design v1

Date : 2026-09-01
Statut : validé, prêt pour plan d'implémentation

## Contexte

Seize Consulting veut coacher ses nouveaux arrivants (Stagiaire à Consultant Sénior) via un
appairage automatique avec un coach interne, suivi pendant 1 an. Le dispositif Excel actuel
n'est pas à jour : le champ `cf_1_coach` de Furious est obsolète, aucune date d'attribution
n'est fiable, aucun historique n'existe.

## Périmètre V1

**Uniquement les nouveaux arrivants**, au fil de l'eau. Pas de rattrapage des 83 collaborateurs
déjà en poste sans coach — décision explicite, pour deux raisons :

- le volume réel (quelques arrivées/mois) rend le déficit structurel non pertinent en V1 ;
  RG·CAP=1 (décision du 03/08) est arithmétiquement intenable sur un traitement en lot (56
  candidats pour 29 coachs), mais tout à fait viable sur un flux d'arrivées.
- un dispositif RH qui rate son lancement (56 appairages douteux le même jour si une règle a
  un bug) ne se relance pas. Un flux de 2-3/mois permet de corriger en marche.

Le rattrapage du stock existant est une V2 explicitement hors scope, permise par le schéma de
données (colonne `origine` sur la table `coaching`), mais non développée ici.

## Exclusions du dispositif

Fonctions support (jamais coachées, jamais coachs) :
Assistante de direction, Chargé de recrutement, Marketing.

Comptes techniques/test : `furious`, `ZTEST.yves`.

Grades hors échelle sans mapping (ex. Consultant IA et Office Manager — `jules.bataille`) :
exclus par défaut, à traiter au cas par cas si le grade apparaît sur un nouvel arrivant.

Départs : voir §Détection des départs.

## Règles de matchmaking

| # | Règle | Traitement | Détail |
|---|---|---|---|
| RG·AT0 | Qui est coaché | Filtre | Grade dans {Stagiaire, Consultant Junior, Consultant Expérimenté, Consultant Sénior}. À partir de Manager : pas coaché, entre dans le vivier de coachs. |
| RG·AT1 | Écart de grade | Filtre en cascade | >= 2 grades en priorité ; si aucun candidat ne survit avec 2, le filtre s'assouplit automatiquement à >= 1 grade pour ce coaché. Cas stagiaire : parrain >= Consultant Expérimenté, quel que soit le palier. |
| RG·AT2 | Ancienneté du coach | Filtre | `arrival_date` >= 1 an. Champ confirmé disponible sur l'objet Utilisateur. |
| RG·CAP | Capacité du coach | Filtre | 1 coaché actif max par coach (viable en V1 grâce au périmètre "arrivées seulement"). |
| RG·NT1 | Mission différente | Bloquant **si la donnée existe** | Coach exclu s'il a une ligne active dans Grille tarifaire projet sur le même `project_id` que le coaché. Si le coaché n'a aucune affectation connue (stagiaire non staffé, inter-contrat), la règle est **sans objet** et n'empêche pas l'attribution. Voir §Stabilité du lien. |
| RG·NT2 | Client différent | Malus (non bloquant) | Même logique via `Project.company_name`. Un appairage même-client reste possible en dernier recours. Sans objet si pas d'affectation connue. |
| RG·NT3 | Ouverture inter-pôles | Bonus | `bu_name` différente entre coach et coaché. |
| ~~RG·VOL~~ | ~~Volontariat~~ | **Retiré de l'automatisation** | Le consentement des coachs est recueilli en interne, de vive voix, après proposition du moteur. Voir §Processus d'attribution. |
| RG·FIN | Durée du lien | — | 1 an. À échéance, clôture automatique, le coach retourne au vivier. |

### Scoring (candidats survivants aux filtres bloquants)

```
+ pôle différent (RG·NT3)
- même client (RG·NT2)
- coach déjà sollicité récemment (équité de charge)
```

### Ordre d'application RG·AT1 (cascade)

```
1. Appliquer tous les filtres (AT0, AT2, CAP, NT1, VOL) + AT1 à 2 grades minimum
2. Si >= 1 candidat survit -> scoring sur cette liste, fin
3. Si 0 candidat -> réappliquer les mêmes filtres avec AT1 assoupli à 1 grade minimum
4. Scoring sur cette liste élargie
```

L'assouplissement est journalisé (motif visible dans le mail d'attribution et dans
`coaching`), pour permettre un suivi de fréquence — si la cascade au palier 1 devient
majoritaire, c'est le signe que le vivier de coachs est structurellement insuffisant.

## Stabilité du lien de coaching

**Principe : RG·NT1 et RG·NT2 sont des critères d'attribution, pas des conditions permanentes.**
Ils s'appliquent au moment de l'appairage, avec l'information disponible à cet instant. Une fois
le lien créé, il n'est jamais réévalué.

Conséquences assumées :

- **Déclencheur = l'arrivée**, pas l'entrée en mission. Un nouvel arrivant sans affectation
  connue (stagiaire, apprenti, inter-contrat) reçoit quand même un coach : RG·NT1/NT2 sont
  alors sans objet, l'appairage se fait sur grade + ancienneté + capacité.
- **Un changement de mission ne rompt rien.** Si le coaché rejoint plus tard la mission de son
  coach — cas fréquent pour les stagiaires, staffés typiquement 1 à 2 mois après leur arrivée —
  le lien est maintenu. Casser une relation établie depuis plusieurs mois ferait plus de dégâts
  que le conflit de neutralité qu'on cherchait à éviter.
- Aucune alerte, aucune réattribution sur ce motif. Comportement voulu, pas défaut à corriger.

Seuls trois événements clôturent un coaching : l'échéance des 12 mois (RG·FIN), le départ de
l'une des deux personnes, ou une demande explicite.

## Données Furious

### Objet Utilisateur (GET /api/v2/user/ -> search)

Champs retenus, confirmés disponibles :

```
id, pseudo, firstname, lastname, arrival_date, departure_date,
status, bu_name, entity, cf_1_coach, cf_5_grade, updated_at
```

`cf_1_coach` : lu mais **ignoré** en V1 (données obsolètes, cf. Contexte). Conservé dans le
miroir pour audit/comparaison manuelle uniquement.

### Objet Grille tarifaire projet (ProjectRateCard, GET /api/v2/project-rate-card/ -> search)

Champs confirmés par appel réel :

```
id, project_id, project_title, assign_to_user
```

**Limite connue** : pas de `start_date`/`end_date` propre à la ligne d'affectation, malgré la
documentation Swagger PDF qui les annonce (écart PDF / implémentation réelle, vérifié le
2026-08-31). RG·NT1/NT2 se basent donc sur "une ligne existe et le projet est actif"
(`Project.actif = true`), pas sur une fenêtre temporelle précise.

**`assign_to_user = "0"`** = poste non pourvu (ligne de prévisionnel sans affectation réelle).
À exclure systématiquement du calcul de neutralité.

**Multi-affectation confirmée** : un `assign_to_user` peut apparaître sur plusieurs lignes
(même projet ou projets différents). Le moteur doit vérifier l'ensemble des lignes actives
d'une personne, pas seulement la première trouvée.

**Volume** : 702 lignes au total -> pagination obligatoire (`limit=250` + boucle sur `offset`).

### Objet Projet (Project, GET /api/v2/project/ -> search)

```
id, title, company_name, contact_company_id, actif
```

Jointure : `ProjectRateCard.project_id = Project.id`, filtré sur `Project.actif = true`.

## Détection des arrivées et des départs

Pas de champ fiable pour un départ (`departure_date` existe mais n'est jamais renseigné dans
l'usage actuel — vérifié sur un cas connu, la personne apparaît toujours avec le champ vide).
Les comptes des personnes parties sont supprimés côté Furious avec un délai (observé : au
moins plusieurs semaines après le départ réel).

**Mécanisme retenu : comparaison quotidienne de la liste des `id` Utilisateur avec la table
miroir `collaborateur` de la veille.**

```
id présent hier, absent aujourd'hui -> DÉPART
  - collaborateur.actif = false, date_disparition = today
  - coaching actif clôturé (motif_fin = 'depart')
    - si départ du COACH  -> coaché remis en file, nouvelle attribution
    - si départ du COACHÉ -> coach libère sa place
  - notification (pas de clôture silencieuse)

id absent hier, présent aujourd'hui -> ARRIVÉE
  - si grade dans RG·AT0 -> entre dans le moteur d'attribution
```

**Garde-fou** : si plus de 5 disparitions détectées en une nuit, aucune clôture automatique —
alerte et validation humaine (protection contre un échec partiel de l'appel API interprété à
tort comme des départs en masse).

**Premier run** : amorçage silencieux (la table `collaborateur` est peuplée sans déclencher le
moteur — sinon tout l'effectif existant serait lu comme "nouvelles arrivées").

**Filet manuel complémentaire** : table `coach_eligibilite.exclu_dispositif`, pour les cas où
le champ `departure_date` sera renseigné par les RH dans le futur, ou pour couvrir le délai
entre départ réel et suppression du compte Furious. Exclusions connues à ce jour :
`fatiha.ousalem`, `jeanne.buee` (parties, comptes encore présents dans Furious).

## Écriture — pas de retour vers Furious

Furious reste lecture seule. Aucune écriture sur `cf_1_coach` ni sur aucun champ Furious.
Raison : source de vérité RH externe, aucun droit d'écriture négocié, risque de désynchronisation
si un tiers modifie Furious en parallèle.

## Stockage

PostgreSQL, schéma dédié séparé du schéma interne de n8n (sur le VPS Hostinger déjà utilisé
par n8n — aucune infrastructure nouvelle).

```sql
-- Miroir Furious. Mémoire persistante (pas de TRUNCATE), sert à la détection arrivée/départ.
collaborateur (
  furious_id, pseudo, firstname, lastname, grade, bu_name, entity,
  arrival_date, actif, date_disparition, synced_at
)

-- Vérité métier. Une ligne par proposition puis par période de coaching, jamais d'écrasement.
coaching (
  id, coache_id, coach_id,
  statut,           -- propose | actif | termine | rejete
  score, motif_score,   -- traçabilité du classement, affichée dans le Frame
  at1_assoupli,     -- true si la cascade RG·AT1 est descendue à 1 grade
  date_proposition, -- écrite par le moteur
  date_debut,       -- NULL tant que non validé ; = date de validation humaine
  date_fin_prevue,  -- date_debut + 1 an, calculée à la validation
  date_fin_reelle,
  motif_fin,        -- echeance | depart | demande
  origine,          -- arrivee | rattrapage (V2, non utilisé en V1)
  created_at
)

-- Exclusions du dispositif, saisies/maintenues par un humain.
coach_eligibilite (
  furious_id,
  exclu_dispositif, motif_exclusion,  -- parti | compte technique | fonction support | demande
  commentaire, updated_at, updated_by
)
```

Le volontariat (ancien RG·VOL) ne figure plus dans ce schéma : il est traité hors système.

## Processus d'attribution — proposition puis validation humaine

Le moteur **propose**, il n'attribue pas. Le consentement des personnes concernées est recueilli
en interne, hors système. Aucun mail automatique de demande d'accord n'est envoyé — un seul
circuit de consentement, humain, pour éviter deux canaux contradictoires.

```
Moteur désigne le meilleur candidat
  -> écrit une ligne `coaching` en statut "propose"
  -> le Frame Dust l'affiche dans la liste des propositions en attente

Un humain (RH / Office Manager) sollicite coach et coaché de vive voix
  -> accord obtenu   : clic "Valider" dans le Frame
                       statut = actif, date_debut = date de validation,
                       date_fin_prevue = date_debut + 1 an
  -> refus           : clic "Rejeter", le moteur propose le candidat suivant du classement
```

Le Frame affiche, pour chaque proposition : le score, le motif du classement, la mission et le
client du coaché — ce dernier point servant de garde-fou humain à RG·NT1/NT2, dont la fiabilité
dépend d'une donnée Furious imparfaite.

Une proposition sans suite n'expire pas automatiquement : elle reste visible dans le Frame
jusqu'à traitement. Le nombre de propositions en attente est un indicateur de santé du dispositif.

## Architecture

```
Furious API  ──(lecture seule, quotidien)──>  n8n  ──>  PostgreSQL
                                               │           ▲
                                               │           │
                                          webhooks    lecture/écriture
                                               │           │
                                               └──  Frame Dust  (UI)
```

- **n8n (batch quotidien)** : synchronise le miroir `collaborateur`, détecte arrivées/départs,
  fait tourner le moteur de matchmaking, écrit les propositions, clôture les coachings arrivés
  à échéance (RG·FIN).
- **n8n (webhooks)** : expose les endpoints appelés par le Frame — lister les propositions en
  attente, valider, rejeter, consulter les coachings actifs.
- **Frame Dust** : interface de lecture et d'action. Capacité d'appel de webhook externe
  confirmée. Aucune logique métier côté Frame — il affiche ce que n8n lui renvoie et déclenche
  des actions via webhook.
- **PostgreSQL** : seule source de vérité du dispositif.

Sécurité des webhooks : `webhookId` explicite (UUID) obligatoire sur chaque node Webhook, et
authentification par header sur les endpoints qui écrivent (valider / rejeter).

## Limites connues de la V1

- RG·NT1/NT2 reposent sur "ligne d'affectation existante + projet actif", pas sur une fenêtre
  temporelle précise (donnée absente côté Furious malgré la documentation Swagger).
- Un coaché sans affectation au moment de l'attribution (stagiaire, inter-contrat) est appairé
  sans contrôle de neutralité mission/client. Assumé, cf. §Stabilité du lien.
- `departure_date` n'étant pas fiable aujourd'hui, la détection de départ a un délai correspondant
  au temps entre le départ réel et la suppression du compte Furious (observé : plusieurs semaines).
- Le rattrapage du stock existant (83 personnes sans coach) n'est pas traité — V2.
- Pas de vérification de refus/répétition abusive (un coach systématiquement rejeté par la
  validation humaine) — à surveiller manuellement en V1, formaliser si le besoin apparaît.
- RG·CAP compte les coachings en statut `actif` uniquement. Une proposition en attente ne
  réserve pas la place du coach : deux propositions simultanées peuvent viser le même coach.
  Acceptable au volume V1 (quelques arrivées/mois), à revoir si les propositions s'accumulent.

## Prochaines étapes

1. Plan d'implémentation détaillé (workflow n8n, schéma SQL, credential Header Auth
   `F-Auth-Token`).
2. Vérifier si le champ technique `start_date`/`end_date` de `ProjectRateCard` est accessible
   autrement que via le picker de colonnes de l'Explorer (question à poser côté admin Furious).
