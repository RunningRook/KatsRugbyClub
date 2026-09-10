/**
 * Kats Rugby Club — Team Check-In API
 *
 * A small dependency-free Cloudflare Worker backed by D1. Serves the
 * live shared state (roster / fixtures / availability) behind
 * https://<your-worker-domain>/api/... for the static page in
 * /check-in/index.html. No accounts required — a lightweight admin PIN
 * (hashed + salted, session tokens issued on success) gates fixture and
 * roster management; everything else is open to anyone with the link.
 *
 * See ../README.md for deploy steps.
 */

// Add every origin the check-in page is served from. Cross-origin
// requests from anywhere else are refused.
const ALLOWED_ORIGINS = [
  "https://katsrugbyclub.com",
  "https://www.katsrugbyclub.com",
  "http://localhost:8788", // `wrangler pages dev` / local testing
];

// Static pepper mixed into the PIN hash so a leaked hash alone isn't a
// rainbow-table lookup. Not a secret worth protecting hard — this PIN
// gate is a UI convenience, not a security boundary.
const PIN_SALT = "kats-checkin-v1";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function corsHeaders(origin, isPublic) {
  // /playhq/* is public sport data meant for any page that wants to embed
  // it, not just this site -- open CORS. Everything else (the check-in
  // tool) stays locked to ALLOWED_ORIGINS.
  const allow = isPublic ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Access-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, init, origin, isPublic) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, isPublic),
      ...(init && init.headers),
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin) {
  return sha256Hex(PIN_SALT + ":" + pin);
}

async function getConfig(db) {
  const rows = await db.prepare("SELECT key, value FROM config").all();
  const cfg = { teamName: "Kats Rugby Club", adminPinHash: null };
  for (const row of rows.results || []) {
    if (row.key === "team_name") cfg.teamName = row.value;
    if (row.key === "admin_pin_hash") cfg.adminPinHash = row.value;
  }
  return cfg;
}

async function setConfigValue(db, key, value) {
  await db
    .prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

async function requireAdmin(request, db) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const row = await db.prepare("SELECT created_at FROM admin_sessions WHERE token = ?").bind(token).first();
  if (!row) return false;
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > SESSION_TTL_MS) {
    await db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
    return false;
  }
  return true;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

// Constant-time-ish string compare so a wrong guess can't be timed
// character-by-character. Overkill for this threat model, cheap to do right.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- PlayHQ (public fixtures/ladder proxy) ----------
//
// Read-only proxy + short-lived cache in front of PlayHQ's public External
// API (docs.playhq.com/tech/api/playhq-external-api), so the club's API key
// stays a server-side secret and the public fixtures page isn't calling
// PlayHQ on every single page load. See README.md's "Fixtures, Results &
// Registration (PlayHQ)" section for how the org id was verified, and
// worker/README.md for exactly what could and couldn't be tested from this
// build environment before it shipped.
//
// IMPORTANT CAVEAT: this build environment's network can't reach
// playhq.com at all (same restriction documented for Wrangler itself), so
// the field names pulled out of each PlayHQ response below (homeTeam,
// startTime, points, etc.) are a best-effort reading of PlayHQ's own docs
// and support articles, NOT verified against a real response. `pick()`
// hedges by trying several plausible spellings per field, and
// GET /playhq/debug dumps the raw upstream JSON so a wrong guess can be
// fixed by editing normalizeGame/normalizeLadderRow below, without
// touching anything else.

const PLAYHQ_HOST = "https://api.caprod.playhq.com";
const PLAYHQ_RESOLVE_TTL_MS = 24 * 60 * 60 * 1000; // season/team/grade rarely change
const PLAYHQ_DATA_TTL_MS = 10 * 60 * 1000; // fixtures/ladder can move on match day

async function playhqFetch(env, path) {
  if (!env.PLAYHQ_API_KEY) {
    throw new Error("Server not configured: run `wrangler secret put PLAYHQ_API_KEY` (see worker/README.md).");
  }
  const res = await fetch(PLAYHQ_HOST + path, {
    headers: {
      "x-api-key": env.PLAYHQ_API_KEY,
      "x-phq-tenant": env.PLAYHQ_TENANT || "rca",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    body = text;
  }
  if (!res.ok) {
    const msg = body && typeof body === "object" && body.message ? body.message : String(text).slice(0, 200);
    throw new Error(`PlayHQ ${path} -> HTTP ${res.status}: ${msg}`);
  }
  return body;
}

// PlayHQ's docs show list endpoints returning a bare array in some places
// and a wrapper object in others -- unwrap defensively rather than assume.
function asArray(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  if (body && Array.isArray(body.results)) return body.results;
  return [];
}

// Reads `obj.a.b` for the first key path (dot-separated) that resolves to a
// non-empty value. Used to hedge against unverified field-name casing (see
// caveat above) -- e.g. pick(game, ["homeTeam.name", "HomeTeam.Name"]).
function pick(obj, keyPaths) {
  for (const keyPath of keyPaths) {
    const val = keyPath.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

// PlayHQ paginates list endpoints via {data, metadata:{hasMore,nextCursor}}
// (confirmed against a real response) -- the teams list in particular is
// every team in the whole competition (hundreds), not just this org's, so
// a single page isn't enough to find ours. Capped at 10 pages (~1000
// items) as a sanity limit, not because that's expected to be hit.
async function playhqFetchAllPages(env, basePath) {
  let all = [];
  let cursor = null;
  for (let i = 0; i < 10; i++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const body = await playhqFetch(env, cursor ? `${basePath}${sep}cursor=${encodeURIComponent(cursor)}` : basePath);
    all = all.concat(asArray(body));
    const meta = body && body.metadata;
    if (!meta || !meta.hasMore || !meta.nextCursor) break;
    cursor = meta.nextCursor;
  }
  return all;
}

async function cacheGet(db, key, ttlMs) {
  const row = await db.prepare("SELECT payload, fetched_at FROM playhq_cache WHERE cache_key = ?").bind(key).first();
  if (!row) return null;
  return { data: JSON.parse(row.payload), fresh: Date.now() - row.fetched_at < ttlMs };
}

async function cacheSet(db, key, data) {
  await db
    .prepare(
      "INSERT INTO playhq_cache (cache_key, payload, fetched_at) VALUES (?,?,?) " +
        "ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at"
    )
    .bind(key, JSON.stringify(data), Date.now())
    .run();
}

// Picks the season resolveKatsGrade (and /playhq/debug, so they agree)
// should use: whichever PlayHQ marks active/current, else the most
// recently started one.
function pickActiveSeason(seasons) {
  return (
    seasons.find((s) => /active|current/i.test(String(pick(s, ["status", "Status"]) || ""))) ||
    seasons.slice().sort((a, b) => new Date(pick(b, ["startDate", "StartDate"]) || 0) - new Date(pick(a, ["startDate", "StartDate"]) || 0))[0]
  );
}

// Org -> current season -> Kats team -> grade. Cached for a day since none
// of this changes mid-week; a season rollover just means the next refresh
// after the cache expires picks up the new one.
async function resolveKatsGrade(env, db) {
  const cached = await cacheGet(db, "resolved_grade", PLAYHQ_RESOLVE_TTL_MS);
  if (cached && cached.fresh) return cached.data;

  const orgId = env.PLAYHQ_ORG_ID;
  const teamMatch = (env.PLAYHQ_TEAM_MATCH || "kats").toLowerCase();

  const seasons = asArray(await playhqFetch(env, `/v1/organisations/${orgId}/seasons`));
  if (!seasons.length) throw new Error("PlayHQ returned no seasons for this organisation (see /playhq/debug).");
  const season = pickActiveSeason(seasons);
  const seasonId = pick(season, ["id", "Id", "ID"]);
  if (!seasonId) throw new Error("Couldn't find an id on a PlayHQ season (see /playhq/debug).");

  // /v1/seasons/:id/teams returns every team in the whole BC Rugby
  // competition, not just this org's -- match on team.club.id against our
  // own verified org id first (exact, can't be fooled by another club's
  // team happening to share initials -- e.g. Kelowna Crows field a team
  // literally named "KRFC U12 Boys"). Fall back to a name-substring match
  // only if club.id isn't populated the way we expect.
  const teams = await playhqFetchAllPages(env, `/v1/seasons/${seasonId}/teams`);
  const team =
    teams.find((t) => String(pick(t, ["club.id", "Club.Id"]) || "").toLowerCase() === orgId.toLowerCase()) ||
    teams.find((t) => String(pick(t, ["name", "Name"]) || "").toLowerCase().includes(teamMatch));
  if (!team) {
    // Include what PlayHQ actually returned so this is fixable from the
    // error alone.
    const clubNames = [...new Set(teams.map((t) => pick(t, ["club.name", "Club.Name"])).filter(Boolean))];
    throw new Error(
      `No PlayHQ team for org ${orgId} or matching "${teamMatch}" among ${teams.length} team(s) in season ${seasonId}. ` +
        (clubNames.length ? `Clubs seen: ${clubNames.slice(0, 30).join(", ")}${clubNames.length > 30 ? ", ..." : ""}` : "Couldn't read a club name from any of them") +
        " (see /playhq/debug)."
    );
  }
  const teamId = pick(team, ["id", "Id", "ID"]);
  const teamName = pick(team, ["name", "Name"]);

  let gradeId = pick(team, ["grade.id", "Grade.Id", "gradeId", "GradeId", "competition.grade.id"]);
  let gradeName = pick(team, ["grade.name", "Grade.Name", "gradeName", "GradeName"]);

  if (!gradeId) {
    const grades = asArray(await playhqFetch(env, `/v1/seasons/${seasonId}/grades`));
    const grade = (gradeName && grades.find((g) => String(pick(g, ["name", "Name"]) || "") === gradeName)) || grades[0];
    if (!grade) throw new Error(`Couldn't resolve a PlayHQ grade for team "${teamName}" (see /playhq/debug).`);
    gradeId = pick(grade, ["id", "Id", "ID"]);
    gradeName = gradeName || pick(grade, ["name", "Name"]);
  }
  if (!gradeId) throw new Error("Couldn't resolve a PlayHQ grade id (see /playhq/debug).");

  const resolved = { seasonId, teamId, teamName, gradeId, gradeName };
  await cacheSet(db, "resolved_grade", resolved);
  return resolved;
}

function normalizeGame(g) {
  return {
    id: pick(g, ["id", "Id", "ID"]),
    round: pick(g, ["round.name", "Round.Name", "round", "Round"]),
    date: pick(g, ["date", "Date", "startTime", "StartTime", "scheduledAt", "ScheduledAt"]),
    status: pick(g, ["status", "Status"]),
    venue: pick(g, ["venue.name", "Venue.Name", "venue", "Venue", "ground.name"]),
    homeTeam: pick(g, ["homeTeam.name", "HomeTeam.Name", "homeTeamName", "HomeTeamName"]),
    awayTeam: pick(g, ["awayTeam.name", "AwayTeam.Name", "awayTeamName", "AwayTeamName"]),
    homeScore: pick(g, ["homeScore", "HomeScore", "results.home.score", "home.score"]),
    awayScore: pick(g, ["awayScore", "AwayScore", "results.away.score", "away.score"]),
  };
}

function normalizeLadderRow(r) {
  return {
    position: pick(r, ["position", "Position", "rank", "Rank"]),
    team: pick(r, ["team.name", "Team.Name", "teamName", "TeamName", "name", "Name"]),
    played: pick(r, ["played", "Played", "statistics.played"]),
    won: pick(r, ["won", "Won", "wins", "statistics.won"]),
    lost: pick(r, ["lost", "Lost", "losses", "statistics.lost"]),
    drawn: pick(r, ["drawn", "Drawn", "draws", "statistics.drawn"]),
    byes: pick(r, ["byes", "Byes", "statistics.byes"]),
    points: pick(r, ["points", "Points", "competitionPoints", "statistics.points"]),
    pointsFor: pick(r, ["pointsFor", "PointsFor", "for", "statistics.for"]),
    pointsAgainst: pick(r, ["pointsAgainst", "PointsAgainst", "against", "statistics.against"]),
  };
}

async function handlePlayhq(request, env, db, path, origin) {
  try {
    if (path === "/playhq/fixtures" && request.method === "GET") {
      const cached = await cacheGet(db, "fixtures", PLAYHQ_DATA_TTL_MS);
      if (cached && cached.fresh) return json(cached.data, { status: 200 }, origin, true);
      try {
        const resolved = await resolveKatsGrade(env, db);
        const games = (await playhqFetchAllPages(env, `/v2/grades/${resolved.gradeId}/games`)).map(normalizeGame);
        const payload = { team: { id: resolved.teamId, name: resolved.teamName }, grade: { id: resolved.gradeId, name: resolved.gradeName }, updatedAt: nowIso(), games };
        await cacheSet(db, "fixtures", payload);
        return json(payload, { status: 200 }, origin, true);
      } catch (err) {
        // Serve stale-but-cached data over a hard error when we have it.
        if (cached) return json({ ...cached.data, stale: true, error: err.message }, { status: 200 }, origin, true);
        return json({ error: err.message }, { status: 502 }, origin, true);
      }
    }

    if (path === "/playhq/ladder" && request.method === "GET") {
      const cached = await cacheGet(db, "ladder", PLAYHQ_DATA_TTL_MS);
      if (cached && cached.fresh) return json(cached.data, { status: 200 }, origin, true);
      try {
        const resolved = await resolveKatsGrade(env, db);
        const ladder = (await playhqFetchAllPages(env, `/v2/grades/${resolved.gradeId}/ladder`)).map(normalizeLadderRow);
        const payload = { grade: { id: resolved.gradeId, name: resolved.gradeName }, updatedAt: nowIso(), ladder };
        await cacheSet(db, "ladder", payload);
        return json(payload, { status: 200 }, origin, true);
      } catch (err) {
        if (cached) return json({ ...cached.data, stale: true, error: err.message }, { status: 200 }, origin, true);
        return json({ error: err.message }, { status: 502 }, origin, true);
      }
    }

    // ---------- GET /playhq/debug?key=... ----------
    // Dumps resolved IDs + raw upstream PlayHQ JSON so a wrong field-name
    // guess in normalizeGame/normalizeLadderRow can be fixed quickly.
    // Gated behind the same ACCESS_KEY as /check-in -- not because this
    // data is sensitive (it's public sport results), just so this worker
    // can't be used as a free anonymous PlayHQ proxy by anyone who finds it.
    if (path === "/playhq/debug" && request.method === "GET") {
      const providedKey = request.headers.get("X-Access-Key") || new URL(request.url).searchParams.get("key") || "";
      if (!env.ACCESS_KEY || !safeEqual(providedKey, env.ACCESS_KEY)) {
        return json({ error: "Missing or incorrect access key (?key=... or X-Access-Key header)." }, { status: 401 }, origin, true);
      }

      // Gathers upstream JSON independently of resolveKatsGrade, so this
      // stays useful even when resolution itself fails (e.g. no team
      // matched) -- that's the exact case it needs to diagnose. The teams
      // list is every team in the whole BC Rugby competition (hundreds,
      // paginated), so this reports a summary + the matched team rather
      // than dumping the whole thing -- see rawUnmatchedClubsSample below
      // if you need to see what IS there.
      const debugInfo = { orgId: env.PLAYHQ_ORG_ID, teamMatch: env.PLAYHQ_TEAM_MATCH || "kats" };
      try {
        const rawSeasons = await playhqFetch(env, `/v1/organisations/${env.PLAYHQ_ORG_ID}/seasons`);
        debugInfo.rawSeasons = rawSeasons;
        const seasons = asArray(rawSeasons);
        const season = seasons.length ? pickActiveSeason(seasons) : null;
        const seasonId = season && pick(season, ["id", "Id", "ID"]);
        debugInfo.chosenSeasonId = seasonId || null;
        if (seasonId) {
          const [teams, rawGrades] = await Promise.all([
            playhqFetchAllPages(env, `/v1/seasons/${seasonId}/teams`),
            playhqFetch(env, `/v1/seasons/${seasonId}/grades`),
          ]);
          debugInfo.teamsFetchedTotal = teams.length;
          debugInfo.matchedTeam =
            teams.find((t) => String(pick(t, ["club.id", "Club.Id"]) || "").toLowerCase() === String(env.PLAYHQ_ORG_ID).toLowerCase()) || null;
          if (!debugInfo.matchedTeam) {
            debugInfo.rawUnmatchedClubsSample = [...new Set(teams.map((t) => pick(t, ["club.name", "Club.Name"])).filter(Boolean))].slice(0, 50);
          }
          debugInfo.rawGrades = rawGrades;
        }
      } catch (err) {
        debugInfo.upstreamFetchError = err.message;
      }

      try {
        const resolved = await resolveKatsGrade(env, db);
        debugInfo.resolved = resolved;
        const [rawGames, rawLadder] = await Promise.all([
          playhqFetch(env, `/v2/grades/${resolved.gradeId}/games`),
          playhqFetch(env, `/v2/grades/${resolved.gradeId}/ladder`),
        ]);
        debugInfo.rawGames = rawGames;
        debugInfo.rawLadder = rawLadder;
      } catch (err) {
        debugInfo.resolveError = err.message;
      }

      return json(debugInfo, { status: 200 }, origin, true);
    }
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, origin, true);
  }

  return json({ error: "Not found." }, { status: 404 }, origin, true);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const db = env.DB;
    const isPlayhq = url.pathname.replace(/\/+$/, "").startsWith("/playhq/");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin, isPlayhq) });
    }

    // ---------- public PlayHQ fixtures/ladder ----------
    // Not gated by ACCESS_KEY: this backs the public fixtures page, not the
    // private check-in tool. See handlePlayhq() above.
    if (isPlayhq) {
      return handlePlayhq(request, env, db, url.pathname.replace(/\/+$/, ""), origin);
    }

    // ---------- private-link gate ----------
    // The whole app — not just admin actions — is only reachable with the
    // shared access key baked into the link the team is given. Without it,
    // nobody gets so much as the roster or fixture list. Set with:
    //   wrangler secret put ACCESS_KEY
    if (!env.ACCESS_KEY) {
      return json({ error: "Server not configured: run `wrangler secret put ACCESS_KEY` (see worker/README.md)." }, { status: 500 }, origin);
    }
    const providedKey = request.headers.get("X-Access-Key") || "";
    if (!safeEqual(providedKey, env.ACCESS_KEY)) {
      return json({ error: "Missing or incorrect access key." }, { status: 401 }, origin);
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean); // e.g. ["api","roster","abc"]

    try {
      // ---------- GET /api/state ----------
      if (path === "/api/state" && request.method === "GET") {
        const [cfg, roster, games, availability] = await Promise.all([
          getConfig(db),
          db.prepare("SELECT id, name FROM roster ORDER BY name COLLATE NOCASE").all(),
          db.prepare("SELECT id, opponent, date, time, location, notes FROM games ORDER BY date ASC").all(),
          db.prepare("SELECT id, game_id AS gameId, player_id AS playerId, player_name AS playerName, status, updated_at AS updatedAt FROM availability").all(),
        ]);
        return json(
          {
            teamName: cfg.teamName,
            adminPinSet: !!cfg.adminPinHash,
            roster: roster.results || [],
            games: games.results || [],
            availability: availability.results || [],
          },
          { status: 200 },
          origin
        );
      }

      // ---------- POST /api/roster ----------
      if (path === "/api/roster" && request.method === "POST") {
        const body = await readJson(request);
        const name = (body.name || "").toString().trim().slice(0, 60);
        if (!name) return json({ error: "Name is required." }, { status: 400 }, origin);

        const existing = await db.prepare("SELECT id, name FROM roster WHERE name = ? COLLATE NOCASE").bind(name).first();
        if (existing) return json(existing, { status: 200 }, origin);

        const id = crypto.randomUUID();
        await db.prepare("INSERT INTO roster (id, name, created_at) VALUES (?, ?, ?)").bind(id, name, nowIso()).run();
        return json({ id, name }, { status: 201 }, origin);
      }

      // ---------- DELETE /api/roster/:id ----------
      if (parts[0] === "api" && parts[1] === "roster" && parts[2] && request.method === "DELETE") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        await db.prepare("DELETE FROM roster WHERE id = ?").bind(parts[2]).run();
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- POST /api/games ----------
      if (path === "/api/games" && request.method === "POST") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        const body = await readJson(request);
        const opponent = (body.opponent || "").toString().trim().slice(0, 80);
        const date = (body.date || "").toString().trim();
        if (!opponent || !date) return json({ error: "Opponent and date are required." }, { status: 400 }, origin);
        const id = crypto.randomUUID();
        await db
          .prepare("INSERT INTO games (id, opponent, date, time, location, notes, created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(id, opponent, date, (body.time || "").toString(), (body.location || "").toString().slice(0, 120), (body.notes || "").toString().slice(0, 300), nowIso())
          .run();
        return json({ id }, { status: 201 }, origin);
      }

      // ---------- PUT /api/games/:id ----------
      if (parts[0] === "api" && parts[1] === "games" && parts[2] && request.method === "PUT") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        const body = await readJson(request);
        const opponent = (body.opponent || "").toString().trim().slice(0, 80);
        const date = (body.date || "").toString().trim();
        if (!opponent || !date) return json({ error: "Opponent and date are required." }, { status: 400 }, origin);
        await db
          .prepare("UPDATE games SET opponent=?, date=?, time=?, location=?, notes=?, updated_at=? WHERE id=?")
          .bind(opponent, date, (body.time || "").toString(), (body.location || "").toString().slice(0, 120), (body.notes || "").toString().slice(0, 300), nowIso(), parts[2])
          .run();
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- DELETE /api/games/:id ----------
      if (parts[0] === "api" && parts[1] === "games" && parts[2] && request.method === "DELETE") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        await db.prepare("DELETE FROM games WHERE id = ?").bind(parts[2]).run();
        await db.prepare("DELETE FROM availability WHERE game_id = ?").bind(parts[2]).run();
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- POST /api/availability ----------
      if (path === "/api/availability" && request.method === "POST") {
        const body = await readJson(request);
        const gameId = (body.gameId || "").toString();
        const playerId = (body.playerId || "").toString();
        const playerName = (body.playerName || "").toString().trim().slice(0, 60);
        const status = (body.status || "").toString();
        if (!gameId || !playerId || !playerName || !["in", "maybe", "out"].includes(status)) {
          return json({ error: "gameId, playerId, playerName and a valid status are required." }, { status: 400 }, origin);
        }
        const id = gameId + "__" + playerId;
        await db
          .prepare(
            "INSERT INTO availability (id, game_id, player_id, player_name, status, updated_at) VALUES (?,?,?,?,?,?) " +
              "ON CONFLICT(id) DO UPDATE SET status=excluded.status, player_name=excluded.player_name, updated_at=excluded.updated_at"
          )
          .bind(id, gameId, playerId, playerName, status, nowIso())
          .run();
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- POST /api/admin/setup (first run only) ----------
      if (path === "/api/admin/setup" && request.method === "POST") {
        const cfg = await getConfig(db);
        if (cfg.adminPinHash) return json({ error: "Admin access is already set up." }, { status: 409 }, origin);
        const body = await readJson(request);
        const pin = (body.pin || "").toString();
        const teamName = (body.teamName || "Kats Rugby Club").toString().trim().slice(0, 60);
        if (pin.length < 4) return json({ error: "PIN needs at least 4 characters." }, { status: 400 }, origin);
        await setConfigValue(db, "admin_pin_hash", await hashPin(pin));
        await setConfigValue(db, "team_name", teamName);
        const token = crypto.randomUUID();
        await db.prepare("INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)").bind(token, nowIso()).run();
        return json({ token, teamName }, { status: 201 }, origin);
      }

      // ---------- POST /api/admin/login ----------
      if (path === "/api/admin/login" && request.method === "POST") {
        const cfg = await getConfig(db);
        const body = await readJson(request);
        const pin = (body.pin || "").toString();
        if (!cfg.adminPinHash || (await hashPin(pin)) !== cfg.adminPinHash) {
          return json({ error: "That PIN isn't right." }, { status: 401 }, origin);
        }
        const token = crypto.randomUUID();
        await db.prepare("INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)").bind(token, nowIso()).run();
        return json({ token }, { status: 200 }, origin);
      }

      // ---------- POST /api/admin/logout ----------
      if (path === "/api/admin/logout" && request.method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (token) await db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- POST /api/admin/team-name ----------
      if (path === "/api/admin/team-name" && request.method === "POST") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        const body = await readJson(request);
        const teamName = (body.teamName || "").toString().trim().slice(0, 60);
        if (!teamName) return json({ error: "Team name can't be empty." }, { status: 400 }, origin);
        await setConfigValue(db, "team_name", teamName);
        return json({ ok: true }, { status: 200 }, origin);
      }

      // ---------- POST /api/admin/pin ----------
      if (path === "/api/admin/pin" && request.method === "POST") {
        if (!(await requireAdmin(request, db))) return json({ error: "Admin PIN required." }, { status: 401 }, origin);
        const body = await readJson(request);
        const pin = (body.pin || "").toString();
        if (pin.length < 4) return json({ error: "PIN needs at least 4 characters." }, { status: 400 }, origin);
        await setConfigValue(db, "admin_pin_hash", await hashPin(pin));
        return json({ ok: true }, { status: 200 }, origin);
      }

      return json({ error: "Not found." }, { status: 404 }, origin);
    } catch (err) {
      return json({ error: "Server error: " + (err && err.message ? err.message : String(err)) }, { status: 500 }, origin);
    }
  },
};
