// netlify/functions/cms.js
// GET  /.netlify/functions/cms          → full CMS JSON  (public, no auth)
// POST /.netlify/functions/cms + JWT    → save CMS JSON  (admin only)

const { neon } = require('@neondatabase/serverless');
const jwt      = require('jsonwebtoken');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: return CMS data (public) ──────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const rows = await sql`
        SELECT data FROM cms_data WHERE site_id = 'petrodek' LIMIT 1
      `;
      const data = rows.length ? rows[0].data : {};
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    } catch (err) {
      console.error('CMS GET error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  // ── POST: save CMS data (authenticated) ────────────────────────────
  if (event.httpMethod === 'POST') {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const user = verifyToken(authHeader);

    if (!user) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (parseErr) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    try {
      await sql`
        INSERT INTO cms_data (site_id, data, updated_at)
        VALUES ('petrodek', ${JSON.stringify(payload)}::jsonb, NOW())
        ON CONFLICT (site_id) DO UPDATE
          SET data       = EXCLUDED.data,
              updated_at = NOW()
      `;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('CMS POST error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
