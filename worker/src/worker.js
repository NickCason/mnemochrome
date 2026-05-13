// Mnemochrome perfect-score worker.
// Receives a POST from the PWA whenever a player hits 100% and forwards a
// Pushover notification with a triumphant sound + edge context. The Pushover
// token never ships to the client.

const PUSHOVER_URL = "https://api.pushover.net/1/messages.json";

const rateBuckets = new Map();

function rateLimit(ip, perMinute) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (rateBuckets.get(ip) || []).filter((t) => t > windowStart);
  if (hits.length >= perMinute) {
    rateBuckets.set(ip, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  return true;
}

function corsHeaders(origin, allowedOrigin) {
  const ok = origin === allowedOrigin;
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function shortUA(ua) {
  if (!ua) return "unknown UA";
  const browser =
    ua.match(/Edg\/[\d.]+/) ||
    ua.match(/OPR\/[\d.]+/) ||
    ua.match(/Chrome\/[\d.]+/) ||
    ua.match(/Firefox\/[\d.]+/) ||
    ua.match(/Safari\/[\d.]+/);
  const os =
    (ua.match(/Windows NT ([\d.]+)/) && `Win ${RegExp.$1}`) ||
    (ua.match(/Mac OS X ([\d_]+)/) && `macOS ${RegExp.$1.replace(/_/g, ".")}`) ||
    (ua.match(/Android ([\d.]+)/) && `Android ${RegExp.$1}`) ||
    (ua.match(/iPhone OS ([\d_]+)/) && `iOS ${RegExp.$1.replace(/_/g, ".")}`) ||
    (ua.includes("Linux") && "Linux") ||
    "unknown OS";
  return `${browser ? browser[0] : "unknown browser"} on ${os}`;
}

function sanitizeHex(s) {
  if (typeof s !== "string") return "";
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : "";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN;
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET") {
      return new Response("mnemochrome-perfect ok\n", {
        status: 200,
        headers: { "Content-Type": "text/plain", ...cors },
      });
    }

    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405, headers: cors });
    }

    if (origin !== allowed) {
      return new Response("forbidden origin", { status: 403, headers: cors });
    }

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const perMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || "30", 10);
    if (!rateLimit(ip, perMinute)) {
      return new Response("rate limited", { status: 429, headers: cors });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine — still fires the triumph
    }

    const target = sanitizeHex(body.target);
    const guess = sanitizeHex(body.guess);
    const pb = Number.isFinite(body.pb) ? body.pb : null;
    const total = Number.isFinite(body.total) ? body.total : null;
    const viewMs = Number.isFinite(body.viewMs) ? body.viewMs : null;
    const version = typeof body.version === "string" ? body.version : "";
    const test = body.test === true;

    const cf = request.cf || {};
    const country = request.headers.get("cf-ipcountry") || cf.country || "??";
    const city = cf.city || "";
    const region = cf.region || "";
    const asn = cf.asOrganization || cf.asn || "";
    const ua = shortUA(request.headers.get("user-agent") || "");

    const locBits = [country, region, city].filter(Boolean).join(" · ");
    const asnBit = asn ? ` · ${asn}` : "";

    const colorLine =
      target && guess && target !== guess
        ? `${target} → ${guess}`
        : target
        ? `${target}`
        : "";

    const statsBits = [];
    if (pb !== null) statsBits.push(`PB ${pb}`);
    if (total !== null) statsBits.push(`round #${total}`);
    if (viewMs !== null) statsBits.push(`${(viewMs / 1000).toFixed(1)}s view`);

    const lines = [
      "100% — perfect colour recall",
      colorLine,
      statsBits.join(" · "),
      `${locBits}${asnBit}`,
      ua,
      version ? `mnemochrome ${version}` : "",
    ].filter(Boolean);

    const title = test ? "Mnemochrome: 100% (test)" : "Mnemochrome: 100%";
    const message = lines.join("\n");

    const form = new URLSearchParams();
    form.set("token", env.PUSHOVER_TOKEN);
    form.set("user", env.PUSHOVER_USER);
    form.set("title", title);
    form.set("message", message);
    form.set("priority", "0");
    if (env.PUSHOVER_SOUND) form.set("sound", env.PUSHOVER_SOUND);
    form.set("url", `${allowed}/mnemochrome/`);
    form.set("url_title", "Play");

    const resp = await fetch(PUSHOVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(`pushover error: ${detail}`, {
        status: 502,
        headers: cors,
      });
    }

    return new Response("ok", { status: 202, headers: cors });
  },
};
