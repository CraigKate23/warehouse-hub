# Warehouse Hub – Deployment Setup

## What you're deploying

A hosted version of Warehouse Hub that your team can log into from any device.
Authentication is handled by Supabase (free). Hosting is handled by Vercel (free).

---

## Step 1 – Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New project**, give it a name like `warehouse-hub`, pick a region close to Georgia
3. Set a strong database password (save it somewhere safe)
4. Wait ~2 minutes for the project to spin up

### Get your credentials

1. In your Supabase project, go to **Settings → API**
2. Copy the **Project URL** (looks like `https://xyzabc.supabase.co`)
3. Copy the **anon / public** key (starts with `eyJ...`)

### Paste them into config.js

Open `config.js` in the WarehouseHub folder and replace the placeholder values:

```js
const SUPABASE_URL      = 'https://xyzabc.supabase.co';   // ← your URL
const SUPABASE_ANON_KEY = 'eyJ...';                        // ← your anon key
```

### Configure Supabase Auth

1. In Supabase go to **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (you'll get this in Step 3 — come back and fill it in)
3. Under **Redirect URLs**, add your Vercel URL + `/index.html`

---

## Step 2 – Push to GitHub

1. Create a new **private** repo on GitHub called `warehouse-hub`
2. In Terminal, navigate to your WarehouseHub folder:

```bash
cd ~/path/to/WarehouseHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/warehouse-hub.git
git push -u origin main
```

---

## Step 3 – Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `warehouse-hub` repo
4. Click **Deploy** (no build settings needed — it's a static site)
5. Vercel will give you a URL like `warehouse-hub.vercel.app`

### Set your Vercel URL in Supabase

Go back to Supabase **Authentication → URL Configuration** and set:
- **Site URL**: `https://warehouse-hub.vercel.app`
- **Redirect URLs**: `https://warehouse-hub.vercel.app/index.html`

---

## Step 4 – Invite your team

1. Have each team member visit your Vercel URL
2. They click **Create Account** on the login page and sign up with their work email
3. They'll get a confirmation email — once confirmed, they can log in

> **Admin tip:** You can manage users in Supabase under **Authentication → Users**.
> To remove someone's access, just delete their user record there.

---

## Optional – Custom Domain

If you have a domain (e.g. `tools.candcwarehouse.com`):

1. In Vercel go to your project → **Settings → Domains**
2. Add your domain and follow the DNS instructions
3. Update the Supabase Site URL and Redirect URLs to match

---

## Files in this project

| File | Purpose |
|------|---------|
| `index.html` | The main app (all tools) — requires login |
| `login.html` | Login / sign-up / forgot password page |
| `config.js` | Your Supabase URL and anon key (fill this in) |
| `vercel.json` | Vercel routing configuration |

---

## Troubleshooting

**Blank screen after login** — Check that your Supabase URL and anon key are correct in `config.js`.

**"Email not confirmed"** — User needs to click the link in their confirmation email. You can also disable email confirmation in Supabase under **Authentication → Settings → Email Auth**.

**Redirect loop** — Make sure the Site URL in Supabase matches your actual Vercel URL exactly (including `https://`).
