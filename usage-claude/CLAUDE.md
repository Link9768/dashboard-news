# Usage Claude

Page locale (http://127.0.0.1:8765) : % de la session 5 h et de la semaine, compte à rebours, prochains resets. Source : le JSON que Claude Code envoie sur stdin à la commande `statusLine` (`rate_limits.five_hour|seven_day`).

- `lib/usage.js` — logique pure (formats, fusion, ligne de statut), chargée par Node et par la page.
- `statusline.js` — commande statusLine : écrit `usage.json` + `last-stdin.json`, affiche la ligne, sort toujours en code 0.
- `serveur.js` — serveur HTTP (liste blanche : `/`, `/lib/usage.js`, `/usage.json`). `usage-claude.cmd` = double-clic pour le lancer. `PORT`, `NO_OPEN=1` en option.
- `index.html` — la page (rafraîchit toutes les 5 s, compte à rebours chaque seconde).
- Données : `%USERPROFILE%\.claude\usage-claude\` (remplaçable par `USAGE_CLAUDE_DIR`, utilisé par les tests).
- Tests : `node --test "tests/*.test.js"` (glob entre guillemets obligatoire).

À mettre à la main dans `~/.claude/settings.json` (barres obliques et guillemets obligatoires pour Git Bash) :
`"statusLine": {"type":"command","command":"node \"C:/Users/JulesBATAILLE/OneDrive - Seize Consulting/Bureau/Vrac/N8n WF/N8N consultant/usage-claude/statusline.js\""}`

Pièges : `pct` utilise une espace normale (pas Intl percent, espace insécable) ; ne jamais redéclarer un nom de `lib/usage.js` dans `index.html` (SyntaxError = page blanche) ; la statusline doit toujours sortir en code 0.
