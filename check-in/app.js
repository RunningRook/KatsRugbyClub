/**
 * Kats Rugby Club — Team Check-In
 *
 * Talks to the Cloudflare Worker API in ../worker/ (see ../worker/README.md
 * to deploy it). No Claude/account sign-in involved — this is a plain
 * static page calling a plain REST API.
 */
(function () {
  "use strict";

  // Swap this if you later attach a custom domain/route in Cloudflare
  // (e.g. https://checkin-api.katsrugbyclub.com) instead of workers.dev.
  var API_BASE = "https://kats-checkin-api.katsrfc.workers.dev";

  var POLL_MS = 12000;

  var state = {
    me: null,
    roster: [],
    games: [],
    availability: [],
    teamName: "Kats Rugby Club",
    adminPinSet: false,
    isAdmin: false,
    adminToken: null,
    accessKey: null,
    editingGameId: null,
  };

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // ---------- local persistence ----------
  function loadMe() {
    try { return JSON.parse(localStorage.getItem("kats_me") || "null"); } catch (e) { return null; }
  }
  function saveMe(me) { try { localStorage.setItem("kats_me", JSON.stringify(me)); } catch (e) {} }
  function loadAdminToken() {
    try { return localStorage.getItem("kats_admin_token") || null; } catch (e) { return null; }
  }
  function saveAdminToken(token) {
    try {
      if (token) localStorage.setItem("kats_admin_token", token);
      else localStorage.removeItem("kats_admin_token");
    } catch (e) {}
  }
  function loadAccessKey() {
    try { return localStorage.getItem("kats_access_key") || null; } catch (e) { return null; }
  }
  function saveAccessKey(key) {
    try {
      if (key) localStorage.setItem("kats_access_key", key);
      else localStorage.removeItem("kats_access_key");
    } catch (e) {}
  }

  // ---------- toast / banner ----------
  var toastTimer = null;
  function showToast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }
  function showBanner(msg) {
    var el = $("#banner");
    el.textContent = msg;
    el.hidden = false;
  }

  // ---------- confirm modal ----------
  // A custom dialog instead of window.confirm() — some in-app browsers
  // (chat-app link previews, embedded webviews) block native confirm()
  // silently, which would make a destructive action just do nothing.
  var pendingConfirm = null;
  function showConfirm(message, onConfirm) {
    $("#confirmMessage").textContent = message;
    pendingConfirm = onConfirm;
    $("#confirmModal").hidden = false;
  }
  function closeConfirm() {
    $("#confirmModal").hidden = true;
    pendingConfirm = null;
  }

  // ---------- API helper ----------
  function api(path, options) {
    options = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (state.accessKey) headers["X-Access-Key"] = state.accessKey;
    if (options.admin && state.adminToken) headers.Authorization = "Bearer " + state.adminToken;
    return fetch(API_BASE + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          if (res.status === 401 && options.admin && state.isAdmin) {
            // Admin session expired server-side — drop local admin state so
            // the next click prompts for the PIN again instead of failing silently.
            state.isAdmin = false;
            state.adminToken = null;
            saveAdminToken(null);
            applyAdminVisibility();
            renderGames();
            renderRoster();
          } else if (res.status === 401 && !options.admin) {
            // The shared access key is missing or wrong (never set, cleared,
            // or rotated by an admin) — drop it and show the private-link
            // gate instead of an empty/broken app.
            state.accessKey = null;
            saveAccessKey(null);
            showGate();
          }
          var err = new Error((data && data.error) || "Request failed (" + res.status + ")");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  // ---------- formatting ----------
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function formatDateParts(iso) {
    var d = new Date(iso + "T00:00:00");
    return {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      num: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: "short" }),
    };
  }
  function formatTime(hhmm) {
    if (!hhmm) return "TBD";
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10), m = parts[1];
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = ((h + 11) % 12) + 1;
    return h12 + ":" + m + " " + ampm;
  }
  function mapsUrl(loc) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loc || ""); }

  // ---------- identity ----------
  function renderIdentity() {
    var text = $("#identityText");
    var switchBtn = $("#switchBtn");
    if (state.me) {
      text.innerHTML = "Checking in as <strong>" + escapeHtml(state.me.name) + "</strong>";
      switchBtn.hidden = false;
    } else {
      text.textContent = "Tap a fixture to check in, or pick your name below.";
      switchBtn.hidden = true;
    }
  }

  function applyAdminVisibility() {
    $all(".admin-only").forEach(function (el) { el.hidden = !state.isAdmin; });
    var btn = $("#adminBtn");
    btn.classList.toggle("is-active", state.isAdmin);
    btn.title = state.isAdmin ? "Admin (unlocked)" : "Admin";
  }

  // ---------- roster ----------
  function renderRoster() {
    var wrap = $("#rosterChips");
    var empty = $("#rosterEmpty");
    $("#rosterCount").textContent = state.roster.length;
    if (state.roster.length === 0) {
      wrap.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    wrap.innerHTML = state.roster.map(function (p) {
      return '<span class="chip">' + escapeHtml(p.name) +
        (state.isAdmin ? '<button data-action="remove-player" data-id="' + p.id + '" aria-label="Remove ' + escapeHtml(p.name) + '">✕</button>' : "") +
        "</span>";
    }).join("");
  }

  // ---------- games ----------
  function gameCardHtml(g, isPast) {
    var avail = state.availability.filter(function (a) { return a.gameId === g.id; });
    var counts = { in: 0, maybe: 0, out: 0 };
    var groups = { in: [], maybe: [], out: [] };
    var respondedIds = {};
    avail.forEach(function (a) {
      if (counts[a.status] !== undefined) {
        counts[a.status]++;
        groups[a.status].push(a.playerName);
        respondedIds[a.playerId] = true;
      }
    });
    var noResponse = Math.max(state.roster.length - Object.keys(respondedIds).length, 0);
    var mine = state.me ? avail.filter(function (a) { return a.playerId === state.me.id; })[0] : null;
    var myStatus = mine ? mine.status : null;
    var dp = formatDateParts(g.date);

    var detailHtml = ["in", "maybe", "out"].map(function (s) {
      if (!groups[s].length) return "";
      return '<div class="tally-group"><span class="tally-group-label ' + s + '">' + s + "</span><span>" +
        groups[s].map(escapeHtml).join(", ") + "</span></div>";
    }).join("");

    return (
      '<article class="game-card' + (isPast ? " is-past" : "") + '" data-id="' + g.id + '">' +
        '<div class="game-stub">' +
          '<span class="stub-day">' + dp.day + "</span>" +
          '<span class="stub-num">' + dp.num + "</span>" +
          '<span class="stub-month">' + dp.month + "</span>" +
        "</div>" +
        '<div class="game-body">' +
          '<div class="game-head">' +
            "<h3>vs " + escapeHtml(g.opponent || "TBD") + "</h3>" +
            (state.isAdmin ? '<div class="card-admin-actions"><button class="icon-btn small" data-action="edit-game" data-id="' + g.id + '" aria-label="Edit fixture">✎</button></div>' : "") +
          "</div>" +
          '<div class="game-meta">' +
            '<span class="meta-item">🕐 ' + formatTime(g.time) + "</span>" +
            '<a class="meta-item meta-link" href="' + mapsUrl(g.location) + '" target="_blank" rel="noopener">📍 ' + escapeHtml(g.location || "TBD") + "</a>" +
          "</div>" +
          (g.notes ? '<p class="game-notes">' + escapeHtml(g.notes) + "</p>" : "") +
          (!isPast
            ? '<div class="rsvp-row" role="group" aria-label="Your availability">' +
                '<button class="rsvp-btn rsvp-in' + (myStatus === "in" ? " active" : "") + '" data-action="set-status" data-id="' + g.id + '" data-status="in">In</button>' +
                '<button class="rsvp-btn rsvp-maybe' + (myStatus === "maybe" ? " active" : "") + '" data-action="set-status" data-id="' + g.id + '" data-status="maybe">Maybe</button>' +
                '<button class="rsvp-btn rsvp-out' + (myStatus === "out" ? " active" : "") + '" data-action="set-status" data-id="' + g.id + '" data-status="out">Out</button>' +
              "</div>"
            : "") +
          '<button class="tally-row" data-action="toggle-tally" data-id="' + g.id + '">' +
            '<span class="tally-pill in">' + counts.in + " In</span>" +
            '<span class="tally-pill maybe">' + counts.maybe + " Maybe</span>" +
            '<span class="tally-pill out">' + counts.out + " Out</span>" +
            (noResponse > 0 ? '<span class="tally-pill pending">' + noResponse + " no reply</span>" : "") +
            '<span class="tally-caret">▾</span>' +
          "</button>" +
          '<div class="tally-detail" hidden>' + (detailHtml || '<span class="tally-group" style="color:var(--ink-soft);">No responses yet.</span>') + "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function splitGames() {
    var today = todayStr();
    var upcoming = state.games.filter(function (g) { return g.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var past = state.games.filter(function (g) { return g.date < today; }).sort(function (a, b) { return a.date > b.date ? -1 : 1; }).slice(0, 20);
    return { upcoming: upcoming, past: past };
  }

  function renderGames() {
    var split = splitGames();
    var list = $("#gamesList");
    var empty = $("#gamesEmpty");
    if (split.upcoming.length === 0) {
      list.innerHTML = "";
      empty.hidden = false;
    } else {
      empty.hidden = true;
      list.innerHTML = split.upcoming.map(function (g) { return gameCardHtml(g, false); }).join("");
    }

    var toggle = $("#pastToggle");
    var pastList = $("#pastList");
    if (split.past.length === 0) {
      toggle.hidden = true;
      pastList.hidden = true;
    } else {
      toggle.hidden = false;
      pastList.innerHTML = split.past.map(function (g) { return gameCardHtml(g, true); }).join("");
    }
  }

  // ---------- who-are-you ----------
  function renderWhoList(filterText) {
    var wrap = $("#whoList");
    var q = (filterText || "").trim().toLowerCase();
    var items = state.roster.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1; });
    if (items.length === 0) {
      wrap.innerHTML = '<div class="who-empty">No matching names — add yours below.</div>';
      return;
    }
    wrap.innerHTML = items.map(function (p) {
      return '<div class="who-row" data-action="pick-me" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '">' +
        "<span>" + escapeHtml(p.name) + "</span><span aria-hidden=\"true\">›</span></div>";
    }).join("");
  }

  function openWhoModal(closable) {
    $("#whoModal").hidden = false;
    $("#whoCloseBtn").hidden = !closable;
    $("#whoSearch").value = "";
    renderWhoList("");
    setTimeout(function () { $("#whoSearch").focus(); }, 50);
  }
  function closeWhoModal() { $("#whoModal").hidden = true; }

  function selectMe(id, name) {
    state.me = { id: id, name: name };
    saveMe(state.me);
    renderIdentity();
    renderGames();
    closeWhoModal();
  }

  function findRosterByName(name) {
    var lower = name.trim().toLowerCase();
    return state.roster.filter(function (p) { return p.name.toLowerCase() === lower; })[0] || null;
  }

  function addPlayer(rawName, selectAsMe) {
    var name = (rawName || "").trim();
    if (!name) return;
    var existing = findRosterByName(name);
    if (existing) {
      if (selectAsMe) selectMe(existing.id, existing.name);
      return;
    }
    api("/api/roster", { method: "POST", body: { name: name } })
      .then(function (player) {
        state.roster.push(player);
        renderRoster();
        renderWhoList($("#whoSearch") ? $("#whoSearch").value : "");
        renderGames();
        if (selectAsMe) selectMe(player.id, player.name);
        showToast(name + " added to the squad.");
      })
      .catch(function (e) { console.error(e); showToast("Couldn't add that name — try again."); });
  }

  // ---------- availability ----------
  function setStatus(gameId, status) {
    if (!state.me) { openWhoModal(true); return; }
    var prior = state.availability.filter(function (a) { return a.gameId === gameId && a.playerId === state.me.id; })[0];
    var optimistic = { id: gameId + "__" + state.me.id, gameId: gameId, playerId: state.me.id, playerName: state.me.name, status: status, updatedAt: new Date().toISOString() };
    state.availability = state.availability.filter(function (a) { return a.id !== optimistic.id; }).concat([optimistic]);
    renderGames();

    api("/api/availability", { method: "POST", body: { gameId: gameId, playerId: state.me.id, playerName: state.me.name, status: status } })
      .catch(function (e) {
        console.error(e);
        state.availability = state.availability.filter(function (a) { return a.id !== optimistic.id; });
        if (prior) state.availability.push(prior);
        renderGames();
        showToast("Couldn't save your availability — try again.");
      });
  }

  // ---------- admin modal ----------
  function openAdminModal() {
    $("#adminModal").hidden = false;
    $("#setupError").textContent = "";
    $("#loginError").textContent = "";
    $("#panelError").textContent = "";
    $("#adminSetupView").hidden = true;
    $("#adminLoginView").hidden = true;
    $("#adminPanelView").hidden = true;

    if (state.isAdmin) {
      $("#adminModalTitle").textContent = "Admin settings";
      $("#panelTeamName").value = state.teamName;
      $("#panelNewPin").value = "";
      $("#adminPanelView").hidden = false;
    } else if (!state.adminPinSet) {
      $("#adminModalTitle").textContent = "Set up admin access";
      $("#setupTeamName").value = state.teamName;
      $("#setupPin").value = "";
      $("#setupPinConfirm").value = "";
      $("#adminSetupView").hidden = false;
    } else {
      $("#adminModalTitle").textContent = "Admin access";
      $("#loginPin").value = "";
      $("#adminLoginView").hidden = false;
      setTimeout(function () { $("#loginPin").focus(); }, 50);
    }
  }
  function closeAdminModal() { $("#adminModal").hidden = true; }

  function becomeAdmin(token) {
    state.adminToken = token;
    state.isAdmin = true;
    saveAdminToken(token);
    applyAdminVisibility();
    renderGames();
    renderRoster();
  }

  // ---------- game form ----------
  function openGameForm(gameId) {
    state.editingGameId = gameId || null;
    $("#gameFormError").textContent = "";
    $("#gameForm").reset();
    $("#deleteGameBtn").hidden = !gameId;
    if (gameId) {
      var g = state.games.filter(function (x) { return x.id === gameId; })[0];
      if (g) {
        $("#gameFormTitle").textContent = "Edit fixture";
        $("#gfOpponent").value = g.opponent || "";
        $("#gfDate").value = g.date || "";
        $("#gfTime").value = g.time || "";
        $("#gfLocation").value = g.location || "";
        $("#gfNotes").value = g.notes || "";
      }
    } else {
      $("#gameFormTitle").textContent = "Add fixture";
      $("#gfDate").value = todayStr();
    }
    $("#gameFormModal").hidden = false;
    setTimeout(function () { $("#gfOpponent").focus(); }, 50);
  }
  function closeGameForm() { $("#gameFormModal").hidden = true; }

  // ---------- data loading ----------
  // `background: true` is for the polling timer, once we're already
  // unlocked: swallow errors into a banner rather than kicking the viewer
  // back to the access gate over a transient blip. The initial/unlock call
  // omits it so unlockWithKey() can react to a bad key.
  function loadState(opts) {
    opts = opts || {};
    return api("/api/state").then(function (data) {
      state.teamName = data.teamName || "Kats Rugby Club";
      state.adminPinSet = !!data.adminPinSet;
      state.roster = data.roster || [];
      state.games = data.games || [];
      state.availability = data.availability || [];

      $("#teamNameEl").textContent = state.teamName;
      document.title = state.teamName + " — Team Check-In";
      renderRoster();
      renderWhoList($("#whoSearch") ? $("#whoSearch").value : "");
      renderGames();
      $("#banner").hidden = true;
    }).catch(function (e) {
      console.error(e);
      if (opts.background) {
        showBanner("Couldn't reach the check-in service. If you're the admin, confirm the Worker is deployed and API_BASE in check-in/app.js is set correctly.");
        return;
      }
      throw e;
    });
  }

  // ---------- events ----------
  function wireEvents() {
    $("#switchBtn").addEventListener("click", function () { openWhoModal(true); });
    $("#whoCloseBtn").addEventListener("click", closeWhoModal);
    $("#whoSearch").addEventListener("input", function (e) { renderWhoList(e.target.value); });
    $("#whoAddForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#whoAddInput");
      addPlayer(input.value, true);
      input.value = "";
    });
    $("#whoList").addEventListener("click", function (e) {
      var row = e.target.closest("[data-action='pick-me']");
      if (!row) return;
      selectMe(row.getAttribute("data-id"), row.getAttribute("data-name"));
    });

    $("#addPlayerForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#addPlayerInput");
      addPlayer(input.value, !state.me);
      input.value = "";
    });
    $("#rosterChips").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action='remove-player']");
      if (!btn || !state.isAdmin) return;
      var id = btn.getAttribute("data-id");
      showConfirm("Remove this player from the squad list?", function () {
        api("/api/roster/" + id, { method: "DELETE", admin: true })
          .then(function () {
            state.roster = state.roster.filter(function (p) { return p.id !== id; });
            renderRoster();
            renderGames();
          })
          .catch(function (e2) { console.error(e2); showToast("Couldn't remove player."); });
      });
    });

    function handleGamesClick(e) {
      var tallyBtn = e.target.closest("[data-action='toggle-tally']");
      if (tallyBtn) {
        tallyBtn.classList.toggle("is-open");
        var card = tallyBtn.closest(".game-card");
        var detail = card.querySelector(".tally-detail");
        detail.hidden = !detail.hidden;
        return;
      }
      var statusBtn = e.target.closest("[data-action='set-status']");
      if (statusBtn) {
        setStatus(statusBtn.getAttribute("data-id"), statusBtn.getAttribute("data-status"));
        return;
      }
      var editBtn = e.target.closest("[data-action='edit-game']");
      if (editBtn) { openGameForm(editBtn.getAttribute("data-id")); return; }
    }
    $("#gamesList").addEventListener("click", handleGamesClick);
    $("#pastList").addEventListener("click", handleGamesClick);

    $("#pastToggle").addEventListener("click", function () {
      var showing = !$("#pastList").hidden;
      $("#pastList").hidden = showing;
      $("#pastToggle").textContent = showing ? "Show past fixtures" : "Hide past fixtures";
    });

    $("#adminBtn").addEventListener("click", openAdminModal);
    $("#adminCloseBtn").addEventListener("click", closeAdminModal);

    $("#setupSaveBtn").addEventListener("click", function () {
      var teamName = $("#setupTeamName").value.trim() || "Kats Rugby Club";
      var pin = $("#setupPin").value.trim();
      var confirmPin = $("#setupPinConfirm").value.trim();
      var err = $("#setupError");
      if (pin.length < 4) { err.textContent = "PIN needs at least 4 characters."; return; }
      if (pin !== confirmPin) { err.textContent = "PINs don't match."; return; }
      api("/api/admin/setup", { method: "POST", body: { teamName: teamName, pin: pin } })
        .then(function (res) {
          state.teamName = res.teamName;
          state.adminPinSet = true;
          $("#teamNameEl").textContent = state.teamName;
          becomeAdmin(res.token);
          closeAdminModal();
          showToast("Admin access set up.");
        })
        .catch(function (e) { err.textContent = e.message || "Couldn't save — try again."; });
    });

    $("#loginSubmitBtn").addEventListener("click", function () {
      var pin = $("#loginPin").value.trim();
      var err = $("#loginError");
      api("/api/admin/login", { method: "POST", body: { pin: pin } })
        .then(function (res) {
          becomeAdmin(res.token);
          closeAdminModal();
          showToast("Admin mode unlocked.");
        })
        .catch(function (e) { err.textContent = e.message || "That PIN isn't right."; });
    });

    $("#panelSaveNameBtn").addEventListener("click", function () {
      var name = $("#panelTeamName").value.trim();
      if (!name) return;
      api("/api/admin/team-name", { method: "POST", admin: true, body: { teamName: name } })
        .then(function () {
          state.teamName = name;
          $("#teamNameEl").textContent = name;
          showToast("Team name updated.");
        })
        .catch(function (e) { $("#panelError").textContent = e.message || "Couldn't save — try again."; });
    });

    $("#panelSavePinBtn").addEventListener("click", function () {
      var pin = $("#panelNewPin").value.trim();
      var err = $("#panelError");
      if (pin.length < 4) { err.textContent = "PIN needs at least 4 characters."; return; }
      api("/api/admin/pin", { method: "POST", admin: true, body: { pin: pin } })
        .then(function () {
          err.textContent = "";
          $("#panelNewPin").value = "";
          showToast("Admin PIN updated.");
        })
        .catch(function (e) { err.textContent = e.message || "Couldn't save — try again."; });
    });

    $("#logoutAdminBtn").addEventListener("click", function () {
      var token = state.adminToken;
      state.isAdmin = false;
      state.adminToken = null;
      saveAdminToken(null);
      applyAdminVisibility();
      renderGames();
      renderRoster();
      closeAdminModal();
      if (token) api("/api/admin/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(function () {});
    });

    $("#addGameBtn").addEventListener("click", function () { openGameForm(null); });
    $("#gameFormCloseBtn").addEventListener("click", closeGameForm);
    $("#gameForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#gameFormError");
      var opponent = $("#gfOpponent").value.trim();
      var date = $("#gfDate").value;
      if (!opponent || !date) { err.textContent = "Opponent and date are required."; return; }
      var payload = {
        opponent: opponent,
        date: date,
        time: $("#gfTime").value || "",
        location: $("#gfLocation").value.trim(),
        notes: $("#gfNotes").value.trim(),
      };
      var call = state.editingGameId
        ? api("/api/games/" + state.editingGameId, { method: "PUT", admin: true, body: payload })
        : api("/api/games", { method: "POST", admin: true, body: payload });
      call.then(function () {
        closeGameForm();
        showToast(state.editingGameId ? "Fixture updated." : "Fixture added.");
        loadState({ background: true });
      }).catch(function (e) { err.textContent = e.message || "Couldn't save — try again."; });
    });

    $("#deleteGameBtn").addEventListener("click", function () {
      if (!state.editingGameId) return;
      var gameId = state.editingGameId;
      showConfirm("Delete this fixture? This can't be undone.", function () {
        api("/api/games/" + gameId, { method: "DELETE", admin: true })
          .then(function () {
            closeGameForm();
            showToast("Fixture deleted.");
            loadState({ background: true });
          })
          .catch(function (e) { $("#gameFormError").textContent = e.message || "Couldn't delete — try again."; });
      });
    });

    $("#confirmYesBtn").addEventListener("click", function () {
      var cb = pendingConfirm;
      closeConfirm();
      if (cb) cb();
    });
    $("#confirmCancelBtn").addEventListener("click", closeConfirm);

    $all(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target !== overlay) return;
        if (overlay.id === "whoModal" && !$("#whoCloseBtn").hidden) closeWhoModal();
        if (overlay.id === "adminModal") closeAdminModal();
        if (overlay.id === "gameFormModal") closeGameForm();
        if (overlay.id === "confirmModal") closeConfirm();
      });
    });
  }

  // ---------- private-link gate ----------
  function showGate(message) {
    $("#appRoot").hidden = true;
    $("#accessGate").hidden = false;
    if (message) $("#accessGateError").textContent = message;
  }
  function hideGate() {
    $("#accessGate").hidden = true;
    $("#appRoot").hidden = false;
  }

  function unlockWithKey(key) {
    key = (key || "").trim();
    if (!key) return Promise.reject(new Error("Enter your access key."));
    state.accessKey = key;
    return loadState().then(function () {
      // loadState() only resolves normally on a 2xx — a bad key rejects
      // via api()'s 401 handling before we get here.
      saveAccessKey(key);
      hideGate();
      if (!state.me) openWhoModal(false);
      startPolling();
    });
  }

  var pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () { loadState({ background: true }); }, POLL_MS);
  }

  // ---------- init ----------
  function init() {
    state.me = loadMe();
    state.adminToken = loadAdminToken();
    state.isAdmin = !!state.adminToken;
    renderIdentity();
    applyAdminVisibility();
    wireEvents();

    $("#accessGateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#accessGateInput");
      $("#accessGateError").textContent = "";
      unlockWithKey(input.value).catch(function (err) {
        $("#accessGateError").textContent = err.status === 401 ? "That access key isn't right." : (err.message || "Couldn't connect — try again.");
      });
    });

    // A shared link looks like .../check-in/?key=XXXX — grab it, remember
    // it locally, and scrub it from the visible URL/history so it doesn't
    // linger in the address bar or browser history.
    var urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      history.replaceState(null, "", window.location.pathname);
      unlockWithKey(urlKey).catch(function (err) {
        showGate(err.status === 401 ? "That link's access key isn't right — ask your admin for a fresh one." : "Couldn't connect — try again.");
      });
      return;
    }

    var storedKey = loadAccessKey();
    if (storedKey) {
      unlockWithKey(storedKey).catch(function () {
        showGate(); // silently fall back to the gate; the 401 handler in api() already cleared the bad key
      });
      return;
    }

    showGate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
