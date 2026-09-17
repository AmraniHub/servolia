"""Prove the phone number reads left-to-right on screen, in Arabic context.

inner_text gives LOGICAL order, so it cannot see this bug at all. The only
honest check is GEOMETRY: measure where the first digit group and the last
digit group actually sit. If "06" is to the LEFT of "78", the number reads
correctly; if it is to the right, bidi reversed the groups.

Measured with a DOM Range over the text node, in both places the number
appears: the chat bubble (plain text, fixed with U+2066/U+2069 isolates)
and the owner's alert (JSX, fixed with <bdi dir="ltr">).
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


# Returns [x_of_first_group, x_of_last_group] for the first element under
# `sel` whose text holds the number. Walks text nodes, builds a Range around
# the two digit groups, and reads their client rects.
MEASURE = """
(sel) => {
  const NUM = '06';
  const LAST = '78';
  for (const el of document.querySelectorAll(sel)) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent;
      const i = t.indexOf(NUM);
      const j = t.lastIndexOf(LAST);
      if (i < 0 || j < 0 || j <= i) continue;
      const r1 = document.createRange();
      r1.setStart(node, i); r1.setEnd(node, i + 2);
      const r2 = document.createRange();
      r2.setStart(node, j); r2.setEnd(node, j + 2);
      const a = r1.getBoundingClientRect(), b = r2.getBoundingClientRect();
      return { first: a.left, last: b.left, text: t.trim().slice(0, 90) };
    }
  }
  return null;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 1000})
    pg.goto(f"{BASE}/hosting?plan=chatbot", wait_until="load", timeout=90000)
    pg.wait_for_selector('[data-testid="assistant-demo"]', timeout=60000)
    pg.click('[data-testid="demo-langs"] button[data-lang="ar"]')
    pg.wait_for_function(
        'document.querySelector("[data-testid=demo-conversation]").getAttribute("dir") === "rtl"',
        timeout=15000)
    pg.wait_for_function(
        'getComputedStyle(document.querySelector("[data-testid=demo-toast]")).opacity === "1"',
        timeout=120000)

    bubble = pg.evaluate(MEASURE, '[data-testid="demo-conversation"] > div')
    ck("the number is found in an Arabic chat bubble", bubble is not None)
    if bubble:
        ck("chat bubble: 06 sits LEFT of 78 — the number reads correctly",
           bubble["first"] < bubble["last"],
           f'06 at x={bubble["first"]:.0f}, 78 at x={bubble["last"]:.0f}')
        print("   bubble text:", bubble["text"])

    toast = pg.evaluate(MEASURE, '[data-testid="demo-toast"] p')
    ck("the number is found in the owner's alert", toast is not None)
    if toast:
        ck("owner's alert: 06 sits LEFT of 78",
           toast["first"] < toast["last"],
           f'06 at x={toast["first"]:.0f}, 78 at x={toast["last"]:.0f}')
        print("   alert text:", toast["text"])

    # The isolate characters must be in the DOM, so a future edit cannot
    # quietly drop the fix and pass on geometry alone by luck.
    has_iso = pg.evaluate(
        'document.querySelector("[data-testid=demo-conversation]").innerText.includes("\\u2066")')
    ck("the chat bubbles carry the LTR isolate", has_iso)
    ck("the alert isolates each field with <bdi>",
       pg.locator('[data-testid="demo-toast"] p bdi').count() == 3,
       str(pg.locator('[data-testid="demo-toast"] p bdi').count()))

    pg.screenshot(path=os.path.join(OUT, "bidi-ar.png"), full_page=True)
    b.close()

print("FAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
