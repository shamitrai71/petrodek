# Petrodek Systems — Deployment Guide

## Architecture

```
GitHub (static files)
  └── Netlify (CDN + Functions)
        ├── public/index.html       ← the SPA
        └── netlify/functions/
              ├── login.js           ← POST /api/login  → JWT
              ├── cms.js             ← GET/POST /api/cms → Neon
              └── logout.js          ← POST /api/logout (token clear)
                        │
                        └── Neon (PostgreSQL)
                              ├── cms_data    ← all CMS content (JSONB)
                              └── admin_users ← hashed credentials
```

**How it works:**
- Public visitors: `index.html` loads, then calls `GET /.netlify/functions/cms` to fetch the latest CMS content. No auth needed.
- Admin: Login form calls `POST /.netlify/functions/login` with email + password. Server checks bcrypt hash in Neon and returns a signed JWT (8h expiry).
- Every CMS save calls `POST /.netlify/functions/cms` with the JWT in the `Authorization: Bearer` header. The function verifies the token before writing to Neon.
- Image blobs (uploaded via the gallery) remain in the browser's `localStorage` as before — they are device-local and not synced to the DB. Use external image URLs for cross-device images.

---

## Step 1 — Create a Neon Database

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project (e.g. `petrodek`).
3. In the **SQL Editor**, paste and run the contents of `schema.sql` to create the tables and seed the default admin.
4. Copy your **Connection String** from the dashboard (Connection Details → Connection string). It looks like:
   ```
   postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
   ```

---

## Step 2 — Push to GitHub

```bash
# From this project folder:
git init
git add .
git commit -m "Initial commit — Petrodek with Neon CMS backend"
git remote add origin https://github.com/YOUR_USERNAME/petrodek.git
git push -u origin main
```

---

## Step 3 — Deploy on Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**.
2. Connect your GitHub account and select the `petrodek` repository.
3. Build settings:
   - **Build command:** *(leave blank — no build step)*
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy site**.

---

## Step 4 — Set Environment Variables in Netlify

Go to **Site → Environment variables → Add variable** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | A long random secret (32+ characters) |

To generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

After adding variables, **trigger a redeploy**: Site → Deploys → Trigger deploy.

---

## Step 5 — Install Function Dependencies

Netlify automatically runs `npm install` if it finds a `package.json`. Your functions use:
- `@neondatabase/serverless` — Neon's edge-compatible Postgres driver
- `bcryptjs` — password hash verification
- `jsonwebtoken` — JWT creation and verification

These are listed in `package.json` and will be installed automatically on deploy.

---

## Step 6 — Verify It Works

1. Visit your Netlify URL. The site should load and display CMS content from the database.
2. Click **⚙ Admin** in the nav and log in with:
   - Email: `esraigroup@gmail.com`
   - Password: `super123`
3. Make a change and save. Refresh on another device — the change should persist.

---

## Changing the Admin Password

Option A — via Neon SQL Editor:
```sql
-- 1. Generate a new hash (run in Node):
-- require('bcryptjs').hashSync('your_new_password', 10)

-- 2. Update in Neon:
UPDATE admin_users
SET password_hash = '$2b$10$YOUR_NEW_HASH_HERE'
WHERE email = 'esraigroup@gmail.com';
```

Option B — change the email address too:
```sql
UPDATE admin_users
SET email = 'new@email.com',
    password_hash = '$2b$10$YOUR_NEW_HASH_HERE'
WHERE email = 'esraigroup@gmail.com';
```

---

## Local Development

```bash
npm install -g netlify-cli
cp .env.example .env.local
# Fill in DATABASE_URL and JWT_SECRET in .env.local

netlify dev
# Site runs at http://localhost:8888
# Functions run at http://localhost:8888/.netlify/functions/
```

---

## File Structure

```
petrodek/
├── public/
│   └── index.html          ← the entire SPA
├── netlify/
│   └── functions/
│       ├── login.js         ← auth endpoint
│       ├── cms.js           ← CMS read/write
│       └── logout.js        ← token clear
├── schema.sql               ← run once in Neon SQL Editor
├── package.json             ← function dependencies
├── netlify.toml             ← Netlify config
├── .env.example             ← env var template
├── .gitignore
└── README.md
```
