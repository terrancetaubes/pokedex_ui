# UI design

This document describes what the UI does, how it is built, and why. Read it before you change the layout, the state, or the security settings.

## Goal

A simple chat page that looks and feels like a modern AI chat app. Users sign in once, ask questions about Pokémon, and read the answers. The page must deploy with one push and must not need a build step.

## Layout

```
+-------------------+--------------------------------------------+
| New chat          |  [sidebar]  Pokédex            [TU] Sign out|
|                   |                                            |
| Recent            |          Ask about a Pokémon               |
|  > Question 1     |     [suggestion] [suggestion] [suggestion] |
|  > Question 2     |                                            |
|                   |   (user bubble, right)                     |
|                   |   answer text, sources (left)              |
|                   |                                            |
|                   |  +--------------------------------------+  |
|                   |  | Ask about a Pokémon            (↑)   |  |
|                   |  +--------------------------------------+  |
|                   |  Each question is sent on its own.         |
+-------------------+--------------------------------------------+
```

- **Sidebar.** A "New chat" button and the list of chats in this browser tab. The sidebar hides with the toggle button. On screens 800 px wide or less, it opens as an overlay.
- **Top bar.** The sidebar toggle, the app name, and the account (initials, e-mail, and Sign out).
- **Welcome view.** Shown when a chat is empty. It has three suggestion chips. A chip fills the composer. It does not send the question, so the user can edit it first.
- **Thread.** User messages are right-aligned in a tinted bubble. Answers are plain text on the left, with sources in a small list below.
- **Composer.** A text box that grows to 200 px. Enter sends. Shift+Enter adds a line. The counter shows from 1500 characters. The limit is 2000, the same as the backend.
- **Colors.** A warm off-white and a terracotta accent. Dark mode follows the operating system setting. The design does not copy any brand logo or trademark.

## States

| State | What the user sees |
|---|---|
| Not configured (placeholder `config.js`) | Sign-in and "New chat" enabled. A click on Sign in shows the configuration message and does not redirect. Composer visible but disabled. |
| Starting (MSAL not yet ready) | Sign-in enabled. A click shows "Sign-in is still starting". Composer disabled. |
| Signed out (configured) | Sign-in and "New chat" enabled. Sign-in redirects to the Microsoft login page. Composer visible, disabled, with the placeholder "Sign in to ask questions". Suggestion chips disabled. |
| Signed in, empty chat | Greeting with the first name, suggestion chips, enabled composer, "New chat" enabled |
| Waiting for an answer | Three animated dots. Send is disabled. The user can still open other chats. |
| Error | Red message in the thread. It stays in the chat as a record. |

## How it works

1. `app.js` checks the four settings in `config.js`. If any value is empty or still has a `<` placeholder, it stops and shows a message.
2. It creates an MSAL.js 3 `PublicClientApplication` (authorization code flow with PKCE). It does not use a client secret.
3. Sign-in redirects the page to the Microsoft login page (`loginRedirect`). After login, Microsoft returns the user to the UI origin. `handleRedirectPromise()` completes the return at start-up. Token refresh tries `acquireTokenSilent` first. It redirects to sign-in only when MSAL reports that interaction is required. Other errors, such as a network failure, are shown as they are.
3a. "New chat" clears the active chat and shows the welcome view. The earlier chats stay in the sidebar until the page reloads or the user signs out.
4. Each question is a `POST {apiBaseUrl}/api/v1/chat` with the body `{"message": "..."}` and a bearer token for `api://pokedex-api/access_as_user`. The answer is `{"answer": "...", "sources": [...]}`. This matches `pokedex_backend`.
5. All text from the server is set with `textContent`. The page never uses `innerHTML` for server or model text.

## Decisions and alternatives

### Plain HTML, CSS, and JavaScript (no framework, no build step)

- **Chosen.** The page is about 400 lines of JavaScript. Deploy uploads `src/` as it is. The CI job checks it with `node --check`. The rules in `AGENTS.md` say no framework unless a human decides otherwise.
- **Alternative: React or Vite.** Better tooling for a bigger app. It needs a build job, a lock file, and more CI. It also adds a dependency tree that must be reviewed. Revisit this if the UI grows past one screen or needs many components.

### Chats in memory only

- **Chosen.** Chats live in JavaScript memory. Closing the tab removes them. Sign-out clears them. The app code never writes chats to `localStorage` or `sessionStorage`. MSAL keeps its token cache in `sessionStorage`. That cache holds tokens, not question text.
- **Trade-off.** Users lose their history on reload. A saved history needs a store on the server (for example, Cosmos DB or Table Storage in the backend) and a per-user partition. That is a design decision for a human.

### Each question is sent alone

- **Chosen.** The backend accepts one `message` field. It has no conversation field. So the agent does not see earlier messages. The disclaimer under the composer says this.
- **Alternative.** Send the last N turns in the body. The backend must accept and validate them, and the agent must use them. This is a cross-repository change.

### Redirect sign-in, not popup

- **Chosen.** The user asked for sign-in that goes to the Microsoft login page. Redirect works in every browser without popup permission. The popup was also unreliable after an `await`, which browsers often block. Token renewal uses the same redirect when MSAL needs the user again.
- **Trade-off.** The page reloads. In-memory chats are lost at sign-in, at sign-out, and when a session expires and needs a new login. The message "Your session has expired. Redirecting to sign in..." appears just before the redirect. A question that was sent when the session expired is lost.
- **Alternative.** Popup sign-in keeps the chats, but browsers may block it. The silent fallback can then fail with no redirect. A later version could save chats in `sessionStorage`. That is a data decision for a human, because it stores question text in the browser.
- **Requirement.** The UI origin must be a registered redirect URI for the Entra app. `pokedex_infra` sets this (stage 1 for localhost, stage 2 for the Static Web App hostnames).

### MSAL.js pinned to 3.30.0 with an SRI hash

- **Chosen.** The script tag names the exact version and a `sha384` integrity hash. The browser refuses a changed file. CI fails if the hash is missing (`scripts/check-markup.sh`).
- **Trade-off.** The version does not update itself. Update it on purpose. Compute the new hash from the file on jsDelivr and put both values in `src/index.html`, then update this document.
- **Alternative.** Bundle MSAL with npm. This is safer for supply chain, but it needs a build step. Revisit it with the framework decision.

### Content security policy

- `frame-src https://login.microsoftonline.com` was added. MSAL can use a hidden iframe to renew a token silently. The CSP `default-src 'self'` would block that frame. This is our reading of the MSAL behavior. Test silent renewal in `dev` after each MSAL upgrade.
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` stop other sites from framing the page.
- `style-src 'self'` allows no inline style attributes in markup. The page sets style values only through the JavaScript `style` property (textarea height), which the CSP allows.

### Stored secret

The Static Web Apps deployment token is the only stored secret. This is the exception in `AGENTS.md`. The page holds no secrets. The four values in `config.js` are public.

## Accessibility

- Buttons have labels. Icons are `aria-hidden`.
- New messages are in a live region (`aria-live="polite"`).
- Focus rings use the accent color.
- Motion is reduced when the user asks for it (`prefers-reduced-motion`).
- The sidebar toggle reports `aria-expanded`.

## Checks

| Check | Where |
|---|---|
| JavaScript syntax | CI: `node --check src/app.js` |
| Every element ID used by `app.js` exists in `index.html`. The MSAL tag has an integrity hash. | CI: `scripts/check-markup.sh` |
| Config renders and fails when a variable is missing | CI renders with test values. `render-config.sh` exits on a missing variable. |
| JSON is valid | CI: `python3 -m json.tool staticwebapp.config.json` |

Manual checks done when this design was written: the signed-out and not-configured states were rendered in headless Edge, and a chat with a stubbed sign-in and API was rendered. The stub did not test real Entra ID sign-in or the real backend. Test those in `dev` before you call a release done.

## Known limits

- No streaming. The user sees the dots until the full answer arrives.
- No Markdown. Answers show as plain text with line breaks. Adding Markdown means a sanitizer library and a new CSP review.
- No tests for the browser code yet. A Playwright test with a stubbed sign-in is the next step.
