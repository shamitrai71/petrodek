// netlify/functions/logout.js
// Not strictly needed (JWTs are stateless) but provided for completeness.
// The client-side doLogout() already clears sessionStorage.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  // JWT is stateless — the client just discards the token.
  // This endpoint exists so you can add server-side token blocklisting later.
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
