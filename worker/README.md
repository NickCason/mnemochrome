# mnemochrome-perfect worker

Tiny Cloudflare Worker that receives a fire-and-forget POST from the
Mnemochrome PWA whenever a player scores 100% on a round, and forwards a
Pushover notification with a triumphant sound + the target/guess hex pair +
the player's personal-best context.

## Deploy

```bash
cd worker
npx wrangler@latest deploy
```

## Secrets

```bash
npx wrangler@latest secret put PUSHOVER_USER
npx wrangler@latest secret put PUSHOVER_TOKEN
```

## Config (`wrangler.toml` vars)

- `ALLOWED_ORIGIN` — only this origin's POSTs are accepted (default
  `https://nickcason.github.io`).
- `RATE_LIMIT_PER_MINUTE` — per-IP cap, in-memory per isolate (default `30`).
- `PUSHOVER_SOUND` — Pushover sound name. Default `bugle` (military victory
  fanfare). Swap for `cosmic`, `magic`, `classical`, `gamelan`, `intermission`,
  or upload a custom sound to your Pushover app and reference it here.

## Smoke test

```bash
curl -X POST https://mnemochrome-perfect.<account>.workers.dev/ \
  -H "Origin: https://nickcason.github.io" \
  -H "Content-Type: application/json" \
  -d '{"target":"#3344ff","guess":"#3344ff","pb":100,"total":42,"test":true}'
```
