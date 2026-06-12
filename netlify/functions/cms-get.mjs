// Netlify Function: GET /api/cms-get
// Returns stored CMS JSON. Uses @netlify/blobs if available,
// otherwise falls back to the Netlify Blobs REST API directly.

const STORE_NAME = "cms";
const KEY = "data";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

function getBlobsContext() {
  const raw = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function blobUrl(ctx, store, key) {
  return `${ctx.url}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
}

async function blobGet(ctx, store, key) {
  const r = await fetch(blobUrl(ctx, store, key), {
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`blob GET ${r.status}`);
  return r.text();
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405, headers: CORS });
  }

  try {
    let text = null;

    // Try npm package first
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore(STORE_NAME);
      text = await store.get(KEY);
    } catch {
      // Fall back to REST API
      const ctx = getBlobsContext();
      if (!ctx) {
        // No blobs context and no npm package — return empty (first deploy)
        return new Response("{}", { status: 200, headers: CORS });
      }
      text = await blobGet(ctx, STORE_NAME, KEY);
    }

    return new Response(text || "{}", { status: 200, headers: CORS });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "read-failed", detail: String(err) }),
      { status: 500, headers: CORS }
    );
  }
};

export const config = { path: "/api/cms-get" };
