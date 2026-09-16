"""The assistant, end to end in a real browser against the dev server.

What the API says is not what the buyer sees. This drives the pay page with
its film, the self-serve page where a typed domain flows into the demo, the
widget as a client's visitor meets it (RTL Arabic, the fallback form when
the model is down), the CORS refusals, and the 404 that keeps an
assistant-only brief from becoming a fake website.

Run with the dev server up:
  C:/Users/Elamr/AppData/Local/Programs/Python/Python313/python.exe tests/assistant-render.py
"""
import json
import os
import sys
import urllib.request

# The Windows console is cp1252; the assistant speaks Arabic.
sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
OUT = r"C:\Users\Elamr\AppData\Local\Temp\sv-assist"
os.makedirs(OUT, exist_ok=True)
fails = []


def ck(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  -- {detail}" if detail else ""))
    if not ok:
        fails.append(name)


def http(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method, headers=headers or {},
                                 data=json.dumps(body).encode() if body is not None else None)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read()
            return r.status, {k.lower(): v for k, v in r.headers.items()}, (json.loads(raw) if raw[:1] in (b"{", b"[") else raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, {k.lower(): v for k, v in e.headers.items()}, (json.loads(raw) if raw[:1] in (b"{", b"[") else raw)


# ── API first: cheap, and it warms the routes ──────────────────────────────
s, h, j = http("GET", "/api/assistant?site=excellenceagency")
ck("an unpaid assistant answers enabled:false", s == 200 and j.get("enabled") is False, str(j)[:80])
s, h, j = http("GET", "/api/assistant?site=demo-study-abroad")
ck("a demo assistant answers with its public config", s == 200 and j.get("enabled") is True and j.get("name") == "Atlas Study", str(j)[:80])
ck("  in three languages", j.get("languages") == ["ar", "fr", "en"], str(j.get("languages")))
ck("  and leaks nothing private", "hostingEmail" not in j and "email" not in j and "phone" not in j and "faqs" not in j)
ck("  with CORS open", h.get("access-control-allow-origin") == "*")

s, h, _ = http("OPTIONS", "/api/chat", headers={"Origin": "https://excellence-agency.org", "Access-Control-Request-Method": "POST"})
ck("preflight is answered 204 for any origin", s == 204 and h.get("access-control-allow-origin") == "*", f"{s} {h.get('Access-Control-Allow-Origin')}")

msg = {"messages": [{"role": "user", "content": "hello"}], "sessionId": "t-1", "siteSlug": "demo-study-abroad"}
s, h, j = http("POST", "/api/chat", msg, {"Origin": "https://evil.example"})
ck("a foreign site may not use the assistant", s == 403 and "access-control-allow-origin" not in h, f"{s} {j}")
s, h, j = http("POST", "/api/chat", msg, {"Origin": "http://localhost:3000"})
ck("an allowed origin gets a reply with CORS echoed", s == 200 and h.get("access-control-allow-origin") == "http://localhost:3000", f"{s} {h.get('Access-Control-Allow-Origin')}")
ck("  (locally: the no-backend fallback, not an error)", isinstance(j, dict) and j.get("fallback") is True, str(j)[:100])
s, h, j = http("POST", "/api/chat", {**msg, "siteSlug": "excellenceagency"}, {"Origin": "https://excellence-agency.org"})
ck("an unpaid assistant refuses to answer, with CORS so the widget can read the refusal",
   s == 403 and h.get("access-control-allow-origin") == "https://excellence-agency.org", f"{s} {h.get('Access-Control-Allow-Origin')}")
s, h, j = http("POST", "/api/chat", {"messages": [], "siteSlug": "demo-study-abroad"})
ck("an empty conversation is a 400", s == 400)

s, h, j = http("GET", "/sites/excellenceagency")
ck("no website is rendered for an assistant-only brief", s == 404, str(s))

with sync_playwright() as p:
    b = p.chromium.launch()

    # ── 1. The pay page for a known client: the film in the client's colour ─
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(f"{BASE}/hosting?plan=chatbot&ref=excellenceagency", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    ck("pay page: the demo frame is on the page", True)
    ck("pay page: the frame names the client's site", "excellence-agency.org" in pg.locator('[data-testid="demo-site"]').inner_text())
    conv = pg.locator('[data-testid="demo-conversation"]')
    ck("pay page: a study-abroad visitor writes right-to-left", conv.get_attribute("dir") == "rtl")
    pg.wait_for_function('document.querySelectorAll(\'[data-testid="demo-conversation"] > div\').length >= 2', timeout=30000)
    first = conv.locator("> div").first.inner_text()
    ck("pay page: the assistant greets in Arabic", "مرحباً" in first, first[:40])
    pg.wait_for_function('getComputedStyle(document.querySelector(\'[data-testid="demo-toast"]\')).opacity === "1"', timeout=40000)
    toast = pg.locator('[data-testid="demo-toast"]').inner_text()
    ck("pay page: the owner's phone lights up, in the owner's French", "Nouvelle demande" in toast and "Yassine" in toast, toast[:60])
    head_bg = pg.evaluate('getComputedStyle(document.querySelector(\'[data-testid="assistant-demo"] .rounded-2xl > div\')).backgroundColor')
    ck("pay page: the widget wears the client's navy, not the house green", head_bg == "rgb(22, 37, 92)", head_bg)
    ck("pay page: the price card still sells at $120/yr", "$120" in pg.locator("body").inner_text())
    ck("pay page: no console errors", not errs, "; ".join(errs[:2]))
    pg.screenshot(path=os.path.join(OUT, "pay-excellence.png"), full_page=True)
    ctx.close()

    # ── 2. The self-serve page: what they type becomes the demo's site ────
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting?plan=chatbot", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    ck("self-serve: the demo starts on 'your website'", pg.locator('[data-testid="demo-site"]').inner_text().strip() == "your website",
       pg.locator('[data-testid="demo-site"]').inner_text())
    ck("self-serve: the visitor writes left-to-right in English", pg.locator('[data-testid="demo-conversation"]').get_attribute("dir") == "ltr")
    pg.fill('input[placeholder="yourdomain.com"]', "https://clinique-atlas.ma/contact")
    pg.wait_for_timeout(200)
    ck("self-serve: typing a domain puts it on the demo", pg.locator('[data-testid="demo-site"]').inner_text().strip() == "clinique-atlas.ma",
       pg.locator('[data-testid="demo-site"]').inner_text())
    ck("self-serve: pay is disabled until they identify themselves", pg.locator("button:has-text('Enter your website')").count() == 1)
    pg.fill('input[type="email"]', "owner@clinique-atlas.ma")
    ck("self-serve: then the pay button is live", pg.locator("button:has-text('Pay $120')").count() == 1)
    ctx.close()

    # ── 3. The widget, as a visitor meets it (Arabic) ─────────────────────
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    werrs = []
    pg.on("pageerror", lambda e: werrs.append(str(e)))
    pg.goto(f"{BASE}/hosting/assistant/try?site=demo-study-abroad&lang=ar", wait_until="load", timeout=90000)
    pg.wait_for_selector(".sva-launch", timeout=30000)
    ck("widget: the launcher appears for a paid/demo slug", True)
    pg.click(".sva-launch")
    pg.wait_for_selector(".sva-open .sva-panel", timeout=5000)
    ck("widget: Arabic page → panel is RTL", pg.locator(".sva-panel").get_attribute("dir") == "rtl")
    pg.wait_for_selector(".sva-m.sva-ai", timeout=5000)
    greet = pg.locator(".sva-m.sva-ai").first.inner_text()
    ck("widget: greets in Arabic with the business name", "Atlas Study" in greet and "مرحباً" in greet, greet)
    ck("widget: quick replies are in Arabic", "الطب" in pg.locator(".sva-chip").first.inner_text(), pg.locator(".sva-chip").first.inner_text())
    ck("widget: the launcher sits bottom-right per the brief", pg.evaluate("getComputedStyle(document.querySelector('.sva-root')).right") == "22px")
    pg.click(".sva-chip >> nth=0")
    pg.wait_for_selector(".sva-form", timeout=15000)  # locally the model is off → fallback form
    ck("widget: when the model is down, the enquiry is not lost — a two-field form appears", True)
    pg.fill(".sva-form input >> nth=0", "SETUP TEST")
    pg.fill(".sva-form input >> nth=1", "0600000000")
    pg.click(".sva-form button")
    pg.wait_for_selector(".sva-note", timeout=15000)
    ck("widget: the fallback form sends and confirms", "✓" in pg.locator(".sva-note").inner_text())
    ck("widget: no page errors on the host page", not werrs, "; ".join(werrs[:2]))
    pg.screenshot(path=os.path.join(OUT, "widget-ar.png"))
    # Language follows the page: flip <html lang> live.
    pg.evaluate('document.documentElement.setAttribute("lang", "fr")')
    pg.wait_for_timeout(300)
    ck("widget: follows a live language switch on the page", pg.locator(".sva-panel").get_attribute("dir") == "ltr" and "Écrivez" in pg.locator(".sva-input textarea").get_attribute("placeholder"))
    ctx.close()

    # ── 4. The widget draws NOTHING for an unpaid slug ────────────────────
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting/assistant/try?site=excellenceagency", wait_until="load", timeout=90000)
    pg.wait_for_timeout(2500)
    ck("widget: an unpaid assistant renders nothing at all", pg.locator(".sva-root").count() == 0)
    ctx.close()

    # ── 5. Thank-you page: the two truths ─────────────────────────────────
    ctx = b.new_context(viewport={"width": 430, "height": 900})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting/thanks?product=chatbot&lang=fr&hosted=1", wait_until="load", timeout=90000)
    ck("thanks (hosted): says it is being added to the site", "en train d'être ajouté" in pg.locator("body").inner_text())
    pg.goto(f"{BASE}/hosting/thanks?product=chatbot&lang=en&brief=1&session_id=cs_test_x", wait_until="load", timeout=90000)
    ck("thanks (self-serve): says two steps remain, never 'nothing to install'",
       "Two short steps" in pg.locator("body").inner_text() and "Nothing to install" not in pg.locator("body").inner_text())

    # ── 6. Phone width: no sideways scroll on the pay page ────────────────
    pg.goto(f"{BASE}/hosting?plan=chatbot&ref=excellenceagency&lang=fr", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    sw = pg.evaluate("document.documentElement.scrollWidth")
    ck("pay page at 430px: no sideways scroll", sw <= 431, str(sw))
    pg.wait_for_timeout(9000)
    pg.screenshot(path=os.path.join(OUT, "pay-excellence-mobile.png"), full_page=True)
    ctx.close()
    b.close()

print("\nscreenshots:", OUT)
print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
