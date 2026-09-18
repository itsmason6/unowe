# SWIFT HAND

A shedding card game. Empty your hand first. Last card can still tax you. The table is mean on purpose.

52-card pack plus two Jokers. Black Joker plays as spades. Red Joker plays as hearts.

## Play

Open the site. Play **offline** against the house, or **create a room** and send the code.

Faces use Byron Knoll's classic PNG deck — rank and suit sit in the corner, so a fanned hand stays readable when cards overlap.

## Host on Railway (recommended)

The repo is already wired for Railway. A production build emits a Node server at `.output/server/index.mjs`, and `npm start` runs it.

1. On GitHub, create a repository (e.g. `swift-hand`).
2. Upload the project files. Include `package.json` **and** `package-lock.json`. Skip `node_modules`.
3. On [Railway](https://railway.com), **New Project** → **Deploy from GitHub repo** → pick that repo.
4. Leave install/build/start alone if Railway detects them. If you fill them in by hand:
   - **Install / build:** `npm install --include=dev && npm run build:railway`
   - **Start:** `node .output/server/index.mjs`
5. Redeploy after you upload a new `package-lock.json`.

Do **not** start the site with `vite` or `npm run preview`. Railway sets `PORT` itself.

Offline play works with no extra services. Rooms use a small signaling database: add Railway **Postgres**, then set `DATABASE_URL` on the service (available at runtime is enough). Without it, rooms still work on a single instance.

## Host on Vercel

1. Import the same GitHub repo in Vercel.
2. **Do not** set an Output Directory. The build writes Vercel's Build Output API itself.
3. Build command: `npm run build` (leave Framework / Nitro detection as-is).
4. For rooms, add a Postgres addon (Neon works) and set `DATABASE_URL`.

Vercel is serverless. Railway is the better fit if you want a long-running table.

## Rules in brief

Dump or pick up — never both. First card matches rank, current suit, or a wild (Joker, Ace, 2/Jack on 2/Jack). Then chain same rank, consecutive same-suit, or special pairings.

- **2** / **black Jack** stack pickup debt. **Red Jack** kills it.
- **Queen** hangs. Cover her or pick up 1. Last-card Queen does not put you out.
- **King** skips. With two still in, it bounces.
- **7** reverses. With two still in, it acts like a King.
- **Ace** starts on anything; only Aces follow; last Ace names the suit.
- **Joker** sits on anything and swaps hands with the next seat still in — unless it is your last card, in which case you are out and there is no swap.
