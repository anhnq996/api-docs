"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, User, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { isAuthenticated, login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      if (isAuthenticated()) router.replace("/");
    } catch {
      // ignore
    }
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setErr("Vui lòng nhập username và mật khẩu.");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const session = login(cleanUsername, password);
    setLoading(false);

    if (!session) {
      setErr("Username hoặc mật khẩu không đúng.");
      return;
    }

    router.push("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-6">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Zap className="size-5" />
          </div>
          <div className="text-xl" style={{ fontWeight: 600 }}>
            API Docs
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xl p-6">
          <div className="mb-5">
            <h1 className="text-lg" style={{ fontWeight: 600 }}>
              Đăng nhập
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dùng tài khoản được cấu hình trong môi trường chạy app.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            {err && (
              <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-3 py-2.5 rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:opacity-90 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Đăng nhập
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
