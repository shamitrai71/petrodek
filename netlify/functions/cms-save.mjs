// Netlify Function: POST /api/cms-save
// Merges provided sections into the stored CMS JSON blob.
// Uses the Netlify Blobs REST API directly (no npm packages needed)
// so it works with zip-file deploys that skip npm install.

const STORE_NAME = "cms";
const KEY = "data";
const MAX_BODY_BYTES = 6_000_000;

const ALLOWED_SECTIONS = new Set([
  "theme", "hero", "products_section", "about_section", "cta_section",
  "footer_section", "pages", "posts", "blog_posts", "menus", "images",
  "videos", "widgets", "cta_buttons", "links", "products", "asset_base",
  "custom_pages", "brand"
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

// Build the Netlify Blobs REST URL for a key.
// Netlify injects NETLIFY_BLOBS_CONTEXT (base64 JSON) at deploy time.
// It contains { url, token } for the site's blob store.
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
  // REST endpoint: {url}/{store}/{key}
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

async function blobSet(ctx, store, key, value) {
  const r = await fetch(blobUrl(ctx, store, key), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/octet-stream"
    },
    body: value
  });
  if (!r.ok) throw new Error(`blob PUT ${r.status}: ${await r.text()}`);
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return json({ error: "method-not-allowed" }, 405);
  }

  // --- Try @netlify/blobs first (works when npm install ran) ---
  let useNpmBlobs = false;
  let store;
  try {
    const { getStore } = await import("@netlify/blobs");
    store = getStore(STORE_NAME);
    useNpmBlobs = true;
  } catch {
    // npm package not available — fall back to REST API
  }

  // --- Parse body ---
  let bodyText;
  try { bodyText = await request.text(); }
  catch (err) { return json({ error: "body-read-failed", detail: String(err) }, 400); }

  if (!bodyText || bodyText.length > MAX_BODY_BYTES) {
    return json({ error: "invalid-body-size", bytes: bodyText ? bodyText.length : 0 }, 413);
  }

  let incoming;
  try { incoming = JSON.parse(bodyText); }
  catch (err) { return json({ error: "invalid-json", detail: String(err) }, 400); }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return json({ error: "expected-json-object" }, 400);
  }

  // --- Filter to allowed sections ---
  const clean = {};
  for (const key of Object.keys(incoming)) {
    if (ALLOWED_SECTIONS.has(key)) clean[key] = incoming[key];
  }
  if (Object.keys(clean).length === 0) {
    return json({ ok: true, accepted: [], note: "no allowed sections; nothing written" }, 200);
  }

  try {
    let existing = {};
    if (useNpmBlobs) {
      // npm path
      const prev = await store.get(KEY);
      if (prev) { try { existing = JSON.parse(prev); } catch {} }
      const merged = { ...existing, ...clean };
      await store.set(KEY, JSON.stringify(merged));
    } else {
      // REST API fallback
      const ctx = getBlobsContext();
      if (!ctx) {
        return json({ error: "blobs-context-missing", detail: "NETLIFY_BLOBS_CONTEXT env var not found. Make sure this is a Netlify deployment." }, 500);
      }
      const prev = await blobGet(ctx, STORE_NAME, KEY);
      if (prev) { try { existing = JSON.parse(prev); } catch {} }
      const merged = { ...existing, ...clean };
      await blobSet(ctx, STORE_NAME, KEY, JSON.stringify(merged));
    }
    return json({ ok: true, accepted: Object.keys(clean) }, 200);
  } catch (err) {
    return json({ error: "write-failed", detail: String(err) }, 500);
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

export const config = { path: "/api/cms-save" };
