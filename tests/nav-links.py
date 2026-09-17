"""The /assistant link is reachable from Servolia's own front doors.

Menu (EN + FR), homepage demo sections, and both footers — and adding the
menu item must not wrap the desktop nav or push the CTA off screen at the
widths people actually use.

Run with the dev server up:
  C:/Users/Elamr/AppData/Local/Programs/Python/Python313/python.exe tests/nav-links.py
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
fails = []


def ck(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  -- {detail}" if detail else ""))
    if not ok:
        fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch()

    # The inline menu shows from xl (1280); below that the burger takes over —
    # eight links plus the CTA cluster cannot fit at 1024, and never truly
    # fit at 768 even before the assistant joined them.
    for width in (1440, 1280):
        pg = b.new_page(viewport={"width": width, "height": 900})
        pg.goto(f"{BASE}/", wait_until="load", timeout=90000)
        pg.wait_for_selector("nav", timeout=30000)
        vis = pg.locator('nav a[href="/assistant"]:visible').count()
        ck(f"EN nav at {width}px carries AI Assistant", vis >= 1, str(vis))
        # One row only: the links' container is the menu row; a wrap doubles it.
        row_h = pg.eval_on_selector('nav a[href="/assistant"]',
                                    "e => e.parentElement.getBoundingClientRect().height")
        ck(f"  menu stays one line at {width}px", 0 < row_h < 30, f"{row_h:.0f}px")
        cta_right = pg.eval_on_selector('nav a[href="/free-audit"]',
                                        "e => e.getBoundingClientRect().right")
        ck(f"  CTA still inside the viewport at {width}px", 0 < cta_right <= width, f"right={cta_right:.0f}")
        pg.close()

    # Below xl: the burger, with the assistant inside its panel.
    for width in (1024, 768):
        pg = b.new_page(viewport={"width": width, "height": 900})
        pg.goto(f"{BASE}/", wait_until="load", timeout=90000)
        pg.wait_for_selector("nav", timeout=30000)
        ck(f"{width}px: the inline menu yields to the burger", pg.locator('nav a[href="/assistant"]:visible').count() == 0)
        pg.click('nav button[aria-label="Toggle menu"]')
        pg.wait_for_selector('nav a[href="/assistant"]:visible', timeout=5000)
        ck(f"{width}px: the burger panel carries AI Assistant", True)
        pg.close()

    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto(f"{BASE}/", wait_until="load", timeout=90000)
    pg.wait_for_selector("#ai-demo", timeout=30000)
    home = pg.locator('#ai-demo a[href="/assistant"]')
    ck("EN homepage: the demo section links to /assistant", home.count() == 1)
    ck("  with the type-your-domain line",
       "Type your domain" in (home.first.inner_text() if home.count() else ""))
    ck("EN footer links to /assistant", pg.locator('footer a[href="/assistant"]').count() >= 1)

    pg.goto(f"{BASE}/fr", wait_until="load", timeout=90000)
    pg.wait_for_selector("#demo-ia", timeout=30000)
    ck("FR nav carries Assistant IA", pg.locator('nav a[href="/assistant?lang=fr"]:visible').count() >= 1)
    fr_home = pg.locator('#demo-ia a[href="/assistant?lang=fr"]')
    ck("FR homepage: the demo section links to /assistant?lang=fr", fr_home.count() == 1)
    ck("  in French", "Tapez votre domaine" in (fr_home.first.inner_text() if fr_home.count() else ""))
    ck("FR footer links to it too", pg.locator('footer a[href="/assistant?lang=fr"]').count() >= 1)
    ck("the niche links in the hero survived as <Link>", pg.locator('a[href="/fr/dentistes"]').count() >= 1)

    # The destination still answers when reached the way the menu reaches it.
    pg.goto(f"{BASE}/assistant?lang=fr", wait_until="load", timeout=90000)
    ck("the /assistant page renders at the end of the menu path", pg.locator("#try-domain").count() == 1)
    b.close()

print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
