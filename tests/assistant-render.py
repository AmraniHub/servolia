"""The assistant, end to end in a real browser against the dev server.

What the API says is not what the buyer sees. This drives the pay page's
demo, the widget as a client's visitor meets it (RTL Arabic, the fallback
form when the model is down), the CORS refusals, and the 404 that keeps an
assistant-only brief from becoming a fake website.

THE DEMO'S CONTRACT, asserted here because it is a judgement the buyer makes
in two seconds and cannot be un-made:
  - it says EXEMPLE and names an obviously-other business, so an invented
    lead with an invented phone number can never read as the buyer's own
    traffic (it used to show the client's real domain above exactly that);
  - it opens in the language the BUYER reads, not the visitor's;
  - the language tabs replay the same conversation, which is the multilingual
    promise demonstrated rather than claimed;
  - the owner's phone alert stays in the owner's language on every tab.

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
ck("preflight is answered 204 for any origin", s == 204 and h.get("access-control-allow-origin") == "*", str(s))

msg = {"messages": [{"role": "user", "content": "hello"}], "sessionId": "t-1", "siteSlug": "demo-study-abroad"}
s, h, j = http("POST", "/api/chat", msg, {"Origin": "https://evil.example"})
ck("a foreign site may not use the assistant", s == 403 and "access-control-allow-origin" not in h, f"{s} {j}")
s, h, j = http("POST", "/api/chat", msg, {"Origin": "http://localhost:3000"})
ck("an allowed origin gets a reply with CORS echoed", s == 200 and h.get("access-control-allow-origin") == "http://localhost:3000", str(s))
ck("  (locally: the no-backend fallback, not an error)", isinstance(j, dict) and j.get("fallback") is True, str(j)[:100])
s, h, j = http("POST", "/api/chat", {**msg, "siteSlug": "excellenceagency"}, {"Origin": "https://excellence-agency.org"})
ck("an unpaid assistant refuses to answer, with CORS so the widget can read the refusal",
   s == 403 and h.get("access-control-allow-origin") == "https://excellence-agency.org", str(s))
s, h, j = http("POST", "/api/chat", {"messages": [], "siteSlug": "demo-study-abroad"})
ck("an empty conversation is a 400", s == 400)

s, h, j = http("GET", "/sites/excellenceagency")
ck("no website is rendered for an assistant-only brief", s == 404, str(s))


def first_bubble(pg):
    return pg.locator('[data-testid="demo-conversation"] > div').first.inner_text()


def wait_bubbles(pg, n=2, timeout=40000):
    pg.wait_for_function(
        'n => document.querySelectorAll(\'[data-testid="demo-conversation"] > div\').length >= n',
        arg=n, timeout=timeout)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ── 1. The pay page for a known French client ─────────────────────────
    ctx = b.new_context(viewport={"width": 1280, "height": 1000}, device_scale_factor=1)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(f"{BASE}/hosting?plan=chatbot&ref=excellenceagency", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)

    # IT IS AN EXAMPLE AND IT SAYS SO.
    badge = pg.locator('[data-testid="demo-badge"]').inner_text().strip().lower()
    ck("pay page: the frame carries an EXEMPLE badge, in the owner's language", badge == "exemple", badge)
    site = pg.locator('[data-testid="demo-site"]').inner_text().strip()
    ck("pay page: the frame names another business, never the client's own",
       site == "atlas-etudes.ma" and "excellence" not in site.lower(), site)
    page_text = pg.locator("body").inner_text()
    ck("pay page: the client's own domain never appears beside the invented lead",
       "excellence-agency.org" not in pg.locator('[data-testid="assistant-demo"]').inner_text())
    ck("pay page: a footnote says the real one carries their name and colours",
       "votre entreprise" in pg.locator('[data-testid="demo-footnote"]').inner_text().lower(),
       pg.locator('[data-testid="demo-footnote"]').inner_text()[:70])

    # IT OPENS IN THE LANGUAGE THE BUYER READS.
    conv = pg.locator('[data-testid="demo-conversation"]')
    ck("pay page: three language tabs, matching the brief", pg.locator('[data-testid="demo-langs"] button').count() == 3,
       str(pg.locator('[data-testid="demo-langs"] button').count()))
    ck("pay page: it opens on Français for a French client",
       pg.locator('[data-testid="demo-langs"] button[aria-selected="true"]').get_attribute("data-lang") == "fr",
       str(pg.locator('[data-testid="demo-langs"] button[aria-selected="true"]').get_attribute("data-lang")))
    ck("pay page: so the conversation reads left-to-right", conv.get_attribute("dir") == "ltr")
    wait_bubbles(pg)
    fr_first = first_bubble(pg)
    ck("pay page: and the first thing he reads is French", "Bienvenue" in fr_first, fr_first[:44])

    # The alert is HIS phone, so it is in HIS language on every tab.
    pg.wait_for_function('getComputedStyle(document.querySelector(\'[data-testid="demo-toast"]\')).opacity === "1"', timeout=60000)
    toast_fr = pg.locator('[data-testid="demo-toast"]').inner_text()
    ck("pay page: his phone lights up in French, with an example number",
       "Nouvelle demande" in toast_fr and "06 12 34 56 78" in toast_fr, toast_fr.replace("\n", " · ")[:80])
    ck("pay page: the caption is French too", "visiteur" in pg.locator('[data-testid="demo-caption"]').inner_text().lower())
    pg.screenshot(path=os.path.join(OUT, "pay-fr.png"), full_page=True)

    # THE TABS REPLAY THE SAME CONVERSATION — the multilingual promise.
    pg.click('[data-testid="demo-langs"] button[data-lang="ar"]')
    pg.wait_for_function('document.querySelector(\'[data-testid="demo-conversation"]\').getAttribute("dir") === "rtl"', timeout=10000)
    ck("pay page: tapping العربية flips the conversation right-to-left", True)
    wait_bubbles(pg)
    ar_first = first_bubble(pg)
    ck("pay page: and the same conversation happens in Arabic", "مرحباً" in ar_first, ar_first[:40])
    pg.wait_for_function('getComputedStyle(document.querySelector(\'[data-testid="demo-toast"]\')).opacity === "1"', timeout=60000)
    ck("pay page: his alert is STILL French on the Arabic tab",
       "Nouvelle demande" in pg.locator('[data-testid="demo-toast"]').inner_text())
    pg.screenshot(path=os.path.join(OUT, "pay-ar.png"), full_page=True)

    head_bg = pg.evaluate('getComputedStyle(document.querySelector(\'[data-testid="assistant-demo"] .rounded-2xl > div\')).backgroundColor')
    ck("pay page: the widget wears the client's navy, not the house green", head_bg == "rgb(22, 37, 92)", head_bg)
    ck("pay page: the price card still sells at $120/yr", "$120" in page_text)
    ck("pay page: no console errors", not errs, "; ".join(errs[:2]))
    ctx.close()

    # ── 2. A stranger: English, generic example, still obviously an example ─
    ctx = b.new_context(viewport={"width": 1280, "height": 1000})
    pg = ctx.new_page()
    serrs = []
    pg.on("pageerror", lambda e: serrs.append(str(e)))
    pg.goto(f"{BASE}/hosting?plan=chatbot", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    ck("stranger: the badge reads Example", pg.locator('[data-testid="demo-badge"]').inner_text().strip().lower() == "example")
    ck("stranger: a generic example business, not a study-abroad one",
       pg.locator('[data-testid="demo-site"]').inner_text().strip() == "atelier-renov.ma",
       pg.locator('[data-testid="demo-site"]').inner_text())
    ck("stranger: it opens on English", pg.locator('[data-testid="demo-langs"] button[aria-selected="true"]').get_attribute("data-lang") == "en")
    wait_bubbles(pg)
    ck("stranger: and greets in English", "Welcome" in first_bubble(pg), first_bubble(pg)[:40])
    # The typed-domain link into the frame was REMOVED: the buyer's own domain
    # must never sit above an invented lead. Typing must not change the frame.
    pg.fill('input[placeholder="yourdomain.com"]', "clinique-atlas.ma")
    pg.wait_for_timeout(400)
    ck("stranger: typing their domain does NOT put it on the example frame",
       pg.locator('[data-testid="demo-site"]').inner_text().strip() == "atelier-renov.ma",
       pg.locator('[data-testid="demo-site"]').inner_text())
    ck("stranger: pay is disabled until they identify themselves", pg.locator("button:has-text('Enter your website')").count() == 1)
    pg.fill('input[type="email"]', "owner@clinique-atlas.ma")
    ck("stranger: then the pay button is live", pg.locator("button:has-text('Pay $120')").count() == 1)
    # The English visitor is a Western customer on a UK mobile — the Ofcom
    # drama range, the legitimate "example number".
    pg.wait_for_function('getComputedStyle(document.querySelector("[data-testid=demo-toast]")).opacity === "1"', timeout=60000)
    toast_en = pg.locator('[data-testid="demo-toast"]').inner_text()
    ck("stranger: the English lead is James on a UK number", "James" in toast_en and "07700 900123" in toast_en,
       " · ".join(toast_en.split())[:80])
    ck("stranger: the pay card promises the settings page", "Your own settings page" in pg.locator("body").inner_text())
    ck("stranger: and that it is built for their site", "Built for your site" in pg.locator("body").inner_text())
    ck("stranger: no console errors", not serrs, "; ".join(serrs[:2]))
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
    pg.evaluate('document.documentElement.setAttribute("lang", "fr")')
    pg.wait_for_timeout(300)
    ck("widget: follows a live language switch on the page",
       pg.locator(".sva-panel").get_attribute("dir") == "ltr" and "Écrivez" in pg.locator(".sva-input textarea").get_attribute("placeholder"))
    ctx.close()

    # ── 4. Unpaid stays dark everywhere that is not ours; ours is the showroom ─
    # The old assertion here — "the try page renders nothing for an unpaid
    # slug" — was the behaviour the showroom exists to replace. What still
    # must hold: a preview is refused from a foreign page, and refused when
    # not asked for, so the client's own website sees the same dark widget
    # it always did.
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1", headers={"Origin": "https://evil.example"})
    ck("preview: refused from a foreign origin", s == 200 and j.get("enabled") is False, str(j)[:60])
    ck("  and the REFUSAL is no-store too — a cached refusal poisoned the showroom's URL on the first deploy",
       "no-store" in h.get("cache-control", ""), h.get("cache-control"))
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1", headers={"Referer": "https://excellence-agency.org/"})
    ck("preview: refused from the client's OWN site (unpaid there means unpaid)", s == 200 and j.get("enabled") is False, str(j)[:60])
    s, h, j = http("GET", "/api/assistant?site=excellenceagency", headers={"Referer": f"{BASE}/hosting/assistant/try"})
    ck("preview: not granted unless asked for, even from our page", s == 200 and j.get("enabled") is False, str(j)[:60])
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1", headers={"Referer": f"{BASE}/hosting/assistant/try"})
    ck("preview: GRANTED from our own page when asked for", s == 200 and j.get("enabled") is True and j.get("preview") is True, str(j)[:80])
    ck("  and it is the client's real brief", j.get("name") == "Excellence Agency" and j.get("accent") == "#16255c", f"{j.get('name')} {j.get('accent')}")
    ck("  never cached — a CDN must not hand it to the client's visitors", "no-store" in h.get("cache-control", ""), h.get("cache-control"))
    s, h, j = http("GET", "/api/assistant?site=demo-study-abroad&preview=1", headers={"Referer": f"{BASE}/x"})
    ck("preview: a demo is simply enabled, never flagged preview", j.get("enabled") is True and j.get("preview") is None)
    # What a REAL browser sends from our own page: no Origin (same-origin GET),
    # no Referer (the site's Referrer-Policy strips it), only Sec-Fetch-Site.
    # The first production deploy refused exactly this request.
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1", headers={"Sec-Fetch-Site": "same-origin"})
    ck("preview: GRANTED on Sec-Fetch-Site same-origin alone (the browser's own word)", j.get("enabled") is True and j.get("preview") is True, str(j)[:60])
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1", headers={"Sec-Fetch-Site": "cross-site"})
    ck("preview: refused on cross-site with nothing else", j.get("enabled") is False, str(j)[:60])
    s, h, j = http("GET", "/api/assistant?site=excellenceagency&preview=1")
    ck("preview: refused with no headers at all", j.get("enabled") is False, str(j)[:60])

    msg = {"messages": [{"role": "user", "content": "hello"}], "sessionId": "t-preview", "siteSlug": "excellenceagency", "preview": True}
    s, h, j = http("POST", "/api/chat", msg, {"Origin": "https://evil.example"})
    ck("preview chat: a foreign page is still 403", s == 403, str(s))
    s, h, j = http("POST", "/api/chat", {**msg, "preview": False}, {"Origin": BASE})
    ck("preview chat: our page WITHOUT the flag is still 403 (unpaid)", s == 403, str(s))
    s, h, j = http("POST", "/api/chat", msg, {"Origin": BASE})
    ck("preview chat: our page with the flag answers", s == 200, f"{s} {str(j)[:60]}")
    ck("  (locally: the no-backend fallback, not an error)", isinstance(j, dict) and j.get("fallback") is True, str(j)[:80])

    # ── 5. Thank-you page: the two truths ─────────────────────────────────
    ctx = b.new_context(viewport={"width": 430, "height": 900})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting/thanks?product=chatbot&lang=fr&hosted=1", wait_until="load", timeout=90000)
    ck("thanks (hosted): says it is being added to the site", "en train d'être ajouté" in pg.locator("body").inner_text())
    pg.goto(f"{BASE}/hosting/thanks?product=chatbot&lang=en&brief=1&session_id=cs_test_x", wait_until="load", timeout=90000)
    ck("thanks (self-serve): says two steps remain, never 'nothing to install'",
       "Two short steps" in pg.locator("body").inner_text() and "Nothing to install" not in pg.locator("body").inner_text())
    ctx.close()

    # ── 7. /assistant: Servolia's own page — any domain, their brand ──────
    ctx = b.new_context(viewport={"width": 1280, "height": 1100})
    pg = ctx.new_page()
    aerrs = []
    pg.on("pageerror", lambda e: aerrs.append(str(e)))
    pg.goto(f"{BASE}/assistant?lang=fr", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    ck("/assistant: opens on the fictitious example", pg.locator('[data-testid="demo-site"]').inner_text().strip() == "atelier-renov.ma")
    ck("/assistant: with the Exemple badge", pg.locator('[data-testid="demo-badge"]').inner_text().strip().lower() == "exemple")

    # An impossible domain is refused politely, not probed.
    pg.fill("#try-domain", "nodots")
    pg.click("button:has-text('Voir')")
    pg.wait_for_function('document.querySelector("[data-testid=try-note]").textContent.includes("domaine")', timeout=15000)
    ck("/assistant: a non-domain gets the gentle error", True)

    # His real client's domain, probed over the network. The probe may fail
    # on this 4G link — that is the designed fallback, and the name must
    # still be theirs either way.
    pg.fill("#try-domain", "excellence-agency.org")
    pg.click("button:has-text('Voir')")
    pg.wait_for_selector('[data-testid="try-showing"]', timeout=90000)
    ck("/assistant: the page says whose example it now is",
       "excellence-agency.org" in pg.locator('[data-testid="try-showing"]').inner_text())
    ck("/assistant: the frame carries their domain", pg.locator('[data-testid="demo-site"]').inner_text().strip() == "excellence-agency.org")
    widget_name = pg.locator('[data-testid="assistant-demo"] .rounded-2xl p').first.inner_text()
    ck("/assistant: the widget is headed with their business name", widget_name == "Excellence Agency", widget_name)
    # Waiting on child count catches the typing indicator; wait for the words.
    pg.wait_for_function('document.querySelector("[data-testid=demo-conversation]").innerText.includes("Excellence Agency")', timeout=40000)
    ck("/assistant: the assistant greets AS their business", True)
    fell_back = "injoignable" in pg.locator('[data-testid="try-note"]').inner_text()
    if not fell_back:
        head_bg = pg.evaluate('getComputedStyle(document.querySelector("[data-testid=assistant-demo] .rounded-2xl > div")).backgroundColor')
        ck("/assistant: probed live — it wears their navy", head_bg == "rgb(22, 37, 92)", head_bg)
        ck("/assistant: and offers their three languages", pg.locator('[data-testid="demo-langs"] button').count() == 3)
    else:
        print("NOTE  probe fell back (site unreachable from here) — brand colour not asserted")
    ck("/assistant: the badge never leaves", pg.locator('[data-testid="demo-badge"]').inner_text().strip().lower() == "exemple")
    ck("/assistant: the footnote names their domain",
       "excellence-agency.org" in pg.locator('[data-testid="demo-footnote"]').inner_text())
    cta = pg.locator('[data-testid="try-cta"]').get_attribute("href") or ""
    ck("/assistant: the CTA carries the domain into the pay page",
       "plan=chatbot" in cta and "site=excellence-agency.org" in cta, cta)
    ck("/assistant: no console errors", not aerrs, "; ".join(aerrs[:2]))
    pg.screenshot(path=os.path.join(OUT, "assistant-page.png"), full_page=True)
    ctx.close()

    # ── 8. The pay page follows: ?site= dresses the demo AND the checkout ─
    ctx = b.new_context(viewport={"width": 1280, "height": 1000})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting?plan=chatbot&site=excellence-agency.org&lang=fr", wait_until="load", timeout=120000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    ck("pay?site=: the frame carries the typed domain", pg.locator('[data-testid="demo-site"]').inner_text().strip() == "excellence-agency.org")
    ck("pay?site=: the widget is headed with their name",
       pg.locator('[data-testid="assistant-demo"] .rounded-2xl p').first.inner_text() == "Excellence Agency")
    ck("pay?site=: the checkout site field is already filled",
       pg.locator('input[placeholder="votredomaine.com"]').input_value() == "excellence-agency.org",
       pg.locator('input[placeholder="votredomaine.com"]').input_value())
    ck("pay?site=: still badged as an example", pg.locator('[data-testid="demo-badge"]').inner_text().strip().lower() == "exemple")
    ctx.close()

    # ── 9. Phone width: no sideways scroll, tabs still reachable ──────────
    ctx = b.new_context(viewport={"width": 430, "height": 900})
    pg = ctx.new_page()
    pg.goto(f"{BASE}/hosting?plan=chatbot&ref=excellenceagency&lang=fr", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    sw = pg.evaluate("document.documentElement.scrollWidth")
    ck("pay page at 430px: no sideways scroll", sw <= 431, str(sw))
    ck("pay page at 430px: the language tabs are still on screen",
       pg.locator('[data-testid="demo-langs"]').bounding_box()["width"] <= 430)
    pg.wait_for_timeout(9000)
    pg.screenshot(path=os.path.join(OUT, "pay-mobile.png"), full_page=True)
    ctx.close()

    # ── 10. THE SHOWROOM: the client's real assistant, live, before paying ─
    # Samira's, in English: the eyebrow says who built it, the widget boots
    # in preview, the launcher opens on HER greeting in HER navy, and the
    # page says plainly that nothing is saved. Then the pay page's door.
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    werrs = []
    pg.on("pageerror", lambda e: werrs.append(str(e)))
    pg.goto(f"{BASE}/hosting/assistant/try?site=goodscochina", wait_until="load", timeout=90000)
    ck("showroom: the eyebrow says Servolia built it", "built by servolia" in pg.locator('[data-testid="try-eyebrow"]').inner_text().lower(),
       pg.locator('[data-testid="try-eyebrow"]').inner_text())
    ck("showroom: the lede calls it hers — the real one", "your assistant" in pg.locator('[data-testid="try-lede"]').inner_text().lower())
    ck("showroom: says nothing is saved and nobody alerted", "nothing is saved" in pg.locator('[data-testid="try-preview-note"]').inner_text().lower())
    ck("showroom: the door to the price is her pay page",
       pg.locator('[data-testid="try-activate"]').get_attribute("href") == "/hosting?plan=chatbot&ref=goodscochina",
       str(pg.locator('[data-testid="try-activate"]').get_attribute("href")))
    pg.wait_for_selector(".sva-root", timeout=20000)
    ck("showroom: the REAL widget boots for an unpaid client", pg.locator(".sva-root").count() == 1)
    pg.click(".sva-launch")
    pg.wait_for_selector(".sva-m", timeout=10000)
    greet = pg.locator(".sva-m").first.inner_text()
    ck("showroom: it greets as GoodsCoChina, from her brief", "goodscochina" in greet.lower(), greet[:70])
    head_bg = pg.evaluate("getComputedStyle(document.querySelector('.sva-head')).backgroundColor")
    ck("showroom: in her navy", head_bg == "rgb(17, 28, 116)", head_bg)
    ck("showroom: no page errors", not werrs, "; ".join(werrs[:2]))

    # The same slug on a foreign page: nothing. The showroom did not open the
    # client's site — this is the same script tag, told by the server no.
    s, h, j = http("GET", "/api/assistant?site=goodscochina", headers={"Origin": "https://goodscochina.com"})
    ck("showroom: on her own site the widget is still told enabled:false", j.get("enabled") is False)

    # The pay page for a known client carries the door to the showroom;
    # a stranger's does not (there is nothing built to show them).
    pg.goto(f"{BASE}/hosting?plan=chatbot&ref=excellenceagency", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="already-built"]', timeout=30000)
    card = pg.locator('[data-testid="already-built"]')
    ck("pay page (client): 'already built for you' card, in French", "déjà construit" in card.inner_text().lower(), card.inner_text()[:60])
    ck("  linking to their showroom", card.get_attribute("href") == "/hosting/assistant/try?site=excellenceagency&lang=fr", str(card.get_attribute("href")))
    pg.goto(f"{BASE}/hosting?plan=chatbot", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=30000)
    ck("pay page (stranger): no such card — nothing built to show", pg.locator('[data-testid="already-built"]').count() == 0)
    ctx.close()
    b.close()

print("\nscreenshots:", OUT)
print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
