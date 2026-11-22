# pokedex_ui

The chat UI for the Pokédex platform. It looks like a chat app: a sidebar with recent chats, a message thread, and a composer at the bottom. Users sign in with Microsoft Entra ID. Each question goes to `pokedex_backend`.

The UI is a static site. It has no server code and no build step. It deploys to Azure Static Web Apps.

## What is in this repository

| Path | What it is |
|---|---|
| `src/` | The site: `index.html`, `styles.css`, `app.js`, and `config.js` (placeholder) |
| `staticwebapp.config.json` | Routes, security headers, and the content security policy |
| `scripts/render-config.sh` | Writes `src/config.js` from environment variables at build time |
| `scripts/check-markup.sh` | Checks that the script and the HTML agree (element IDs, library integrity hash) |
| `.github/workflows/ci-cd.yml` | CI on pull requests and pushes. CD to `dev` and `itg` |
| `.github/workflows/deploy.yml` | Reusable deploy workflow. It reads the GitHub environment |
| `docs/DESIGN.md` | Layout, behavior, and the decisions behind them |
| `docs/HOSTING.md` | Why Static Web Apps, and the one-time setup |
| `docs/ENVIRONMENTS.md` | The GitHub variables and secret for each environment |

Read `AGENTS.md` and `SECURITY.md` before you change code.

## Run locally

1. Set the four public settings for the environment you test against. Use the values from `docs/ENVIRONMENTS.md`:

   ```bash
   export TENANT_ID=<tenant-id>
   export UI_CLIENT_ID=<pokedex-ui-spa client id>
   export API_BASE_URL=<backend https URL>
   export API_SCOPE=api://pokedex-api/access_as_user
   bash scripts/render-config.sh src/config.js
   ```

2. Serve `src/` with any static server:

   ```bash
   cd src
   python -m http.server 4280
   ```

3. Open `http://localhost:4280`. The UI-app registration must list `http://localhost:4280` as a redirect URI. `pokedex_infra` sets this in stage 1.

4. Before you commit, restore the placeholder: `git checkout -- src/config.js`. The committed file holds placeholders only.

If `src/config.js` still holds placeholders, the page shows a configuration message and does not start sign-in. This is intended.

## Checks

```bash
node --check src/app.js
bash scripts/check-markup.sh
```

CI runs the same checks, and it also renders the config with test values and checks `staticwebapp.config.json`.

## Branches and deployment

This repository follows `../docs/BRANCHING_AND_RELEASE.md`. The rules in short:

| Action | Result |
|---|---|
| Open a pull request into `develop` or `release/**` | CI runs. Nothing is deployed. |
| Push to `develop` | CI runs, then deploys to `dev` |
| Push to `release/<n>` | CI runs, then deploys to `itg` |
| Run the workflow by hand (`workflow_dispatch`) | CI runs only. Deploy runs only on a push. |

To deploy again without a code change, rerun the last successful deploy job from the Actions tab, or push an empty commit to `develop`.

There is no `main` branch and no production environment. Do not add one without a human decision.

## First deployment

The steps are in `docs/HOSTING.md` and `../pokedex_infra/docs/BOOTSTRAP.md`. In short:

1. Run the infrastructure bootstrap. It creates the Static Web App `swa-pokedex-<env>-<suffix>`.
2. Copy the Static Web App deployment token into the GitHub environment secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (`dev`, then `itg`).
3. Set the GitHub environment variables in `docs/ENVIRONMENTS.md`. If one is missing, the deploy stops at the config step. It does not publish a broken site.
4. Add the Static Web App hostname to the UI redirect URIs and rerun the identity pipeline (stage 2).
5. Push to `develop`.

## Security

See `SECURITY.md`. The one stored secret is the Static Web Apps deployment token. Everything else is public configuration.
