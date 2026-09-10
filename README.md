# UNOWE

Shed the hand. Queen is still a trap.

## Local

```bat
cd unowe
node server/server.js
```

Open http://localhost:8787

No npm install. Node 18+.

## Vercel (the website)

Vercel serves the pages and the vs-AI table.
It does **not** keep WebSockets alive, so live rooms need a second host.

1. Put this folder on GitHub
2. Import the repo in Vercel → Deploy
3. You get `something.vercel.app`

## Live rooms (Railway / Fly / Render)

1. Deploy the **same repo** as a Node web service
2. Start command: `node server/server.js`
3. Copy the public HTTPS URL
4. Edit `js/config.js` on GitHub:

```js
window.UNOWE_SOCKET = "wss://YOUR-SERVER.up.railway.app";
```

5. Redeploy Vercel

Then the Vercel site talks to the socket box.
