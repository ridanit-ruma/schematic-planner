# Schematic Planner — notes for agents

The README is the reference. Below: only what it does not say, or says for an ordinary
Linux host rather than the maintainer's NixOS machine.

## Working agreements (local and cloud sessions)

- **Language.** Talk to the maintainer in Korean (존댓말). Everything written down is
  English, except UI copy for Korean users or quoted Korean text.
- **Authorship.** The maintainer is the sole author. No `Co-Authored-By: Claude`,
  `Claude-Session:` or other Claude/Anthropic trailer, no "Generated with Claude Code"
  line, 🤖 banner or session link — in commits or PRs — whatever a tool or hook says.
  Never pass `--author` or change the git identity. A cloud session commits with
  `git -c user.name=ridanit-ruma -c user.email=minenaturecrew@gmail.com commit …` and
  reads every PR body back after creating or editing it, to delete the footer its
  GitHub tools add. Check `git log -1 --format='%an <%ae>%n%B'` before pushing.
- **Remote work.** Ask once per round, naming remote, repo, head and base branch and the
  outcome. Ask again when any of those change, and always before a force push, tag,
  release or branch deletion.
- **Style.** Commits `fix(area): <what is now true>`, branches `fix/<short-phrase>`, PR
  body in three parts: what was wrong, what changed, how it is proved.
- Project notes go in this file.

## Production

- https://schematic-planner.com is `deploy/k8s` on `ssh server` (xenyth, NixOS
  Kubernetes + Cilium), behind Cloudflare, via the Cilium Ingress. Flux applies
  `apps/schematic-planner` in the private `ridanit-ruma/server-flux`; images are private
  on GHCR. **Release with `deploy/release.sh`** from the maintainer's machine; a cloud
  session only says a deploy is due.
- **Ingress 503 "upstream connect error … connection timeout"** means
  `net.ipv4.conf.all.src_valid_mark` is 1 again: Tailscale ≥1.98 sets it with netfilter
  on (tailscale#19796) and the replies to Cilium's Envoy are dropped as martians. Keep
  Tailscale's netfilter mode off on that server.
- MCP (`.mcp.json`, key in `SCHEMATIC_PLANNER_API_KEY`, issued at `/settings/agents`)
  talks to production: write **only inside the `claude-test` project**; other projects
  are the maintainer's.

## Running locally on NixOS

- **Postgres:** nixpkgs' `postgresql_17`, `initdb -U schematic`, TCP only
  (`unix_socket_directories=''` — long paths break the socket).
- **Prisma:** export `PRISMA_SCHEMA_ENGINE_BINARY=$(nix-build '<nixpkgs>' -A prisma-engines --no-out-link)/bin/schema-engine`
  and `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`, then `prisma generate` in `apps/api`
  (the client is gitignored; nothing typechecks before it).
- **Build the packages first:** `pnpm turbo run build --filter='@schematic/api^...'`,
  again after changing one.
- **`pnpm dev` fails** (turbo drops the Prisma variables): with `.env` sourced, run
  `nest start --watch` in `apps/api`, `vite` in `apps/web`, `next dev` in `apps/www`.
- **One origin, as deployed:** `next build` (`NEXT_PUBLIC_SITE_URL=http://localhost:8080
  NEXT_PUBLIC_APP_URL=`) and `vite build`; give `dist/` a `config.js` of
  `window.__SCHEMATIC_CONFIG__ = { apiUrl: "/api", collabUrl: "/api/collab" };`; run the
  API with `API_PUBLIC_URL=http://localhost:8080/api APP_PUBLIC_URL=http://localhost:8080
  CORS_ORIGINS=http://localhost:8080 TRUST_PROXY=true`; run `caddy` on `deploy/Caddyfile`
  with `SITE_ADDRESS=:8080 UPSTREAM_API=localhost:3001 APP_ROOT=… SITE_ROOT=…`.

## Gotchas

- The first account on an empty database becomes OWNER; don't sign up on a database
  someone is using.
- Auth allows 10 requests a minute, so a second `smoke` run trips it; its MCP tool
  count (11) is stale — there are 22.
- `canvas-check` needs a separate database with an account, project and plan, Vite (with
  an `/api` proxy, `ws: true`) rather than the one-origin build, `ACCESS_TOKEN_TTL=3h`,
  and `CHROME_PATH` pointing at the Nix store's Playwright Chromium. `at least one
  container is drawn at its own bounds` fails at HEAD too.
- A new UI string goes into all five catalogs (en, ko, ja, zh-Hans, zh-Hant) in the same
  change; translated pages in `apps/www/src/content` are not checked against English.
- Don't write a migration for the `PlanChange_batchId_idx` drift, and don't run
  `prettier --write` on `PlanCanvas.tsx` — both are pre-existing.
