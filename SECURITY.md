# Security policy

## Reporting a vulnerability

Do not open a public issue. Contact the repository owner directly through a private channel.

## Rules

- The browser holds no secrets. Users sign in with MSAL.js 3.30.0 using the authorization code flow with PKCE.
- The MSAL script is pinned to one version with a `sha384` integrity hash. The browser refuses a changed file. Do not switch to a floating version tag.
- Tokens are requested only for the backend scope. They are never sent to third parties.
- Chats are kept in memory. They are cleared at sign-out and when the tab closes.
- The content security policy in `staticwebapp.config.json` limits scripts, connections, and frames. It allows `login.microsoftonline.com` as a frame source so that MSAL can renew tokens silently.
- Model output and server data are rendered with `textContent` only. A manual check (see `docs/DESIGN.md`) showed that HTML in an answer is displayed as text. No automated test covers this yet.
- The only stored secret is the Static Web Apps deployment token (see `AGENTS.md`).
- Known gap: the backend has no conversation state, so this UI cannot send history. Adding history means a backend change and a new data-retention decision.
