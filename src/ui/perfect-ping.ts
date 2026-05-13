// Fire-and-forget Pushover ping for 100% rounds. Only runs on the live
// nickcason.github.io host so local dev never pages the phone. The CF Worker
// holds the Pushover token; this client only sends sanitized round context.

const PING_URL = "https://mnemochrome-perfect.nick-da4.workers.dev/";
const HOST = "nickcason.github.io";

declare const __BUILD_SHA__: string;

export interface PerfectPingPayload {
  target: string;
  guess: string;
  pb: number;
  total: number;
  viewMs: number;
}

export function reportPerfect(payload: PerfectPingPayload): void {
  if (typeof window === "undefined") return;
  if (window.location.hostname !== HOST) return;

  const body = JSON.stringify({
    target: payload.target,
    guess: payload.guess,
    pb: payload.pb,
    total: payload.total,
    viewMs: payload.viewMs,
    version: typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "",
  });

  try {
    fetch(PING_URL, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  } catch {
    // Never let the ping break a celebration.
  }
}
