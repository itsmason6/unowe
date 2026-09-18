# SWIFT HAND

A shedding card game. Empty your hand first. Last card can still tax you. The table is mean on purpose.

52-card pack plus two Jokers. Black Joker plays as spades. Red Joker plays as hearts.

## Play

Open the site. Play **offline** against the house, or **create a room** and send the code.

Faces use Byron Knoll's classic PNG deck — rank and suit sit in the corner, so a fanned hand stays readable when cards overlap.

## Host on Railway (recommended)

Upload the **whole unzipped project** to GitHub. The `scripts` folder is required. Skip `node_modules`.

Folders that must be on GitHub:

- `src`
- `public` (including `public/cards` and `public/__grok`)
- `scripts`
- `server`
- `migrations`

Root files that must be on GitHub:

- `package.json`
- `package-lock.json`
- `railway-build.mjs`
- `vite.config.ts`
- `tsconfig.json`
- `railway.json`
- `nixpacks.toml`
- `.npmrc`

Then on [Railway](https://railway.com): **New Project → Deploy from GitHub repo**. If you fill commands in by hand:

- **Install / build:** `npm install --include=dev && npm run build:railway`
- **Start:** `node .output/server/index.mjs`

Do **not** start the site with `vite` or `npm run preview`.

Offline play works with no extra services. For rooms across restarts, add Railway Postgres and set `DATABASE_URL`.

## Host on Vercel

1. Import the same GitHub repo in Vercel.
2. **Do not** set an Output Directory.
3. Build command: `npm run build`.
4. For rooms, add a Postgres addon and set `DATABASE_URL`.

## Rules in brief

Dump or pick up — never both. First card matches rank, current suit, or a wild (Joker, Ace, 2/Jack on 2/Jack). Then chain same rank, consecutive same-suit, or special pairings.

- **2** / **black Jack** stack pickup debt. **Red Jack** kills it.
- **Queen** hangs. Cover her or pick up 1. Last-card Queen does not put you out.
- **King** skips. With two still in, it bounces.
- **7** reverses. With two still in, it acts like a King.
- **Ace** starts on anything; only Aces follow; last Ace names the suit.
- **Joker** sits on anything and swaps hands with the next seat still in — unless it is your last card, in which case you are out and there is no swap.
