/*!
 * Servolia assistant — the one line a client's site loads.
 *
 *   <script defer src="https://servolia.com/assistant.js" data-site="SLUG"></script>
 *
 * Plain JavaScript on purpose: it runs inside somebody else's page, next to
 * whatever framework, jQuery or theme they already have, and must depend on
 * none of it. No build step, no fonts, no third-party calls other than
 * servolia.com. Everything it draws is prefixed `sva-` so it cannot collide
 * with the host page's CSS, and it sits in its own stacking context.
 *
 * What it does, in order:
 *   1. asks /api/assistant?site=SLUG what to draw (name, colour, languages,
 *      greetings). `enabled:false` means draw nothing — an unpaid or unknown
 *      assistant leaves the page exactly as it found it.
 *   2. picks the language from <html lang>, within the ones the assistant
 *      speaks, and follows the page if that attribute changes (multilingual
 *      sites switch it live). Arabic flips the panel to RTL.
 *   3. talks to /api/chat with the last twelve turns. A reply carrying
 *      `fallback:true` (model down) swaps in a two-field form that posts to
 *      /api/chat-fallback, so the enquiry is captured either way.
 *
 * Nothing here knows the business's prompt, phone number or where its leads
 * go; that stays on the server. Optional attributes:
 *   data-position="left"   launcher bottom-left (default right)
 *   data-origin="…"        API origin, for local testing only
 */
(function () {
  "use strict";
  // currentScript is null for a tag inserted by script; fall back to finding ourselves.
  var script = document.currentScript || document.querySelector('script[src*="assistant.js"][data-site]');
  if (!script) return;
  var SLUG = (script.getAttribute("data-site") || "").trim();
  if (!SLUG) return;
  var ORIGIN = (script.getAttribute("data-origin") || "https://servolia.com").replace(/\/+$/, "");
  var POSITION = script.getAttribute("data-position") === "left" ? "left" : "right";
  // Servolia's own try page sets this so an UNPAID assistant can be tried
  // there. On a client's site the attribute does nothing: the server only
  // honours it from servolia.com's own pages, so pasting it changes nothing.
  var PREVIEW = script.getAttribute("data-preview") === "1";
  var MAX_TURNS = 12;

  // One widget per page, however many times the tag was pasted.
  if (window.__servoliaAssistant) return;
  window.__servoliaAssistant = true;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  fetch(ORIGIN + "/api/assistant?site=" + encodeURIComponent(SLUG) + (PREVIEW ? "&preview=1" : ""), { credentials: "omit" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      ready(function () {
        // A dead API stays silent (the catch below). A bug in THIS file must
        // not: it once built the widget, threw before wiring a single click,
        // and the promise chain swallowed it — a launcher that did nothing.
        try { boot(cfg); } catch (err) { console.error("[assistant]", err); }
      });
    })
    .catch(function () { /* silent by contract: a dead API must not break the host page */ });

  /* ── the widget ──────────────────────────────────────────────────────── */
  function boot(cfg) {
    var accent = /^#[0-9a-fA-F]{6}$/.test(cfg.accent || "") ? cfg.accent : "#36671E";
    var langs = cfg.languages && cfg.languages.length ? cfg.languages : ["en"];
    var lang = pickLang();
    var S = cfg.strings[lang];
    var open = false;
    var busy = false;
    var fallback = false;
    var messages = load();
    var sid = sessionId();
    var nudgeTimer = null;
    // Declared before the first render() call that reads them. `var` hoists
    // the name, not the value: declared lower down, `state` was undefined at
    // the first render and the whole boot died on `state.captured`.
    var state = { captured: false, error: "", formState: "idle" };
    var typingEl = null;

    function pickLang() {
      var page = ((document.documentElement.getAttribute("lang") || "").slice(0, 2)).toLowerCase();
      return langs.indexOf(page) >= 0 ? page : langs[0];
    }
    function isRtl() { return lang === "ar"; }

    /* CSS — every rule namespaced, colours from the config. `all: initial`
       on the root beats the host page's inherited font/line-height/color. */
    var css = "" +
      ".sva-root{all:initial;position:fixed;bottom:22px;" + POSITION + ":22px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans Arabic',sans-serif;font-size:15px;line-height:1.45;color:#18181B;direction:ltr}" +
      ".sva-root *{box-sizing:border-box;font-family:inherit}" +
      ".sva-launch{all:initial;cursor:pointer;width:58px;height:58px;border-radius:50%;background:" + accent + ";box-shadow:0 8px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:transform .18s ease;position:relative;border:0}" +
      ".sva-launch:hover{transform:scale(1.06)}" +
      ".sva-launch svg{width:26px;height:26px;fill:#fff}" +
      ".sva-launch .sva-x{display:none}" +
      ".sva-open .sva-launch .sva-x{display:block}.sva-open .sva-launch .sva-chat{display:none}" +
      ".sva-nudge{position:absolute;bottom:70px;" + POSITION + ":0;background:#fff;color:#18181B;border:1px solid #E8E6E0;border-radius:14px;padding:9px 13px;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.12);animation:sva-in .3s ease;cursor:pointer}" +
      ".sva-panel{display:none;position:absolute;bottom:72px;" + POSITION + ":0;width:370px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 110px);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.24);overflow:hidden;flex-direction:column;border:1px solid #E8E6E0;animation:sva-in .22s ease}" +
      ".sva-open .sva-panel{display:flex}" +
      ".sva-head{background:" + accent + ";color:#fff;padding:14px 16px;display:flex;align-items:center;gap:11px;flex-shrink:0}" +
      ".sva-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0}" +
      ".sva-title{font-weight:700;font-size:15px;line-height:1.2;color:#fff}" +
      ".sva-sub{font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px;margin-top:3px;color:#fff}" +
      ".sva-dot{width:7px;height:7px;border-radius:50%;background:#BEF264;box-shadow:0 0 0 0 rgba(190,242,100,.7);animation:sva-pulse 1.8s infinite}" +
      ".sva-close{all:initial;cursor:pointer;margin-inline-start:auto;color:#fff;opacity:.75;font-size:20px;line-height:1;padding:4px 6px}" +
      ".sva-close:hover{opacity:1}" +
      ".sva-msgs{flex:1;overflow-y:auto;padding:14px 14px 6px;background:#FAFAF7;display:flex;flex-direction:column;gap:9px;-webkit-overflow-scrolling:touch}" +
      ".sva-m{max-width:84%;padding:9px 13px;border-radius:16px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}" +
      ".sva-m.sva-new{animation:sva-in .2s ease}" +
      ".sva-m.sva-ai{align-self:flex-start;background:#fff;border:1px solid #E8E6E0;color:#18181B;border-bottom-left-radius:5px}" +
      ".sva-m.sva-me{align-self:flex-end;background:" + accent + ";color:#fff;border-bottom-right-radius:5px}" +
      ".sva-rtl .sva-m.sva-ai{border-bottom-left-radius:16px;border-bottom-right-radius:5px}" +
      ".sva-rtl .sva-m.sva-me{border-bottom-right-radius:16px;border-bottom-left-radius:5px}" +
      ".sva-typing{align-self:flex-start;background:#fff;border:1px solid #E8E6E0;border-radius:16px;padding:11px 14px;display:flex;gap:5px}" +
      ".sva-typing i{width:7px;height:7px;border-radius:50%;background:#A1A1AA;display:block;animation:sva-bounce 1.2s infinite}" +
      ".sva-typing i:nth-child(2){animation-delay:.15s}.sva-typing i:nth-child(3){animation-delay:.3s}" +
      ".sva-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 6px}" +
      ".sva-chip{all:initial;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:" + accent + ";background:#fff;border:1px solid " + accent + "55;border-radius:999px;padding:7px 12px}" +
      ".sva-chip:hover{background:#F5F4EF}" +
      ".sva-note{align-self:center;font-size:12.5px;font-weight:700;color:#36671E;background:#EEF5EA;border:1px solid #36671E44;border-radius:999px;padding:6px 12px;text-align:center}" +
      ".sva-err{align-self:center;font-size:12.5px;color:#B91C1C;text-align:center}" +
      ".sva-form{background:#fff;border:1px solid #E8E6E0;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px}" +
      ".sva-form p{margin:0;font-size:13px;font-weight:700}" +
      ".sva-form input{all:initial;font-family:inherit;font-size:14px;color:#18181B;background:#FAFAF7;border:1px solid #E8E6E0;border-radius:10px;padding:9px 11px;width:100%}" +
      ".sva-form button{all:initial;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;color:#fff;background:" + accent + ";border-radius:10px;padding:10px;text-align:center}" +
      ".sva-form button[disabled]{opacity:.5;cursor:default}" +
      ".sva-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E8E6E0;background:#fff;flex-shrink:0;align-items:flex-end}" +
      ".sva-input textarea{all:initial;font-family:inherit;font-size:15px;line-height:1.4;color:#18181B;background:#FAFAF7;border:1px solid #E8E6E0;border-radius:14px;padding:10px 13px;flex:1;resize:none;max-height:110px;min-height:42px;width:100%}" +
      ".sva-input textarea:focus{border-color:" + accent + "}" +
      ".sva-send{all:initial;cursor:pointer;width:42px;height:42px;border-radius:12px;background:" + accent + ";display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      ".sva-send[disabled]{opacity:.45;cursor:default}" +
      ".sva-send svg{width:18px;height:18px;fill:#fff}" +
      ".sva-rtl .sva-send svg{transform:scaleX(-1)}" +
      ".sva-rtl{direction:rtl}" +
      "@keyframes sva-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      "@keyframes sva-pulse{0%{box-shadow:0 0 0 0 rgba(190,242,100,.6)}70%{box-shadow:0 0 0 7px rgba(190,242,100,0)}100%{box-shadow:0 0 0 0 rgba(190,242,100,0)}}" +
      "@keyframes sva-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}" +
      "@media (max-width:480px){.sva-root{bottom:14px;" + POSITION + ":14px}.sva-panel{width:calc(100vw - 28px);height:calc(100vh - 100px)}}" +
      "@media (prefers-reduced-motion:reduce){.sva-root *{animation:none!important;transition:none!important}}";

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var root = el("div", "sva-root");
    root.setAttribute("data-servolia-assistant", SLUG);
    var launch = el("button", "sva-launch");
    launch.type = "button";
    launch.innerHTML =
      '<svg class="sva-chat" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>' +
      '<svg class="sva-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>';
    var nudge = el("div", "sva-nudge");
    nudge.style.display = "none";
    var panel = el("div", "sva-panel");
    panel.setAttribute("role", "dialog");

    var head = el("div", "sva-head");
    var avatar = el("div", "sva-avatar");
    avatar.textContent = (cfg.name || "A").trim().charAt(0).toUpperCase();
    var titles = el("div");
    var title = el("div", "sva-title");
    title.textContent = cfg.name;
    var sub = el("div", "sva-sub");
    var dot = el("span", "sva-dot");
    var subText = el("span");
    sub.appendChild(dot); sub.appendChild(subText);
    titles.appendChild(title); titles.appendChild(sub);
    var close = el("button", "sva-close");
    close.type = "button";
    close.innerHTML = "&times;";
    head.appendChild(avatar); head.appendChild(titles); head.appendChild(close);

    var msgs = el("div", "sva-msgs");
    var inputRow = el("div", "sva-input");
    var ta = document.createElement("textarea");
    ta.rows = 1;
    var send = el("button", "sva-send");
    send.type = "button";
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21 23 12 2 3v7l15 2-15 2z"/></svg>';
    inputRow.appendChild(ta); inputRow.appendChild(send);

    panel.appendChild(head); panel.appendChild(msgs); panel.appendChild(inputRow);
    root.appendChild(nudge); root.appendChild(panel); root.appendChild(launch);
    document.body.appendChild(root);

    applyLang();
    render();

    /* Follow the page's language switcher. Multilingual sites set <html lang>
       when the visitor picks a flag; the widget must not stay in Arabic on a
       page that just turned French. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var next = pickLang();
        if (next !== lang) { lang = next; S = cfg.strings[lang]; applyLang(); render(); }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }

    launch.addEventListener("click", toggle);
    close.addEventListener("click", function () { setOpen(false); });
    nudge.addEventListener("click", function () { setOpen(true); });
    send.addEventListener("click", function () { submit(ta.value); });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(ta.value); }
    });
    ta.addEventListener("input", grow);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });

    // A gentle "we're here" after a few seconds, once per session.
    if (!messages.length && !sessionStorage.getItem("sva_nudged_" + SLUG)) {
      nudgeTimer = setTimeout(function () {
        if (open) return;
        nudge.style.display = "block";
        try { sessionStorage.setItem("sva_nudged_" + SLUG, "1"); } catch (e) { /* private mode */ }
        setTimeout(function () { nudge.style.display = "none"; }, 12000);
      }, 6000);
    }

    // Let the host page open it from its own buttons: onclick="ServoliaAssistant.open()"
    window.ServoliaAssistant = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      ask: function (text) { setOpen(true); submit(String(text || "")); },
    };

    function applyLang() {
      panel.setAttribute("dir", isRtl() ? "rtl" : "ltr");
      panel.setAttribute("lang", lang);
      if (isRtl()) panel.classList.add("sva-rtl"); else panel.classList.remove("sva-rtl");
      panel.setAttribute("aria-label", cfg.name);
      subText.textContent = S.online;
      ta.placeholder = S.placeholder;
      ta.setAttribute("aria-label", S.placeholder);
      send.setAttribute("aria-label", S.send);
      launch.setAttribute("aria-label", open ? S.close : S.open);
      close.setAttribute("aria-label", S.close);
      nudge.textContent = S.nudge;
    }

    function toggle() { setOpen(!open); }
    function setOpen(v) {
      open = v;
      if (open) root.classList.add("sva-open"); else root.classList.remove("sva-open");
      launch.setAttribute("aria-label", open ? S.close : S.open);
      if (open) {
        nudge.style.display = "none";
        if (nudgeTimer) clearTimeout(nudgeTimer);
        if (!messages.length) {
          // The greeting arrives like a message, not like a label: a short
          // typing pause makes the first thing the visitor sees feel answered.
          showTyping();
          setTimeout(function () { hideTyping(); push("assistant", cfg.greeting[lang]); render(); }, 450);
        }
        setTimeout(function () { ta.focus(); scroll(); }, 60);
      }
    }

    function render() {
      msgs.innerHTML = "";
      if (!messages.length && open) return;
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        // Only the newest bubble animates: the list is rebuilt on every
        // render, and re-animating all of them makes the history flicker.
        var d = el("div", "sva-m " + (m.role === "user" ? "sva-me" : "sva-ai") + (i === messages.length - 1 ? " sva-new" : ""));
        d.textContent = m.content;
        msgs.appendChild(d);
      }
      // Chips only under the greeting — after the first real question they
      // are noise, and after the greeting language switched they are stale.
      if (messages.length === 1 && messages[0].role === "assistant" && !busy) {
        var chips = el("div", "sva-chips");
        (cfg.quickReplies[lang] || []).forEach(function (q) {
          var b = el("button", "sva-chip");
          b.type = "button";
          b.textContent = q;
          b.addEventListener("click", function () { submit(q); });
          chips.appendChild(b);
        });
        msgs.appendChild(chips);
      }
      if (state.captured) { var n = el("div", "sva-note"); n.textContent = S.captured; msgs.appendChild(n); }
      if (state.error) { var e = el("div", "sva-err"); e.textContent = state.error; msgs.appendChild(e); }
      if (fallback && state.formState !== "done") msgs.appendChild(form());
      if (fallback && state.formState === "done") { var ok = el("div", "sva-note"); ok.textContent = S.sent; msgs.appendChild(ok); }
      scroll();
    }

    function showTyping() {
      if (typingEl) return;
      typingEl = el("div", "sva-typing");
      typingEl.innerHTML = "<i></i><i></i><i></i>";
      msgs.appendChild(typingEl);
      scroll();
    }
    function hideTyping() { if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl); typingEl = null; }

    function submit(text) {
      text = (text || "").trim();
      if (!text || busy || fallback) return;
      ta.value = ""; grow();
      push("user", text);
      busy = true; send.disabled = true; state.error = "";
      render(); showTyping();
      fetch(ORIGIN + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          messages: messages.slice(-MAX_TURNS).map(function (m) { return { role: m.role, content: m.content }; }),
          sessionId: sid,
          pageUrl: location.href,
          siteSlug: SLUG,
          preview: PREVIEW,
        }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
        .then(function (res) {
          hideTyping();
          if (!res.ok || !res.body || typeof res.body.reply !== "string") {
            if (res.status === 429) { state.error = res.body && res.body.error ? res.body.error : "…"; }
            else { push("assistant", S.error); fallback = true; }
          } else {
            push("assistant", res.body.reply);
            if (res.body.qualified) state.captured = true;
            if (res.body.fallback) fallback = true;
          }
        })
        .catch(function () { hideTyping(); push("assistant", S.error); fallback = true; })
        .then(function () { busy = false; send.disabled = false; render(); if (!fallback) ta.focus(); });
    }

    function form() {
      var f = el("div", "sva-form");
      var p = el("p"); p.textContent = S.fallbackTitle;
      var name = document.createElement("input"); name.placeholder = S.name; name.autocomplete = "name";
      var contact = document.createElement("input"); contact.placeholder = S.contact; contact.autocomplete = "tel";
      var b = el("button"); b.type = "button"; b.textContent = state.formState === "sending" ? S.sending : S.sendDetails;
      b.disabled = state.formState === "sending";
      b.addEventListener("click", function () {
        if (!contact.value.trim()) { contact.focus(); return; }
        state.formState = "sending"; b.disabled = true; b.textContent = S.sending;
        fetch(ORIGIN + "/api/chat-fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({ name: name.value.trim(), contact: contact.value.trim(), siteSlug: SLUG, sessionId: sid, pageUrl: location.href }),
        })
          .then(function (r) { state.formState = r.ok ? "done" : "error"; })
          .catch(function () { state.formState = "error"; })
          .then(function () { if (state.formState === "error") state.error = S.failed; render(); });
      });
      f.appendChild(p); f.appendChild(name); f.appendChild(contact); f.appendChild(b);
      if (state.formState === "error") { var e = el("div", "sva-err"); e.textContent = S.failed; f.appendChild(e); }
      return f;
    }

    function push(role, content) {
      messages.push({ role: role, content: content });
      if (messages.length > 40) messages = messages.slice(-40);
      save();
    }
    function scroll() { msgs.scrollTop = msgs.scrollHeight; }
    function grow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 110) + "px"; }

    /* Per tab, not per browser: a conversation should survive a click to the
       next page and not reappear next week as if the visitor never left. */
    function load() {
      try { var raw = sessionStorage.getItem("sva_msgs_" + SLUG); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    }
    function save() {
      try { sessionStorage.setItem("sva_msgs_" + SLUG, JSON.stringify(messages)); } catch (e) { /* storage blocked */ }
    }
    function sessionId() {
      var key = "sva_sid_" + SLUG;
      try {
        var v = localStorage.getItem(key);
        if (!v) {
          v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
          localStorage.setItem(key, v);
        }
        return v;
      } catch (e) { return "s-" + Date.now().toString(36); }
    }
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
})();
