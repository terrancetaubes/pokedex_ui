// Pokédex UI. MSAL.js 3 (authorization code flow with PKCE). Public settings only. No secrets.
//
// Rules (see AGENTS.md):
// - Build all DOM with createElement and textContent. Never use innerHTML for server or model text.
// - Send requests only to cfg.apiBaseUrl with a bearer token for cfg.apiScope.
// - Chats live in memory only. App code never writes chats to browser storage.
//   MSAL keeps its own token cache in sessionStorage. That cache holds tokens, not chat text.
(function () {
  "use strict";

  const SETUP_MESSAGE = "This build has no settings. Run scripts/render-config.sh before you deploy (see README).";
  const MAX_LEN = 2000;
  const COUNT_FROM = 1500; // show the character counter from this length
  const TITLE_LEN = 40;
  const cfg = window.POKEDEX_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const els = {
    app: $("app"),
    sidebar: $("sidebar"),
    toggleSidebar: $("toggle-sidebar"),
    newChat: $("new-chat"),
    chatList: $("chat-list"),
    signIn: $("sign-in"),
    signInMain: $("sign-in-main"),
    signInPanel: $("signin-panel"),
    signInText: $("signin-text"),
    accountMenu: $("account-menu"),
    avatar: $("avatar"),
    userName: $("user-name"),
    signOut: $("sign-out"),
    content: $("content"),
    welcome: $("welcome"),
    greeting: $("greeting"),
    suggestions: $("suggestions"),
    thread: $("thread"),
    composer: $("composer"),
    question: $("question"),
    charCount: $("char-count"),
    send: $("send"),
    status: $("status"),
  };

  const state = {
    ready: false, // MSAL initialized
    msal: null,
    account: null,
    chats: [], // newest first: { id, title, messages: [{ role, text, sources? }] }
    activeId: null,
    busy: false,
    pendingChatId: null,
    nextId: 1,
  };

  // ---------- helpers ----------

  function isConfigured() {
    return [cfg.tenantId, cfg.clientId, cfg.apiBaseUrl, cfg.apiScope].every(
      (v) => typeof v === "string" && v.length > 0 && !v.includes("<")
    );
  }

  function setStatus(text) {
    els.status.textContent = text || "";
  }

  function activeChat() {
    return state.chats.find((c) => c.id === state.activeId) || null;
  }

  function firstName() {
    const acc = state.account;
    if (!acc) return "";
    const full = acc.name || "";
    return full.split(" ")[0] || "";
  }

  function initials() {
    const acc = state.account;
    if (!acc) return "";
    const source = (acc.name || acc.username || "").replace(/@.*/, "");
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function titleFrom(question) {
    return question.length > TITLE_LEN ? `${question.slice(0, TITLE_LEN)}…` : question;
  }

  function errorText(err) {
    if (err && err.status) {
      if (err.status === 401 || err.status === 403) return "Your session has expired. Sign in again.";
      if (err.status === 422) return "The question could not be sent. Shorten it and try again.";
      if (err.status === 504) return "The agents took too long to answer. Try again.";
      return `The server returned an error (${err.status}). Try again.`;
    }
    if (err instanceof TypeError) return "Could not reach the server. Check your connection.";
    return (err && err.message) || "Something went wrong. Try again.";
  }

  // ---------- rendering ----------

  function renderSidebar() {
    els.chatList.replaceChildren();
    if (state.chats.length === 0) {
      els.chatList.appendChild(el("li", "empty-note", state.account ? "No chats yet" : "Sign in to start a chat"));
      return;
    }
    for (const chat of state.chats) {
      const li = el("li");
      const btn = el("button", "chat-item", chat.title);
      btn.type = "button";
      if (chat.id === state.activeId) btn.setAttribute("aria-current", "true");
      btn.addEventListener("click", () => openChat(chat.id));
      li.appendChild(btn);
      els.chatList.appendChild(li);
    }
  }

  function messageEl(msg) {
    const article = el("article", `msg msg-${msg.role}`);
    article.appendChild(el("p", "msg-text", msg.text));
    if (msg.sources && msg.sources.length) {
      const list = el("ul", "sources");
      for (const s of msg.sources) list.appendChild(el("li", null, String(s)));
      article.appendChild(list);
    }
    return article;
  }

  function typingEl() {
    const wrap = el("article", "msg msg-assistant typing");
    wrap.setAttribute("role", "status");
    const dots = el("span", "dots");
    dots.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) dots.appendChild(el("span"));
    wrap.appendChild(dots);
    wrap.appendChild(el("span", "sr-only", "Thinking"));
    return wrap;
  }

  function renderThread() {
    const chat = activeChat();
    const isPending = state.busy && chat && chat.id === state.pendingChatId;
    const hasContent = !!chat && (chat.messages.length > 0 || isPending);

    els.welcome.hidden = hasContent;
    els.thread.hidden = !hasContent;
    els.thread.replaceChildren();
    if (!hasContent) return;

    for (const msg of chat.messages) els.thread.appendChild(messageEl(msg));
    if (isPending) els.thread.appendChild(typingEl());
    els.content.scrollTop = els.content.scrollHeight;
  }

  function updateComposer() {
    const text = els.question.value;
    const len = text.length;
    els.charCount.textContent = len >= COUNT_FROM ? `${len}/${MAX_LEN}` : "";
    els.send.disabled = state.busy || !state.account || !text.trim();
  }

  function autosize() {
    els.question.style.height = "auto";
    els.question.style.height = `${Math.min(els.question.scrollHeight, 200)}px`;
  }

  function renderAccount() {
    const signedIn = !!state.account;
    const configured = isConfigured();

    els.app.dataset.signedIn = String(signedIn);

    // Sign-in is always clickable while signed out. A click in an unconfigured build shows the reason.
    els.signIn.hidden = signedIn;
    els.signIn.title = configured ? "" : SETUP_MESSAGE;
    els.signInPanel.hidden = signedIn;
    els.signInText.textContent = configured
      ? state.ready
        ? "Sign in to ask questions."
        : "Starting sign-in..."
      : "Sign-in is not set up in this build.";
    els.accountMenu.hidden = !signedIn;

    // The composer is always visible. It accepts text only when signed in.
    els.question.disabled = !signedIn;
    els.question.placeholder = signedIn ? "Ask about a Pokémon" : "Sign in to ask questions";
    for (const btn of document.querySelectorAll(".suggestion")) btn.disabled = !signedIn;

    els.avatar.textContent = initials();
    els.userName.textContent = signedIn ? state.account.username || state.account.name || "" : "";

    if (signedIn && firstName()) {
      els.greeting.textContent = `Hi ${firstName()}, what would you like to know about Pokémon?`;
    } else {
      els.greeting.textContent = "Ask about a Pokémon";
    }
  }

  function renderAll() {
    renderAccount();
    renderSidebar();
    renderThread();
    updateComposer();
  }

  // ---------- chats ----------

  // Opens a blank chat. The current chat stays in the sidebar.
  function newChat() {
    state.activeId = null;
    setStatus("");
    renderAll();
    if (!els.question.disabled) els.question.focus();
  }

  function openChat(id) {
    state.activeId = id;
    setStatus("");
    renderAll();
  }

  async function send(question) {
    if (state.busy || !state.account) return;

    let chat = activeChat();
    if (!chat) {
      chat = { id: state.nextId++, title: titleFrom(question), messages: [] };
      state.chats.unshift(chat);
      state.activeId = chat.id;
    }

    chat.messages.push({ role: "user", text: question });
    state.busy = true;
    state.pendingChatId = chat.id;
    setStatus("");
    renderAll();

    try {
      const data = await ask(question);
      chat.messages.push({
        role: "assistant",
        text: data.answer || "No answer returned.",
        sources: data.sources,
      });
    } catch (err) {
      chat.messages.push({ role: "error", text: errorText(err) });
    } finally {
      state.busy = false;
      state.pendingChatId = null;
      renderAll();
    }
  }

  // ---------- auth and API ----------

  async function getToken() {
    const request = { account: state.account, scopes: [cfg.apiScope] };
    try {
      const result = await state.msal.acquireTokenSilent(request);
      return result.accessToken;
    } catch (err) {
      // Only send the user to sign in again when MSAL says interaction is required.
      // Other errors (for example network failures) are shown as they are.
      if (!(err instanceof window.msal.InteractionRequiredAuthError)) throw err;
      // This leaves the page. In-memory chats are lost. See docs/DESIGN.md.
      setStatus("Your session has expired. Redirecting to sign in...");
      await state.msal.acquireTokenRedirect(request);
      throw new Error("Redirecting to sign in.");
    }
  }

  async function ask(question) {
    const token = await getToken();
    const response = await fetch(`${cfg.apiBaseUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: question }),
    });
    if (!response.ok) {
      const err = new Error(`Request failed (${response.status}).`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    return {
      answer: typeof data.answer === "string" ? data.answer : "",
      sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
    };
  }

  // Sign-in leaves this page for the Microsoft sign-in page and comes back here.
  // handleRedirectPromise() in start() completes the return.
  function signIn() {
    if (!isConfigured()) {
      setStatus(SETUP_MESSAGE);
      return;
    }
    if (!state.msal || !state.ready) {
      setStatus("Sign-in is still starting. Try again in a moment.");
      return;
    }
    setStatus("Redirecting to Microsoft sign-in...");
    state.msal.loginRedirect({ scopes: [cfg.apiScope] }).catch((err) => setStatus(errorText(err)));
  }

  function signOut() {
    if (!isConfigured() || !state.msal) return;
    // Drop the chats of the signed-out user from memory before the page leaves.
    state.account = null;
    state.chats = [];
    state.activeId = null;
    state.busy = false;
    state.pendingChatId = null;
    state.msal
      .logoutRedirect({ postLogoutRedirectUri: window.location.origin })
      .catch((err) => setStatus(errorText(err)));
  }

  // ---------- events ----------

  els.signIn.addEventListener("click", signIn);
  els.signInMain.addEventListener("click", signIn);
  els.signOut.addEventListener("click", signOut);
  els.newChat.addEventListener("click", newChat);

  els.toggleSidebar.addEventListener("click", () => {
    const closed = els.app.classList.toggle("sidebar-closed");
    els.toggleSidebar.setAttribute("aria-expanded", String(!closed));
  });

  for (const btn of document.querySelectorAll(".suggestion")) {
    btn.addEventListener("click", () => {
      els.question.value = btn.dataset.prompt || "";
      autosize();
      updateComposer();
      els.question.focus();
    });
  }

  els.question.addEventListener("input", () => {
    autosize();
    updateComposer();
  });

  // Enter sends. Shift+Enter adds a new line. Do not send while an IME is composing text.
  els.question.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });

  els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = els.question.value.trim();
    if (!question || question.length > MAX_LEN) return;
    els.question.value = "";
    autosize();
    send(question);
  });

  // ---------- start ----------

  function start() {
    // On narrow screens, start with the sidebar closed.
    if (window.matchMedia("(max-width: 800px)").matches) {
      els.app.classList.add("sidebar-closed");
      els.toggleSidebar.setAttribute("aria-expanded", "false");
    }

    renderAll();

    if (!isConfigured()) {
      setStatus(SETUP_MESSAGE);
      return;
    }
    if (!window.msal) {
      setStatus("The sign-in library did not load. Check the network and the content security policy.");
      return;
    }

    state.msal = new window.msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });

    state.msal
      .initialize()
      .then(() => state.msal.handleRedirectPromise())
      .then((result) => {
        if (result && result.account) state.msal.setActiveAccount(result.account);
        state.account = state.msal.getActiveAccount() || state.msal.getAllAccounts()[0] || null;
        if (state.account) state.msal.setActiveAccount(state.account);
        state.ready = true;
        renderAll();
      })
      .catch((err) => {
        state.ready = true;
        setStatus(errorText(err));
        renderAll();
      });
  }

  start();
})();
