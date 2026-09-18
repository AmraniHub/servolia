"use client";

import { useRef, useState } from "react";

/**
 * WHERE THE CLIENT'S WEBSITE ACTUALLY LIVES.
 *
 * The rest of this panel describes the service. This page IS the service: the
 * files being listed are the ones a visitor downloads, and a file replaced
 * here is live on the public site about a minute later. That is the thing
 * hosting is, and until now a client had no way to see it.
 *
 * Replace is offered per file rather than as a general "upload". A client with
 * a new product photo wants THAT photo changed, and picking the file it
 * replaces is both easier to think about and impossible to get half-right.
 * Adding something new is a separate, deliberate action.
 *
 * Nothing here can delete. A client who can delete index.html can take their
 * own shop down on a Friday night, and the person they call is us.
 */

interface Entry {
  name: string;
  /* Already formatted. A function cannot cross the server/client boundary —
     React has nothing to serialise it into — so the server does the
     formatting and this receives the words. */
  size: string;
  kind: "page" | "image" | "style" | "script" | "font" | "folder" | "other";
}

const T = {
  en: {
    intro:
      "These are the files your website is served from. Replace a photo or a document and your site updates by itself in about a minute.",
    replace: "Replace",
    replacing: "Uploading…",
    addTitle: "Add a file",
    addBody: (kinds: string) => `${kinds}, up to 3.5 MB. Pick where it should go.`,
    folderRoot: "Main folder",
    choose: "Choose a file",
    uploading: "Uploading…",
    doneAdd: (p: string) => `Added ${p}. Your site is updating — give it about a minute.`,
    doneReplace: (p: string) => `Replaced ${p}. Your site is updating — give it about a minute.`,
    renamed: (p: string) => `Saved as ${p}, because a file with that name was already there.`,
    dropped: "The connection dropped. Nothing on your site was changed.",
    cannotDelete: "Need something removed? Tell us and we will take it off for you.",
    sizeHead: "Size",
  },
  fr: {
    intro:
      "Voici les fichiers qui composent votre site. Remplacez une photo ou un document et votre site se met à jour tout seul en une minute environ.",
    replace: "Remplacer",
    replacing: "Envoi…",
    addTitle: "Ajouter un fichier",
    addBody: (kinds: string) => `${kinds}, jusqu'à 3,5 Mo. Choisissez où le placer.`,
    folderRoot: "Dossier principal",
    choose: "Choisir un fichier",
    uploading: "Envoi…",
    doneAdd: (p: string) => `${p} ajouté. Votre site se met à jour — comptez une minute.`,
    doneReplace: (p: string) => `${p} remplacé. Votre site se met à jour — comptez une minute.`,
    renamed: (p: string) => `Enregistré sous ${p}, car un fichier portait déjà ce nom.`,
    dropped: "La connexion a été interrompue. Rien n'a été modifié sur votre site.",
    cannotDelete: "Besoin de supprimer quelque chose ? Dites-le nous et nous le retirons.",
    sizeHead: "Taille",
  },
};

function KindMark({ kind }: { kind: Entry["kind"] }) {
  const tone: Record<Entry["kind"], string> = {
    page: "bg-[#EEF5EA] text-[#36671E]",
    image: "bg-[#EAF1FB] text-[#2C5AA0]",
    folder: "bg-[#F4F2EC] text-[#8A8A80]",
    style: "bg-[#F6EEFB] text-[#6B3E9E]",
    script: "bg-[#FEF7E7] text-[#92700E]",
    font: "bg-[#F4F2EC] text-[#71717A]",
    other: "bg-[#F4F4F0] text-[#71717A]",
  };
  const letter: Record<Entry["kind"], string> = {
    page: "H", image: "IMG", folder: "/", style: "CSS", script: "JS", font: "F", other: "·",
  };
  return (
    <span className={`shrink-0 inline-flex items-center justify-center w-9 h-7 rounded-lg text-[10px] font-black ${tone[kind]}`}>
      {letter[kind]}
    </span>
  );
}

export default function FileManager({
  token,
  lang,
  files,
  folders,
  accept,
  acceptedList,
  sample = false,
}: {
  token: string;
  lang: "en" | "fr";
  files: Entry[];
  folders: string[];
  accept: string;
  acceptedList: string;
  sample?: boolean;
}) {
  const t = T[lang];
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  const [folder, setFolder] = useState(folders[0] ?? "");
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function send(file: File, targetFolder: string, replace: boolean, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const body = new FormData();
      body.set("t", token);
      body.set("file", file);
      body.set("folder", targetFolder);
      if (replace) body.set("replace", "1");
      const r = await fetch("/api/client-area?do=upload", { method: "POST", body });
      const d = await r.json();
      if (!d.ok) {
        setMsg({ good: false, text: d.error || t.dropped });
        return;
      }
      setMsg({
        good: true,
        text: (replace ? t.doneReplace(d.path) : t.doneAdd(d.path)) + (d.renamed ? ` ${t.renamed(d.path)}` : ""),
      });
    } catch {
      setMsg({ good: false, text: t.dropped });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden">
      <p className="px-6 pt-6 text-[14px] text-[#52525B] leading-relaxed">{t.intro}</p>

      <ul className="mt-4 divide-y divide-[#F0EFEA]">
        {files.map((f) => {
          const key = f.name;
          const canReplace = f.kind !== "folder" && !sample;
          return (
            <li key={key} className="flex items-center gap-3 px-6 py-3 hover:bg-[#FAFAF7] transition-colors">
              <KindMark kind={f.kind} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14.5px] ${f.kind === "page" ? "font-bold text-[#18181B]" : "text-[#3F3F46]"}`}>
                  {f.name}
                  {f.kind === "folder" ? "/" : ""}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] text-[#8A8A80] tabular-nums w-16 text-right">
                {f.size}
              </span>
              {canReplace ? (
                <>
                  <input
                    ref={(el) => { replaceRefs.current[key] = el; }}
                    type="file" accept={accept} className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void send(file, "", true, key);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => replaceRefs.current[key]?.click()}
                    disabled={busy !== null}
                    className="shrink-0 h-8 px-3 rounded-lg border border-[#E2E6DD] text-[12.5px] font-bold text-[#36671E] hover:bg-[#F7FBF4] disabled:opacity-40 transition-colors"
                  >
                    {busy === key ? t.replacing : t.replace}
                  </button>
                </>
              ) : (
                <span className="shrink-0 w-[72px]" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-6 py-5 border-t border-[#F0EFEA] bg-[#FAFAF7]">
        <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">{t.addTitle}</p>
        <p className="text-[13.5px] text-[#52525B] leading-relaxed mb-3">{t.addBody(acceptedList)}</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={folder} onChange={(e) => setFolder(e.target.value)} disabled={sample}
            className="h-10 px-3 rounded-lg border border-[#E2E6DD] bg-white text-[13.5px] text-[#18181B]"
          >
            {folders.map((f) => (
              <option key={f} value={f}>{f === "" ? t.folderRoot : `${f}/`}</option>
            ))}
          </select>
          <input
            ref={addRef} type="file" accept={accept} className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void send(file, folder, false, "__add");
              e.target.value = "";
            }}
          />
          <button
            onClick={() => addRef.current?.click()}
            disabled={sample || busy !== null}
            className="h-10 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold disabled:opacity-40"
          >
            {busy === "__add" ? t.uploading : t.choose}
          </button>
        </div>
        {msg ? (
          <p className={`mt-3 text-[13.5px] leading-relaxed ${msg.good ? "text-[#36671E]" : "text-[#B45309]"}`}>
            {msg.text}
          </p>
        ) : null}
        <p className="mt-3 text-[12.5px] text-[#8A8A80]">{t.cannotDelete}</p>
      </div>
    </div>
  );
}
