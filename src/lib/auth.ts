"use client";

import type { User } from "@supabase/supabase-js";
import { getErrorMessage, toError } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabase/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
};

const AVATAR_COLORS = [
  "from-indigo-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-lime-500 to-emerald-500",
];

function colorFromId(id: string) {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function fallbackName(email: string) {
  return email.split("@")[0] || "User";
}

function metadataName(user: User) {
  return typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
    ? user.user_metadata.name.trim()
    : "";
}

function toAuthUser(user: User, profile?: ProfileRow | null): AuthUser {
  const email = user.email ?? "";
  return {
    id: user.id,
    email: profile?.email ?? email,
    name: profile?.name?.trim() || metadataName(user) || fallbackName(email),
  };
}

async function syncProfile(user: User, nameOverride?: string) {
  const supabase = getSupabaseClient();
  const email = user.email ?? "";
  const name = nameOverride?.trim() || metadataName(user) || fallbackName(email);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        name,
        avatar_color: colorFromId(user.id),
      },
      { onConflict: "id" }
    )
    .select("id,email,name")
    .maybeSingle();

  if (error) {
    console.warn(getErrorMessage(error, "Could not sync your profile."));
    return null;
  }
  return data as ProfileRow | null;
}

export async function login(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) return null;

  const profile = await syncProfile(data.user);
  return { token: data.session.access_token, user: toAuthUser(data.user, profile) };
}

export async function registerAccount(email: string, password: string, name: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: name.trim() },
    },
  });

  if (error) throw toError(error, "Could not create the account.");
  if (!data.user) throw new Error("Could not create the account.");

  const profile = data.session ? await syncProfile(data.user, name) : null;
  return {
    user: toAuthUser(data.user, profile),
    needsEmailConfirmation: !data.session,
  };
}

export async function logout() {
  await getSupabaseClient().auth.signOut();
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const profile = await syncProfile(data.user);
  return toAuthUser(data.user, profile);
}

export async function isAuthenticated() {
  return Boolean(await getAuthUser());
}
