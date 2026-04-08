// netlify/functions/setup.js
// POST /.netlify/functions/setup
//
// Idempotent DB bootstrap — safe to run multiple times.
// Creates tables and seeds default admin if none exists.
//
// Auth: accepts EITHER
//   1. Bearer <SETUP_SECRET>  — used by the Netlify build plugin post-deploy
//   2. Bearer <admin JWT>     — used by the admin dashboard "Run Setup" button
//
// This means you only need SETUP_SECRET set as an env var in Netlify;
// admins can also trigger it manually after logging in.

const { neon }  = require('@neondatabase/serverless');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

function isAuthorized(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  // Check against SETUP_SECRET (build plugin path)
  if (process.env.SETUP_SECRET && token === process.env.SETUP_SECRET) return true;

  // Check as a valid admin JWT (admin dashboard path)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return !!payload.sub; // any valid signed token is sufficient
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'POST only' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!isAuthorized(authHeader)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!process.env.DATABASE_URL) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'DATABASE_URL not configured' }) };
  }

  const sql = neon(process.env.DATABASE_URL);
  const log = [];

  try {
    // ── 1. cms_data table ─────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS cms_data (
        id         SERIAL PRIMARY KEY,
        site_id    TEXT NOT NULL DEFAULT 'petrodek' UNIQUE,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    log.push('✓ cms_data table ready');

    // ── 2. Seed empty CMS row ─────────────────────────────────────────────
    const cmsInsert = await sql`
      INSERT INTO cms_data (site_id, data)
      VALUES ('petrodek', '{}')
      ON CONFLICT (site_id) DO NOTHING
    `;
    log.push(cmsInsert.count > 0 ? '✓ cms_data row seeded' : '→ cms_data row already exists');

    // ── 3. admin_users table ──────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            SERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    log.push('✓ admin_users table ready');

    // ── 4. Seed admin (only if table is empty) ────────────────────────────
    const existing = await sql`SELECT COUNT(*) AS cnt FROM admin_users`;
    if (parseInt(existing[0].cnt, 10) === 0) {
      const adminEmail = process.env.ADMIN_EMAIL    || 'esraigroup@gmail.com';
      const adminPass  = process.env.ADMIN_PASSWORD || 'super123';
      const hash = await bcrypt.hash(adminPass, 10);
      await sql`
        INSERT INTO admin_users (email, password_hash)
        VALUES (${adminEmail}, ${hash})
      `;
      log.push('✓ Admin user created: ' + adminEmail);
    } else {
      log.push('→ Admin user already exists — skipped');
    }

    // ── 5. Report DB state ────────────────────────────────────────────────
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    log.push('✓ Tables: ' + tables.map(function(r) { return r.table_name; }).join(', '));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, log: log }),
    };

  } catch (err) {
    console.error('Setup error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: err.message, log: log }),
    };
  }
};
