"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import yaml from "js-yaml";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Save,
  Wand2,
  X,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ApiSpec } from "@/lib/data/apiSpec";
import { convertOpenApi } from "@/lib/utils/openapiConverter";

type SourceFormat = "json" | "yaml";
type ValidationState =
  | { status: "ok"; message: null }
  | { status: "error"; message: string };

interface Props {
  initialText: string;
  initialFormat: SourceFormat;
  onClose: () => void;
  onChange: (spec: ApiSpec, text: string, format: SourceFormat) => void | Promise<void>;
}

function parseDoc(text: string, format: SourceFormat) {
  return format === "json" ? JSON.parse(text) : yaml.load(text);
}

function serializeDoc(doc: unknown, format: SourceFormat) {
  return format === "json"
    ? JSON.stringify(doc, null, 2)
    : yaml.dump(doc, { indent: 2, lineWidth: 100, noRefs: true });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

class HighlightBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const EDITOR_FONT = '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace';
const EDITOR_FONT_SIZE = "12.5px";
const EDITOR_LINE_HEIGHT = "1.6";
const EDITOR_PADDING = "12px";
const EDITOR_DEBOUNCE_MS = 250;
const HIGHLIGHT_CHAR_LIMIT = 50000;
const HIGHLIGHT_LINE_LIMIT = 1200;
const LINE_NUMBER_LIMIT = 1200;

const highlighterBase = {
  margin: 0,
  padding: EDITOR_PADDING,
  background: "transparent",
  fontFamily: EDITOR_FONT,
  fontSize: EDITOR_FONT_SIZE,
  lineHeight: EDITOR_LINE_HEIGHT,
  whiteSpace: "pre",
  overflow: "visible",
  minHeight: "100%",
} satisfies CSSProperties;

const codeTagBase = {
  fontFamily: EDITOR_FONT,
  fontSize: EDITOR_FONT_SIZE,
  lineHeight: EDITOR_LINE_HEIGHT,
  whiteSpace: "pre",
  background: "transparent",
} satisfies CSSProperties;

export function SpecEditor({ initialText, initialFormat, onClose, onChange }: Props) {
  const isDark = useIsDark();
  const [format, setFormat] = useState<SourceFormat>(initialFormat);
  const [text, setText] = useState(initialText);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedText, setSavedText] = useState(initialText);
  const [savedFormat, setSavedFormat] = useState<SourceFormat>(initialFormat);
  const [justSaved, setJustSaved] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preWrapRef = useRef<HTMLDivElement>(null);
  const debouncedText = useDebouncedValue(text, EDITOR_DEBOUNCE_MS);
  const debouncedFormat = useDebouncedValue(format, EDITOR_DEBOUNCE_MS);
  const highlightIsStale = debouncedText !== text || debouncedFormat !== format;
  const lineCount = useMemo(() => debouncedText.split("\n").length, [debouncedText]);
  const tooLargeToHighlight =
    debouncedText.length > HIGHLIGHT_CHAR_LIMIT || lineCount > HIGHLIGHT_LINE_LIMIT;

  const validation = useMemo<ValidationState>(() => {
    if (tooLargeToHighlight) return { status: "ok", message: null };
    try {
      const doc = parseDoc(debouncedText, debouncedFormat);
      if (!doc || typeof doc !== "object") throw new Error("Empty document");
      return { status: "ok", message: null };
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Parse error") };
    }
  }, [debouncedText, debouncedFormat, tooLargeToHighlight]);

  const status = highlightIsStale ? "editing" : validation.status;
  const shownError = errorMsg ?? (highlightIsStale || tooLargeToHighlight ? null : validation.message);
  const isDirty = text !== savedText || format !== savedFormat;
  const shouldHighlight = !highlightIsStale && !tooLargeToHighlight;
  const shouldShowLineNumbers = lineCount <= LINE_NUMBER_LIMIT;

  const handleSave = async () => {
    try {
      const doc = parseDoc(text, format);
      if (!doc || typeof doc !== "object") throw new Error("Empty document");
      const spec = convertOpenApi(doc);
      await onChange(spec, text, format);
      setSavedText(text);
      setSavedFormat(format);
      setErrorMsg(null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Could not save"));
    }
  };

  const handleFormatCode = () => {
    try {
      const doc = parseDoc(text, format);
      setText(serializeDoc(doc, format));
      setErrorMsg(null);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Could not format"));
    }
  };

  const handleSwitchFormat = (next: SourceFormat) => {
    if (next === format) return;
    try {
      const doc = parseDoc(text, format);
      setText(serializeDoc(doc, next));
      setFormat(next);
    } catch {
      setFormat(next);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], {
      type: format === "json" ? "application/json" : "text/yaml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openapi.${format === "json" ? "json" : "yaml"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      handleSave();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const insert = "  ";
      const next = text.slice(0, start) + insert + text.slice(end);
      setText(next);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insert.length;
      });
    }
  };

  const syncScroll = () => {
    if (taRef.current && preWrapRef.current) {
      preWrapRef.current.scrollTop = taRef.current.scrollTop;
      preWrapRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const highlightStyle = isDark ? oneDark : oneLight;
  const overlayBg = isDark ? "#0d1117" : "#f6f8fa";
  const caretColor = isDark ? "#e6edf3" : "#1f2328";
  const overlayText = debouncedText.endsWith("\n") ? `${debouncedText} ` : debouncedText;
  const plain = (
    <pre
      style={{
        margin: 0,
        padding: EDITOR_PADDING,
        background: "transparent",
        fontFamily: EDITOR_FONT,
        fontSize: EDITOR_FONT_SIZE,
        lineHeight: EDITOR_LINE_HEIGHT,
        whiteSpace: "pre",
        color: caretColor,
      }}
    >
      {overlayText}
    </pre>
  );

  return (
    <aside
      className="fixed top-0 right-0 z-40 flex h-screen w-full max-w-[560px] flex-col border-l border-border bg-sidebar text-sidebar-foreground shadow-2xl"
      style={{
        boxShadow: isDark ? "-8px 0 32px rgba(0,0,0,0.5)" : "-8px 0 32px rgba(0,0,0,0.12)",
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div style={{ fontWeight: 600 }}>OpenAPI Editor</div>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
              status === "ok"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : status === "editing"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            {tooLargeToHighlight ? (
              <>Performance mode</>
            ) : status === "ok" ? (
              <>
                <CheckCircle2 className="size-3" /> Valid
              </>
            ) : status === "editing" ? (
              <>Editing</>
            ) : (
              <>
                <AlertCircle className="size-3" /> Error
              </>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-sidebar-border px-4 py-2">
        <div className="flex gap-1 rounded-md bg-muted/50 p-0.5">
          <button
            onClick={() => handleSwitchFormat("json")}
            className={`rounded px-2.5 py-1 font-mono text-xs ${
              format === "json" ? "bg-background shadow" : "text-muted-foreground"
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => handleSwitchFormat("yaml")}
            className={`rounded px-2.5 py-1 font-mono text-xs ${
              format === "yaml" ? "bg-background shadow" : "text-muted-foreground"
            }`}
          >
            YAML
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!isDirty && !justSaved}
          className="flex h-7 items-center gap-1 rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 text-xs text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          title="Save and update the UI (Ctrl/Cmd+S)"
        >
          {justSaved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {justSaved ? "Saved" : "Save"}
        </button>
        <button
          onClick={handleFormatCode}
          className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent"
        >
          <Wand2 className="size-3.5" /> Format
        </button>
        <button
          onClick={handleCopy}
          className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleDownload}
          className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent"
          aria-label="Download source"
        >
          <Download className="size-3.5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1" style={{ background: overlayBg }}>
        <div
          className="flex-shrink-0 select-none overflow-hidden border-r border-border text-right font-mono text-xs text-muted-foreground"
          style={{
            padding: `${EDITOR_PADDING} 8px`,
            fontFamily: EDITOR_FONT,
            fontSize: EDITOR_FONT_SIZE,
            lineHeight: EDITOR_LINE_HEIGHT,
            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)",
          }}
          aria-hidden
        >
          {shouldShowLineNumbers ? (
            Array.from({ length: lineCount }, (_, index) => <div key={index}>{index + 1}</div>)
          ) : (
            <div>{lineCount}</div>
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          {shouldHighlight && (
            <div
              ref={preWrapRef}
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
              aria-hidden
            >
              <HighlightBoundary fallback={plain} resetKey={`${debouncedFormat}-${debouncedText.length}`}>
                <SyntaxHighlighter
                  language={debouncedFormat}
                  style={highlightStyle}
                  PreTag="div"
                  customStyle={highlighterBase}
                  codeTagProps={{ style: codeTagBase }}
                >
                  {overlayText}
                </SyntaxHighlighter>
              </HighlightBoundary>
            </div>
          )}

          <textarea
            ref={taRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            wrap="off"
            className="absolute inset-0 z-10 h-full w-full resize-none focus:outline-none"
            style={{
              padding: EDITOR_PADDING,
              fontFamily: EDITOR_FONT,
              fontSize: EDITOR_FONT_SIZE,
              lineHeight: EDITOR_LINE_HEIGHT,
              tabSize: 2,
              whiteSpace: "pre",
              color: shouldHighlight ? "transparent" : caretColor,
              background: "transparent",
              caretColor,
              border: "none",
              WebkitTextFillColor: shouldHighlight ? "transparent" : caretColor,
            }}
          />
        </div>
      </div>

      {shownError && (
        <div className="flex items-start gap-2 border-t border-sidebar-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 flex-shrink-0" />
          <div className="break-all font-mono">{shownError}</div>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {lineCount} lines / {text.length} characters
        </span>
        {isDirty && <span className="text-amber-500">unsaved</span>}
      </div>
    </aside>
  );
}
