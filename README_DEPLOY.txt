PRESTIGE LEAGUE — RESTAURACIÓN WEB + PANEL ADMIN

Esta versión mantiene la web multipágina/por vistas, la estética negra y naranja, el ranking, los rangos del Modo Liga, la inscripción al torneo, el chat con Staff y el panel privado de administración.

ARCHIVOS PRINCIPALES
- index.html
- styles.css
- script.js
- server.js
- package.json
- assets/ranks/*.png
- ADMIN_SETUP.txt

DEPLOY EN RAILWAY
1. Reemplazá los archivos del repositorio de la web por estos archivos.
2. No borres los demás assets que ya tengas en el repositorio, especialmente assets/prestige-logo.png y cualquier imagen histórica del torneo.
3. Verificá que Railway tenga DATABASE_URL.
4. Configurá ADMIN_PASSWORD en Variables de Railway.
5. El start command es: node server.js
6. La web queda en: https://prestigeleague.up.railway.app/
7. El panel queda en: https://prestigeleague.up.railway.app/admin

IMPORTANTE
- No se modifica el bot.
- No pongas ADMIN_PASSWORD dentro de los archivos.
- La web y el bot deben seguir usando la misma DATABASE_URL para compartir el ranking.
