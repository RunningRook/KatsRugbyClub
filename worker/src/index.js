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

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Access-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, init, origin) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const db = env.DB;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
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
