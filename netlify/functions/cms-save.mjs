// Netlify Function: POST /api/cms-save
// Merges the provided sections into the stored CMS JSON.
// Only sections in ALLOWED_SECTIONS are accepted — anything else is ignored.
// Keep ALLOWED_SECTIONS in sync with LIVE_SECTIONS in index.html.
//
// No authentication yet. Anyone who can reach this endpoint can overwrite
// content. Lock this down before giving the site a real public audience:
//   - Netlify Identity JWT (preferred)
//   - Shared secret header
//   - IP allowlist at the redirect layer

import { getStore } from "@netlify/blobs";

const STORE_NAME = "cms";
const KEY = "data";
const MAX_BODY_BYTES = 6_000_000; // ~6MB — Netlify Functions sync invocation limit

const ALLOWED_SECTIONS = new Set([
  "theme",
  "hero",
  "products_section",
  "about_section",
  "cta_section",
  "footer_section",
  "pages",
  "posts",
  "blog_posts",
  "menus",
  "images",
  "videos",
  "widgets",
  "cta_buttons",
  "links",
  "products",
  "asset_base",
  "custom_pages"
]);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HEADERS });
  }
  if (request.method !== "POST") {
    return json({ error: "method-not-allowed" }, 405);
  }

  let bodyText;
  try {
    bodyText = await request.text();
  } catch (err) {
    return json({ error: "body-read-failed", detail: String(err) }, 400);
  }

  if (!bodyText || bodyText.length > MAX_BODY_BYTES) {
    return json({ error: "invalid-body-size", bytes: bodyText ? bodyText.length : 0 }, 413);
  }

  let incoming;
  try {
    incoming = JSON.parse(bodyText);
  } catch (err) {
    return json({ error: "invalid-json", detail: String(err) }, 400);
  }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return json({ error: "expected-json-object" }, 400);
  }

  // Filter to the allowed sections
  const clean = {};
  for (const key of Object.keys(incoming)) {
    if (ALLOWED_SECTIONS.has(key)) {
      clean[key] = incoming[key];
    }
  }
  const acceptedKeys = Object.keys(clean);
  if (acceptedKeys.length === 0) {
    return json({
      ok: true,
      accepted: [],
      note: "no allowed sections in body; nothing written"
    }, 200);
  }

  let store;
  try {
    store = getStore(STORE_NAME);
  } catch (err) {
    return json({ error: "blob-store-unavailable", detail: String(err) }, 500);
  }

  // Merge onto what's already there so we don't clobber other sections
  let existing = {};
  try {
    const prev = await store.get(KEY);
    if (prev) existing = JSON.parse(prev);
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      existing = {};
    }
  } catch (err) {
    // Corrupt stored blob — start fresh rather than propagate the error
    existing = {};
  }

  const merged = { ...existing, ...clean };

  try {
    await store.set(KEY, JSON.stringify(merged));
    return json({ ok: true, accepted: acceptedKeys }, 200);
  } catch (err) {
    return json({ error: "write-failed", detail: String(err) }, 500);
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: HEADERS });
}

export const config = { path: "/api/cms-save" };
