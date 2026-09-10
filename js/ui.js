(function () {
  const E = window.CardoEngine;
  const AI = window.CardoAI;

  let state = null;
  let sortMode = "suit";
  let selected = [];
  let humanIndex = 0;
  let busy = false;
  let botCount = 1;
  let online = false;
  let seatTarget = 4;
  let lobby = null;
  let pendingSnap = null;
  const Net = window.CardoNet;

  const $ = (id) => document.getElementById(id);

  function startVsAI() {
    const names = ["BOT 1", "BOT 2", "BOT 3", "BOT 4", "BOT 5"];
    const lineup = [{ name: "YOU", isAI: false }];
    for (let i = 0; i < botCount; i++) lineup.push({ name: names[i], isAI: true });
    state = E.createGame(lineup);
    selected = [];
    online = false;
    $("start").classList.add("hidden");
    $("hub").classList.add("hidden");
    $("lobby").classList.add("hidden");
    $("table").classList.remove("hidden");
    render();
    maybeAI();
  }

  function playerName() {
    const n = ($("player-name").value || "").trim().slice(0, 16);
    return n || "PLAYER";
  }

  function show(id) {
    ["start", "hub", "lobby", "table"].forEach(function (s) {
      $(s).classList.toggle("hidden", s !== id);
    });
  }

  function hydrate(view) {
    state = {
      currentPlayer: view.currentPlayer,
      direction: view.direction,
      currentSuit: view.currentSuit,
      pickupDebt: view.pickupDebt,
      mustFollowQueen: view.mustFollowQueen,
      awaitingSuit: view.awaitingSuit,
      winner: view.winner,
      gameOver: view.gameOver,
      lastAction: view.lastAction,
      log: view.log || [],
      discard: view.discard && view.discard.length ? view.discard.slice() : (view.top ? [view.top] : []),
      drawPile: new Array(view.drawCount || 0),
      players: (view.players || []).map(function (p) {
        return {
          id: p.id,
          name: p.name,
          isAI: !!p.isAI,
          out: !!p.out,
          hand: p.hand ? p.hand.slice() : new Array(p.count || 0),
        };
      }),
    };
    humanIndex = view.you;
  }

  function renderLobby() {
    if (!lobby) return;
    $("lobby-code").textContent = "ROOM " + lobby.code + (lobby.private ? " · PRIVATE" : "");
    $("lobby-title").textContent = lobby.phase === "playing" ? "IN PLAY" : "LOBBY";
    $("lobby-hint").textContent = lobby.players.length + " / " + lobby.target + " seated.";
    $("lobby-seats").innerHTML = lobby.players.map(function (p) {
      return '<div class="lobby-seat ' + (p.host ? "host" : "") + '">' +
        p.name + (p.host ? "<br><span class=\"tiny\">HOST</span>" : "") +
        "</div>";
    }).join("");
    const host = lobby.youAreHost === true;
    $("btn-start").classList.toggle("hidden", !host || lobby.phase !== "lobby" || lobby.players.length < 2);
    const log = $("chat-log");
    log.innerHTML = (lobby.chat || []).map(function (m) {
      return '<div class="chat-line"><span class="who">' + m.name + ":</span> " + m.text + "</div>";
    }).join("");
    log.scrollTop = log.scrollHeight;
  }

  function renderRooms(list) {
    const el = $("room-list");
    if (!list || !list.length) {
      el.innerHTML = '<div class="tiny">NO PUBLIC ROOMS</div>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      return '<div class="room-row" data-code="' + r.code + '"><span>' + r.code +
        " · " + r.host + '</span><span>' + r.seated + "/" + r.target + "</span></div>";
    }).join("");
  }

  function goOnline() {
    const name = playerName();
    $("player-name").value = name;
    Net.connect(name).then(function () {
      show("hub");
    }).catch(function () {
      toast("NO SERVER");
    });
  }

  function bindNet() {
    if (!Net) return;
    Net.on("error", function (m) { toast(m.error || "NO"); });
    Net.on("rooms", function (m) { renderRooms(m.rooms); });
    Net.on("joined", function (m) {
      if (m.you) Net.id = m.you;
      try {
        sessionStorage.setItem("unowe-seat", JSON.stringify({
          token: m.token,
          room: m.code,
          name: playerName()
        }));
      } catch (e) {}
    });
    Net.on("lobby", function (m) {
      lobby = m;
      if (m.phase === "lobby" || !state) {
        show("lobby");
        renderLobby();
      } else {
        renderLobby();
      }
    });
    Net.on("state", function (m) {
      online = true;
      if (busy) {
        pendingSnap = m.state;
        return;
      }
      applyOnlineState(m.state);
    });
    Net.on("left", function () {
      online = false;
      lobby = null;
      state = null;
      try { sessionStorage.removeItem("unowe-seat"); } catch (e) {}
      show("hub");
    });
    Net.on("close", function () {
      toast("DISCONNECTED");
    });
  }

  function cardSrc(card) {
    if (E.isJoker(card)) {
      return card.color === "black" ? "cards/black_joker.png" : "cards/red_joker.png";
    }
    const ranks = { A: "ace", J: "jack", Q: "queen", K: "king" };
    const suits = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" };
    const r = ranks[card.rank] || String(card.rank).toLowerCase();
    return "cards/" + r + "_of_" + suits[card.suit] + ".png";
  }

  function fxLabel(card) {
    if (E.isTwo(card)) return "+2";
    if (E.isBlackJack(card)) return "+5";
    if (E.isRedJack(card)) return "BLOCK";
    if (card.rank === "Q") return "AGAIN";
    if (card.rank === "K") return "SKIP";
    if (card.rank === "7") return "REV";
    if (E.isAce(card)) return "SUIT";
    if (E.isJoker(card)) return "SWAP";
    return "";
  }

  function faceHTML(card, opts = {}) {
    const cls = ["card"];
    if (opts.table) cls.push("table-card");
    if (opts.selected) cls.push("selected");
    if (opts.dim) cls.push("dim");
    const fx = fxLabel(card);
    const badge = opts.n ? '<div class="badge">' + opts.n + "</div>" : "";
    const tag = fx ? '<div class="fx">' + fx + "</div>" : "";
    return '<div class="' + cls.join(" ") + '" data-id="' + card.id + '">' +
      '<img src="' + cardSrc(card) + '" alt="">' + tag + badge + "</div>";
  }

  function backHTML(count) {
    const n = Math.min(5, Math.max(1, count));
    let s = "";
    for (let i = 0; i < n; i++) s += `<div class="mini-back"></div>`;
    return s;
  }

  function render() {
    if (!state) return;
    const view = E.publicView(state, humanIndex);
    const me = state.players[humanIndex];

    const opp = $("opponents");
    opp.innerHTML = state.players
      .map((p, i) => {
        if (i === humanIndex) return "";
        const on = i === state.currentPlayer && state.winner == null;
        return `<div class="seat ${on ? "turn" : ""} ${p.hand.length === 1 ? "one" : ""} ${p.out ? "out" : ""}" data-name="${p.name}">
          <div class="nm">${p.name}</div>
          <div class="backs">${p.out ? "" : backHTML(p.hand.length)}</div>
          <div class="cnt">${p.out ? "OUT" : p.hand.length}</div>
        </div>`;
      })
      .join("");

    const t = E.top(state);
    $("discard").innerHTML = t ? faceHTML(t, { table: true }) : "";
    $("draw-count").textContent = state.drawPile.length;
    $("suit-pip").textContent = E.SUIT_SYM[state.currentSuit] || "";
    $("suit-name").textContent = E.SUIT_NAME[state.currentSuit] || "";
    $("dir").classList.toggle("ccw", state.direction < 0);
    $("dir-lab").textContent = state.direction > 0 ? "CLOCKWISE" : "REVERSE";

    const banner = $("banner");
    banner.className = "banner";
    if (state.winner != null) {
      banner.textContent = state.players[state.winner].name + " WINS";
    } else if (state.pickupDebt > 0 && state.currentPlayer === humanIndex) {
      banner.classList.add("owe");
      banner.textContent = "YOU OWE " + state.pickupDebt;
    } else if (state.mustFollowQueen && state.currentPlayer === humanIndex) {
      banner.classList.add("queen");
      banner.textContent = "ON THE QUEEN OR PICK UP 1";
    } else {
      banner.textContent = state.lastAction || "";
    }

    $("you-turn").textContent =
      state.winner != null
        ? ""
        : state.currentPlayer === humanIndex
        ? "YOUR TURN"
        : state.players[state.currentPlayer].name + " IS PLAYING";

    const hand = E.sortHand(me.hand, sortMode);
    const selSet = new Set(selected);
    $("hand").innerHTML = hand
      .map((c) => {
        const n = selected.indexOf(c.id);
        return faceHTML(c, {
          selected: n >= 0,
          n: n >= 0 ? n + 1 : 0,
          dim: state.currentPlayer !== humanIndex && state.winner == null,
        });
      })
      .join("");
    layoutHand();

    const feed = $("feed");
    if (feed) {
      const lines = (state.log || []).slice(-8);
      feed.innerHTML = lines.map((line) => '<div class="feed-line">' + line + "</div>").join("");
      feed.scrollTop = feed.scrollHeight;
    }

    $("sort-suit").classList.toggle("on", sortMode === "suit");
    $("sort-rank").classList.toggle("on", sortMode === "rank");

    const myTurn = state.currentPlayer === humanIndex && state.winner == null && !state.awaitingSuit;
    $("btn-play").disabled = !myTurn || selected.length === 0;
    const pickupLabel = state.pickupDebt > 0 ? "TAKE " + state.pickupDebt : "PICK UP";
    $("btn-pickup").textContent = pickupLabel;
    $("btn-pickup").disabled = !myTurn;
    $("btn-pickup").classList.toggle("danger", state.pickupDebt > 0);

    if (state.awaitingSuit && state.currentPlayer === humanIndex && state.winner == null) {
      $("modal").classList.remove("hidden");
    } else {
      $("modal").classList.add("hidden");
    }

    if (state.gameOver) {
      $("win").classList.remove("hidden");
      $("win-msg").textContent =
        state.winner === humanIndex ? "YOU WIN." : state.players[state.winner].name + " WINS.";
    } else {
      $("win").classList.add("hidden");
    }
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 900);
  }

  function flashIllegal(el) {
    el.classList.add("illegal");
    setTimeout(() => el.classList.remove("illegal"), 600);
  }

  function onHandClick(e) {
    const cardEl = e.target.closest(".card");
    if (!cardEl || busy) return;
    if (!state || state.winner != null) return;
    if (state.currentPlayer !== humanIndex) return;
    if (state.awaitingSuit) return;
    const id = cardEl.dataset.id;
    const idx = selected.indexOf(id);
    if (idx >= 0) {
      selected = selected.slice(0, idx);
      render();
      return;
    }
    const trial = selected.concat(id);
    if (!E.chainValid(idsToCards(trial), state)) {
      flashIllegal(cardEl);
      toast("WON'T SIT");
      return;
    }
    selected = trial;
    render();
  }

  function idsToCards(ids) {
    const hand = state.players[humanIndex].hand;
    return ids.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  }

  function pileTarget() {
    const d = $("discard");
    const el = (d && d.querySelector(".card")) || d;
    return el.getBoundingClientRect();
  }

  function flyCard(card, fromRect, ms) {
    ms = ms || 450;
    return new Promise(function (resolve) {
      const to = pileTarget();
      const flyer = document.createElement("div");
      flyer.className = "flyer";
      flyer.style.transition = "left " + ms + "ms ease-in-out, top " + ms + "ms ease-in-out";
      const img = document.createElement("img");
      img.src = cardSrc(card);
      flyer.appendChild(img);
      const w = fromRect.width || 78;
      const h = fromRect.height || 110;
      flyer.style.width = w + "px";
      flyer.style.height = h + "px";
      flyer.style.left = fromRect.left + "px";
      flyer.style.top = fromRect.top + "px";
      document.body.appendChild(flyer);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          flyer.style.left = to.left + (to.width - w) / 2 + "px";
          flyer.style.top = to.top + (to.height - h) / 2 + "px";
        });
      });
      setTimeout(function () {
        $("discard").innerHTML = faceHTML(card, { table: true });
        const feed = $("feed");
        if (feed) {
          const line = document.createElement("div");
          line.className = "feed-line";
          line.textContent = flyCard._name + " played " + E.cardLabel(card);
          feed.appendChild(line);
          while (feed.children.length > 8) feed.removeChild(feed.firstChild);
          feed.scrollTop = feed.scrollHeight;
        }
        flyer.remove();
        resolve();
      }, ms + 40);
    });
  }

  function tickSeatCount(name) {
    document.querySelectorAll("#opponents .seat").forEach(function (seat) {
      const nm = seat.querySelector(".nm");
      const cnt = seat.querySelector(".cnt");
      if (!nm || !cnt || nm.textContent !== name) return;
      const n = Math.max(0, (parseInt(cnt.textContent, 10) || 0) - 1);
      cnt.textContent = n;
      const backs = seat.querySelector(".backs");
      if (backs) {
        const show = Math.min(5, Math.max(0, n));
        backs.innerHTML = new Array(show).fill('<div class="mini-back"></div>').join("");
      }
      seat.classList.toggle("one", n === 1);
    });
  }

  function playSequence(cards, rects, name, then, ms, gap) {
    busy = true;
    flyCard._name = name;
    ms = ms || 450;
    gap = gap == null ? 160 : gap;
    var i = 0;
    function next() {
      if (i >= cards.length) {
        busy = false;
        render();
        if (then) then();
        return;
      }
      tickSeatCount(name);
      var card = cards[i];
      var el = card ? document.querySelector('#hand [data-id="' + card.id + '"]') : null;
      var rect = el ? el.getBoundingClientRect() : (rects[i] || rects[0]);
      if (el) el.style.visibility = "hidden";
      flyCard(card, rect, ms).then(function () {
        i += 1;
        setTimeout(next, gap);
      });
    }
    next();
  }

  function aliveCount() {
    if (!state || !state.players) return 0;
    return state.players.filter(function (p) { return !p.out; }).length;
  }

  function canExtend(cards) {
    if (!state || !cards.length) return false;
    const hand = state.players[humanIndex].hand || [];
    const used = {};
    selected.forEach(function (id) { used[id] = true; });
    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      if (!c || !c.id || used[c.id]) continue;
      if (E.chainValid(cards.concat(c), state)) return true;
    }
    return false;
  }

  function needsMorePrompt(cards) {
    if (!cards.length) return null;
    if (!canExtend(cards)) return null;
    const last = cards[cards.length - 1];
    if (last.rank === "Q") {
      return {
        title: "QUEEN HANGING",
        body: "You have cards that can sit on this Queen. If you leave her on top you pick up 1. Play her anyway?"
      };
    }
    if (aliveCount() === 2 && last.rank === "K") {
      return {
        title: "KING COMES BACK",
        body: "With two players this King skips them. You have more that can go. Play it anyway?"
      };
    }
    if (aliveCount() === 2 && last.rank === "7") {
      return {
        title: "7 SKIPS THEM",
        body: "With two players a 7 skips the other seat. You have more that can go. Play it anyway?"
      };
    }
    return null;
  }

  function afterOnlineAnim() {
    if (pendingSnap) {
      const snap = pendingSnap;
      pendingSnap = null;
      applyOnlineState(snap);
    }
  }

  function seatRect(name) {
    const seat = document.querySelector('#opponents .seat[data-name="' + name + '"]')
      || document.querySelector("#opponents .seat");
    const origin = seat ? seat.getBoundingClientRect() : { left: window.innerWidth / 2, top: 8, width: 80, height: 40 };
    return {
      left: origin.left + origin.width / 2 - 43,
      top: Math.max(8, origin.top - 10),
      width: 86,
      height: 122
    };
  }

  function applyOnlineState(view) {
    const played = view.justPlayed || [];
    const by = view.justPlayedBy;
    const name = view.players && view.players[by] ? view.players[by].name : "PLAYER";
    if (played.length && by !== humanIndex && by != null) {
      hydrate(view);
      show("table");
      const rects = played.map(function () { return seatRect(name); });
      playSequence(played, rects, name, afterOnlineAnim, 850, 280);
      return;
    }
    hydrate(view);
    show("table");
    selected = [];
    render();
  }

  function commitPlay() {
    if (busy || !selected.length) return;
    const cards = idsToCards(selected);
    const rects = selected.map(function (id) {
      const el = document.querySelector('#hand [data-id="' + id + '"]');
      return el ? el.getBoundingClientRect() : pileTarget();
    });
    if (online) {
      Net.send("play", { ids: selected });
      selected = [];
      playSequence(cards, rects, state.players[humanIndex].name, afterOnlineAnim, 500, 180);
      return;
    }
    const res = E.playCards(state, humanIndex, selected);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    selected = [];
    playSequence(cards, rects, state.players[humanIndex].name, maybeAI, 500, 180);
  }

  function doPlay() {
    if (busy || !selected.length) return;
    const cards = idsToCards(selected);
    const ask = needsMorePrompt(cards);
    if (ask) {
      $("confirm-title").textContent = ask.title;
      $("confirm-body").textContent = ask.body;
      $("confirm").classList.remove("hidden");
      return;
    }
    commitPlay();
  }

  function doPickup() {
    if (busy) return;
    if (online) {
      Net.send("pickup", {});
      selected = [];
      return;
    }
    const res = E.pickUp(state, humanIndex);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    selected = [];
    render();
    maybeAI();
  }

  function pickSuit(suit) {
    if (online) {
      Net.send("suit", { suit: suit });
      return;
    }
    const res = E.chooseSuit(state, suit);
    if (!res.ok) return toast(res.error);
    render();
    maybeAI();
  }

  function maybeAI() {
    if (online) return;
    if (!state || state.winner != null) return;
    const p = state.players[state.currentPlayer];
    if (!p.isAI) return;
    if (busy) return;
    busy = true;
    const delay = 500 + Math.random() * 350;
    setTimeout(() => {
      const idx = state.currentPlayer;
      const choice = AI.decide(state, idx);
      if (choice.type === "play") {
        const hand = state.players[idx].hand;
        const cards = choice.ids.map(function (id) {
          return hand.find(function (c) { return c.id === id; });
        }).filter(Boolean);
        const seat = document.querySelector('#opponents .seat[data-name="' + state.players[idx].name + '"]')
          || document.querySelector("#opponents .seat");
        const origin = seat ? seat.getBoundingClientRect() : { left: window.innerWidth/2, top: 8, width: 80, height: 40 };
        const rects = cards.map(function () {
          return {
            left: origin.left + origin.width / 2 - 43,
            top: Math.max(8, origin.top - 10),
            width: 86,
            height: 122
          };
        });
        const res = E.playCards(state, idx, choice.ids);
        busy = false;
        if (!res.ok) {
          AI.act(state, idx);
          render();
          maybeAI();
          return;
        }
        playSequence(cards, rects, state.players[idx].name, maybeAI, 850, 320);
        return;
      }
      AI.act(state, idx);
      busy = false;
      selected = [];
      render();
      if (state.winner == null && state.players[state.currentPlayer].isAI) {
        maybeAI();
      }
    }, delay);
  }


  function layoutHand() {
    const el = $("hand");
    if (!el) return;
    const cards = Array.prototype.slice.call(el.querySelectorAll(".card"));
    if (!cards.length) return;
    const n = cards.length;
    const cardW = cards[0].getBoundingClientRect().width || 86;
    const pad = 20;
    const avail = Math.max(0, el.clientWidth - pad * 2);
    const minPeek = Math.min(58, Math.max(36, Math.round(cardW * 0.62)));
    let overlap = 8;
    const natural = n * cardW + 8 * Math.max(0, n - 1);
    if (n > 1 && natural > avail) {
      overlap = (n * cardW - avail) / (n - 1);
      overlap = Math.min(cardW - minPeek, Math.max(8, overlap));
    } else {
      overlap = -8;
    }
    const rowW = n * cardW - Math.max(0, overlap) * (n - 1);
    const overflowing = rowW > el.clientWidth - 8;
    el.style.justifyContent = overflowing ? "flex-start" : "center";
    el.style.paddingLeft = overflowing ? pad + "px" : "8px";
    el.style.paddingRight = overflowing ? pad + "px" : "8px";
    cards.forEach(function (c, i) {
      c.style.marginLeft = i === 0 ? "0px" : (overlap < 0 ? "8px" : "-" + overlap + "px");
      var sel = c.classList.contains("selected");
      c.style.zIndex = sel ? String(i + 1) : String(20 + i);
    });
  }

  function bind() {
    $("btn-vs-ai").addEventListener("click", startVsAI);
    $("btn-online").addEventListener("click", goOnline);
    $("btn-hub-home").addEventListener("click", function () { show("start"); });
    document.querySelectorAll("#seat-count [data-seats]").forEach(function (b) {
      b.addEventListener("click", function () {
        seatTarget = parseInt(b.getAttribute("data-seats"), 10);
        document.querySelectorAll("#seat-count [data-seats]").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
      });
    });
    $("priv").addEventListener("change", function () {
      $("room-pass").style.display = $("priv").checked ? "block" : "none";
    });
    $("btn-create").addEventListener("click", function () {
      Net.send("create", {
        target: seatTarget,
        password: $("priv").checked ? $("room-pass").value : "",
      });
    });
    $("btn-join").addEventListener("click", function () {
      Net.send("join", {
        code: ($("join-code").value || "").toUpperCase(),
        password: $("join-pass").value || "",
      });
    });
    $("btn-refresh").addEventListener("click", function () { Net.send("list"); });
    $("room-list").addEventListener("click", function (e) {
      const row = e.target.closest("[data-code]");
      if (!row) return;
      $("join-code").value = row.getAttribute("data-code");
      Net.send("join", { code: row.getAttribute("data-code"), password: $("join-pass").value || "" });
    });
    $("btn-start").addEventListener("click", function () { Net.send("start"); });
    $("btn-lobby-leave").addEventListener("click", function () { Net.send("leave"); });
    $("chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const text = $("chat-input").value;
      $("chat-input").value = "";
      Net.send("chat", { text: text });
    });
    bindNet();
    document.querySelectorAll("#bot-count [data-bots]").forEach(function (b) {
      b.addEventListener("click", function () {
        botCount = parseInt(b.getAttribute("data-bots"), 10);
        document.querySelectorAll("#bot-count [data-bots]").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
      });
    });
    $("btn-again").addEventListener("click", function () {
      $("win").classList.add("hidden");
      if (online) {
        Net.send("again");
        return;
      }
      startVsAI();
    });
    $("btn-home").addEventListener("click", () => {
      $("win").classList.add("hidden");
      if (online) {
        Net.send("leave");
        show("hub");
        return;
      }
      show("start");
      state = null;
    });
    $("hand").addEventListener("click", onHandClick);
    $("btn-play").addEventListener("click", doPlay);
    $("confirm-yes").addEventListener("click", function () {
      $("confirm").classList.add("hidden");
      commitPlay();
    });
    $("confirm-no").addEventListener("click", function () {
      $("confirm").classList.add("hidden");
    });
    $("btn-pickup").addEventListener("click", doPickup);
    $("sort-suit").addEventListener("click", () => {
      sortMode = "suit";
      render();
    });
    $("sort-rank").addEventListener("click", () => {
      sortMode = "rank";
      render();
    });
    document.querySelectorAll("[data-suit]").forEach((b) => {
      b.addEventListener("click", () => pickSuit(b.dataset.suit));
    });
  }

  window.addEventListener("resize", layoutHand);
  bind();
  try {
    const seat = JSON.parse(sessionStorage.getItem("unowe-seat") || "null");
    if (seat && seat.name) {
      $("player-name").value = seat.name;
      goOnline();
    }
  } catch (e) {}
})();
