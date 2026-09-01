# Attribution automatique de coachs — Design v1

Date : 2026-09-01
Statut : validé, prêt pour plan d'implémentation

## Contexte

Seize Consulting veut coacher ses nouveaux arrivants (Stagiaire à Consultant Sénior) via un
appairage automatique avec un coach interne. Le dispositif Excel actuel
n'est pas à jour : le champ `cf_1_coach` de Furious est obsolète, aucune date d'attribution
n'est fiable, aucun historique n'existe.

## Périmètre V1

**Revirement du 2026-09-01 : le rattrapage du stock existant entre dans le périmètre V1.**
La décision initiale ("nouveaux arrivants uniquement, stock existant en V2") est abandonnée.
Deux mécanismes compensent le déficit structurel identifié à l'origine (56 coachés potentiels
pour 29 coachs) : la clôture automatique par sortie de grade (§Fin de coaching par changement
de grade) et l'assouplissement de RG·CAP (§Règles de matchmaking). Le principe qui justifiait
l'exclusion du stock — éviter des dizaines d'appairages non vérifiés le même jour — reste
valable opérationnellement : le traitement du stock doit être **amorcé progressivement**, pas
déclenché en un seul batch, cf. §Amorçage.

L'automatisation continue de traiter :
1. les **nouveaux arrivants**, au fil de l'eau (flux, mécanisme inchangé) ;
2. le **stock existant** identifié le 2026-09-01 (voir liste ci-dessous), traité comme des
   propositions à valider au même titre que les nouveaux arrivants — pas d'écriture automatique
   sans validation humaine, cf. §Processus d'attribution.

### État observé au 2026-09-01 (base de l'amorçage)

**Liens actuels à réexaminer** — le coaché a dépassé le grade limite de RG·AT0, son coach doit
être libéré automatiquement (cf. §Fin de coaching par changement de grade) :

| Grade actuel du coaché | Coaché | Coach |
|---|---|---|
| Manager | Bastien Cabanes | Philippe Spoljaric |
| Manager | Luc Chapelle | Georges Baguenier Desormeaux |
| Manager | Baptiste Lambert | Sinda Yacoubi |
| Manager | Laurène Masclet | Yves Canaux de Bonfils |
| Manager | Sinda Yacoubi | Yves Canaux de Bonfils |
| Expert | Ronan Lambert | Sinda Yacoubi |

**Consultants Juniors actuellement sans coach**, à intégrer au moteur de proposition :
Benjamin Chouquet, Chaima Fekih Salem, Titouan Gragnic, Hedi Kalboussi, Anis Khaldi,
Amine Saidi.

**Consultants Séniors actuellement sans coach**, à intégrer au moteur de proposition :
Amélie Grandmougin, Farah Helal, Alexis-François Papin.

*Note : la table "Manager coach X" fournie deux fois (une fois sous "Manager", une fois sous
"Consultant expérimenté") — traitée comme un seul et même jeu de données, la duplication étant
un doublon de saisie. À confirmer si une deuxième liste distincte existait pour les Consultants
Expérimentés.*

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
| RG·AT0 | Qui est coaché / qui coache | Filtre | Coaché : grade dans {Stagiaire, Consultant Junior, Consultant Expérimenté, Consultant Sénior}. Coach : à partir de Manager, **ou** Consultant Junior sous condition RG·AT2 (voir ligne suivante). Un Consultant Junior peut donc être à la fois coaché (par un Expérimenté+) et coach (d'un Stagiaire), ce ne sont pas des ensembles disjoints. |
| RG·AT1 | Écart de grade | Filtre en cascade | >= 2 grades en priorité ; si aucun candidat ne survit avec 2, le filtre s'assouplit automatiquement à >= 1 grade pour ce coaché. **Deux viviers possibles pour un Stagiaire** : parrain >= Consultant Expérimenté (écart >= 2, palier prioritaire) **ou**, si la cascade descend au palier assoupli, un Consultant Junior éligible via RG·AT0 (écart = 1). Aucun écart de 0 n'est jamais autorisé. |
| RG·AT2 | Ancienneté du coach | Filtre | `arrival_date` >= 1 an, **tout coach potentiel confondu** — y compris un Consultant Junior (cf. RG·AT0). Champ confirmé disponible sur l'objet Utilisateur. |
| RG·CAP | Capacité du coach | Filtre | 1 coaché actif par défaut. Extensible à 2 uniquement sur accord explicite du coach (pas un CAP global à 2 — une exception par coach, tracée). |
| RG·NT1 | Mission différente | Bloquant **si la donnée existe** | Coach exclu s'il a une ligne active dans Grille tarifaire projet sur le même `project_id` que le coaché. Si le coaché n'a aucune affectation connue (stagiaire non staffé, inter-contrat), la règle est **sans objet** et n'empêche pas l'attribution. Voir §Stabilité du lien. |
| RG·NT2 | Client différent | Malus (non bloquant) | Même logique via `Project.company_name`. Un appairage même-client reste possible en dernier recours. Sans objet si pas d'affectation connue. |
| RG·NT3 | Ouverture inter-pôles | Bonus | `bu_name` différente entre coach et coaché. |
| ~~RG·VOL~~ | ~~Volontariat~~ | **Retiré de l'automatisation** | Le consentement des coachs est recueilli en interne, de vive voix, après proposition du moteur. Voir §Processus d'attribution. |
| ~~RG·FIN~~ | ~~Durée du lien~~ | **Mise de côté** | Plus de clôture à échéance fixe (1 an). Le lien dure jusqu'à un départ, une demande explicite, ou une sortie de grade (RG·GRADE ci-dessous). |
| RG·GRADE | Fin par changement de grade | **Clôture automatique** | Dès que le grade du coaché sort de RG·AT0 (>= Manager), le lien est clôturé sans validation humaine et le coach redevient disponible. Seule clôture automatique du dispositif — tout le reste (attribution, refus) passe par une validation humaine. |

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

Trois événements clôturent un coaching : le départ de l'une des deux personnes, une demande
explicite, ou la sortie de grade du coaché (RG·GRADE — seule clôture automatique, sans
validation humaine, cf. §Règles de matchmaking). Il n'y a plus d'échéance automatique fixe
(RG·FIN mise de côté) — un lien peut durer plusieurs années si les deux parties le souhaitent
et que le coaché reste dans la tranche de grades coachée.

**RG·GRADE ne contredit pas le principe ci-dessus** : la stabilité du lien porte sur RG·NT1/NT2
(mission, client), qui ne sont jamais réévalués après attribution. RG·GRADE est une clôture par
sortie de périmètre (RG·AT0), une logique différente — le dispositif ne coache plus ce grade,
il n'y a plus de justification à maintenir le lien.

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
  date_fin_reelle,  -- NULL tant que le lien est actif ; pas de date prévue (RG·FIN mise de côté)
  motif_fin,        -- depart | demande | sortie_grade
  origine,          -- arrivee | rattrapage
  cap_etendu,       -- true si ce coach a explicitement accepté un 2e coaché (dérogation RG·CAP)
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
                       statut = actif, date_debut = date de validation
                       (pas de date de fin prévue — durée illimitée par défaut)
  -> refus           : clic "Rejeter", le moteur propose le candidat suivant du classement
```

Le Frame affiche, pour chaque proposition : le score, le motif du classement, la mission et le
client du coaché — ce dernier point servant de garde-fou humain à RG·NT1/NT2, dont la fiabilité
dépend d'une donnée Furious imparfaite.

Une proposition sans suite n'expire pas automatiquement : elle reste visible dans le Frame
jusqu'à traitement. Le nombre de propositions en attente est un indicateur de santé du dispositif.

## Amorçage du stock existant

Le stock (§Périmètre V1) n'est pas injecté d'un coup. Il est traité par lots, dans cet ordre :

```
1. Clôturer les 6 liens identifiés où le coaché a dépassé le grade limite (RG·GRADE)
   -> les coachs concernés (Philippe Spoljaric, Georges Baguenier Desormeaux, Sinda Yacoubi,
      Yves Canaux de Bonfils) reviennent dans le vivier disponible

2. Générer les propositions pour les 9 collaborateurs identifiés sans coach
   (6 Consultants Juniors + 3 Consultants Séniors), par lot de 3-4 max par jour
   -> mêmes règles, même écran de validation que pour un nouvel arrivant

3. Reprendre le reste du stock (collaborateurs non listés le 2026-09-01, hors ceux déjà
   couverts) au même rythme progressif, jusqu'à résorption
```

Le rythme par lot n'est pas fixé arbitrairement — il doit rester assez faible pour que chaque
proposition validée serve de test sur les règles avant le lot suivant, dans le même esprit que
le traitement au fil de l'eau des nouveaux arrivants.

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
  détecte les sorties de grade (clôture automatique RG·GRADE), fait tourner le moteur de
  matchmaking sur les arrivées et sur le stock encore non traité, écrit les propositions,
  clôture les coachings dont le coach ou le coaché est parti.
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
- Pas de vérification de refus/répétition abusive (un coach systématiquement rejeté par la
  validation humaine) — à surveiller manuellement en V1, formaliser si le besoin apparaît.
- RG·CAP compte les coachings en statut `actif` uniquement. Une proposition en attente ne
  réserve pas la place du coach : deux propositions simultanées peuvent viser le même coach.
  Acceptable au volume V1, à revoir si les propositions s'accumulent.
- **RG·FIN mise de côté, en partie compensée par RG·GRADE.** Un coach ne libère sa place que
  par départ, demande explicite, ou sortie de grade de son coaché — pas par simple échéance.
  RG·GRADE réduit la tension sur le vivier (les Managers+ ne restent jamais coachés) mais ne
  l'élimine pas : un lien avec un Consultant Sénior qui reste longtemps à ce grade immobilise
  son coach durablement. Indicateur à surveiller : nombre de coachs "pleins" dans le temps.
- L'amorçage du stock (§Amorçage) dépend d'un état observé manuellement le 2026-09-01, non
  d'une requête automatisée : à re-vérifier par le moteur au premier run plutôt que pris pour
  acquis, l'état ayant pu changer entre l'observation et la mise en production.

## Prochaines étapes

1. Plan d'implémentation détaillé (workflow n8n, schéma SQL, credential Header Auth
   `F-Auth-Token`).
2. Vérifier si le champ technique `start_date`/`end_date` de `ProjectRateCard` est accessible
   autrement que via le picker de colonnes de l'Explorer (question à poser côté admin Furious).
