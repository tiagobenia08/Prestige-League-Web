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
  document.getElementById("registration-form")?.addEventListener("submit", submitRegistration);
  loadTournamentConfig();
  document.getElementById("teams-ranking-toggle").addEventListener("click", toggleTeamsRanking);
  loadLeagueData();
});


async function submitRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("registration-message");
  const submit = form.querySelector("button[type='submit']");
  message.className = "registration-message";
  message.textContent = "Enviando inscripción…";
  submit.disabled = true;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.players = [1,2,3,4,5,6].map(i => String(payload[`player_${i}`] || "").trim()).filter(Boolean);
  [1,2,3,4,5,6].forEach(i => delete payload[`player_${i}`]);
  try {
    const response = await fetch(`${API_BASE}/api/tournament/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo enviar la inscripción.");
    message.className = "registration-message success";
    message.textContent = "Inscripción enviada correctamente. La organización revisará los datos y el pago.";
    form.reset();
  } catch (error) {
    message.className = "registration-message error";
    message.textContent = error.message || "No se pudo enviar la inscripción.";
  } finally {
    submit.disabled = false;
  }
}

async function loadTournamentConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/tournament/config`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const link = document.getElementById("payment-link");
    if (data.payment_url) {
      link.href = data.payment_url;
    } else {
      link.removeAttribute("target");
      link.href = "#";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        alert("El enlace de pago todavía no fue configurado por la organización.");
      }, { once: true });
    }
  } catch (error) {
    console.error("No se pudo cargar la configuración del torneo:", error);
  }
}

/* V9: navegación por páginas sin scroll de una sola página */
const PAGE_IDS = ["home","liga","torneos","info","discord","inscripcion-page","chat"];

function showPage(page) {
  document.body.classList.remove("app-home");
  document.querySelectorAll(".page-view").forEach(el => el.classList.remove("active"));
  if (page === "home") {
    document.body.classList.add("app-home");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function bindPageNavigation() {
  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });
  document.querySelectorAll(".content-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const parent = tab.closest(".page-view");
      parent.querySelectorAll(".content-tab").forEach(t => t.classList.remove("active"));
      parent.querySelectorAll(".page-panel").forEach(p => p.classList.add("hidden"));
      tab.classList.add("active");
      const panel = parent.querySelector(`[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.classList.remove("hidden");
      if (tab.dataset.tab === "liga-ranking") loadFullPlayersRanking();
    });
  });
}

async function loadFullPlayersRanking() {
  const el = document.getElementById("full-players-ranking");
  if (!el) return;
  try {
    const response = await fetch(`${API_BASE}/api/rankings/players`, { cache: "no-store" });
    if (!response.ok) throw new Error("ranking");
    const players = await response.json();
    el.innerHTML = players.map((p, i) => `
      <div class="ranking-row">
        <b>${String(i+1).padStart(2,"0")}</b>
        <span class="avatar">${escapeHtml((p.psn || "PL").slice(0,2).toUpperCase())}</span>
        <strong>${escapeHtml(p.psn || "Jugador")}</strong>
        <em>${Math.round(Number(p.mmr) || 0)}</em>
      </div>
    `).join("");
  } catch {
    el.innerHTML = '<p>No se pudo cargar el ranking.</p>';
  }
}

async function submitRegistrationV9(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = document.getElementById("registration-message-v9");
  const data = Object.fromEntries(new FormData(form).entries());
  const players = [data.player_1,data.player_2,data.player_3,data.player_4,data.player_5,data.player_6].filter(Boolean);
  data.players = players;
  try {
    const response = await fetch(`${API_BASE}/api/tournament-registrations`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "error");
    msg.className = "registration-message success";
    msg.textContent = `Inscripción recibida. N.º ${result.registration.id}. Pago pendiente de verificación.`;
    form.reset();
  } catch (e) {
    msg.className = "registration-message error";
    msg.textContent = "No pudimos registrar la inscripción. Revisá los datos e intentá nuevamente.";
  }
}

async function loadStaffChat() {
  const el = document.getElementById("staff-chat-messages");
  if (!el) return;
  try {
    const response = await fetch(`${API_BASE}/api/staff-chat`, { cache:"no-store" });
    if (!response.ok) return;
    const messages = await response.json();
    el.innerHTML = messages.map(m => `
      <div class="chat-message ${m.sender_type === "staff" ? "staff" : "user"}">
        <b>${escapeHtml(m.sender_name)}</b>
        <span>${escapeHtml(m.message)}</span>
      </div>`).join("");
    el.scrollTop = el.scrollHeight;
  } catch {}
}

async function submitStaffChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const msg = document.getElementById("staff-chat-messages");
  try {
    const response = await fetch(`${API_BASE}/api/staff-chat`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
    });
    if (!response.ok) throw new Error("chat");
    form.reset();
    await loadStaffChat();
  } catch {
    alert("No se pudo enviar la consulta. Intentá nuevamente.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindPageNavigation();
  showPage("home");
  const reg = document.getElementById("registration-form-v9");
  if (reg) reg.addEventListener("submit", submitRegistrationV9);
  const chat = document.getElementById("staff-chat-form");
  if (chat) chat.addEventListener("submit", submitStaffChat);
  loadStaffChat();
  setInterval(loadStaffChat, 5000);
});
