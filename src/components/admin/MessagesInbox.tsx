"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Loader2, PenSquare, ArrowLeft, Search, Trash2, ArchiveRestore, Bell, BellOff, Image as ImageIcon, X } from "lucide-react";

/**
 * Unified client-messages inbox. Left: every conversation with unread badges.
 * Right: the thread, where you reply or start a new message to any client.
 * Deleting a chat only hides it from your own view — nothing is ever hard-deleted,
 * so the Trash panel can restore it for you, the client, or both.
 */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

interface Thread { email: string; lastBody: string; lastAt: string; lastSender: string; unread: number }
interface Contact { email: string; business: string | null }
interface Message {
  id: string; sender: "client" | "admin"; body: string; created_at: string;
  deleted_by_admin_at?: string | null; deleted_by_client_at?: string | null;
  attachment_url?: string | null; attachment_type?: string | null;
}
interface TrashThread { email: string; deletedByAdmin: number; deletedByClient: number; lastDeletedAt: string }

export default function MessagesInbox() {
  const [view, setView] = useState<"inbox" | "trash">("inbox");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [trashThreads, setTrashThreads] = useState<TrashThread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notify, setNotify] = useState(true);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email-notify preference persists across messages so you don't have to re-toggle it every send.
  useEffect(() => {
    const saved = localStorage.getItem("servolia_admin_email_notify");
    if (saved === "0") setNotify(false);
  }, []);
  function toggleNotify() {
    setNotify((v) => {
      const next = !v;
      localStorage.setItem("servolia_admin_email_notify", next ? "1" : "0");
      return next;
    });
  }

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/messages");
    if (res.ok) {
      const d = await res.json();
      setThreads(d.threads ?? []);
      setContacts(d.contacts ?? []);
    }
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const loadTrash = useCallback(async () => {
    const res = await fetch("/api/admin/messages/trash");
    if (res.ok) setTrashThreads((await res.json()).threads ?? []);
  }, []);
  useEffect(() => { loadTrash(); }, [loadTrash]);

  const fetchThread = useCallback(async (email: string, includeDeleted = false): Promise<Message[]> => {
    const res = await fetch(`/api/admin/client-messages?email=${encodeURIComponent(email)}${includeDeleted ? "&includeDeleted=1" : ""}`);
    if (!res.ok) return [];
    return (await res.json()).messages ?? [];
  }, []);

  const openThread = useCallback(async (email: string) => {
    setActive(email); setComposing(false); setLoadingThread(true); setMessages([]);
    try {
      setMessages(await fetchThread(email));
      setThreads((prev) => prev.map((t) => (t.email === email ? { ...t, unread: 0 } : t)));
    } finally { setLoadingThread(false); }
  }, [fetchThread]);

  const openTrashThread = useCallback(async (email: string) => {
    setActive(email); setComposing(false); setLoadingThread(true); setMessages([]);
    try { setMessages(await fetchThread(email, true)); } finally { setLoadingThread(false); }
  }, [fetchThread]);

  // Live updates: poll the open thread for new messages, and the list for unread.
  useEffect(() => {
    if (!active || view !== "inbox") return;
    const id = setInterval(async () => {
      const fresh = await fetchThread(active);
      setMessages((prev) => {
        if (fresh.length <= prev.length) return prev;
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const m of fresh) if (!seen.has(m.id)) merged.push(m);
        return merged;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [active, view, fetchThread]);

  useEffect(() => {
    const id = setInterval(loadThreads, 12000);
    return () => clearInterval(id);
  }, [loadThreads]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function pickImage(file: File) {
    setImageError("");
    if (!ACCEPTED_IMAGE_TYPES.split(",").includes(file.type)) { setImageError("Only JPEG, PNG, WEBP, or GIF images."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageError("Image must be under 4MB."); return; }
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  }
  function clearPendingImage() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null); setPendingPreview(null); setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    const text = input.trim();
    const email = active;
    if ((!text && !pendingImage) || !email || sending) return;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;
      if (pendingImage) {
        const form = new FormData();
        form.append("file", pendingImage);
        const up = await fetch("/api/admin/client-messages/upload", { method: "POST", body: form });
        const upData = await up.json();
        if (!up.ok) { setImageError(upData.error ?? "Upload failed"); setSending(false); return; }
        attachmentUrl = upData.url; attachmentType = upData.type;
      }
      setInput(""); clearPendingImage();
      const res = await fetch("/api/admin/client-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, body: text, attachmentUrl, attachmentType, notify }),
      });
      const d = await res.json();
      if (d.message) {
        setMessages((prev) => [...prev, d.message]);
        loadThreads();
      }
    } finally { setSending(false); }
  }

  async function deleteActiveChat() {
    if (!active || deleting) return;
    if (!confirm(`Delete this conversation with ${active}? It'll disappear from your inbox — you can restore it from Trash any time.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/client-messages?email=${encodeURIComponent(active)}`, { method: "DELETE" });
      setActive(null); setMessages([]);
      loadThreads(); loadTrash();
    } finally { setDeleting(false); }
  }

  async function restore(email: string, target: "admin" | "client" | "both") {
    if (restoring) return;
    setRestoring(true);
    try {
      await fetch("/api/admin/messages/restore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, target }),
      });
      await Promise.all([loadThreads(), loadTrash()]);
      if (active === email) setMessages(await fetchThread(email, true));
    } finally { setRestoring(false); }
  }

  function startNew(email: string) {
    if (!email.trim()) return;
    setComposing(false);
    setNewEmail("");
    openThread(email.trim().toLowerCase());
  }

  function switchView(v: "inbox" | "trash") {
    setView(v); setActive(null); setMessages([]); setComposing(false);
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);
  const activeTrash = trashThreads.find((t) => t.email === active);

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#18181B] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#36671E]" /> Messages
            {totalUnread > 0 && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-[#36671E] text-white">{totalUnread}</span>}
          </h1>
          <p className="text-sm text-[#71717A]">Every client conversation in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#E8E6E0] p-0.5 bg-[#FAFAF7]">
            <button onClick={() => switchView("inbox")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${view === "inbox" ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A]"}`}>
              Inbox
            </button>
            <button onClick={() => switchView("trash")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${view === "trash" ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A]"}`}>
              <Trash2 className="w-3 h-3" /> Trash {trashThreads.length > 0 && `(${trashThreads.length})`}
            </button>
          </div>
          {view === "inbox" && (
            <button onClick={() => { setComposing(true); setActive(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115]">
              <PenSquare className="w-4 h-4" /> New message
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4 bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden" style={{ minHeight: "540px" }}>
        {/* Thread list */}
        <div className={`border-r border-[#E8E6E0] ${active || composing ? "hidden md:block" : ""}`}>
          {view === "inbox" ? (
            threads.length === 0 ? (
              <p className="text-sm text-[#A1A1AA] text-center p-8">No conversations yet.</p>
            ) : (
              <div className="divide-y divide-[#F5F4EF] max-h-[540px] overflow-y-auto">
                {threads.map((t) => (
                  <button key={t.email} onClick={() => openThread(t.email)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF7] transition-colors ${active === t.email ? "bg-[#EEF5EA]" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#18181B] truncate">{t.email}</span>
                      {t.unread > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#36671E] text-white flex-shrink-0">{t.unread}</span>}
                    </div>
                    <p className="text-xs text-[#71717A] truncate mt-0.5">{t.lastSender === "admin" ? "You: " : ""}{t.lastBody}</p>
                  </button>
                ))}
              </div>
            )
          ) : trashThreads.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] text-center p-8">Nothing deleted.</p>
          ) : (
            <div className="divide-y divide-[#F5F4EF] max-h-[540px] overflow-y-auto">
              {trashThreads.map((t) => (
                <button key={t.email} onClick={() => openTrashThread(t.email)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF7] transition-colors ${active === t.email ? "bg-[#EEF5EA]" : ""}`}>
                  <span className="text-sm font-bold text-[#18181B] truncate block">{t.email}</span>
                  <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
                    {t.deletedByAdmin > 0 && `Deleted by you (${t.deletedByAdmin})`}
                    {t.deletedByAdmin > 0 && t.deletedByClient > 0 && " · "}
                    {t.deletedByClient > 0 && `Deleted by client (${t.deletedByClient})`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right pane */}
        <div className="flex flex-col" style={{ height: "540px" }}>
          {composing ? (
            <ComposeNew contacts={contacts} onPick={startNew} value={newEmail} setValue={setNewEmail} />
          ) : !active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#A1A1AA]">
              {view === "inbox" ? "Select a conversation, or start a new one." : "Select a deleted conversation to preview or restore it."}
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#E8E6E0] bg-[#FAFAF7] flex items-center gap-2">
                <button onClick={() => setActive(null)} className="md:hidden text-[#52525B]"><ArrowLeft className="w-4 h-4" /></button>
                <span className="text-sm font-black text-[#18181B] truncate flex-1">{active}</span>
                {view === "inbox" ? (
                  <button onClick={deleteActiveChat} disabled={deleting} title="Delete conversation"
                    className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-red-600 transition-colors disabled:opacity-40 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {activeTrash && activeTrash.deletedByAdmin > 0 && (
                      <button onClick={() => restore(active, "admin")} disabled={restoring}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#EEF5EA] text-[#36671E] hover:bg-[#DCFCE7] disabled:opacity-40">
                        <ArchiveRestore className="w-3 h-3" /> Restore for me
                      </button>
                    )}
                    {activeTrash && activeTrash.deletedByClient > 0 && (
                      <button onClick={() => restore(active, "client")} disabled={restoring}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#DBEAFE] text-[#1D4ED8] hover:bg-[#BFDBFE] disabled:opacity-40">
                        <ArchiveRestore className="w-3 h-3" /> Restore for client
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {loadingThread ? (
                  <p className="text-sm text-[#A1A1AA] text-center mt-6">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[#A1A1AA] text-center mt-6">No messages yet — say hello 👋</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                        m.sender === "admin" ? "bg-[#36671E] text-[#FAFAF7] rounded-br-sm" : "bg-[#F5F4EF] text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                      } ${view === "trash" ? "opacity-70" : ""}`}>
                        {m.attachment_url && (
                          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5 -mx-1 -mt-0.5">
                            <img src={m.attachment_url} alt="Attachment" className="rounded-lg max-h-56 max-w-full object-contain" />
                          </a>
                        )}
                        {m.body}
                        <div className={`text-[10px] mt-1 flex items-center gap-1.5 ${m.sender === "admin" ? "text-[#FAFAF7]/60" : "text-[#A1A1AA]"}`}>
                          {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {view === "trash" && m.deleted_by_admin_at && <span className="italic">· deleted by you</span>}
                          {view === "trash" && m.deleted_by_client_at && <span className="italic">· deleted by client</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              {view === "inbox" && (
                <div className="border-t border-[#E8E6E0]">
                  {imageError && <p className="text-xs text-red-600 px-2.5 pt-2">{imageError}</p>}
                  {pendingPreview && (
                    <div className="px-2.5 pt-2 flex items-center gap-2">
                      <div className="relative">
                        <img src={pendingPreview} alt="" className="h-14 w-14 object-cover rounded-lg border border-[#E8E6E0]" />
                        <button onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#18181B] text-white flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs text-[#A1A1AA]">Image ready — add a caption or just hit send.</span>
                    </div>
                  )}
                  <div className="p-2.5 flex items-center gap-2">
                    <button onClick={toggleNotify} title={notify ? "Email notification: ON — client gets an email for this message" : "Email notification: OFF — saves Resend credits, no email sent"}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors ${notify ? "bg-[#EEF5EA] border-[#36671E]/30 text-[#36671E]" : "bg-[#FAFAF7] border-[#E8E6E0] text-[#A1A1AA]"}`}>
                      {notify ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Attach an image"
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-[#E8E6E0] text-[#71717A] hover:bg-[#FAFAF7]">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                    <input value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Type a message to your client…"
                      className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-lg px-3.5 py-2 border border-[#E8E6E0] focus:outline-none focus:border-[#36671E]" />
                    <button onClick={send} disabled={(!input.trim() && !pendingImage) || sending}
                      className="w-9 h-9 rounded-lg bg-[#36671E] flex items-center justify-center disabled:opacity-40 hover:bg-[#295115] flex-shrink-0">
                      {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-[#A1A1AA] mt-3">Clients always get a portal notification. The bell toggle controls whether they also get an email — turn it off for quick back-and-forth to save Resend credits.</p>
    </div>
  );
}

function ComposeNew({ contacts, onPick, value, setValue }: {
  contacts: Contact[]; onPick: (email: string) => void; value: string; setValue: (v: string) => void;
}) {
  const filtered = value
    ? contacts.filter((c) => c.email.toLowerCase().includes(value.toLowerCase()) || (c.business ?? "").toLowerCase().includes(value.toLowerCase()))
    : contacts;
  return (
    <div className="p-5 flex flex-col h-full">
      <p className="text-sm font-black text-[#18181B] mb-3">New message to a client</p>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search a client, or type an email…"
          className="w-full pl-9 pr-3 py-2.5 bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl text-sm focus:outline-none focus:border-[#36671E]" />
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-[#F5F4EF] border border-[#E8E6E0] rounded-xl">
        {filtered.length === 0 && /@/.test(value) ? (
          <button onClick={() => onPick(value)} className="w-full text-left px-4 py-3 hover:bg-[#FAFAF7] text-sm font-bold text-[#36671E]">
            Start conversation with {value}
          </button>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center p-6">No matching clients.</p>
        ) : (
          filtered.map((c) => (
            <button key={c.email} onClick={() => onPick(c.email)} className="w-full text-left px-4 py-3 hover:bg-[#FAFAF7]">
              <p className="text-sm font-bold text-[#18181B]">{c.business ?? c.email}</p>
              {c.business && <p className="text-xs text-[#A1A1AA]">{c.email}</p>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
