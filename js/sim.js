const E = require("./engine");
const AI = require("./ai");

function playGame() {
  const s = E.createGame([
    { name: "A", isAI: true },
    { name: "B", isAI: true },
  ]);
  let guard = 0;
  while (s.winner == null && guard++ < 800) {
    const i = s.currentPlayer;
    const beforeTurn = i;
    const beforeLog = s.log.length;
    const res = AI.act(s, i);
    if (!res || !res.ok) {
      // force pickup/pass to avoid hard lock
      if (s.awaitingSuit) E.chooseSuit(s, "H");
      else if (s.justDrew) E.passAfterDraw(s, i);
      else {
        const p = E.pickUp(s, i);
        if (!p.ok && s.currentPlayer === i) {
          return { error: p.error || "stuck", log: s.log.slice(-8), last: s.lastAction };
        }
      }
    }
    if (s.currentPlayer === beforeTurn && s.log.length === beforeLog && s.winner == null && !s.awaitingSuit) {
      return { error: "no progress", last: s.lastAction, debt: s.pickupDebt, queen: s.mustFollowQueen };
    }
  }
  if (s.winner == null) return { error: "timeout", last: s.lastAction, log: s.log.slice(-6) };
  return { winner: s.players[s.winner].name, turns: guard, last: s.lastAction };
}

let ok = 0;
const fails = [];
for (let i = 0; i < 80; i++) {
  const r = playGame();
  if (r.error) fails.push(r);
  else ok++;
}
console.log(JSON.stringify({ ok, failed: fails.length, sample: fails.slice(0, 8) }, null, 2));
