# SETUP.md — WeRopen deployment guide

> **If you are Claude Code reading this:** your job is to walk the user through
> getting WeRopen live. Do the technical steps yourself (install deps, run the
> dev server, edit files). For the steps that require the user to click around
> in a web dashboard (creating accounts, copying keys), give them clear,
> numbered instructions and wait for them to paste values back to you. Be
> patient — the user has told us they are not a coder. Confirm each phase worked
> before moving to the next.

This is a Next.js + Supabase web app. There are three phases:

1. **Run it locally** (see it working on your own machine)
2. **Connect the database** (Supabase — free)
3. **Deploy it live** (Vercel — free)

---

## Phase 1 — Run locally

These commands run in the project folder.

```bash
npm install
```

You'll need Supabase keys before the app will load data, so do Phase 2 next,
then come back and run:

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

---

## Phase 2 — Supabase (the database / backend)

**What the user does (in a browser):**

1. Go to https://supabase.com and click **Start your project**. Sign in with
   GitHub or email (free, no credit card).
2. Click **New project**. Give it a name like `weropen`, choose a strong
   database password (save it somewhere), pick the region closest to Texas
   (e.g. **East US** or **Central US**), and click **Create new project**.
   Wait ~2 minutes for it to provision.
3. In the left sidebar, open the **SQL Editor**. Click **New query**, paste in
   the ENTIRE contents of `supabase/schema.sql` from this project, and click
   **Run**. You should see "Success. No rows returned." This creates the tables
   and adds the Austin seed businesses.
4. In the left sidebar, go to **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

**What Claude Code does:**

Create a file named `.env.local` in the project root (copy `.env.local.example`)
and fill in the two values the user just copied:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=the-long-anon-key
```

Then run `npm run dev` and confirm the businesses load at http://localhost:3000.
Test: search, filter, click "Yes, open" on a card, and post an owner update from
the "I own a business" tab. All should work against the live database.

---

## Phase 3 — Deploy live with Vercel

**What the user does (in a browser):**

1. Push this project to a new GitHub repository. (Claude Code can do the git
   commands — see below — the user just needs a free GitHub account.)
2. Go to https://vercel.com, sign in with GitHub (free).
3. Click **Add New → Project**, find the `weropen` repo, and click **Import**.
4. Before deploying, expand **Environment Variables** and add the same two:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. After ~1 minute you'll get a live URL like
   `https://weropen.vercel.app`. That's your app, on the internet.

**What Claude Code does** (to push to GitHub — ask the user to create an empty
repo first, then):

```bash
git init
git add .
git commit -m "Initial WeRopen build"
git branch -M main
git remote add origin https://github.com/USERNAME/weropen.git
git push -u origin main
```

---

## After it's live

- **Add real businesses:** Use the Supabase **Table Editor → businesses → Insert**
  to add your actual local grocery store, pizza place, etc. Or ask Claude Code to
  write a small script.
- **Custom domain:** In Vercel → Settings → Domains, you can add `weropen.com`
  if you buy it.
- **Share it:** Send the Vercel URL to friends/neighbors before the next storm.

---

## Hardening (do this in week 2, before promoting widely)

The v1 database policies are intentionally permissive (anyone can update any
business status, because there's no login yet). Before this gets real traffic:

- Add Supabase Auth (email magic links are simplest).
- Restrict the `businesses` UPDATE policy so only a verified owner can change
  their own row.
- Move the owner-update endpoint behind an auth check.
- Consider a server-side rate limit on reports (e.g. by IP) in addition to the
  per-token one already in `src/app/api/reports/route.js`.

Ask Claude (or Claude Code) to implement any of these when you're ready.
