const API_BASE = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlayers(players) {
  const el = document.getElementById("players-ranking");
  if (!players.length) {
    el.innerHTML = '<div class="ranking-row"><strong>No hay jugadores registrados.</strong></div>';
    return;
  }
  el.innerHTML = players.map((p, i) => `
    <div class="ranking-row">
      <b>${String(i + 1).padStart(2, "0")}</b>
      <span class="avatar">${escapeHtml((p.psn || p.discord_name || "PL").slice(0,2).toUpperCase())}</span>
      <strong>${escapeHtml(p.psn || p.discord_name || "Jugador")}</strong>
      <em>${Math.round(Number(p.mmr) || 0)}</em>
    </div>`).join("");
}

function renderTeams(teams) {
  const el = document.getElementById("teams-ranking");
  if (!teams.length) {
    el.innerHTML = '<div class="ranking-row team-row"><strong>No hay equipos registrados.</strong></div>';
    return;
  }
  el.innerHTML = teams.map((t, i) => `
    <div class="ranking-row team-row">
      <b>${String(i + 1).padStart(2, "0")}</b>
      <span class="team-logo">${escapeHtml((t.name || "PL").slice(0,2).toUpperCase())}</span>
      <strong>${escapeHtml(t.name || "Equipo")}</strong>
      <em>${Math.round(Number(t.mmr) || 0)}</em>
    </div>`).join("");
}

async function loadLeagueData() {
  try {
    const response = await fetch(`${API_BASE}/api/home`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    document.getElementById("stat-players").textContent = data.stats.players;
    document.getElementById("stat-teams").textContent = data.stats.teams;
    renderPlayers(data.players);
    renderTeams(data.teams);
    if (data.discord_url) document.getElementById("discord-btn").href = data.discord_url;
  } catch (error) {
    console.error("No se pudo cargar Prestige League API:", error);
  }
}

document.addEventListener("DOMContentLoaded", loadLeagueData);
