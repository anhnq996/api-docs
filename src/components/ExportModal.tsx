"use client";

import { useState } from "react";
import {
  Check,
  Download,
  FileCode2,
  FileJson2,
  FileText,
  FileType2,
  Loader2,
  X,
} from "lucide-react";
import type { ApiSpec } from "@/lib/data/apiSpec";
import {
  exportHTML,
  exportPDF,
  exportSwagger,
  exportWord,
} from "@/lib/utils/exportUtils";

interface ExportOption {
  id: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  accent: string;
  bg: string;
  border: string;
  fn: () => void | Promise<void>;
}

export function ExportModal({
  onClose,
  spec,
  projectName,
  baseUrl,
  theme,
}: {
  onClose: () => void;
  spec: ApiSpec;
  projectName: string;
  baseUrl: string;
  theme: "light" | "dark";
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const options: ExportOption[] = [
    {
      id: "html",
      icon: <FileCode2 className="size-7" />,
      label: "HTML",
      desc: "A complete static page with sidebar navigation and syntax highlighting. Runs directly in the browser.",
      accent: "text-sky-400",
      bg: "bg-sky-500/10 dark:bg-sky-500/10 group-hover:bg-sky-500/20",
      border: "border-sky-500/30 group-hover:border-sky-400/60",
      fn: () => exportHTML(spec, projectName, { baseUrl, theme }),
    },
    {
      id: "pdf",
      icon: <FileText className="size-7" />,
      label: "PDF",
      desc: "Opens the browser print dialog. Each API group is rendered as a section.",
      accent: "text-rose-400",
      bg: "bg-rose-500/10 group-hover:bg-rose-500/20",
      border: "border-rose-500/30 group-hover:border-rose-400/60",
      fn: () => exportPDF(spec, projectName, { baseUrl, theme }),
    },
    {
      id: "swagger",
      icon: <FileJson2 className="size-7" />,
      label: "Swagger / OpenAPI 3.0",
      desc: "A standard OpenAPI 3.0.3 JSON file for Swagger UI, Postman, and Insomnia.",
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
      border: "border-emerald-500/30 group-hover:border-emerald-400/60",
      fn: () => exportSwagger(spec, projectName, { baseUrl, theme }),
    },
    {
      id: "word",
      icon: <FileType2 className="size-7" />,
      label: "Word (.docx)",
      desc: "A complete Word document with metadata, endpoint index, parameters, body, and responses.",
      accent: "text-violet-400",
      bg: "bg-violet-500/10 group-hover:bg-violet-500/20",
      border: "border-violet-500/30 group-hover:border-violet-400/60",
      fn: () => exportWord(spec, projectName, { baseUrl, theme }),
    },
  ];

  const handleExport = async (opt: ExportOption) => {
    if (loading) return;
    setLoading(opt.id);
    setDone(null);
    try {
      await opt.fn();
      setDone(opt.id);
      setTimeout(() => setDone(null), 2000);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
              <Download className="size-4 text-white" />
            </div>
            <div>
              <h2 className="text-base" style={{ fontWeight: 700 }}>
                Export API Docs
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose an export format
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-accent/60 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {options.map((opt) => {
            const isLoading = loading === opt.id;
            const isDone = done === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleExport(opt)}
                disabled={!!loading}
                className={`group relative text-left rounded-xl border p-5 transition-all duration-200 ${opt.border} ${
                  loading && !isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`size-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${opt.bg} ${opt.accent}`}
                >
                  {isLoading ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : isDone ? (
                    <Check className="size-6 text-emerald-400" />
                  ) : (
                    opt.icon
                  )}
                </div>
                <div className={`text-sm mb-1.5 ${opt.accent}`} style={{ fontWeight: 700 }}>
                  {opt.label}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
