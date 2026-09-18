# SWIFT HAND

A shedding card game. Empty your hand first. Last card can still tax you. The table is mean on purpose.

52-card pack plus two Jokers. Black Joker plays as spades. Red Joker plays as hearts.

## Play

Open the site. Play **offline** against the house, or **create a room** and send the code.

Faces use Byron Knoll's classic PNG deck — rank and suit sit in the corner, so a fanned hand stays readable when cards overlap.

## Host on Railway (recommended)

The GitHub zip unpacks to **one folder** named `swift-hand`. That folder is the whole website.

1. Upload the `swift-hand` folder to your GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**.
3. Set **Root Directory** to `swift-hand` (so Railway sees `package.json`).
4. If you fill commands in by hand:
   - **Install / build:** `npm install --include=dev && npm run build:railway`
   - **Start:** `node .output/server/index.mjs`

Do **not** start the site with `vite` or `npm run preview`. Skip `node_modules`.

Offline play works with no extra services. For rooms across restarts, add Railway Postgres and set `DATABASE_URL`.

## Host on Vercel

1. Import the same GitHub repo in Vercel.
2. Set Root Directory to `swift-hand` if that is how the repo is laid out.
3. **Do not** set an Output Directory.
4. Build command: `npm run build`.
5. For rooms, add a Postgres addon and set `DATABASE_URL`.

## Rules in brief

Dump or pick up — never both. First card matches rank, current suit, or a wild (Joker, Ace, 2/Jack on 2/Jack). Then chain same rank, consecutive same-suit, or special pairings.

- **2** / **black Jack** stack pickup debt. **Red Jack** kills it.
- **Queen** hangs. Cover her or pick up 1. Last-card Queen does not put you out.
- **King** skips. With two still in, it bounces.
- **7** reverses. With two still in, it acts like a King.
- **Ace** starts on anything; only Aces follow; last Ace names the suit.
- **Joker** sits on anything and swaps hands with the next seat still in — unless it is your last card, in which case you are out and there is no swap.
