# Conversion Markdown unique → Mail / Teams / WhatsApp

## Contexte

Workflow `Ed0jzFVdq4nan2qt` ("Formulaire - Envoi Message Personnalisé"). Une collègue saisit un
message via un formulaire n8n public, qui doit partir sur trois canaux : Mail (Outlook), Teams,
WhatsApp (Evolution API).

**Constat de départ (vérifié)** : les nodes `Envoi Teams` et `Envoi WhatsApp (Evolution API)1`
sont actuellement déconnectés du flux (`Prépare données` n'alimente que la branche mail). Les
tests de liens cliquables "qui ne passaient pas" sur WhatsApp/Teams n'avaient donc jamais
réellement atteint ces canaux — seul le mail a été testé jusqu'ici.

**Besoin** : une seule saisie par la collègue, qui donne un rendu correct sur les 3 canaux, sans
qu'elle ait à connaître le HTML ni à adapter son texte par canal.

## Contrainte non négociable

Les trois canaux n'ont pas le même moteur de rendu :

| Canal | Moteur | Gras | Taille de titre | Lien avec texte personnalisé |
|---|---|---|---|---|
| Mail (Outlook, Graph API) | HTML complet | oui | oui (`<h1>`, styles) | oui (`<a href>`) |
| Teams (Graph API, `contentType: html`) | HTML restreint | oui | **non** (pas de contrôle de taille) | oui (`<a href>`) |
| WhatsApp (Evolution API) | Markdown propriétaire | oui (`*texte*`) | **non** (aucune notion de taille) | **non** (URL brute uniquement, cliquable mais visible telle quelle) |

Un rendu strictement identique sur les 3 canaux est donc impossible sans dégrader le mail au
niveau du plus pauvre (WhatsApp). Le design retenu (option A, validée avec l'utilisateur)
accepte une dégradation gracieuse : chaque canal reçoit le meilleur rendu qu'il peut afficher.

## Format de saisie

La collègue écrit en **Markdown simple**, dans le champ "Votre message" du formulaire existant.
Aucun HTML à taper.

Syntaxe supportée :
- `# Titre` → titre (rendu gros+gras en mail, gras seul sur Teams/WhatsApp)
- `**gras**` → gras sur les 3 canaux
- `[texte](url)` → lien avec texte personnalisé en mail/Teams ; sur WhatsApp devient
  `texte : url` (URL brute cliquable, sans texte de substitution)
- Retours à la ligne simples → conservés tels quels sur les 3 canaux

Le collage direct de HTML (cas signature Outlook) reste géré séparément par la détection
`estDejaHtml` déjà en place dans le node "Convertit Markdown vers HTML" — cette spec ne
modifie pas ce chemin existant, elle ajoute la génération de la variante WhatsApp/Teams à partir
du Markdown source, avant que la conversion HTML n'écrase le texte.

## Architecture

```
Formulaire Message
   ↓
Prépare données (Set)
   ↓
Génère les 3 versions (Code) — NOUVEAU
   ├─ version_html   (mail : titre gros, gras, liens <a href>)
   ├─ version_teams   (Teams : gras, pas de taille, liens <a href>)
   └─ version_whatsapp (WhatsApp : *gras*, pas de titre, "texte : url")
   ↓ (chaque branche lit son propre champ)
   ├─→ Envoi Teams               (reconnecté, lit version_teams)
   ├─→ Envoi WhatsApp            (reconnecté, lit version_whatsapp)
   └─→ Liste contacts - Filtre exclusion → ... → Envoi Mail (lit version_html, chemin existant inchangé)
```

Le node "Convertit Markdown vers HTML" existant est renommé implicitement en assumant le rôle
de générateur mail ; sa logique `estDejaHtml` est conservée telle quelle pour le cas signature
collée. Le nouveau node "Génère les 3 versions" se place **avant** lui dans le flux mail, et en
parallèle alimente Teams et WhatsApp directement (ces deux canaux n'ont pas besoin du chemin
pièce-jointe/exclusion mail).

## Règles de conversion (implémentées en JavaScript, dans un node Code)

Entrée : texte Markdown brut (ou HTML déjà collé, détecté et laissé tel quel pour la branche
mail uniquement — les branches Teams/WhatsApp appliquent un strip-HTML basique si détecté, pour
éviter d'envoyer des balises brutes sur ces canaux).

1. **Titres** (`# texte` en début de ligne)
   - Mail : `<h2 style="...">texte</h2>` (une seule taille, pas de hiérarchie multi-niveaux —
     hors scope)
   - Teams : `<b>texte</b>`
   - WhatsApp : `*texte*`

2. **Gras** (`**texte**`)
   - Mail : `<b>texte</b>`
   - Teams : `<b>texte</b>`
   - WhatsApp : `*texte*`

3. **Liens** (`[texte](url)`)
   - Mail : `<a href="url">texte</a>`
   - Teams : `<a href="url">texte</a>`
   - WhatsApp : `texte : url`

4. **Retours à la ligne**
   - Mail : `\n` → `<br>` (comportement actuel conservé, protégé par `estDejaHtml`)
   - Teams : `\n` → `<br>` (contentType html)
   - WhatsApp : `\n` conservé tel quel (WhatsApp interprète nativement)

## Nodes touchés

- **Nouveau** : Code node "Génère les 3 versions", juste après "Prépare données"
- **Modifié** : "Envoi Teams" — reconnecté au flux, `contentType` passé à `html`
  (actuellement `text` par défaut, cf. `CLAUDE.md` §5), lit `version_teams`
- **Modifié** : "Envoi WhatsApp (Evolution API)1" — reconnecté au flux, lit `version_whatsapp`
- **Inchangé** : "Convertit Markdown vers HTML" (logique `estDejaHtml` conservée), "A une pièce
  jointe ?", "Envoi Mail (Outlook)", "Envoi Mail avec PJ (Outlook)"

## Erreurs et cas limites

- Message sans aucune syntaxe Markdown (texte brut simple) → passe inchangé sur les 3 canaux,
  aucune régression par rapport à l'existant.
- HTML collé (cas signature) → branche mail inchangée (comportement actuel) ; branches
  Teams/WhatsApp appliquent un strip basique des balises pour éviter d'envoyer du HTML brut
  affiché tel quel (repris du constat déjà fait sur WhatsApp : aucune interprétation HTML).
- Lien sans texte (`[](url)` ou URL nue déjà dans le texte) → laissé tel quel sur les 3 canaux,
  pas de reformattage forcé.

## Prérequis / limites

- Pas de credential supplémentaire nécessaire (Teams et WhatsApp utilisent déjà leurs
  credentials/config existants).
- Limite actée et communiquée à l'utilisateur : pas de titre visuellement "gros" possible sur
  Teams ni WhatsApp, seulement du gras — limitation des plateformes, pas du workflow.
- Limite actée : pas de lien avec texte personnalisé sur WhatsApp — le protocole n'affiche que
  des URLs brutes cliquables.
