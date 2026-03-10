# Solo Level Up - Website (example)

This folder contains a minimal Next.js (app router) scaffold with Tailwind CSS and example pages. It is a starting point for the public website and dashboard.

Setup

1. Copy `.env.example` to `.env` (or set environment variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional for API routes)

2. Install and run:

```bash
cd website
npm install
npm run dev
```

The app provides example pages: `/`, `/dashboard`, `/leaderboard` and an API route `/api/leaderboard`.
