"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * What the client sees: a password box, then their own words in plain boxes.
 *
 * Written for somebody who is not technical and is slightly nervous about
 * breaking their own website. So: no jargon, no HTML, no "commit", no
 * "deploy". It says what happened and what will happen next, in those words.
 *
 * The two things that decide whether this feels safe to use:
 *  - the button says what it will do, and the message afterwards says what it
 *    DID, including "nothing to save" when they pressed it without typing;
 *  - it tells them the site takes about a minute, because a client who sees
 *    no change on their site after 5 seconds presses Save again, and again.
 */

const API = "/api/site-editor";

interface Field {
  key: string;
  label: string;
  multiline: boolean;
  max: number;
  value: string;
  problem: string | null;
}
interface Page { file: string; label: string }

/**
 * The client's own three colours, as CSS variables everything here follows.
 *
 * Handed in per client rather than taken from Servolia's stylesheet: this
 * component is served at several clients' own domains, and each should see
 * their colours, not ours. Servolia green on a screen at goodscochina.com/admin
 * announces whose software it really is, on the one page that should feel like
 * hers. The values are lifted from the client's own :root, so the editor is
 * built out of the same tokens their website is.
 */
export interface Theme { accent: string; surface: string; line: string }

function accentVars(t: Theme): React.CSSProperties {
  return { "--ed-accent": t.accent, "--ed-surface": t.surface, "--ed-line": t.line } as React.CSSProperties;
}

export default function SiteEditor({ siteRef, theme }: { siteRef: string; theme: Theme }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [business, setBusiness] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [file, setFile] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});

  const load = useCallback(async (which?: string) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}${which ? `?file=${encodeURIComponent(which)}` : ""}`);
      if (r.status === 401) { setSignedIn(false); return; }
      const d = await r.json();
      if (!d.ok) { setMsg({ good: false, text: d.error || "Could not open your pages." }); return; }
      setSignedIn(true);
      setBusiness(d.businessName);
      setPages(d.pages);
      setFile(d.file);
      setFields(d.fields);
      setEdited({});
      setProblems({});
    } catch {
      setMsg({ good: false, text: "The connection dropped. Try again." });
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, []);

  /* The first load yields before it touches state. load() sets `busy` on its
     very first line, and calling it straight from an effect body is a
     synchronous setState during render — react-hooks/set-state-in-effect, and
     the same trap this codebase hit in AssistantDemo. Awaiting once moves
     every update out of the effect body. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (alive) load();
    })();
    return () => { alive = false; };
  }, [load]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${API}?do=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The site is taken from the address this page is served at.
        body: JSON.stringify({ ref: siteRef, password }),
      });
      const d = await r.json();
      if (!d.ok) { setMsg({ good: false, text: d.error || "That did not work." }); return; }
      setPassword("");
      await load();
    } catch {
      setMsg({ good: false, text: "The connection dropped. Try again." });
    } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setMsg(null); setProblems({});
    try {
      const r = await fetch(`${API}?do=save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, values: edited }),
      });
      const d = await r.json();
      if (r.status === 401) { setSignedIn(false); return; }
      if (!d.ok) {
        if (d.problems) { setProblems(d.problems); setMsg({ good: false, text: "Please fix the notes below." }); }
        else setMsg({ good: false, text: d.error || "That did not save." });
        return;
      }
      if (d.nothingToDo) { setMsg({ good: true, text: "Nothing had changed, so nothing was saved." }); return; }
      setMsg({
        good: true,
        text: `Saved ${d.changed} change${d.changed === 1 ? "" : "s"}. Your website is updating now — give it about a minute, then refresh your site to see it.`
          // Her site is bilingual and the other language follows the English
          // wording, so a reworded line stops being translated. Said here
          // rather than in a footnote: it is a consequence of what she just
          // did, and she is the only person who can decide it matters.
          + (d.note ? ` ${d.note}` : ""),
      });
      await load(file);
    } catch {
      setMsg({ good: false, text: "The connection dropped — nothing was changed." });
    } finally { setBusy(false); }
  }

  const dirty = Object.keys(edited).length > 0;

  if (!ready) return <div className="max-w-2xl mx-auto px-5 py-16 text-[#71717A]">Loading…</div>;

  if (!signedIn) {
    return (
      <div className="max-w-sm mx-auto px-5 py-20" style={accentVars(theme)}>
        <h1 className="text-2xl font-black text-[var(--ed-accent)] mb-1">Edit your website</h1>
        <p className="text-[14px] text-[#52525B] mb-6">Enter the password you were given.</p>
        <form onSubmit={signIn}>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" autoComplete="current-password" autoFocus
            className="w-full h-11 px-3 rounded-lg border border-[var(--ed-line)] bg-white text-[15px] mb-3"
          />
          <button type="submit" disabled={busy || !password}
            style={{ background: "var(--ed-accent)" }}
            className="w-full h-11 rounded-lg text-white font-bold disabled:opacity-50">
            {busy ? "Checking…" : "Open my website"}
          </button>
        </form>
        {msg ? <p className={`mt-3 text-[13.5px] ${msg.good ? "text-[var(--ed-accent)]" : "text-[#B45309]"}`}>{msg.text}</p> : null}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-12" style={accentVars(theme)}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-2xl font-black text-[var(--ed-accent)]">{business}</h1>
        <button
          onClick={async () => { await fetch(`${API}?do=logout`, { method: "POST" }); setSignedIn(false); }}
          className="text-[13px] text-[#71717A] hover:underline">Sign out</button>
      </div>
      <p className="text-[14px] text-[#52525B] mb-6">
        Change the words on your website. Your layout and design stay exactly as they are.
      </p>

      {pages.length > 1 ? (
        <div className="flex flex-wrap gap-2 mb-7">
          {pages.map((p) => (
            <button key={p.file} onClick={() => load(p.file)} disabled={busy}
              className={`h-9 px-4 rounded-lg text-[13.5px] font-bold border ${
                p.file === file ? "text-white" : "bg-white text-[#3F3F46] border-[var(--ed-line)]"
              }`}
              style={p.file === file ? { background: "var(--ed-accent)", borderColor: "var(--ed-accent)" } : undefined}>{p.label}</button>
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        {fields.map((f) => {
          const value = f.key in edited ? edited[f.key] : f.value;
          const bad = problems[f.key];
          if (f.problem) {
            return (
              <div key={f.key} className="rounded-xl border border-[#F0DFA8] bg-[#FEF9EC] p-4">
                <p className="text-[13px] font-bold text-[#6B5309]">{f.label}</p>
                <p className="text-[13px] text-[#6B5309] mt-1">
                  This one cannot be edited yet — tell us and we will sort it.
                </p>
              </div>
            );
          }
          return (
            <div key={f.key}>
              <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor={f.key}>{f.label}</label>
              {f.multiline ? (
                <textarea id={f.key} rows={3} value={value} maxLength={f.max}
                  onChange={(e) => setEdited({ ...edited, [f.key]: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border bg-white text-[15px] leading-relaxed ${bad ? "border-[#B45309]" : "border-[var(--ed-line)]"}`} />
              ) : (
                <input id={f.key} type="text" value={value} maxLength={f.max}
                  onChange={(e) => setEdited({ ...edited, [f.key]: e.target.value })}
                  className={`w-full h-11 px-3 rounded-lg border bg-white text-[15px] ${bad ? "border-[#B45309]" : "border-[var(--ed-line)]"}`} />
              )}
              {bad ? <p className="mt-1 text-[12.5px] text-[#B45309]">{bad}</p> : null}
            </div>
          );
        })}
      </div>

      {/* Sticky, because the list is longer than a phone screen and a Save
          button she has to scroll back up for is a Save button she misses. */}
      {/* Opaque, not translucent. A 95% bar over a page of the same colour buys
          nothing but a faint ghost of the fields sliding under it, and
          color-mix() computes to a color(srgb …) value that is awkward to
          assert against. */}
      <div className="sticky bottom-0 mt-8 -mx-5 px-5 py-4 border-t border-black/[0.08]"
        style={{ background: "var(--ed-surface)" }}>
        <button onClick={save} disabled={busy || !dirty}
          style={{ background: "var(--ed-accent)" }}
          className="w-full h-12 rounded-xl text-white font-bold disabled:opacity-40">
          {busy ? "Saving…" : dirty ? "Save changes to my website" : "No changes yet"}
        </button>
        {msg ? <p className={`mt-3 text-[13.5px] ${msg.good ? "text-[var(--ed-accent)]" : "text-[#B45309]"}`}>{msg.text}</p> : null}
      </div>
    </div>
  );
}
