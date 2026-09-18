import { NextRequest, NextResponse } from "next/server";
import { editableSite, fieldsFor, pagesWithFields, validate } from "@/lib/siteEditor";
import { readCurrent, readSiteFile, saveEdits } from "@/lib/siteEditorRepo";
import { untranslatedAfterEdit, translationNote } from "@/lib/siteEditorI18n";
import {
  passwordMatches, createEditorSession, editorSession,
  editorConfigured, EDITOR_COOKIE, EDITOR_SESSION_SECONDS,
} from "@/lib/siteEditorAuth";

export const runtime = "nodejs";

/**
 * The page editor's API. Reached by the client at THEIR OWN domain — their
 * host rewrites /admin to this — so every request the browser makes is
 * same-origin with their site, the session cookie is theirs, and they never
 * see servolia.com. That is not cosmetic: they asked for control of their
 * pages, not an account on someone else's website.
 *
 *   POST ?do=login   { ref, password }   → sets the session cookie
 *   POST ?do=logout                      → clears it
 *   GET  ?file=…                         → the current text of that page
 *   POST ?do=save    { file, values }    → one commit, then their host rebuilds
 *
 * The site being edited comes from the SESSION, never from the request body.
 * A logged-in client cannot reach another client's pages by changing a field
 * in the form.
 */

/* One failed password a second is plenty for a human and useless for a script.
   In memory, so it resets on a cold start — a soft brake, not a vault. */
const RATE = new Map<string, { n: number; at: number }>();
function tooManyTries(ip: string): boolean {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now - e.at > 60_000) { RATE.set(ip, { n: 1, at: now }); return false; }
  e.n += 1;
  return e.n > 8;
}

export async function POST(req: NextRequest) {
  const doing = req.nextUrl.searchParams.get("do");
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  if (doing === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(EDITOR_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (doing === "login") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
    if (tooManyTries(ip)) {
      return NextResponse.json({ ok: false, error: "Too many attempts — wait a minute." }, { status: 429 });
    }
    const ref = String(body.ref ?? "").trim().toLowerCase();
    const site = editableSite(ref);
    /* The same answer whether the site is unknown, has no password set, or the
       password is wrong. Anything else tells a stranger which businesses have
       an editor. */
    if (!site || !editorConfigured(ref) || !passwordMatches(ref, String(body.password ?? ""))) {
      return NextResponse.json({ ok: false, error: "That password is not right." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, businessName: site.businessName });
    res.cookies.set(EDITOR_COOKIE, await createEditorSession(ref), {
      httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: EDITOR_SESSION_SECONDS,
    });
    return res;
  }

  if (doing === "save") {
    const ref = await editorSession();
    const site = ref ? editableSite(ref) : undefined;
    if (!site) return NextResponse.json({ ok: false, error: "signed-out" }, { status: 401 });

    const file = String(body.file ?? "");
    if (!pagesWithFields(site).some((p) => p.file === file)) {
      return NextResponse.json({ ok: false, error: "unknown-page" }, { status: 400 });
    }
    const fields = fieldsFor(site, file);
    const values = (body.values ?? {}) as Record<string, string>;

    /* Validate EVERY field before writing ANY of them, so a page is never
       half-saved because the last box was too long. */
    const problems: Record<string, string> = {};
    for (const f of fields) {
      if (!(f.key in values)) continue;
      const bad = validate(f, values[f.key]);
      if (bad) problems[f.key] = bad;
    }
    if (Object.keys(problems).length) {
      return NextResponse.json({ ok: false, error: "invalid", problems }, { status: 400 });
    }

    const out = await saveEdits(site, fields, values, site.businessName);
    if (!out.ok) {
      console.error("[site-editor] save failed:", out.reason, out.detail);
      return NextResponse.json(
        { ok: false, error: "Your changes could not be saved just now. Nothing was altered — please try again." },
        { status: 502 },
      );
    }
    /* Her site's other language is swapped in by matching English strings, so
       a line she has just reworded is a line that language can no longer
       render. Checked after the save, never before it: this is something to
       tell her about work that succeeded, not a reason to refuse it. A
       dictionary we cannot read costs the note, not the save. */
    let note: string | null = null;
    if (out.changed.length && site.translations) {
      const dict = await readSiteFile(site, site.translations.file);
      if (dict) {
        const saved = out.changed.map((k) => values[k]).filter(Boolean);
        note = translationNote(untranslatedAfterEdit(dict, saved).length, site.translations.language);
      }
    }

    return NextResponse.json({
      ok: true,
      changed: out.changed.length,
      nothingToDo: out.changed.length === 0,
      skipped: out.skipped,
      note,
    });
  }

  return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const ref = await editorSession();
  const site = ref ? editableSite(ref) : undefined;
  if (!site) return NextResponse.json({ ok: false, error: "signed-out" }, { status: 401 });

  const offered = pagesWithFields(site);
  const file = req.nextUrl.searchParams.get("file") || offered[0]?.file || site.pages[0].file;
  if (!offered.some((p) => p.file === file)) {
    return NextResponse.json({ ok: false, error: "unknown-page" }, { status: 400 });
  }
  const fields = fieldsFor(site, file);
  try {
    const current = await readCurrent(site, fields);
    return NextResponse.json({
      ok: true,
      businessName: site.businessName,
      pages: offered,
      file,
      fields: fields.map((f) => ({
        key: f.key, label: f.label, multiline: Boolean(f.multiline), max: f.max ?? 2000,
        value: current.find((c) => c.key === f.key)?.value ?? "",
        /* A field whose marker is missing or misplaced is shown as
           unavailable rather than as an empty box — an empty box invites a
           client to type into something that will never save. */
        problem: current.find((c) => c.key === f.key)?.problem ?? null,
      })),
    });
  } catch (err) {
    console.error("[site-editor] read failed:", err);
    return NextResponse.json({ ok: false, error: "Could not open your pages just now." }, { status: 502 });
  }
}
