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

app.get("/api/discord/members", async (_req, res) => {
  const invite = process.env.DISCORD_INVITE_CODE || "bRDKns4TQ";
  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(invite)}?with_counts=true`);
    if (!response.ok) throw new Error(`Discord API ${response.status}`);
    const data = await response.json();
    const members = Number(data.approximate_member_count);
    if (!Number.isFinite(members)) throw new Error("member_count_unavailable");
    res.json({ members });
  } catch (e) {
    console.error("Discord member count error:", e.message);
    res.status(503).json({ error: "discord_count_unavailable" });
  }
});

app.get("/api/home", async (_req, res) => {
  try {
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
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM players) AS players,
        (SELECT COUNT(*)::int FROM teams) AS teams
    `);
    res.json({
      stats: counts.rows[0],
      players,
      teams,
      discord_url: process.env.DISCORD_INVITE_URL || "https://discord.gg/bRDKns4TQ"
    });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "database_unavailable" });
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
    entry_fee_usd: 25,
    max_players: 6,
    payment_url: process.env.TOURNAMENT_PAYMENT_URL || "https://paypal.me/prestigeleaguetorneo/25USD"
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
        entry_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 25,
        payment_reference TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        status TEXT NOT NULL DEFAULT 'pending_review',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query(`
      INSERT INTO tournament_registrations
        (team_name, country, captain_contact, players, entry_fee_usd, payment_reference)
      VALUES ($1, $2, $3, $4::jsonb, 25, $5)
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

app.listen(port, "0.0.0.0", () => console.log(`Prestige League Web/API listening on ${port}`));
