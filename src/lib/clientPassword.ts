import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Optional password login for the client portal. Magic-link stays the default;
 * a client can set a password (once logged in) and then log in with it.
 * Passwords are bcrypt-hashed — plaintext is never stored.
 */

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Get the stored hash for an email, or null. */
export async function getHash(email: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("client_auth")
    .select("password_hash")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return (data as { password_hash?: string } | null)?.password_hash ?? null;
}

export async function hasPassword(email: string): Promise<boolean> {
  return (await getHash(email)) !== null;
}

/** Verify a plaintext password against the stored hash. */
export async function verifyPassword(email: string, plain: string): Promise<boolean> {
  const hash = await getHash(email);
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Set or replace the password for an email. */
export async function setPassword(email: string, plain: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  const password_hash = await hashPassword(plain);
  const { error } = await db
    .from("client_auth")
    .upsert({ email: email.toLowerCase().trim(), password_hash }, { onConflict: "email" });
  return !error;
}

/** Basic password strength gate. */
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 200) return "Password is too long";
  return null;
}
