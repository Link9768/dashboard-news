# Enrichissement rapport état des appareils NinjaOne — infos d'intégrité

## Contexte

Le workflow n8n `Ninja état des appareils 03` (id `Jk5VOziMFEqfT3urDZEuQ`) génère mensuellement un rapport HTML uploadé sur SharePoint comme preuve ISO 27001 (contrôles A.8.9 gestion des configurations / A.8.8 gestion des vulnérabilités techniques). Aujourd'hui il ne collecte que le statut en ligne/hors ligne/maintenance via `GET /v2/devices`.

Besoin : enrichir la collecte avec des données d'intégrité par appareil, en n'utilisant que des champs API réellement vérifiés (aucune donnée inventée ou supposée).

## Vérification des données disponibles

Test réalisé sur un appareil réel (SEIZE-OVI, id 1) via `GET /v2/device/{id}` :

**Champs confirmés disponibles et fiables :**
- `os.name`, `os.buildNumber`, `os.needsReboot` — identité OS et besoin de reboot
- `lastContact` (timestamp Unix) — dernier contact agent
- `volumes[].capacity`, `volumes[].freeSpace` — espace disque
- `lastLoggedInUser` — dernier utilisateur connecté
- `system.manufacturer`, `system.model`, `system.serialNumber` — identité matérielle

**Champs testés et écartés :**
- `GET /v2/device/{id}/os-patches` : retourne une liste de patchs avec `severity` et `status` (`APPROVED`/`OPTIONAL`), mais **aucun champ fiable indiquant si le patch est réellement installé**. Un fichier de rapport antérieur trouvé sur SharePoint (`NinjaRMM-2026-07-20_1308.html`) montrait un calcul de "conformité patchs" à 0% avec 243 patchs "approuvés" mais 0 "installés" — résultat incohérent, signe d'un mapping de champs cassé. Écarté de cette v1.
- Antivirus : aucun champ AV dans les réponses observées. Écarté.

## Périmètre v1

Ajout d'un tableau détaillé par appareil sous la synthèse globale existante, avec ces colonnes uniquement (toutes vérifiées) :

| Colonne | Champ API | Traitement |
|---|---|---|
| Nom | `systemName` | tel quel |
| Statut | `offline` / `maintenance.status` | badge coloré vert/orange/rouge |
| OS | `os.name` + `os.buildNumber` | concaténé |
| Reboot requis | `os.needsReboot` | badge rouge si `true` |
| Dernier contact | `lastContact` | timestamp Unix → date lisible fr-FR |
| Disque libre | `volumes[0].freeSpace` / `volumes[0].capacity` | % + Go, badge rouge si <10% |
| Dernier utilisateur | `lastLoggedInUser` | tel quel |

La synthèse globale existante (total / en ligne / hors ligne / en maintenance + barre de répartition) est conservée telle quelle.

## Architecture

```
Schedule Trigger (mensuel, inchangé)
  → Get NinjaOne Token (inchangé)
  → Get NinjaOne Devices (inchangé — liste des ~82 appareils avec leurs id)
  → [NOUVEAU] Get Device Detail (boucle sur chaque id via Split in Batches)
  → Formater Rapport NinjaOne (enrichi avec le tableau détaillé)
  → Config → Get M365 Token → Get Drive List → Extraire Drive ID (inchangés)
  → Uploader NinjaOne SharePoint (inchangé)
```

### Boucle de collecte détaillée

`GET /v2/device/{id}` doit être appelé une fois par appareil (~82 appels). Pour éviter le rate-limiting NinjaOne :
- `Split in Batches` (lots de 10 appareils)
- Petit délai entre lots (node Wait, quelques secondes)

### Gestion d'erreurs

Si `Get Device Detail` échoue pour un appareil donné (agent hors ligne depuis longtemps, endpoint indisponible), le workflow ne doit pas s'arrêter : l'appareil concerné apparaît dans le tableau avec la mention "Détail indisponible" sur les colonnes concernées, en conservant au minimum son statut de base (déjà connu via `Get NinjaOne Devices`).

## Hors périmètre (v1)

- Statut antivirus (non exposé par l'API)
- Conformité des patchs OS (champ "installé" non fiable dans l'API testée)
- Ces deux points pourront être réévalués si un endpoint ou un champ fiable est identifié ultérieurement.
