"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

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
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const customDark: { [key: string]: React.CSSProperties } = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    background: "#0d1117",
    margin: 0,
    padding: "1rem 1.25rem",
    fontSize: "0.775rem",
    lineHeight: "1.7",
    fontFamily:
      '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    fontFamily:
      '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
};

const customLight: { [key: string]: React.CSSProperties } = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...(oneLight['pre[class*="language-"]'] as React.CSSProperties),
    background: "#f6f8fa",
    margin: 0,
    padding: "1rem 1.25rem",
    fontSize: "0.775rem",
    lineHeight: "1.7",
    fontFamily:
      '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
  'code[class*="language-"]': {
    ...(oneLight['code[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    fontFamily:
      '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
};

const langMap: Record<string, string> = {
  bash: "bash",
  shell: "bash",
  curl: "bash",
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  php: "php",
  go: "go",
  java: "java",
  python: "python",
  json: "json",
  yaml: "yaml",
  xml: "xml",
  html: "markup",
  css: "css",
};

export function CodeBlock({
  code,
  language = "json",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const isDark = useIsDark();

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const prismLang = langMap[language.toLowerCase()] ?? "text";

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all"
      style={{
        border: isDark ? "1px solid #30363d" : "1px solid #d0d7de",
        boxShadow: isDark
          ? "0 4px 24px rgba(0,0,0,0.5)"
          : "0 2px 12px rgba(0,0,0,0.07)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 select-none"
        style={{
          background: isDark ? "#161b22" : "#eaeef2",
          borderBottom: isDark ? "1px solid #30363d" : "1px solid #d0d7de",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          <span
            className="ml-3 text-xs font-mono uppercase tracking-widest"
            style={{ color: isDark ? "#8b949e" : "#57606a" }}
          >
            {language}
          </span>
        </div>

        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-all duration-150"
          style={{
            color: copied ? "#3fb950" : isDark ? "#8b949e" : "#57606a",
            background: copied
              ? isDark
                ? "rgba(63,185,80,0.12)"
                : "#dcfce7"
              : "transparent",
          }}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              <span>Đã copy!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={prismLang}
          style={isDark ? customDark : customLight}
          showLineNumbers={false}
          wrapLines={false}
          customStyle={{ margin: 0, borderRadius: 0 }}
          codeTagProps={{
            style: {
              fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
