#!/usr/bin/env node
// scripts/setup-db.js
//
// Runs at BUILD TIME via netlify.toml:  command = "node scripts/setup-db.js"
//
// Idempotent — safe to run on every deploy.
// Creates tables and seeds the default admin if none exists.
// Exits 0 on success, exits 0 even on soft failure (never blocks deploy).

const { neon } = require('@neondatabase/serverless');
const bcrypt   = require('bcryptjs');

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn('[DB Setup] DATABASE_URL not set — skipping DB setup.');
    console.warn('[DB Setup] Add DATABASE_URL in Netlify → Site → Environment Variables.');
    return;
  }

  console.log('[DB Setup] Connecting to Neon...');
  const sql = neon(dbUrl);
  const log = [];

  try {
    // ── 1. cms_data ─────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS cms_data (
        id         SERIAL PRIMARY KEY,
        site_id    TEXT NOT NULL DEFAULT 'petrodek' UNIQUE,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    log.push('✓ cms_data table ready');

    const cmsInsert = await sql`
      INSERT INTO cms_data (site_id, data)
      VALUES ('petrodek', '{}')
      ON CONFLICT (site_id) DO NOTHING
    `;
    log.push(cmsInsert.count > 0 ? '✓ cms_data row seeded' : '→ cms_data row already exists');

    // ── 2. admin_users ───────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            SERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    log.push('✓ admin_users table ready');

    // ── 3. Seed admin only if table is empty ─────────────────────
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

    // ── 4. Report ────────────────────────────────────────────────
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    log.push('✓ Tables: ' + tables.map(r => r.table_name).join(', '));

    console.log('[DB Setup] Setup complete:');
    log.forEach(line => console.log('  ' + line));

  } catch (err) {
    // Log but never block the deploy
    console.warn('[DB Setup] Warning — setup encountered an error:', err.message);
    console.warn('[DB Setup] The site will still deploy. Run setup manually from the Admin panel.');
  }
}

main();
