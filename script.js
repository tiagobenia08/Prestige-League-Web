
function displayValue(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    if ("length" in value) return value.length;
    if ("count" in value) return value.count;
    if ("total" in value) return value.total;
  }
  return value ?? 0;
}

const API_BASE = "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
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

async function loadHomeStats() {
  try {
    const r = await fetch(`${API_BASE}/api/home`, {cache:"no-store"});
    if (!r.ok) throw new Error(`API ${r.status}`);
    const d = await r.json();
    const members = d.discord_members_count ?? d.stats?.discord_members_count ?? 370;
    document.getElementById("stat-players").textContent = `${members}+`;
  } catch {
    document.getElementById("stat-players").textContent = "370+";
  }
}

async function loadRanking() {
  const el = document.getElementById("full-players-ranking");
  if (!el) return;
  try {
    const r = await fetch(`${API_BASE}/api/rankings/players`, {cache:"no-store"});
    const players = await r.json();
    el.innerHTML = players.map((p,i) => `
      <div class="ranking-row">
        <b>${i+1}</b>
        <strong>${escapeHtml(p.psn || p.name || "Jugador")}</strong>
        <span>${Math.round(Number(p.mmr)||0)} MMR</span>
      </div>`).join("");
  } catch {
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
  } catch {
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
  } catch {}
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


function getAdminPassword(){ return sessionStorage.getItem('prestige_admin_password') || ''; }
async function adminFetch(url, options={}){ const headers={...(options.headers||{}), 'x-admin-password':getAdminPassword()}; return fetch(url,{...options,headers,cache:'no-store'}); }
function adminStatusLabel(s){ return ({pending_review:'PENDIENTE',approved:'APROBADA',rejected:'RECHAZADA'})[s]||s; }
function paymentStatusLabel(s){ return ({pending:'PENDIENTE',verified:'VERIFICADO',rejected:'RECHAZADO'})[s]||s; }
async function loadAdminRegistrations(){
  const el=document.getElementById('admin-registrations'); if(!el||!getAdminPassword()) return;
  try{ const r=await adminFetch('/api/admin/registrations'); if(!r.ok) throw new Error(); const rows=await r.json();
    if(!rows.length){el.innerHTML='<p class="admin-empty">Todavía no hay inscripciones.</p>';return;}
    el.innerHTML=rows.map(reg=>{const players=Array.isArray(reg.players)?reg.players:[]; return `<article class="admin-registration-card"><div class="admin-reg-head"><div><span class="admin-reg-id">#${reg.id}</span><h4>${escapeHtml(reg.team_name)}</h4><small>${escapeHtml(reg.country)} · ${escapeHtml(reg.created_at?new Date(reg.created_at).toLocaleString('es-UY'):'')}</small></div><span class="admin-status ${escapeHtml(reg.status)}">${adminStatusLabel(reg.status)}</span></div><div class="admin-reg-grid"><div><b>CAPITÁN</b><span>${escapeHtml(reg.captain_contact)}</span></div><div><b>PAGO</b><span>${escapeHtml(reg.payment_reference)}</span></div><div><b>JUGADORES</b><span>${players.map(escapeHtml).join(' · ')}</span></div></div><div class="admin-reg-controls"><label>Estado <select data-reg-status="${reg.id}"><option value="pending_review" ${reg.status==='pending_review'?'selected':''}>Pendiente</option><option value="approved" ${reg.status==='approved'?'selected':''}>Aprobada</option><option value="rejected" ${reg.status==='rejected'?'selected':''}>Rechazada</option></select></label><label>Pago <select data-reg-payment="${reg.id}"><option value="pending" ${reg.payment_status==='pending'?'selected':''}>Pendiente</option><option value="verified" ${reg.payment_status==='verified'?'selected':''}>Verificado</option><option value="rejected" ${reg.payment_status==='rejected'?'selected':''}>Rechazado</option></select></label><button class="btn btn-primary admin-save-reg" type="button" data-id="${reg.id}">GUARDAR</button></div><small class="admin-payment-state">Pago: ${paymentStatusLabel(reg.payment_status)}</small></article>`;}).join('');
    el.querySelectorAll('.admin-save-reg').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.id;const status=el.querySelector(`[data-reg-status="${id}"]`).value;const payment_status=el.querySelector(`[data-reg-payment="${id}"]`).value;btn.disabled=true;try{const r=await adminFetch(`/api/admin/registrations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,payment_status})});if(!r.ok)throw new Error();await loadAdminRegistrations();}catch{alert('No se pudo actualizar la inscripción.');btn.disabled=false;}}));
  }catch{el.innerHTML='<p class="admin-error">No se pudieron cargar las inscripciones.</p>'; }
}
async function loadAdminChat(){
  const el=document.getElementById('admin-chat-messages');if(!el||!getAdminPassword())return;
  try{const r=await adminFetch('/api/admin/chat');if(!r.ok)throw new Error();const messages=await r.json();el.innerHTML=messages.length?messages.map(m=>`<div class="chat-message ${m.sender_type==='staff'?'staff':'user'}"><b>${escapeHtml(m.sender_name)}</b><span>${escapeHtml(m.message)}</span><small>${m.created_at?new Date(m.created_at).toLocaleString('es-UY'):''}</small></div>`).join(''):'<p class="admin-empty">Todavía no hay mensajes.</p>';el.scrollTop=el.scrollHeight;}catch{el.innerHTML='<p class="admin-error">No se pudieron cargar los mensajes.</p>'; }
}
async function adminLogin(e){e.preventDefault();const password=document.getElementById('admin-password').value;const msg=document.getElementById('admin-login-message');try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok)throw new Error();sessionStorage.setItem('prestige_admin_password',password);document.getElementById('admin-login').hidden=true;document.getElementById('admin-content').hidden=false;msg.textContent='';await Promise.all([loadAdminRegistrations(),loadAdminChat()]);}catch{msg.className='registration-message error';msg.textContent='Contraseña incorrecta o panel no configurado.';}}
function showAdmin(){document.querySelectorAll('.route-view').forEach(v=>v.classList.remove('active'));document.getElementById('view-admin')?.classList.add('active');document.body.classList.remove('app-home');const logged=!!getAdminPassword();document.getElementById('admin-login').hidden=logged;document.getElementById('admin-content').hidden=!logged;if(logged){loadAdminRegistrations();loadAdminChat();}history.replaceState(null,'','/admin');}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-route").forEach(btn => btn.addEventListener("click", () => showRoute(btn.dataset.route)));

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
  document.getElementById("admin-login-form")?.addEventListener("submit", adminLogin);
  document.getElementById("admin-refresh")?.addEventListener("click", () => { loadAdminRegistrations(); loadAdminChat(); });
  document.getElementById("admin-logout")?.addEventListener("click", () => { sessionStorage.removeItem("prestige_admin_password"); showAdmin(); });
  document.getElementById("admin-chat-form")?.addEventListener("submit", async (e) => { e.preventDefault(); const form=e.currentTarget; const data=Object.fromEntries(new FormData(form).entries()); try{const r=await adminFetch('/api/admin/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw new Error();form.reset();await loadAdminChat();}catch{alert('No se pudo enviar la respuesta.');} });
  loadHomeStats();

  if (location.pathname === '/admin') showAdmin();
  else { const hash = location.hash.replace("#",""); showRoute(["liga","torneos","info","discord","chat"].includes(hash) ? hash : "home"); }
  setInterval(() => {
    if (document.getElementById("view-chat")?.classList.contains("active")) loadStaffChat();
  }, 5000);
});
