# UNOWE

Shed the hand. Queen is still a trap.

## Local

```bat
cd unowe
node server/server.js
```

Open http://localhost:8787

No npm install. Node 18+.

## Railway (the whole game)

One Node service. Pages + rooms + animations. No Vercel.

1. Push this repo
2. Railway → New service from the repo
3. Start command: `node server/server.js`
4. Open `https://YOUR-SERVICE.up.railway.app`

Leave `js/config.js` as `window.UNOWE_SOCKET = ""` so the browser talks to the same host.

Hard refresh after deploy (`Ctrl+Shift+R`) or the old `ui.js` stays cached and opponent cards still teleport.
