const API_BASE = "";
const DISCORD_INVITE = "https://discord.gg/bRDKns4TQ";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function setMemberCount(value) {
  const count = Number(value);
  const text = Number.isFinite(count) && count > 0 ? String(Math.round(count)) : "—";
  const ids = ["stat-players", "discord-members-card", "discord-members-social", "discord-members-page"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

function showRoute(route) {
  document.querySelectorAll(".route-view").forEach(v => v.classList.remove("active"));
  const view = document.getElementById(`view-${route}`);
  if (view) view.classList.add("active");
  document.body.classList.toggle("app-home", route === "home");
  window.scrollTo(0, 0);
  if (route === "liga") {
    const active = document.querySelector("#view-liga .content-tab.active");
    if (active?.dataset.tab === "liga-ranking") loadRanking();
  }
  if (route === "chat") loadStaffChat();
  history.replaceState(null, "", route === "home" ? "/" : `#${route}`);
}

async function fetchHome() {
  const r = await fetch(`${API_BASE}/api/home`, { cache: "no-store" });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function loadHomeStats() {
  try {
    const data = await fetchHome();
    setMemberCount(data.discord_members_count ?? data.stats?.discord_members_count);
    const discordButton = document.getElementById("discord-btn");
    if (discordButton) discordButton.href = data.discord_url || DISCORD_INVITE;
  } catch (error) {
    console.error("No se pudo cargar la cantidad de miembros de Discord:", error);
  }
}

async function loadRanking() {
  const el = document.getElementById("full-players-ranking");
  if (!el) return;
  try {
    const r = await fetch(`${API_BASE}/api/rankings/players`, { cache: "no-store" });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const players = await r.json();
    if (!Array.isArray(players) || !players.length) {
      el.innerHTML = "<p>No hay jugadores registrados.</p>";
      return;
    }
    el.innerHTML = players.map((p,i) => `
      <div class="ranking-row">
        <b>${i+1}</b>
        <strong>${escapeHtml(p.psn || p.discord_name || "Jugador")}</strong>
        <span>${Math.round(Number(p.mmr)||0)} MMR</span>
      </div>`).join("");
  } catch (error) {
    console.error("No se pudo cargar el ranking:", error);
    el.innerHTML = "<p>No se pudo cargar el ranking.</p>";
  }
}

async function submitRegistration(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = document.getElementById("registration-message");
  const data = Object.fromEntries(new FormData(form).entries());
  data.players = [data.player_1,data.player_2,data.player_3,data.player_4,data.player_5,data.player_6].filter(Boolean);
  try {
    const r = await fetch(`${API_BASE}/api/tournament/register`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
    });
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || "error");
    msg.className = "registration-message success";
    msg.textContent = `Inscripción recibida. N.º ${out.registration_id ?? ""}. Queda pendiente de verificación del pago.`;
    form.reset();
  } catch (error) {
    console.error(error);
    msg.className = "registration-message error";
    msg.textContent = "No pudimos registrar la inscripción. Revisá los datos e intentá nuevamente.";
  }
}

async function loadStaffChat() {
  const el = document.getElementById("staff-chat-messages");
  if (!el) return;
  try {
    const r = await fetch(`${API_BASE}/api/staff-chat`, {cache:"no-store"});
    if (!r.ok) return;
    const messages = await r.json();
    el.innerHTML = messages.map(m => `
      <div class="chat-message ${m.sender_type === "staff" ? "staff" : "user"}">
        <b>${escapeHtml(m.sender_name)}</b><span>${escapeHtml(m.message)}</span>
      </div>`).join("");
    el.scrollTop = el.scrollHeight;
  } catch (error) {
    console.error("No se pudo cargar el chat:", error);
  }
}

async function submitStaffChat(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const r = await fetch(`${API_BASE}/api/staff-chat`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
    });
    if (!r.ok) throw new Error();
    form.reset();
    await loadStaffChat();
  } catch {
    alert("No se pudo enviar la consulta.");
  }
}

async function refreshLiveData() {
  await loadHomeStats();
  const rankingView = document.getElementById("view-liga");
  const rankingPanel = document.querySelector('#view-liga .content-tab.active[data-tab="liga-ranking"]');
  if (rankingView?.classList.contains("active") && rankingPanel) {
    await loadRanking();
  }
  if (document.getElementById("view-chat")?.classList.contains("active")) {
    await loadStaffChat();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-route").forEach(btn => {
    btn.addEventListener("click", () => showRoute(btn.dataset.route));
  });

  document.querySelectorAll("#view-liga .content-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#view-liga .content-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll("#view-liga .tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#view-liga [data-panel="${tab.dataset.tab}"]`)?.classList.add("active");
      if (tab.dataset.tab === "liga-ranking") loadRanking();
    });
  });

  document.getElementById("registration-form")?.addEventListener("submit", submitRegistration);
  document.getElementById("staff-chat-form")?.addEventListener("submit", submitStaffChat);
  loadHomeStats();

  const hash = location.hash.replace("#","");
  showRoute(["liga","torneos","info","discord","chat"].includes(hash) ? hash : "home");

  // Mantiene Home y Ranking actualizados sin tener que recargar la página.
  setInterval(refreshLiveData, 10000);
});
