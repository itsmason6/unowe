(function (root) {
  const E = () => root.CardoEngine;

  function handOf(state, idx) {
    return state.players[idx].hand;
  }

  function allChains(state, idx) {
    const E = root.CardoEngine;
    const hand = handOf(state, idx);
    const chains = [];

    function extend(path) {
      if (chains.length > 350) return;
      chains.push(path.slice());
      if (path.length >= 8) return;
      const used = new Set(path.map((c) => c.id));
      for (const card of hand) {
        if (used.has(card.id)) continue;
        const next = path.concat(card);
        if (E.chainValid(next, state)) extend(next);
      }
    }

    for (const card of hand) {
      if (E.chainValid([card], state)) extend([card]);
    }
    return chains;
  }

  function scoreChain(chain, state, idx) {
    const E = root.CardoEngine;
    const hand = handOf(state, idx);
    const remaining = hand.length - chain.length;
    let score = chain.length * 10;
    const last = chain[chain.length - 1];

    // Prefer emptying the hand — but never on a hanging Queen
    if (remaining === 0) {
      if (last.rank === "Q") score -= 1000;
      else score += 500;
    }

    // Don't leave a hanging Queen if other options exist
    if (last.rank === "Q" && remaining > 0) score -= 40;
    if (last.rank === "K" && state.players.length === 2 && remaining > 0) {
      score -= 35;
    }
    if (remaining === 0 && last.rank === "K" && state.players.length === 2) {
      score -= 1000;
    }

    for (let i = 0; i < chain.length; i++) {
      if (E.isJoker(chain[i]) && i !== chain.length - 1 && !E.isJoker(chain[i + 1])) score -= 10000;
      if (E.isAce(chain[i]) && i !== chain.length - 1 && !E.isAce(chain[i + 1])) score -= 10000;
      if ((E.isTwo(chain[i]) || E.isBlackJack(chain[i])) && i !== chain.length - 1) {
        const nxt = chain[i + 1];
        if (!(E.isTwo(nxt) || E.isBlackJack(nxt) || E.isRedJack(nxt))) score -= 10000;
      }
    }
    if (E.isJoker(last) && remaining > 0) score -= 80;
    if (E.isJoker(last) && remaining === 0) score += 80;

    // Dump specials when useful
    for (const c of chain) {
      if (E.isBlackJack(c) || E.isTwo(c)) score += 3;
      if (c.rank === "K" || c.rank === "7") score += 2;
    }
    return score;
  }

  function pickSuit(state, idx) {
    const counts = { H: 0, D: 0, C: 0, S: 0 };
    for (const c of handOf(state, idx)) {
      if (c.rank === "JOKER") counts[E().jokerSuit(c)]++;
      else if (counts[c.suit] != null) counts[c.suit]++;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function decide(state, idx) {
    const Eng = E();
    if (state.winner != null) return { type: "wait" };
    if (state.currentPlayer !== idx) return { type: "wait" };

    if (state.awaitingSuit) {
      return { type: "suit", suit: pickSuit(state, idx) };
    }

    const chains = allChains(state, idx);

    if (state.pickupDebt > 0) {
      const fights = chains.filter((ch) =>
        ch.some((c) => Eng.isRedJack(c) || Eng.isTwo(c) || Eng.isBlackJack(c))
      );
      if (!fights.length) return { type: "pickup" };
      fights.sort((a, b) => scoreChain(b, state, idx) - scoreChain(a, state, idx));
      return { type: "play", ids: fights[0].map((c) => c.id) };
    }

    if (!chains.length) {
      return { type: "pickup" };
    }

    chains.sort((a, b) => scoreChain(b, state, idx) - scoreChain(a, state, idx));
    return { type: "play", ids: chains[0].map((c) => c.id) };
  }

  function act(state, idx) {
    const Eng = E();
    const choice = decide(state, idx);
    if (choice.type === "suit") return Eng.chooseSuit(state, choice.suit);
    if (choice.type === "pickup") return Eng.pickUp(state, idx);
    if (choice.type === "play") return Eng.playCards(state, idx, choice.ids);
    return { ok: true, state };
  }

  root.CardoAI = { decide, act };
  if (typeof module !== "undefined") module.exports = root.CardoAI;
})(typeof window !== "undefined" ? window : globalThis);
