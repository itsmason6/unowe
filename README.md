# SWIFT HAND

A shedding card game. Empty your hand first. Last card can still tax you. The table is mean on purpose.

52-card pack plus two Jokers. Black Joker plays as spades. Red Joker plays as hearts.

## Play

Open the site. Play **offline** against the house, or **create a room** and send the code.

Cards are painted in the page (cream faces, brass reverse). You do not need to upload PNG card art.

## Put it on GitHub, host on Railway

No terminal required.

1. On GitHub, click **New repository**. Name it `swift-hand`.
2. Click **uploading an existing file**. Upload everything in this project **except** `node_modules`, `.git`, and `dist` if they appear.
3. On [Railway](https://railway.com), **New Project** → **Deploy from GitHub repo** → pick `swift-hand`.
4. Railway will detect Node. If asked:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm run preview -- --host 0.0.0.0 --port $PORT`
5. Each time you change files on GitHub (upload or web editor), Railway rebuilds the site.

Rooms use a small signaling database. In Railway, add a Postgres plugin if you want rooms to work across multiple server instances. Offline play works with no extra services.

## Rules in brief

Dump or pick up — never both. First card matches rank, current suit, or a wild (Joker, Ace, 2/Jack on 2/Jack). Then chain same rank, consecutive same-suit, or special pairings.

- **2** / **black Jack** stack pickup debt. **Red Jack** kills it.
- **Queen** hangs. Cover her or pick up 1. Last-card Queen does not put you out.
- **King** skips. With two still in, it bounces.
- **7** reverses. With two still in, it acts like a King.
- **Ace** starts on anything; only Aces follow; last Ace names the suit.
- **Joker** sits on anything and swaps hands with the next seat still in — unless it is your last card, in which case you are out and there is no swap.
