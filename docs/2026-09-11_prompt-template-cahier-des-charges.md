# Prompt — Générer un cahier des charges à partir d'un besoin brut

Template réutilisable. Usage : coller ce prompt dans une session IA, puis fournir le besoin
brut (notes, transcript de réunion, message Slack/Teams, idée en vrac). Méthode extraite du
cadrage réel du dispositif de coaching automatique
([design](superpowers/specs/2026-09-01-coaching-auto-design.md),
[cahier des charges](2026-09-01_cahier-des-charges-attribution-coachs.md)).

---

## PROMPT À COPIER

```
Tu es chargé de transformer un besoin exprimé de façon informelle en cahier des charges
exploitable. Voici le besoin brut :

<< COLLER ICI le texte brut : notes, message, transcript, idée >>

Avant de rédiger quoi que ce soit, applique cette méthode.

## 1. Extraire, ne pas inventer

Liste séparément :
- ce qui est explicitement dit (règles, contraintes, exemples concrets donnés)
- ce qui est implicite mais nécessaire pour que le besoin tienne debout (ex : "attribuer X"
  implique forcément "détecter qu'il faut attribuer X" et "savoir quand arrêter")
- ce qui manque et doit être demandé avant de continuer

Ne complète jamais un vide par une hypothèse silencieuse. Si une info manque, pose la question
plutôt que de deviner — une seule question à la fois, avec des options concrètes si possible
(pas des questions ouvertes qui demandent un essai de rédaction).

## 2. Vérifier avant de construire une règle dessus

Pour toute règle qui dépend d'une donnée externe (un champ d'API, une colonne d'un fichier, un
système tiers) : ne pas supposer que la donnée existe ou a le format attendu. Demander une
vérification concrète (un appel réel, un export, une capture d'écran) avant d'écrire la règle
comme acquise. Si la vérification n'a pas encore eu lieu, marquer la règle comme conditionnelle
et dire explicitement ce qui la validerait ou l'invaliderait.

Distinguer trois niveaux de confiance dans les affirmations : vérifié (testé réellement),
déduit (cohérent avec la doc mais non testé), supposé (hypothèse à confirmer). Ne jamais
présenter un supposé comme un vérifié.

## 3. Chiffrer avant de trancher

Dès qu'un arbitrage porte sur des volumes, des ratios ou une capacité (ex : "combien de X pour
combien de Y"), calculer sur les vraies données plutôt que d'estimer à l'intuition. Si les
données réelles sont disponibles, les utiliser pour produire des chiffres exacts et présenter
le résultat avant de proposer des options d'arbitrage — jamais l'inverse.

## 4. Qualifier chaque règle

Pour toute règle de sélection/attribution/validation, préciser explicitement son type :
- **bloquante** : élimine une option sans appel
- **malus/bonus** : influence un classement sans exclure
- **conditionnelle** : ne s'applique que si une donnée est disponible

Une règle non qualifiée est ambiguë et sera mal implémentée. Systématiquement se demander : si
cette règle empêche de trouver une seule solution valide, que se passe-t-il ? "Pas de solution"
est rarement acceptable — proposer un repli explicite (assouplissement en cascade, dernier
recours, file d'attente) plutôt que de laisser un cas sans issue.

## 5. Détecter les contradictions entre décisions successives

Un cahier des charges se construit par itérations : chaque nouvelle contrainte peut contredire
une décision déjà actée. Avant d'intégrer une nouvelle règle, vérifier explicitement si elle
entre en tension avec une règle précédente. Si oui, le dire clairement et demander comment
trancher — ne jamais choisir silencieusement une interprétation qui écrase l'autre.

## 6. Structurer la sortie

Produire un document avec ces sections (adapter les noms au domaine, garder la structure) :

1. **Objectif** — 1 à 2 phrases, ce que le dispositif doit accomplir
2. **Constat de départ** — pourquoi ce besoin existe, quel problème actuel il corrige
3. **Périmètre** — ce qui est traité dans cette version, ce qui est explicitement exclu et
   pourquoi (jamais une exclusion silencieuse)
4. **Qui/quoi est concerné** — les populations ou objets en jeu, avec leurs critères
   d'inclusion/exclusion
5. **Règles** — sous forme de tableau : nom de la règle, type (bloquant/malus/conditionnel),
   description. Une ligne par règle, pas de règles mélangées en prose.
6. **Cas particuliers et limites** — les situations où une règle ne s'applique pas, et ce qui
   se passe alors
7. **Processus** — qui déclenche quoi, où est la décision humaine si le sujet le justifie,
   qu'est-ce qui est automatique vs validé manuellement
8. **Source des données** — d'où vient chaque information utilisée, avec son niveau de
   confiance (vérifié/déduit/supposé)
9. **Ce que cette version ne couvre pas** — explicite, pas laissé à déduire
10. **Prochaine étape** — ce qui reste à faire avant la construction

## 7. Avant de livrer

Relire le document et vérifier :
- chaque règle a un type explicite (bloquant/malus/conditionnel)
- aucune affirmation "vérifiée" n'est en fait une supposition
- aucune contradiction entre deux sections
- chaque exclusion du périmètre a une raison écrite
- les chiffres cités viennent d'un calcul sur données réelles, pas d'une estimation

Si un point reste incertain après cette relecture, le signaler explicitement plutôt que de
livrer un document qui a l'air complet mais cache une zone floue.
```

---

## Notes d'usage

- Ce prompt suppose un dialogue itératif (l'IA pose des questions, attend les réponses, affine).
  Si le besoin est déjà complet et sans zone grise, l'IA peut produire directement le document,
  mais doit quand même appliquer la checklist de relecture (§7).
- Pour un besoin technique (workflow, API, base de données), ajouter en tête du besoin brut le
  contexte technique disponible (endpoints connus, contraintes d'infra) — le prompt s'appuiera
  dessus pour la section 8 (Source des données).
- Le format tableau de la section 5 (Règles) est ce qui a le plus structuré le cadrage réel :
  il force à trancher le type de chaque règle plutôt que de la laisser en prose ambiguë.
