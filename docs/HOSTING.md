# Hosting options for the UI

## Options

| Option | Setup time | Cost (low traffic) | Strength | Trade-off |
|---|---|---|---|---|
| **Azure Static Web Apps** (chosen) | About 15 minutes | Free tier available | Built-in CDN, HTTPS, custom domains, GitHub deploy | Deploy uses a deployment token secret, not OIDC |
| Storage account static website | About 10 minutes | Very low | Cheapest, simple | No built-in CI, no custom domain without a CDN, weaker headers |
| Container App (nginx) | About 30 minutes | Pay for a running replica | Same platform as the backend, OIDC deploy | More moving parts for a static page |
| App Service (Linux) | About 30 minutes | Paid plan required | Full control | Highest cost and admin effort for a static page |

## Decision

Use Azure Static Web Apps. It is the fastest route to a secure, HTTPS-hosted page with a CDN, and it fits a static UI with no server code. The deployment token is the trade-off. Only this repository uses that secret.

## UI stack decision

The UI is plain HTML, CSS, and JavaScript with no framework and no build step. This follows the rule in `AGENTS.md`. The reasons and the alternatives are in `docs/DESIGN.md`. Revisit the decision if the UI grows past one screen.

## One-time setup (per environment)

1. The platform deployment in `pokedex_infra` creates `swa-pokedex-<env>-<suffix>`.
2. Copy its deployment token into the GitHub environment secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (for `dev` and `itg`).
3. Set the environment variables listed in `docs/ENVIRONMENTS.md`.
4. Add the Static Web App's hostname to the UI redirect URIs in `pokedex_infra/identity/*.bicepparam`, and run `identity.yml`.
5. Push to `develop` (dev) or create a `release/<n>` branch (itg).

## Alternatives not chosen

If the tenant policy blocks deployment tokens, move the UI to a Container App. Use the same pattern as `pokedex_backend`, with OIDC deploy.
