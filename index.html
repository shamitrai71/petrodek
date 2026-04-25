// Netlify Function: GET /api/cms-get
// Returns the stored CMS JSON (empty object if nothing saved yet).

import { getStore } from "@netlify/blobs";

const STORE_NAME = "cms";
const KEY = "data";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HEADERS });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), {
      status: 405,
      headers: HEADERS
    });
  }

  try {
    const store = getStore(STORE_NAME);
    const text = await store.get(KEY);
    if (!text) {
      return new Response("{}", { status: 200, headers: HEADERS });
    }
    // Stored as JSON text; pass through unchanged.
    return new Response(text, { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "read-failed", detail: String(err) }),
      { status: 500, headers: HEADERS }
    );
  }
};

export const config = { path: "/api/cms-get" };
