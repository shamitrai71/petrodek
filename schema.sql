-- ============================================================
-- Petrodek CMS — Neon (PostgreSQL) Schema
-- Run this once in your Neon SQL editor to initialise the DB
-- ============================================================

-- CMS content (one row, json blob — mirrors the old localStorage shape)
CREATE TABLE IF NOT EXISTS cms_data (
  id        SERIAL PRIMARY KEY,
  site_id   TEXT NOT NULL DEFAULT 'petrodek' UNIQUE,
  data      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed an empty row so GET always has something to return
INSERT INTO cms_data (site_id, data)
VALUES ('petrodek', '{}')
ON CONFLICT (site_id) DO NOTHING;

-- Admin users  (email + bcrypt hash)
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default admin — password is "super123"
-- bcrypt hash of "super123" with 10 rounds:
INSERT INTO admin_users (email, password_hash)
VALUES (
  'esraigroup@gmail.com',
  '$2b$10$Ue6BOdWWDJPFTt9bU1H6CeOz6KQ5b0Qv2VTaXkLvl3uiNmFbZ3mRu'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- How to rotate the admin password:
--   1. Generate a new hash in Node:
--      require('bcryptjs').hashSync('newpassword', 10)
--   2. UPDATE admin_users SET password_hash='<newhash>'
--      WHERE email='esraigroup@gmail.com';
-- ============================================================
