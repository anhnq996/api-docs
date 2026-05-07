"use client";

const AUTH_TOKEN_KEY = "api-docs.auth-token.v1";
const AUTH_USER_KEY = "api-docs.auth-user.v1";

export type AuthUser = {
  username: string;
  name: string;
};

export function getConfiguredCredentials() {
  return {
    username: process.env.NEXT_PUBLIC_AUTH_USERNAME ?? "admin",
    password: process.env.NEXT_PUBLIC_AUTH_PASSWORD ?? "admin123",
  };
}

function createToken(username: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return btoa(`${username}:${Date.now()}:${random}`);
}

export function login(username: string, password: string) {
  const credentials = getConfiguredCredentials();
  if (username !== credentials.username || password !== credentials.password) {
    return null;
  }

  const user: AuthUser = { username, name: username };
  const token = createToken(username);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return { token, user };
}

export function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    logout();
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}
