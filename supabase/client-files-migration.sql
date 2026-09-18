-- ===========================================================================
-- Client file vault  (run once in the Supabase SQL editor)
-- ===========================================================================
-- The portal's only client storage until now was `chat-attachments`: images
-- only, 4MB, inside a message thread, and in a PUBLIC bucket served by
-- unguessable URL. That is acceptable for a screenshot and unacceptable for a
-- contract, so documents get their own PRIVATE bucket (`client-files`) reached
-- only through short-lived signed URLs.
--
-- The stored object is a random UUID under a hashed per-client prefix, so this
-- table is what holds the human facts: the real filename the client uploaded,
-- its size, the type we sniffed from its first bytes, and who put it there.
-- Without this table a client sees a list of UUIDs.
--
-- No RLS policies, deliberately: nothing in this schema uses RLS, because the
-- anon key is never given table access and every read goes through a server
-- route holding the service-role key (see src/lib/supabase.ts). Adding RLS to
-- this one table would imply a protection the other twenty do not have.
-- Access control lives in src/lib/clientFiles.ts, which scopes every query to
-- the email in the portal session cookie and refuses any path outside that
-- client's own prefix.
-- ===========================================================================

create table if not exists client_files (
  id           uuid primary key default gen_random_uuid(),
  email        text        not null,
  path         text        not null unique,
  name         text        not null,
  size         bigint      not null,
  mime         text        not null default 'application/octet-stream',
  uploaded_by  text        not null default 'client',
  created_at   timestamptz not null default now()
);

-- Every query is "this client's files, newest first" — the quota sum included.
create index if not exists client_files_email_created_idx
  on client_files (email, created_at desc);

comment on table  client_files            is 'Portal file vault metadata. Objects live in the private client-files storage bucket.';
comment on column client_files.path       is 'Storage object path: <sha256(email)[0:32]>/<uuid>.<ext>. Never user-controlled.';
comment on column client_files.name       is 'Original filename, sanitised. Shown to the client and used as the download name.';
comment on column client_files.size       is 'Bytes, read back from storage after upload — never the size the browser claimed.';
comment on column client_files.uploaded_by is 'client | servolia — rendered as "from you" / "from Servolia" in the portal.';
