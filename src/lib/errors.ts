type ErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function knownMessage(message: string, code = "") {
  if (/signups not allowed/i.test(message)) {
    return "Signups are disabled in Supabase Auth. Enable email signups in the Supabase dashboard or create the user from Authentication > Users.";
  }

  if (code === "PGRST205" && /public\.profiles|profiles/i.test(message)) {
    return "Supabase table public.profiles is missing. Run my-next-app/supabase/schema.sql in the Supabase SQL Editor.";
  }

  return "";
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return knownMessage(error.message) || error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return knownMessage(error) || error.trim();
  }

  if (isRecord(error)) {
    const value = error as ErrorLike;
    const message = textValue(value.message);
    const details = textValue(value.details);
    const hint = textValue(value.hint);
    const code = textValue(value.code);

    const mapped = knownMessage(message, code);
    if (mapped) return mapped;

    const parts = [message, details, hint].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  return fallback;
}

export function toError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(getErrorMessage(error, fallback));
}
