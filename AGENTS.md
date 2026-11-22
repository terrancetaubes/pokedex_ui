# AGENTS.md: pokedex_ui

Read the parent `../AGENTS.md` first. Its rules apply here.

## Purpose

A static single-page chat UI for the Pokedex platform. The layout resembles a modern chat app: a sidebar, a message thread, and a bottom composer. It signs users in with Microsoft Entra ID and sends questions to `pokedex_backend`. It has no server code and no build step.

## Layout

| Path | Contents |
|---|---|
| `src/` | The static site: `index.html`, `app.js`, `styles.css`, `config.js` (placeholder, committed) |
| `scripts/render-config.sh` | Writes `src/config.js` from environment variables. Fails when one is missing. |
| `scripts/check-markup.sh` | Fails when `app.js` uses an element ID that `index.html` lacks, or when the MSAL tag has no integrity hash |
| `staticwebapp.config.json` | Routes, security headers, and the content security policy |
| `.github/workflows/ci-cd.yml` | CI on pull requests and pushes. Calls the deploy workflow for `develop` (dev) and `release/**` (itg) |
| `.github/workflows/deploy.yml` | Reusable deploy: renders the config, then uploads `src/` to Azure Static Web Apps |
| `docs/DESIGN.md` | Layout, behavior, decisions, alternatives, and known limits |
| `docs/HOSTING.md` | Why Static Web Apps, and the one-time setup |
| `docs/ENVIRONMENTS.md` | GitHub variables and the secret for each environment |

## Rules for agents

- Never put secrets, keys, or tokens in any file in this repository. Client IDs and tenant IDs are public and are allowed.
- Never insert server responses or model output with `innerHTML`. Use `textContent`. Model output is untrusted.
- Call the backend only with a bearer token for the scope in `config.js`. Do not call the agent app or Azure Functions directly.
- Chats stay in memory. Do not write chat text to `localStorage` or `sessionStorage`.
- Keep the page free of frameworks and build steps unless a human decides otherwise. The current decision is in `docs/DESIGN.md`. Record any change in `docs/HOSTING.md` as well.
- Any new external script must be added to the content security policy in `staticwebapp.config.json` with a reason. Pin its version and add an `integrity` hash, as the MSAL tag does.
- Do not commit generated values in `src/config.js`. Restore the placeholder before you commit.
- `scripts/check-markup.sh` and `node --check src/app.js` must pass before a change is merged.
- Log every change in `AGENT_CHANGELOG.md`.

## Exception to the shared rules

The Static Web Apps deployment uses a deployment token stored as the GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. This is the only stored secret allowed in the platform. Rotate it when a person with access leaves, and after any suspected leak.
