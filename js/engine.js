(function (root) {
  const SUITS = ["H", "D", "C", "S"];
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUIT_SYM = { H: "♥", D: "♦", C: "♣", S: "♠" };
  const SUIT_NAME = { H: "HEARTS", D: "DIAMONDS", C: "CLUBS", S: "SPADES" };
  const RED = new Set(["H", "D"]);

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function makeCard(rank, suit, extra) {
    const card = {
      id: uid(),
      rank,
      suit, // H D C S; jokers use B/R as color stored in suit? use suit S/H and rank JOKER
      ...extra,
    };
    return card;
  }

  function isJoker(c) {
    return c.rank === "JOKER";
  }
  function isAce(c) {
    return c.rank === "A";
  }
  function isWild(c) {
    return isJoker(c) || isAce(c);
  }
  function isBlackJack(c) {
    return c.rank === "J" && (c.suit === "C" || c.suit === "S");
  }
  function isRedJack(c) {
    return c.rank === "J" && (c.suit === "H" || c.suit === "D");
  }
  function isTwo(c) {
    return c.rank === "2";
  }
  function jokerSuit(c) {
    // Black joker -> spades, red joker -> hearts
    return c.color === "black" ? "S" : "H";
  }
  function printedSuit(c) {
    if (isJoker(c)) return jokerSuit(c);
    return c.suit;
  }
  function cardLabel(c) {
    if (isJoker(c)) return c.color === "black" ? "Joker ♠" : "Joker ♥";
    return c.rank + SUIT_SYM[c.suit];
  }

  function freshDeck() {
    const deck = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push(makeCard(r, s));
      }
    }
    deck.push(makeCard("JOKER", "S", { color: "black" }));
    deck.push(makeCard("JOKER", "H", { color: "red" }));
    return shuffle(deck);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function top(state) {
    return state.discard[state.discard.length - 1];
  }

  const RANK_SEQ = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function rankIndex(card) {
    if (!card || isJoker(card)) return -1;
    return RANK_SEQ.indexOf(card.rank);
  }

  function ranksAdjacent(a, b) {
    const ia = rankIndex(a);
    const ib = rankIndex(b);
    if (ia < 0 || ib < 0) return false;
    return Math.abs(ia - ib) === 1;
  }

  function isStackCard(c) {
    return isTwo(c) || isBlackJack(c);
  }

  function isTwoOrJack(c) {
    return isTwo(c) || (c && c.rank === "J");
  }

  function matchesPair(a, b) {
    // a can follow b
    if (!a || !b) return false;
    if (isJoker(a)) return true;
    if (isAce(a)) return b.rank === "Q" || b.rank === "K" || isAce(b);
    if (isJoker(b)) return true;
    // 2s and any Jacks sit on each other regardless of suit.
    if (isTwoOrJack(a) && isTwoOrJack(b)) return true;
    if (a.rank === b.rank) return true;
    if (printedSuit(a) === printedSuit(b)) {
      // Queen / 7 / King tax: any card of that suit can follow.
      if (b.rank === "Q" || b.rank === "K") return true;
      return ranksAdjacent(a, b);
    }
    return false;
  }

  function matchesDiscard(card, state) {
    if (isWild(card)) return true;
    const t = top(state);
    if (!t) return true;
    if (isTwoOrJack(card) && isTwoOrJack(t)) return true;
    if (card.rank === t.rank) return true;
    if (printedSuit(card) === state.currentSuit) return true;
    return false;
  }

  function isDebtFighter(card) {
    return isTwo(card) || isBlackJack(card) || isRedJack(card);
  }

  function legalFirstCard(card, state) {
    if (state.pickupDebt > 0) return isDebtFighter(card);
    return matchesDiscard(card, state);
  }

  function chainValid(cards, state) {
    if (!cards.length) return false;
    if (!legalFirstCard(cards[0], state)) return false;
    for (let i = 0; i < cards.length - 1; i++) {
      if (isAce(cards[i]) && !isAce(cards[i + 1])) return false;
      if (isJoker(cards[i]) && !isJoker(cards[i + 1])) return false;
    }
    if (activeCount(state) >= 3) {
      for (let i = 0; i < cards.length - 1; i++) {
        if (cards[i].rank === "K" && cards[i + 1].rank !== "K") return false;
      }
    }
    for (let i = 0; i < cards.length - 1; i++) {
      if (isTwo(cards[i]) || isBlackJack(cards[i])) {
        const nxt = cards[i + 1];
        if (!(isTwo(nxt) || isBlackJack(nxt) || isRedJack(nxt))) return false;
      }
    }
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1];
      const cur = cards[i];
      if (state.pickupDebt > 0 && !debtResolvedByPrefix(cards, i)) {
        if (!isTwo(cur) && !isBlackJack(cur) && !isRedJack(cur)) return false;
        if (isDebtFighter(prev) && isDebtFighter(cur)) continue;
        if (!matchesPair(cur, prev) && !isWild(cur) && !isDebtFighter(cur)) return false;
        continue;
      }
      if (!matchesPair(cur, prev)) return false;
    }
    return true;
  }

  function debtResolvedByPrefix(cards, index) {
    for (let i = 0; i < index; i++) {
      if (isRedJack(cards[i])) return true;
    }
    return false;
  }

  function sortHand(hand, mode) {
    const suitOrder = { H: 0, D: 1, C: 2, S: 3 };
    const rankOrder = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
      "10": 10, J: 11, Q: 12, K: 13, A: 14, JOKER: 15,
    };
    const copy = hand.slice();
    if (mode === "rank") {
      copy.sort((a, b) => {
        const ra = rankOrder[a.rank] - rankOrder[b.rank];
        if (ra) return ra;
        return (suitOrder[printedSuit(a)] ?? 9) - (suitOrder[printedSuit(b)] ?? 9);
      });
    } else {
      copy.sort((a, b) => {
        const sa = (suitOrder[printedSuit(a)] ?? 9) - (suitOrder[printedSuit(b)] ?? 9);
        if (sa) return sa;
        return rankOrder[a.rank] - rankOrder[b.rank];
      });
    }
    return copy;
  }

  function createGame(playerConfigs) {
    // playerConfigs: [{name, isAI}]
    const n = playerConfigs.length;
    if (n < 2 || n > 6) throw new Error("2–6 players");
    let deck = freshDeck();
    const players = playerConfigs.map((p, i) => ({
      id: i,
      name: p.name,
      isAI: !!p.isAI,
      hand: [],
      out: false,
    }));
    for (let r = 0; r < 7; r++) {
      for (const pl of players) pl.hand.push(deck.pop());
    }
    const discard = [deck.pop()];
    const start = discard[0];
    let currentSuit = printedSuit(start);
    const state = {
      players,
      drawPile: deck,
      discard,
      currentSuit,
      currentPlayer: 0,
      direction: 1,
      pickupDebt: 0,
      skips: 0,
      mustFollowQueen: false,
      awaitingSuit: false,
      suitPassTurn: false,
      pendingSkips: 0,
      winner: null,
      finishes: [],
      gameOver: false,
      log: [],
      lastAction: "Cards dealt.",
      startResolved: false,
    };
    applyStarter(state);
    return state;
  }

  function log(state, msg) {
    state.log.push(msg);
    state.lastAction = msg;
  }

  function nextIndex(state, from, steps) {
    const n = state.players.length;
    let i = from;
    const d = state.direction;
    let taken = 0;
    let guard = 0;
    steps = Math.max(1, steps || 1);
    while (taken < steps && guard++ < 48) {
      i = (i + d + n) % n;
      if (!state.players[i].out) taken++;
    }
    return i;
  }

  function activeCount(state) {
    return state.players.filter(function (p) { return !p.out; }).length;
  }

  function markOut(state, playerIndex) {
    const p = state.players[playerIndex];
    if (p.out) return;
    p.out = true;
    p.hand = [];
    state.finishes = state.finishes || [];
    state.finishes.push(playerIndex);
    log(state, p.name + " is out.");
    if (activeCount(state) <= 1) {
      state.gameOver = true;
      state.winner = state.finishes[0];
      const last = state.players.findIndex(function (pl) { return !pl.out; });
      if (last >= 0 && state.finishes.indexOf(last) < 0) state.finishes.push(last);
      log(state, state.players[state.winner].name + " takes the table.");
    }
  }

  function applyStarter(state) {
    const c = top(state);
    const first = 0; // first seat is "next" after phantom dealer
    log(state, "Starter: " + cardLabel(c));
    if (isTwo(c)) {
      state.pickupDebt = 2;
      state.currentPlayer = first;
      log(state, state.players[first].name + " owes 2 from the starter.");
    } else if (isBlackJack(c)) {
      state.pickupDebt = 5;
      state.currentPlayer = first;
      log(state, state.players[first].name + " owes 5 from the starter.");
    } else if (isRedJack(c)) {
      state.currentPlayer = first;
    } else if (c.rank === "K") {
      state.currentPlayer = nextIndex(state, first, 1);
      log(state, state.players[first].name + " skipped by starter King.");
    } else if (c.rank === "7") {
      state.direction = -1;
      state.currentPlayer = nextIndex(state, state.players.length - 1, 1);
      // dealer phantom is conceptually before 0 clockwise = last index as previous
      // With reverse, first actor is the other way from dealer = last player
      log(state, "Starter 7 — direction flipped.");
    } else if (isAce(c)) {
      state.awaitingSuit = true;
      state.suitPassTurn = false;
      state.currentPlayer = first;
      log(state, state.players[first].name + " names the suit for the starter Ace.");
    } else if (isJoker(c)) {
      state.currentSuit = jokerSuit(c);
      const a = first;
      const b = nextIndex(state, a, 1);
      swapHands(state, a, b);
      state.currentPlayer = b;
      log(state, "Starter Joker — " + state.players[a].name + " swaps with " + state.players[b].name + ".");
    } else if (c.rank === "Q") {
      state.mustFollowQueen = true;
      state.currentPlayer = first;
      log(state, "Starter Queen — " + state.players[first].name + " must play on it or pick up 1.");
    } else {
      state.currentPlayer = first;
    }
    state.startResolved = true;
  }

  function swapHands(state, i, j) {
    const tmp = state.players[i].hand;
    state.players[i].hand = state.players[j].hand;
    state.players[j].hand = tmp;
  }

  function drawOne(state, playerIndex) {
    if (!state.drawPile.length) recycle(state);
    if (!state.drawPile.length) return null;
    const c = state.drawPile.pop();
    state.players[playerIndex].hand.push(c);
    return c;
  }

  function recycle(state) {
    if (state.discard.length <= 1) return;
    const keep = state.discard.pop();
    state.drawPile = shuffle(state.discard);
    state.discard = [keep];
  }

  function drawMany(state, playerIndex, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      const c = drawOne(state, playerIndex);
      if (c) got.push(c);
    }
    return got;
  }

  function chooseSuit(state, suit) {
    if (!state.awaitingSuit) return { ok: false, error: "Not naming a suit." };
    if (!SUITS.includes(suit)) return { ok: false, error: "Bad suit." };
    const who = state.currentPlayer;
    state.currentSuit = suit;
    state.awaitingSuit = false;
    log(state, state.players[who].name + " set suit to " + SUIT_SYM[suit] + ".");
    if (state.suitPassTurn) {
      const skips = state.pendingSkips || 0;
      state.suitPassTurn = false;
      state.pendingSkips = 0;
      advanceTurn(state, who, skips, false);
    }
    return { ok: true, state };
  }

  function playCards(state, playerIndex, cardIds) {
    if (state.winner != null) return { ok: false, error: "Game over." };
    if (state.awaitingSuit) return { ok: false, error: "Name a suit first." };
    if (playerIndex !== state.currentPlayer) return { ok: false, error: "Not your turn." };
    const player = state.players[playerIndex];
    const cards = [];
    const used = new Set();
    for (const id of cardIds) {
      if (used.has(id)) return { ok: false, error: "Duplicate card." };
      used.add(id);
      const card = player.hand.find((c) => c.id === id);
      if (!card) return { ok: false, error: "You don't have that card." };
      cards.push(card);
    }
    if (!chainValid(cards, state)) return { ok: false, error: "That chain won't sit." };

    // remove from hand
    player.hand = player.hand.filter((c) => !used.has(c.id));
    state.justPlayed = cards.slice();
    state.justPlayedBy = playerIndex;
    for (const c of cards) state.discard.push(c);

    const goingEmpty = player.hand.length === 0;
    const last = cards[cards.length - 1];
    const labels = cards.map(cardLabel).join(" → ");
    log(state, player.name + " played " + labels + ".");

    let queenPending = state.mustFollowQueen;
    let skipAdd = 0;
    let swapped = false;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (queenPending) queenPending = false;
      if (isTwo(c)) state.pickupDebt += 2;
      if (isBlackJack(c)) state.pickupDebt += 5;
      if (isRedJack(c)) state.pickupDebt = 0;
      if (c.rank === "K") {
        // 2-player King bounce is spent if they already laid cards after it.
        if (activeCount(state) !== 2 || i === cards.length - 1) skipAdd += 1;
      }
      if (c.rank === "7") {
        state.direction *= -1;
        if (activeCount(state) === 2 && i === cards.length - 1) skipAdd += 1;
      }
      if (c.rank === "Q") queenPending = true;
      if (isAce(c)) {
        if (i === cards.length - 1) {
          state.awaitingSuit = true;
        } else {
          state.currentSuit = printedSuit(cards[i + 1]);
        }
      }
      if (isJoker(c)) {
        state.currentSuit = jokerSuit(c);
        const lastInDump = i === cards.length - 1;
        if (lastInDump && !(goingEmpty && lastInDump)) {
          const victim = nextIndex(state, playerIndex, 1);
          swapHands(state, playerIndex, victim);
          swapped = true;
          log(state, player.name + " swapped hands with " + state.players[victim].name + ".");
        } else if (!lastInDump) {
          log(state, player.name + " stacked a Joker — no swap yet.");
        }
      } else if (!isAce(c) || i < cards.length - 1) {
        // keep current suit tracking from non-wilds
        if (!isAce(c) && !isJoker(c)) state.currentSuit = printedSuit(c);
      }
    }

    // If last is not ace/joker, suit is printed of last non-override... already handled
    if (!isAce(last) && !isJoker(last)) {
      state.currentSuit = printedSuit(last);
    }
    if (isJoker(last)) state.currentSuit = jokerSuit(last);

    const bouncedToSelf = nextIndex(state, playerIndex, 1 + skipAdd) === playerIndex;
    const twoAlive = activeCount(state) === 2;
    const bounceCard = last.rank === "K";
    const hangingBounce = bouncedToSelf && bounceCard && twoAlive;
    let alreadyTaxed = false;

    // Going out
    if (goingEmpty) {
      if (last.rank === "Q" || hangingBounce) {
        drawMany(state, playerIndex, 1);
        alreadyTaxed = true;
        queenPending = false;
        log(
          state,
          last.rank === "Q"
            ? player.name + " can't go out on a Queen — picks up 1."
            : player.name + " bounced " + last.rank + " back to themselves — must follow or pick up 1."
        );
      } else {
        markOut(state, playerIndex);
        state.mustFollowQueen = false;
        state.awaitingSuit = false;
        if (state.gameOver) return { ok: true, state };
      }
    }

    state.mustFollowQueen = queenPending && last.rank === "Q";
    state.justDrew = null;

    // Chain ended on Queen with cards still in hand = hanging Queen = pick up 1.
    if (last.rank === "Q" && player.hand.length > 0 && !alreadyTaxed) {
      drawMany(state, playerIndex, 1);
      alreadyTaxed = true;
      state.mustFollowQueen = false;
      log(state, player.name + " left a Queen hanging — picks up 1.");
    }

    // King/7 sent the turn back to you and you didn't lay another card on it.
    if (hangingBounce && !alreadyTaxed) {
      drawMany(state, playerIndex, 1);
      log(state, player.name + " sent it back with a " + last.rank + " — no follow-up, picks up 1.");
    }

    if (state.awaitingSuit) {
      state.suitPassTurn = true;
      // Bounce extra-turn is spent on the Ace follow-up / suit call; don't also skip back to self.
      state.pendingSkips = bouncedToSelf ? 0 : skipAdd;
      return { ok: true, state };
    }

    if (bouncedToSelf && last.rank === "K" && twoAlive) {
      // 2-player King bounce: follow-up in this dump was the extra go. Other player next.
      state.currentPlayer = nextIndex(state, playerIndex, 1);
      state.mustFollowQueen = false;
      return { ok: true, state };
    }
    if (bouncedToSelf && last.rank === "7") {
      log(state, "7 skips the other seat.");
    }

    advanceTurn(state, playerIndex, skipAdd, swapped);
    return { ok: true, state };
  }

  function advanceTurn(state, fromIndex, skipAdd, swappedFromJoker) {
    // After a joker swap, it's the victim's turn (next player)
    // Kings skip additional people from there
    let steps = 1 + skipAdd;
    if (swappedFromJoker) {
      // next player already is the victim; still apply skips onto them?
      // Ruling: swap, then it is their turn, kings in same chain skip past them
      steps = 1 + skipAdd;
    }
    state.currentPlayer = nextIndex(state, fromIndex, steps);
    state.mustFollowQueen = false;
  }

  function pickUp(state, playerIndex) {
    if (state.winner != null) return { ok: false, error: "Game over." };
    if (state.awaitingSuit) return { ok: false, error: "Name a suit first." };
    if (playerIndex !== state.currentPlayer) return { ok: false, error: "Not your turn." };
    const player = state.players[playerIndex];

    if (state.pickupDebt > 0) {
      const n = state.pickupDebt;
      drawMany(state, playerIndex, n);
      state.pickupDebt = 0;
      state.mustFollowQueen = false;
      log(state, player.name + " eats " + n + ".");
      state.currentPlayer = nextIndex(state, playerIndex, 1);
      return { ok: true, state };
    }

    if (state.mustFollowQueen) {
      drawMany(state, playerIndex, 1);
      state.mustFollowQueen = false;
      log(state, player.name + " can't cover the Queen — picks up 1.");
      state.currentPlayer = nextIndex(state, playerIndex, 1);
      return { ok: true, state };
    }

    const drawn = drawOne(state, playerIndex);
    log(state, player.name + " picks up 1." + (drawn ? "" : " Deck empty."));
    state.justDrew = null;
    state.mustFollowQueen = false;
    state.currentPlayer = nextIndex(state, playerIndex, 1);
    return { ok: true, state, drew: drawn };
  }

  function passAfterDraw(state, playerIndex) {
    if (playerIndex !== state.currentPlayer) return { ok: false, error: "Not your turn." };
    state.justDrew = null;
    state.currentPlayer = nextIndex(state, playerIndex, 1);
    log(state, state.players[playerIndex].name + " holds and passes.");
    return { ok: true, state };
  }

  function publicView(state, viewerIndex) {
    return {
      currentPlayer: state.currentPlayer,
      direction: state.direction,
      currentSuit: state.currentSuit,
      pickupDebt: state.pickupDebt,
      mustFollowQueen: state.mustFollowQueen,
      awaitingSuit: state.awaitingSuit,
      winner: state.winner,
      lastAction: state.lastAction,
      justDrew: viewerIndex === state.currentPlayer ? state.justDrew : null,
      justPlayed: state.justPlayed || null,
      justPlayedBy: state.justPlayedBy == null ? null : state.justPlayedBy,
      top: top(state),
      drawCount: state.drawPile.length,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isAI: p.isAI,
        out: !!p.out,
        count: p.hand.length,
        hand: i === viewerIndex ? p.hand.slice() : null,
      })),
      gameOver: !!state.gameOver,
      finishes: (state.finishes || []).slice(),
      log: (state.log || []).slice(-12),
      discard: state.discard.slice(-8),
      you: viewerIndex,
    };
  }

  const api = {
    SUITS,
    SUIT_SYM,
    SUIT_NAME,
    createGame,
    playCards,
    pickUp,
    chooseSuit,
    passAfterDraw,
    chainValid,
    legalFirstCard,
    matchesPair,
    matchesDiscard,
    sortHand,
    cardLabel,
    printedSuit,
    isJoker,
    isAce,
    isWild,
    isBlackJack,
    isRedJack,
    isTwo,
    jokerSuit,
    top,
    publicView,
    nextIndex,
  };

  root.CardoEngine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
