/**
 * Kats Rugby Club — live PlayHQ fixtures & ladder widget.
 *
 * Talks to the Cloudflare Worker's public /playhq/fixtures and
 * /playhq/ladder endpoints (see ../../worker/README.md — "PlayHQ live
 * fixtures & ladder"), not PlayHQ directly: the Worker holds the PlayHQ API
 * key server-side and caches responses, so this page never sees the key.
 *
 * This is progressive enhancement on top of the .playhq-card link-out
 * that's already on the page. If the fetch fails for any reason — the
 * Worker's PLAYHQ_API_KEY secret isn't set yet, PlayHQ is down, or a
 * field-name guess in the Worker's normalizeGame/normalizeLadderRow came
 * back empty (see worker/src/index.js's caveat comment) — the widget
 * containers are just left hidden. Nothing on the page breaks; the
 * existing link-out card is still there and still works either way.
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

  function isKats(name) {
    return /kats/i.test(String(name || ""));
  }

  function fixtureRowHtml(g) {
    var opponent = isKats(g.homeTeam) ? g.awayTeam : g.homeTeam;
    var prefix = isKats(g.homeTeam) ? "vs" : "@";
    var hasScore = g.homeScore != null && g.awayScore != null;
    var scoreHtml = hasScore
      ? escapeHtml(g.homeScore) + " – " + escapeHtml(g.awayScore)
      : '<span class="tbd">' + fmtDate(g.date) + "</span>";
    return (
      '<div class="fixture">' +
      '<div class="fixture-round">' + (g.round ? escapeHtml(g.round) : fmtDate(g.date)) + "</div>" +
      '<div class="fixture-opponent"><div>' +
      '<div class="name">' + prefix + " " + escapeHtml(opponent || "TBC") + "</div>" +
      '<div class="meta">' + fmtDate(g.date) + (g.venue ? " &middot; " + escapeHtml(g.venue) : "") + "</div>" +
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
    el.textContent = "Next up: " + prefix + " " + (opponent || "TBC") + " — " + fmtDate(next.date);
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
