"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, Mail, User, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { isAuthenticated, login, registerAccount } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        if ((await isAuthenticated()) && active) router.replace("/");
      } catch {
        // ignore
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErr("Please enter an email and password.");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) {
        setErr("Please enter a display name.");
        return;
      }
      if (password.length < 6) {
        setErr("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErr("Password confirmation does not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const result = await registerAccount(cleanEmail, password, name);
        if (result.needsEmailConfirmation) {
          setOkMsg("Account created. Check your email to confirm it before signing in.");
        } else {
          router.push("/");
        }
        return;
      }

      const session = await login(cleanEmail, password);
      if (!session) {
        setErr("The email or password is incorrect.");
        return;
      }
      router.push("/");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Could not complete this request."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Zap className="size-5" />
          </div>
          <div className="text-xl" style={{ fontWeight: 600 }}>
            API Docs
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xl p-6">
          <div className="flex gap-1 p-1 rounded-md bg-muted/50 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErr(null);
                setOkMsg(null);
              }}
              className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
                mode === "login" ? "bg-background shadow" : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErr(null);
                setOkMsg(null);
              }}
              className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
                mode === "register" ? "bg-background shadow" : "text-muted-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mb-5">
            <h1 className="text-lg" style={{ fontWeight: 600 }}>
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Sign in to access this feature."
                : "Register a new account for project access."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Display name
                </label>
                <div className="relative">
                  <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
            )}

            {err && (
              <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                {err}
              </div>
            )}
            {okMsg && (
              <div className="px-3 py-2 rounded-md bg-emerald-500/10 text-emerald-500 text-sm flex items-center gap-2">
                <CheckCircle2 className="size-4" /> {okMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-3 py-2.5 rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:opacity-90 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
