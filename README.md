# WeRopen

**Is it actually open right now?** Real-time business status during ice storms,
holidays, and other spontaneous closures — starting in Austin / Central Texas.

When Google says a place is open but the ice storm says otherwise, WeRopen shows
what's really happening, combining owner updates with community reports.

## What's here

- **Next.js** web app (works in any browser, installable on phones)
- **Supabase** backend (Postgres database + API)
- **Anonymous reporting** — anyone can mark a business open/closed, no login
- **Owner updates** — businesses can post authoritative status + notes
- **Search & filter** by name and category

## Tech stack

| Layer    | Choice              |
|----------|---------------------|
| Frontend | Next.js 14 + React  |
| Styling  | Tailwind CSS        |
| Backend  | Supabase (Postgres) |
| Hosting  | Vercel              |

All free tiers. No credit card required to launch.

## Getting it running

See **[SETUP.md](./SETUP.md)** for full step-by-step instructions — it's
written so you can hand it to Claude Code and have it walk you through the whole
deployment.

## Project structure

```
weropen/
├── src/
│   ├── app/
│   │   ├── page.js              # main UI (search, cards, owner panel)
│   │   ├── layout.js            # app shell
│   │   ├── globals.css          # styles + fonts
│   │   └── api/
│   │       ├── businesses/      # GET businesses + reports
│   │       ├── businesses/update/  # POST owner status
│   │       └── reports/         # POST community reports
│   └── lib/
│       ├── supabase.js          # database client
│       └── status.js            # status logic + helpers
├── supabase/
│   └── schema.sql               # database tables + seed data
└── SETUP.md                     # deployment guide
```

## Roadmap

- [ ] v1 — anonymous reports, Austin scope *(this build)*
- [ ] User accounts + verified owner claiming
- [ ] Auto-trigger storm alerts from a weather API
- [ ] Expand beyond Central Texas
- [ ] Native mobile app
