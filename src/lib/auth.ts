"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

function toAuthUser(user: User): AuthUser {
  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    name:
      typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
        ? user.user_metadata.name
        : email.split("@")[0] || "Admin",
  };
}

async function ensureAdmin(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function login(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) return null;

  const isAdmin = await ensureAdmin(data.user.id);
  if (!isAdmin) {
    await supabase.auth.signOut();
    throw new Error("This account is not allowed to access API Docs.");
  }

  return { token: data.session.access_token, user: toAuthUser(data.user) };
}

export async function logout() {
  await getSupabaseClient().auth.signOut();
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const isAdmin = await ensureAdmin(data.user.id);
  if (!isAdmin) {
    await supabase.auth.signOut();
    return null;
  }

  return toAuthUser(data.user);
}

export async function isAuthenticated() {
  return Boolean(await getAuthUser());
}
