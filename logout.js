// netlify/functions/logout.js
// JWTs are stateless — client just drops the token.
// This endpoint exists for future server-side token blocklisting.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
