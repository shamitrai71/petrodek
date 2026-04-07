// netlify/functions/login.js
// POST /api/login  { email, password }  → { token }

const { neon } = require('@neondatabase/serverless');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let email, password;
  try {
    ({ email, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email || !password)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Email and password required' }) };

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT id, email, password_hash FROM admin_users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;

    if (!rows.length)
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid credentials' }) };

    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password_hash);
    if (!ok)
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid credentials' }) };

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ token, email: user.email }),
    };
  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
  }
};
