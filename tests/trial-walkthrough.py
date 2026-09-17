"""Walk the client's journey in demo mode and prove each page works.

This is the path a client takes from the email: the trial consent page, the
click, the "it is live" state, and the settings page — all with ?demo=1, so
nothing touches a real client's site. Screenshots at each step for him to
look at before deciding to send anything.
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
OUT = r"C:\Users\Elamr\AppData\Local\Temp\sv-assist"
fails = []


def ck(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  -- {detail}" if detail else ""))
    if not ok:
        fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ── 1. The trial consent page, as the email's link lands on it ─────────
    pg = b.new_page(viewport={"width": 900, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{BASE}/hosting/assistant/trial?demo=1", wait_until="load", timeout=90000)
    body = pg.locator("body").inner_text()
    ck("trial page: renders in walk-through mode", "7-day trial" in body, body[:60].replace("\n", " · "))
    ck("  says plainly it starts nothing", "starts nothing" in body.lower())
    ck("  no card is promised", "no card" in body.lower())
    ck("  names the end behaviour", "steps back on its own" in body.lower())
    ck("  the button is there", pg.locator('[data-testid="trial-start"]').count() == 1)
    pg.screenshot(path=os.path.join(OUT, "walk-1-trial-page.png"), full_page=True)

    # ── 2. The click — the moment a real client commits ────────────────────
    pg.click('[data-testid="trial-start"]')
    pg.wait_for_selector('[data-testid="trial-started"]', timeout=15000)
    started = pg.locator('[data-testid="trial-started"]').inner_text()
    ck("after the click: the live-on-your-site confirmation", "live on atlas-etudes.ma" in started.lower(), started[:70].replace("\n", " · "))
    ck("  it carries the end date", any(m in started for m in
        ("January", "February", "March", "April", "May", "June", "July",
         "August", "September", "October", "November", "December")), started[:90].replace("\n", " · "))
    ck("  and it admits nothing was started", "nothing was started" in started.lower())
    pg.screenshot(path=os.path.join(OUT, "walk-2-trial-started.png"), full_page=True)
    ck("no page errors", not errs, "; ".join(errs[:2]))
    pg.close()

    # ── 3. The settings page — "tell it what to say" ───────────────────────
    pg = b.new_page(viewport={"width": 900, "height": 1100})
    pg.goto(f"{BASE}/hosting/assistant?demo=1", wait_until="load", timeout=90000)
    body = pg.locator("body").inner_text()
    ck("settings page: renders in walk-through mode", "What it knows" in body, body[:60].replace("\n", " · "))
    ck("  the instructions field is there", pg.locator("#b-instructions").count() == 1)
    ck("  pre-filled from the brief", len(pg.locator("#b-faqs").input_value()) > 40)
    pg.screenshot(path=os.path.join(OUT, "walk-3-settings.png"), full_page=True)
    pg.close()

    # ── 4. The French client's view of the same consent page ──────────────
    pg = b.new_page(viewport={"width": 900, "height": 900})
    pg.goto(f"{BASE}/hosting/assistant/trial?demo=1&lang=fr", wait_until="load", timeout=90000)
    body = pg.locator("body").inner_text()
    ck("trial page in French (what Excellence would get)", "jours d'essai" in body, body[:60].replace("\n", " · "))
    ck("  and it says it starts nothing", "ne lance rien" in body.lower())
    pg.screenshot(path=os.path.join(OUT, "walk-4-trial-fr.png"), full_page=True)
    pg.close()
    b.close()

print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
