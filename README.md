# UNOWE

Shed the hand. Queen is still a trap.

## Local

```bat
cd unowe
node server/server.js
```

Open http://localhost:8787

No npm install. Node 18+.

## Railway

One Node service. Pages + rooms on the same URL.

1. Push this folder to GitHub
2. Railway → deploy from the repo
3. Start command: `node server/server.js`
4. Open `https://YOUR-SERVICE.up.railway.app`

Leave `js/config.js` as `window.UNOWE_SOCKET = ""`.
The browser talks to `/ws` on the same host.
