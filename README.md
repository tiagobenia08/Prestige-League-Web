# Prestige League Web — actualización

Incluye:
- navegación multipágina por vistas (Home / Liga / Torneos / Información / Discord / Chat Staff);
- contador de jugadores basado en el servidor de Discord, mostrado como número exacto y sin `+`;
- ranking individual conectado a PostgreSQL;
- actualización automática del contador y ranking mientras la web está abierta;
- inscripción dentro del apartado Próximo Torneo del 14 de septiembre de 2026;
- historial de la Primera Edición (6–12 de agosto de 2026) con Team Pool, Bracket y Campeones;
- reglamento actualizado con C4, Inserción táctica y Virote Triple, además de la lista completa del documento de reglamento;
- chat general con Staff y mensaje automático;
- links oficiales de Discord, Instagram, X, TikTok y Twitch.

## Deploy
Subir el contenido de esta carpeta al repositorio de la web y hacer deploy en Railway.

La web y el bot deben usar la misma `DATABASE_URL` para que el ranking se sincronice en tiempo real.


## Corrección 2026-08-26
- Contador de miembros: Discord Invite API con approximate_member_count.
- Ranking: consulta PostgreSQL sin caché HTTP y refresco de la web cada 10 s.
- Baneos del Modo Liga: reemplazados por la lista exacta indicada por la organización, incluyendo Silenciador.
- No se modifica el bot.
