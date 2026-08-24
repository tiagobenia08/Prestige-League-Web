const API_BASE = "";
const DISCORD_INVITE = "https://discord.gg/bRDKns4TQ";
let playersExpanded = false;
let teamsExpanded = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlayers(players, limit = null) {
  const el = document.getElementById("players-ranking");
  const visiblePlayers = limit ? players.slice(0, limit) : players;
  if (!visiblePlayers.length) {
    el.innerHTML = '<div class="ranking-row"><strong>No hay jugadores registrados.</strong></div>';
    return;
  }
  el.innerHTML = visiblePlayers.map((p, i) => `
    <div class="ranking-row">
      <b>${String(i + 1).padStart(2, "0")}</b>
      <span class="avatar">${escapeHtml((p.psn || p.discord_name || "PL").slice(0,2).toUpperCase())}</span>
      <strong>${escapeHtml(p.psn || p.discord_name || "Jugador")}</strong>
      <em>${Math.round(Number(p.mmr) || 0)}</em>
    </div>`).join("");
}

function renderTeams(teams, limit = null) {
  const el = document.getElementById("teams-ranking");
  const visibleTeams = limit ? teams.slice(0, limit) : teams;
  if (!visibleTeams.length) {
    el.innerHTML = '<div class="ranking-row team-row"><strong>No hay equipos registrados.</strong></div>';
    return;
  }
  el.innerHTML = visibleTeams.map((t, i) => `
    <div class="ranking-row team-row">
      <b>${String(i + 1).padStart(2, "0")}</b>
      <span class="team-logo">${escapeHtml((t.name || "PL").slice(0,2).toUpperCase())}</span>
      <strong>${escapeHtml(t.name || "Equipo")}</strong>
      <em>${Math.round(Number(t.mmr) || 0)}</em>
    </div>`).join("");
}

async function togglePlayersRanking() {
  const button = document.getElementById("players-ranking-toggle");
  if (playersExpanded) {
    const response = await fetch(`${API_BASE}/api/home`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    renderPlayers(data.players, 10);
    playersExpanded = false;
    button.textContent = "VER RANKING COMPLETO →";
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/rankings/players`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const players = await response.json();
    renderPlayers(players);
    playersExpanded = true;
    button.textContent = "MOSTRAR TOP 10 ↑";
  } catch (error) {
    console.error("No se pudo cargar el ranking completo:", error);
  } finally {
    button.disabled = false;
  }
}

async function toggleTeamsRanking() {
  const button = document.getElementById("teams-ranking-toggle");
  if (teamsExpanded) {
    const response = await fetch(`${API_BASE}/api/home`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    renderTeams(data.teams, 10);
    teamsExpanded = false;
    button.textContent = "VER EQUIPOS →";
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/rankings/teams`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const teams = await response.json();
    renderTeams(teams);
    teamsExpanded = true;
    button.textContent = "MOSTRAR TOP 10 ↑";
  } catch (error) {
    console.error("No se pudo cargar el ranking completo de equipos:", error);
  } finally {
    button.disabled = false;
  }
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
    document.getElementById("discord-btn").href = data.discord_url || DISCORD_INVITE;
  } catch (error) {
    console.error("No se pudo cargar Prestige League API:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("discord-btn").href = DISCORD_INVITE;
  document.getElementById("players-ranking-toggle").addEventListener("click", togglePlayersRanking);
  document.getElementById("teams-ranking-toggle").addEventListener("click", toggleTeamsRanking);
  loadLeagueData();
});
