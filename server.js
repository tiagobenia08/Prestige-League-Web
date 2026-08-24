const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: "database_unavailable" });
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
      discord_url: process.env.DISCORD_INVITE_URL || ""
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

app.listen(port, "0.0.0.0", () => console.log(`Prestige League Web/API listening on ${port}`));
