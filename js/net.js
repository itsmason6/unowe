(function (root) {
  const Net = {
    ws: null,
    id: null,
    name: "",
    handlers: {},
    on(type, fn) {
      this.handlers[type] = fn;
    },
    send(type, payload) {
      if (!this.ws || this.ws.readyState !== 1) return;
      this.ws.send(JSON.stringify(Object.assign({ type: type }, payload || {})));
    },
    connect(name) {
      const self = this;
      this.name = name;
      const custom = (root.UNOWE_SOCKET || "").trim();
      let url;
      if (custom) {
        url = custom.replace(/\/$/, "");
        if (url.indexOf("ws") !== 0) {
          url = (location.protocol === "https:" ? "wss:" : "ws:") + "//" + url.replace(/^https?:\/\//, "");
        }
        if (url.indexOf("/ws") === -1) url += "/ws";
      } else {
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        url = proto + "//" + location.host + "/ws";
      }
      return new Promise(function (resolve, reject) {
        const ws = new WebSocket(url);
        self.ws = ws;
        ws.onopen = function () {
          let token = "";
          try {
            const seat = JSON.parse(sessionStorage.getItem("unowe-seat") || "null");
            if (seat && seat.token) token = seat.token;
          } catch (e) {}
          self.send("hello", { name: name, token: token });
        };
        ws.onerror = function () {
          reject(new Error("socket"));
        };
        ws.onmessage = function (ev) {
          let msg;
          try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (msg.type === "hello") {
            self.id = msg.id;
            self.name = msg.name;
            resolve(msg);
          }
          const fn = self.handlers[msg.type];
          if (fn) fn(msg);
        };
        ws.onclose = function () {
          const fn = self.handlers.close;
          if (fn) fn();
        };
      });
    },
  };
  root.CardoNet = Net;
})(window);
