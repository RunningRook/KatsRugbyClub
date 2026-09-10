/**
 * Kats Rugby Club — live PlayHQ fixtures & ladder widget.
 *
 * Talks to the Cloudflare Worker's public /playhq/fixtures and
 * /playhq/ladder endpoints (see ../../worker/README.md — "PlayHQ live
 * fixtures & ladder"), not PlayHQ directly: the Worker holds the PlayHQ API
 * key server-side and caches responses, so this page never sees the key.
 *
 * Progressive enhancement: if the fetch fails for any reason — the
 * Worker's PLAYHQ_API_KEY secret isn't set, PlayHQ is down, or a
 * field-name guess in the Worker's normalizeGamesResponse/
 * normalizeLadderResponse turns out wrong (see worker/src/index.js) —
 * the widget containers are just left hidden rather than showing broken
 * data. A page can optionally include a `#playhq-fallback` element
 * (visible by default, e.g. "Loading live fixtures…") that gets hidden
 * automatically the moment real data loads, so a failure doesn't leave
 * the page looking empty forever.
 */
(function () {
  "use strict";

  // Swap this if you later attach a custom domain/route in Cloudflare
  // (e.g. https://checkin-api.katsrugbyclub.com) instead of workers.dev —
  // same base URL as check-in/app.js, since it's the same deployed Worker.
  var API_BASE = "https://kats-checkin-api.katsrfc.workers.dev";

  function $(sel, root) { return (root || document).querySelector(sel); }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function fmtDate(value) {
    if (!value) return "Date TBC";
    var d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(String(value));
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function fmtTime(value) {
    if (!value) return "";
    var d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function isKats(name) {
    return /kats/i.test(String(name || ""));
  }

  function fixtureRowHtml(g) {
    var opponent = isKats(g.homeTeam) ? g.awayTeam : g.homeTeam;
    var prefix = isKats(g.homeTeam) ? "vs" : "@";
    var hasScore = g.homeScore != null && g.awayScore != null;
    var scoreHtml = hasScore ? escapeHtml(g.homeScore) + " – " + escapeHtml(g.awayScore) : "";
    var time = fmtTime(g.date);
    return (
      '<div class="fixture">' +
      '<div class="fixture-round">' + fmtDate(g.date) + "</div>" +
      '<div class="fixture-opponent"><div>' +
      '<div class="name">' + prefix + " " + escapeHtml(opponent || "TBC") + "</div>" +
      '<div class="meta">' + (time ? escapeHtml(time) : "Time TBC") + (g.venue ? " &middot; " + escapeHtml(g.venue) : "") + "</div>" +
      "</div></div>" +
      '<div class="fixture-score">' + scoreHtml + "</div>" +
      "</div>"
    );
  }

  function ladderRowHtml(r) {
    return (
      "<tr" + (isKats(r.team) ? ' class="is-kats"' : "") + ">" +
      "<td>" + escapeHtml(r.position) + "</td>" +
      "<td>" + escapeHtml(r.team) + "</td>" +
      "<td>" + escapeHtml(r.played) + "</td>" +
      "<td>" + escapeHtml(r.won) + "</td>" +
      "<td>" + escapeHtml(r.drawn) + "</td>" +
      "<td>" + escapeHtml(r.lost) + "</td>" +
      "<td>" + escapeHtml(r.pointsFor) + "</td>" +
      "<td>" + escapeHtml(r.pointsAgainst) + "</td>" +
      '<td class="ladder-points">' + escapeHtml(r.points) + "</td>" +
      "</tr>"
    );
  }

  function showWidget(container) {
    var widget = container.closest ? container.closest(".playhq-widget") : null;
    if (widget) widget.hidden = false;
    // Once any real data has loaded, the "still loading / couldn't load"
    // fallback message (if the page has one) is no longer needed.
    var fallback = $("#playhq-fallback");
    if (fallback) fallback.hidden = true;
  }

  function stampUpdated(data) {
    var el = $("#playhq-updated");
    if (!el || !data.updatedAt) return;
    var d = new Date(data.updatedAt);
    el.textContent = "Live data updated " + (isNaN(d.getTime()) ? data.updatedAt : d.toLocaleString());
    el.hidden = false;
  }

  // Homepage teaser: just the next game with no result yet, e.g.
  // "Next up: vs Chilliwack — Sat, Sep 26". Independent of the full
  // fixtures list on the season page — either or both may be on a page.
  function renderNextFixture(el, games) {
    var next = games.filter(function (g) { return g.homeScore == null && g.awayScore == null; })[0];
    if (!next) return;
    var opponent = isKats(next.homeTeam) ? next.awayTeam : next.homeTeam;
    var prefix = isKats(next.homeTeam) ? "vs" : "@";
    var time = fmtTime(next.date);
    el.textContent = "Next up: " + prefix + " " + (opponent || "TBC") + " — " + fmtDate(next.date) + (time ? ", " + time : "");
    el.hidden = false;
  }

  function loadFixtures() {
    var list = $("#playhq-fixtures");
    var teaser = $("#playhq-next-fixture");
    if (!list && !teaser) return;
    fetch(API_BASE + "/playhq/fixtures")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.games || !data.games.length) return;
        if (list) {
          list.innerHTML = data.games.map(fixtureRowHtml).join("");
          showWidget(list);
          stampUpdated(data);
        }
        if (teaser) renderNextFixture(teaser, data.games);
      })
      .catch(function () {
        /* Worker unreachable or not deployed yet — leave the widget hidden. */
      });
  }

  function loadLadder() {
    var container = $("#playhq-ladder");
    if (!container) return;
    var tbody = container.querySelector("tbody") || container;
    fetch(API_BASE + "/playhq/ladder")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ladder || !data.ladder.length) return;
        tbody.innerHTML = data.ladder.map(ladderRowHtml).join("");
        showWidget(container);
        stampUpdated(data);
      })
      .catch(function () {
        /* Worker unreachable or not deployed yet — leave the widget hidden. */
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadFixtures();
    loadLadder();
  });
})();
