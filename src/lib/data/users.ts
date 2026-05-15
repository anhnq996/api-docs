"use client";

import { toError } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  registeredAt: string;
}

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_color: string | null;
  created_at: string;
};

const COLORS = [
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
  return COLORS[sum % COLORS.length];
}

function fromRow(row: ProfileRow): DirectoryUser {
  const email = row.email ?? "";
  return {
    id: row.id,
    email,
    name: row.name?.trim() || email.split("@")[0] || "User",
    avatarColor: row.avatar_color || colorFromId(row.id),
    registeredAt: row.created_at,
  };
}

export async function loadUsers(): Promise<DirectoryUser[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,avatar_color,created_at")
    .order("name", { ascending: true });

  if (error) throw toError(error, "Could not load users.");
  return ((data ?? []) as ProfileRow[]).map(fromRow);
}
