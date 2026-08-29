const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: "database_unavailable" });
  }
});

let discordMemberCache = { count: null, updatedAt: 0 };
const DISCORD_COUNT_CACHE_MS = 30000;

async function getDiscordMemberCount() {
  const now = Date.now();
  if (discordMemberCache.count !== null && now - discordMemberCache.updatedAt < DISCORD_COUNT_CACHE_MS) {
    return discordMemberCache.count;
  }

  const guildId = process.env.DISCORD_GUILD_ID || "1526300364289081344";
  const botToken = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const widgetFallback = async () => {
    try {
      const response = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return null;
      const data = await response.json();
      const count = Number(data.approximate_member_count || data.member_count);
      if (Number.isFinite(count) && count > 0) {
        discordMemberCache = { count, updatedAt: Date.now() };
        return count;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Prefer the bot-authenticated Discord endpoint: it is more reliable than
  // the public widget and uses the same guild as the production bot.
  if (botToken) {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${botToken}` },
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        const count = Number(data.approximate_member_count || data.member_count);
        if (Number.isFinite(count) && count > 0) {
          discordMemberCache = { count, updatedAt: Date.now() };
          return count;
        }
      }
    } catch {}
  }

  return await widgetFallback();
}


app.get("/api/discord-members", async (_req, res) => {
  try {
    const count = await getDiscordMemberCount();
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count });
  } catch (e) {
    console.error("No se pudo obtener el contador de Discord:", e);
    res.status(503).json({ count: null });
  }
});

app.get("/api/home", async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const discordMembers = await getDiscordMemberCount();
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM players) AS players,
        (SELECT COUNT(*)::int FROM teams) AS teams
    `);
    const players = (await pool.query(`
      SELECT discord_id, discord_name, psn, mmr, rank
      FROM players
      ORDER BY mmr DESC, psn ASC
      LIMIT 10
    `)).rows;
    const teams = (await pool.query(`
      SELECT team_id, name, mmr, logo_url
      FROM teams
      ORDER BY mmr DESC, name ASC
      LIMIT 10
    `)).rows;
    res.json({
      stats: counts.rows[0],
      discord_members_count: discordMembers,
      players,
      teams,
      discord_url: process.env.DISCORD_INVITE_URL || "https://discord.gg/bRDKns4TQ"
    });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "database_unavailable", discord_members_count: null });
  }
});

app.get("/api/rankings/players", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT discord_id, discord_name, psn, mmr, rank FROM players ORDER BY mmr DESC, psn ASC`);
    res.json(result.rows);
  } catch (e) {
    res.status(503).json({ error: "database_unavailable" });
  }
});

app.get("/api/rankings/teams", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT team_id, name, mmr, logo_url FROM teams ORDER BY mmr DESC, name ASC`);
    res.json(result.rows);
  } catch (e) {
    res.status(503).json({ error: "database_unavailable" });
  }
});


app.get("/api/tournament/config", (_req, res) => {
  res.json({
    entry_fee_usd: 20,
    max_players: 6,
    payment_url: process.env.TOURNAMENT_PAYMENT_URL || "https://paypal.me/prestigeleaguetorneo/20USD"
  });
});

app.post("/api/tournament/register", async (req, res) => {
  const { team_name, country, captain_contact, players, payment_reference } = req.body || {};
  if (!team_name || !country || !captain_contact || !payment_reference || !Array.isArray(players)) {
    return res.status(400).json({ error: "Faltan datos obligatorios." });
  }
  const cleanPlayers = players.map(p => String(p).trim()).filter(Boolean);
  if (cleanPlayers.length < 1 || cleanPlayers.length > 6) {
    return res.status(400).json({ error: "El equipo debe registrar entre 1 y 6 jugadores." });
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournament_registrations (
        id BIGSERIAL PRIMARY KEY,
        team_name TEXT NOT NULL,
        country TEXT NOT NULL,
        captain_contact TEXT NOT NULL,
        players JSONB NOT NULL,
        entry_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 20,
        payment_reference TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        status TEXT NOT NULL DEFAULT 'pending_review',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query(`
      INSERT INTO tournament_registrations
        (team_name, country, captain_contact, players, entry_fee_usd, payment_reference)
      VALUES ($1, $2, $3, $4::jsonb, 20, $5)
      RETURNING id, created_at
    `, [team_name.trim(), country.trim(), captain_contact.trim(), JSON.stringify(cleanPlayers), payment_reference.trim()]);
    res.status(201).json({ ok: true, registration_id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (e) {
    console.error("Tournament registration error:", e);
    res.status(503).json({ error: "No se pudo guardar la inscripción." });
  }
});


app.get("/api/staff-chat", async (_req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_chat_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('user','staff')),
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query(`
      SELECT id, sender_type, sender_name, message, created_at
      FROM staff_chat_messages
      ORDER BY id ASC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(503).json({ error: "database_unavailable" });
  }
});

app.post("/api/staff-chat", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!name || !message || name.length > 60 || message.length > 1000) {
    return res.status(400).json({ error: "invalid_message" });
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_chat_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('user','staff')),
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query(`
      INSERT INTO staff_chat_messages (sender_type, sender_name, message)
      VALUES ('user', $1, $2)
      RETURNING id, sender_type, sender_name, message, created_at
    `, [name, message]);

    // Automatic acknowledgement requested for general enquiries.
    await pool.query(`
      INSERT INTO staff_chat_messages (sender_type, sender_name, message)
      VALUES ('staff', 'Prestige League Staff', 'Un miembro del staff se comunicará contigo pronto.')
    `);

    res.status(201).json({ ok: true, message: result.rows[0] });
  } catch (e) {
    res.status(503).json({ error: "database_unavailable" });
  }
});



// ============================================================
// ADMIN — INSCRIPCIONES Y CHAT
// La contraseña se configura en Railway como ADMIN_PASSWORD.
// ============================================================
function adminAuth(req, res, next) {
  const configured = process.env.ADMIN_PASSWORD;
  const supplied = String(req.headers['x-admin-password'] || '');
  if (!configured) return res.status(503).json({ error: 'admin_password_not_configured' });
  if (!supplied || supplied !== configured) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;
  const supplied = String(req.body?.password || '');
  if (!configured) return res.status(503).json({ ok: false, error: 'admin_password_not_configured' });
  if (!supplied || supplied !== configured) return res.status(401).json({ ok: false, error: 'invalid_password' });
  res.json({ ok: true });
});

app.get('/api/admin/registrations', adminAuth, async (_req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournament_registrations (
        id BIGSERIAL PRIMARY KEY, team_name TEXT NOT NULL, country TEXT NOT NULL,
        captain_contact TEXT NOT NULL, players JSONB NOT NULL,
        entry_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 20, payment_reference TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending', status TEXT NOT NULL DEFAULT 'pending_review',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query(`SELECT id, team_name, country, captain_contact, players, entry_fee_usd, payment_reference, payment_status, status, created_at FROM tournament_registrations ORDER BY id DESC`);
    res.json(result.rows);
  } catch (e) { console.error('Admin registrations error:', e); res.status(503).json({ error: 'database_unavailable' }); }
});

app.patch('/api/admin/registrations/:id', adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').trim();
  const paymentStatus = String(req.body?.payment_status || '').trim();
  const allowedStatus = new Set(['pending_review', 'approved', 'rejected']);
  const allowedPayment = new Set(['pending', 'verified', 'rejected']);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid_id' });
  if (!allowedStatus.has(status) || !allowedPayment.has(paymentStatus)) return res.status(400).json({ error: 'invalid_status' });
  try {
    const result = await pool.query(`UPDATE tournament_registrations SET status = $1, payment_status = $2 WHERE id = $3 RETURNING id, status, payment_status`, [status, paymentStatus, id]);
    if (!result.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, registration: result.rows[0] });
  } catch (e) { console.error('Admin registration update error:', e); res.status(503).json({ error: 'database_unavailable' }); }
});

app.get('/api/admin/chat', adminAuth, async (_req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS staff_chat_messages (id BIGSERIAL PRIMARY KEY, sender_type TEXT NOT NULL CHECK (sender_type IN ('user','staff')), sender_name TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const result = await pool.query(`SELECT id, sender_type, sender_name, message, created_at FROM staff_chat_messages ORDER BY id DESC LIMIT 200`);
    res.json(result.rows.reverse());
  } catch (e) { console.error('Admin chat error:', e); res.status(503).json({ error: 'database_unavailable' }); }
});

app.post('/api/admin/chat', adminAuth, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const name = String(req.body?.name || 'Prestige League Staff').trim() || 'Prestige League Staff';
  if (!message || message.length > 1000) return res.status(400).json({ error: 'invalid_message' });
  try {
    const result = await pool.query(`INSERT INTO staff_chat_messages (sender_type, sender_name, message) VALUES ('staff', $1, $2) RETURNING id, sender_type, sender_name, message, created_at`, [name.slice(0,60), message]);
    res.status(201).json({ ok: true, message: result.rows[0] });
  } catch (e) { console.error('Admin chat send error:', e); res.status(503).json({ error: 'database_unavailable' }); }
});

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(port, "0.0.0.0", () => console.log(`Prestige League Web/API listening on ${port}`));
