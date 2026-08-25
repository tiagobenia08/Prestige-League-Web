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

function numericStat(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (value && typeof value === "object") {
    const candidates = [value.count, value.value, value.total, value.players, value.teams];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
      if (typeof candidate === "string" && candidate.trim() !== "" && Number.isFinite(Number(candidate))) return Number(candidate);
    }
  }
  return fallback;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}

function renderPlayers(players, limit = null) {
  const el = document.getElementById("players-ranking");
  const list = asArray(players, ["players", "rows", "data"]);
  const visiblePlayers = limit ? list.slice(0, limit) : list;
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
  const list = asArray(teams, ["teams", "rows", "data"]);
  const visibleTeams = limit ? list.slice(0, limit) : list;
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
    const stats = data.stats || {};
    // El contador del Home representa la comunidad de Discord, no los jugadores registrados en el bot.
    // Se mantiene visible como 400+ para comunicar el tamaño actual de la comunidad.
    document.getElementById("stat-players").textContent = "400+";
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
  loadDiscordMemberCount();
});


async function loadDiscordMemberCount() {
  try {
    const response = await fetch(`${API_BASE}/api/discord/members`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (Number.isFinite(data.members)) {
      const el = document.getElementById("stat-discord-members");
      if (el) el.textContent = data.members.toLocaleString("es-UY");
    }
  } catch (error) {
    console.error("No se pudo cargar la cantidad de miembros de Discord:", error);
  }
}
