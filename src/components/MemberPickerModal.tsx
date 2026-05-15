"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Loader2, Search, Trash2, UserPlus, X } from "lucide-react";
import { loadUsers, type DirectoryUser } from "@/lib/data/users";

interface Props {
  title?: string;
  ownerId?: string;
  currentMemberIds: string[];
  onClose: () => void;
  onSave: (memberIds: string[]) => void | Promise<void>;
}

export function MemberPickerModal({
  title = "Manage members",
  ownerId,
  currentMemberIds,
  onClose,
  onSave,
}: Props) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMemberIds));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const loadedUsers = await loadUsers();
        if (active) setUsers(loadedUsers);
      } catch (e: unknown) {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load users.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  const ownerUser = ownerId ? users.find((user) => user.id === ownerId) : null;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (user.id === ownerId) return false;
      if (!q) return true;
      return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
    });
  }, [ownerId, search, users]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(selected));
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save members.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4" />
            <h3 className="text-sm" style={{ fontWeight: 600 }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 shrink-0">
          {ownerUser && (
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground mb-1.5">Owner</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                <div
                  className={`size-7 rounded-full bg-gradient-to-br ${ownerUser.avatarColor} text-white flex items-center justify-center text-xs`}
                >
                  {ownerUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{ownerUser.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {ownerUser.email}
                  </div>
                </div>
                <Crown className="size-3 text-amber-400" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted rounded-md px-2.5 py-1.5">
            <Search className="size-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email..."
              className="bg-transparent text-xs flex-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <p className="text-[10px] text-muted-foreground mt-2">
            {selected.size} member{selected.size === 1 ? "" : "s"} selected.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading users
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No users found.
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selected.has(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggle(user.id)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md mb-0.5 transition-colors ${
                    isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted"
                  }`}
                >
                  <div
                    className={`size-8 rounded-full bg-gradient-to-br ${user.avatarColor} text-white flex items-center justify-center text-xs shrink-0`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs truncate">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </div>
                  <div
                    className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {isSelected && <Check className="size-3" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2 px-5 py-3 border-t border-border shrink-0">
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
            >
              <Trash2 className="size-3" /> Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-md border border-border hover:bg-accent text-xs"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-xs flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            Save ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}

interface MemberAvatarsProps {
  ownerId?: string;
  memberIds: string[];
  max?: number;
}

export function MemberAvatars({ ownerId, memberIds, max = 4 }: MemberAvatarsProps) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    let active = true;
    loadUsers()
      .then((loadedUsers) => {
        if (active) setUsers(loadedUsers);
      })
      .catch(() => {
        if (active) setUsers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const ids = [
    ...(ownerId ? [ownerId] : []),
    ...memberIds.filter((id) => id !== ownerId),
  ];
  const visible = ids
    .slice(0, max)
    .map((id) => users.find((user) => user.id === id))
    .filter(Boolean) as DirectoryUser[];
  const extra = ids.length - visible.length;

  if (!ids.length) return null;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user) => (
        <div
          key={user.id}
          title={`${user.name}${user.id === ownerId ? " (owner)" : ""}`}
          className={`size-6 rounded-full bg-gradient-to-br ${user.avatarColor} text-white flex items-center justify-center text-[10px] ring-2 ring-card`}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="size-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] ring-2 ring-card">
          +{extra}
        </div>
      )}
    </div>
  );
}
