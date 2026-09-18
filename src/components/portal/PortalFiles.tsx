"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderOpen, Upload, Download, Trash2, FileText, Image as ImageIcon,
  FileArchive, Film, Loader2, AlertCircle, Check,
} from "lucide-react";
import type { Dict } from "@/components/portal/portalDict";

/**
 * The client's own filing cabinet, inside the portal they already log into.
 *
 * WHY THE UPLOAD IS THREE CALLS. sign -> PUT -> confirm. The file goes straight
 * from the browser to private storage, because a serverless request body caps
 * out near 4.5MB and that is the reason chat attachments are stuck at 4MB.
 * Our code only signs the way in and then checks what actually landed.
 *
 * `humanSize` is duplicated from src/lib/clientFiles.ts on purpose: that module
 * pulls in siteEditor and clientRefs for its own job, and importing it here
 * would drag all of that into the browser bundle to format one number.
 */

interface VaultFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploaded_by: "client" | "servolia";
  created_at: string;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function IconFor({ file }: { file: VaultFile }) {
  const cls = "w-4 h-4 text-[var(--p-accent)] shrink-0";
  if (file.mime.startsWith("image/")) return <ImageIcon className={cls} />;
  if (file.mime.startsWith("video/")) return <Film className={cls} />;
  if (file.mime === "application/zip") return <FileArchive className={cls} />;
  return <FileText className={cls} />;
}

/**
 * One PUT straight to storage, with real progress.
 *
 * XHR rather than fetch because fetch cannot report upload progress, and on
 * this connection a silent 25MB upload is indistinguishable from a hang.
 *
 * The body shape is copied from supabase-js: for a Blob in a browser it PUTs
 * multipart form data with `cacheControl` and the file under an EMPTY field
 * name. Raw bytes with a content-type header are also accepted by the storage
 * API, but matching the SDK's own browser path leaves nothing to differ from
 * the documented behaviour. The multipart boundary has to come from the
 * browser, so Content-Type is deliberately not set here.
 */
function putToStorage(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(form);
  });
}

export default function PortalFiles({ t }: { email: string; t: Dict }) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [used, setUsed] = useState(0);
  const [quota, setQuota] = useState(0);
  const [maxFile, setMaxFile] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ name: string; pct: number } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/files");
      if (!res.ok) return;
      const d = await res.json();
      setFiles(d.files ?? []);
      setUsed(d.used ?? 0);
      setQuota(d.quota ?? 0);
      setMaxFile(d.maxFile ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Sequential, not parallel: on a 4G uplink three at once is three slow ones. */
  const upload = useCallback(async (picked: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(picked)) {
      setCurrent({ name: file.name, pct: 0 });
      try {
        const signRes = await fetch("/api/portal/files/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size }),
        });
        const signed = await signRes.json();
        if (!signRes.ok) { setError(signed.error ?? t.fl.uploadErr); break; }

        await putToStorage(signed.uploadUrl, file, (pct) => setCurrent({ name: file.name, pct }));

        const confirmRes = await fetch("/api/portal/files/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: signed.path, name: file.name }),
        });
        const saved = await confirmRes.json();
        if (!confirmRes.ok) { setError(saved.error ?? t.fl.uploadErr); break; }

        setJustAdded(saved.file?.id ?? null);
        setTimeout(() => setJustAdded(null), 2500);
      } catch {
        setError(t.fl.uploadErr);
        break;
      } finally {
        setCurrent(null);
      }
    }
    await load();
  }, [load, t]);

  async function remove(id: string) {
    setConfirmId(null);
    setError(null);
    const res = await fetch(`/api/portal/files/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t.fl.uploadErr);
      return;
    }
    await load();
  }

  const card = "rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6";
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const full = quota > 0 && used >= quota;

  return (
    <div className="space-y-4">
      {/* Drop zone + quota */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[var(--p-accent)]" /> {t.fl.title}
        </h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">{t.fl.subtitle}</p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}
          onClick={() => !current && inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            current ? "cursor-wait" : "cursor-pointer"
          } ${dragging ? "border-[var(--p-accent)] bg-[var(--p-accent)]/5" : "border-[var(--p-border)] hover:border-[var(--p-accent)]"}`}
        >
          {current ? (
            <>
              <Loader2 className="w-5 h-5 mx-auto mb-2 text-[var(--p-accent)] animate-spin" />
              <p className="text-sm font-bold text-[var(--p-text)] truncate">{current.name}</p>
              <div className="h-1.5 rounded-full bg-[var(--p-bg)] mt-3 overflow-hidden">
                <div className="h-full bg-[var(--p-accent)] transition-all" style={{ width: `${current.pct}%` }} />
              </div>
              <p className="text-[11px] text-[var(--p-muted)] mt-1.5">{current.pct}%</p>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mx-auto mb-2 text-[var(--p-muted)]" />
              <p className="text-sm font-bold text-[var(--p-text)]">{t.fl.drop}</p>
              <p className="text-[11px] text-[var(--p-muted)] mt-1">
                {t.fl.maxFile.replace("{n}", String(Math.round(maxFile / 1024 / 1024) || 25))}
              </p>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />

        {/* Quota — stated, never implied as unlimited */}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-bold text-[var(--p-muted)] mb-1.5">
            <span>{t.fl.used.replace("{used}", humanSize(used)).replace("{quota}", humanSize(quota))}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--p-bg)] overflow-hidden">
            <div className={`h-full transition-all ${full ? "bg-red-500" : "bg-[var(--p-accent)]"}`} style={{ width: `${pct}%` }} />
          </div>
          {full && <p className="text-[11px] text-red-500 font-bold mt-1.5">{t.fl.quotaFull}</p>}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-500 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
          </div>
        )}
      </div>

      {/* The list */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-[var(--p-muted)]" /></div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center">
            <FolderOpen className="w-6 h-6 mx-auto mb-2 text-[var(--p-faint)]" />
            <p className="text-sm font-bold text-[var(--p-text)]">{t.fl.empty}</p>
            <p className="text-xs text-[var(--p-muted)] mt-1 max-w-sm mx-auto">{t.fl.emptyBody}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--p-border)] -my-2">
            {files.map((f) => (
              <li key={f.id} className="py-3 flex items-center gap-3">
                <IconFor file={f} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--p-text)] truncate flex items-center gap-2">
                    {f.name}
                    {justAdded === f.id && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  </p>
                  <p className="text-[11px] text-[var(--p-muted)]">
                    {humanSize(f.size)} · {new Date(f.created_at).toLocaleDateString()} ·{" "}
                    {f.uploaded_by === "servolia" ? t.fl.fromUs : t.fl.fromYou}
                  </p>
                </div>
                {confirmId === f.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => remove(f.id)} className="text-[11px] font-black text-red-500 hover:underline">{t.fl.confirmDelete}</button>
                    <button onClick={() => setConfirmId(null)} className="text-[11px] font-bold text-[var(--p-muted)] hover:text-[var(--p-text)]">{t.fl.cancel}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={`/api/portal/files/${f.id}/url`} title={t.fl.download}
                      className="p-2 rounded-lg text-[var(--p-muted)] hover:text-[var(--p-accent)] hover:bg-[var(--p-raised)]">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => setConfirmId(f.id)} title={t.fl.delete}
                      className="p-2 rounded-lg text-[var(--p-muted)] hover:text-red-500 hover:bg-[var(--p-raised)]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-[var(--p-faint)] px-1">{t.fl.footnote}</p>
    </div>
  );
}
