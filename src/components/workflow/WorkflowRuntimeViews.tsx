"use client";

import { Fragment, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  History,
  Play,
  Square,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  CallRecord,
  Workflow,
  WorkflowRunResult,
  WorkflowRunStatus,
} from "@/lib/data/workflowData";

const STATUS_STYLES: Record<WorkflowRunStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-500/10 text-blue-500",
  passed: "bg-emerald-500/10 text-emerald-500",
  failed: "bg-red-500/10 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-500 bg-emerald-500/10",
  POST: "text-blue-500 bg-blue-500/10",
  PUT: "text-amber-500 bg-amber-500/10",
  PATCH: "text-violet-500 bg-violet-500/10",
  DELETE: "text-red-500 bg-red-500/10",
};

function statusColor(code: number) {
  if (code < 300) return "text-emerald-500";
  if (code < 400) return "text-amber-500";
  if (code < 500) return "text-orange-500";
  return "text-red-500";
}

function responseTimeColor(ms: number) {
  if (ms < 500) return "text-emerald-500";
  if (ms < 1500) return "text-amber-500";
  return "text-red-500";
}

function StatusPill({ status }: { status: WorkflowRunStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLES[status]}`}>
      {status === "running" && <Zap className="size-3 animate-pulse" />}
      {status === "passed" && <CheckCircle2 className="size-3" />}
      {status === "failed" && <XCircle className="size-3" />}
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={`text-2xl font-mono ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function MultiWorkflowRunner({
  workflows,
  statuses,
  onRunSelected,
  onStop,
  isRunning,
}: {
  workflows: Workflow[];
  statuses: Record<string, WorkflowRunStatus>;
  onRunSelected: (ids: string[]) => void;
  onStop: () => void;
  isRunning: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const runnableWorkflows = workflows.filter((workflow) =>
    workflow.steps.some((step) => step.enabled)
  );
  const selectedIds = Array.from(selected).filter((id) =>
    runnableWorkflows.some((workflow) => workflow.id === id)
  );
  const counts = useMemo(
    () => ({
      queued: Object.values(statuses).filter((status) => status === "queued").length,
      running: Object.values(statuses).filter((status) => status === "running").length,
      passed: Object.values(statuses).filter((status) => status === "passed").length,
      failed: Object.values(statuses).filter((status) => status === "failed").length,
    }),
    [statuses]
  );

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg" style={{ fontWeight: 600 }}>
              Run workflows
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select one or more saved workflows and run them from the same queue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRunSelected(selectedIds)}
              disabled={!selectedIds.length || isRunning}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-500 px-3 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Play className="size-4" /> Run selected ({selectedIds.length})
            </button>
            <button
              onClick={() => onRunSelected(runnableWorkflows.map((workflow) => workflow.id))}
              disabled={!runnableWorkflows.length || isRunning}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Zap className="size-4" /> Run all
            </button>
            {isRunning && (
              <button
                onClick={onStop}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-sm text-red-500 hover:bg-red-500/20"
              >
                <Square className="size-4" /> Stop
              </button>
            )}
          </div>
        </div>

        {(counts.queued > 0 || counts.running > 0 || counts.passed > 0 || counts.failed > 0) && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Queued" value={counts.queued} />
            <StatCard label="Running" value={counts.running} tone="text-blue-500" />
            <StatCard label="Passed" value={counts.passed} tone="text-emerald-500" />
            <StatCard label="Failed" value={counts.failed} tone="text-red-500" />
          </div>
        )}

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} of {runnableWorkflows.length} runnable workflows selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelected(new Set(runnableWorkflows.map((workflow) => workflow.id)))}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {workflows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No workflows yet.
              </div>
            ) : (
              workflows.map((workflow) => {
                const enabledSteps = workflow.steps.filter((step) => step.enabled).length;
                const isRunnable = enabledSteps > 0;
                const isSelected = selected.has(workflow.id);
                const status = statuses[workflow.id] ?? "idle";

                return (
                  <button
                    key={workflow.id}
                    onClick={() => isRunnable && toggleSelect(workflow.id)}
                    disabled={!isRunnable}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isRunnable}
                      onChange={() => toggleSelect(workflow.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="accent-primary"
                      aria-label={`Select ${workflow.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm" style={{ fontWeight: 600 }}>
                        {workflow.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {enabledSteps} enabled / {workflow.steps.length} total steps
                      </div>
                    </div>
                    <StatusPill status={status} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunReportPanel({ results }: { results: WorkflowRunResult[] }) {
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const totals = useMemo(
    () =>
      results.reduce(
        (acc, result) => ({
          total: acc.total + result.summary.total,
          passed: acc.passed + result.summary.passed,
          failed: acc.failed + result.summary.failed,
          responseTime: acc.responseTime + result.summary.avgResponseTime,
        }),
        { total: 0, passed: 0, failed: 0, responseTime: 0 }
      ),
    [results]
  );
  const avgResponseTime = results.length
    ? Math.round(totals.responseTime / results.length)
    : 0;
  const errorRate = totals.total ? Math.round((totals.failed / totals.total) * 1000) / 10 : 0;

  const toggleRun = (id: string) => {
    setExpandedRuns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!results.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <BarChart3 className="mb-3 size-9" />
        <p className="text-sm text-foreground">No run reports yet</p>
        <p className="mt-1 text-xs">Run a workflow to generate a report.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total requests" value={totals.total} />
          <StatCard label="Passed" value={totals.passed} tone="text-emerald-500" />
          <StatCard label="Failed" value={totals.failed} tone={totals.failed ? "text-red-500" : "text-foreground"} />
          <StatCard label="Error rate" value={`${errorRate}%`} tone={errorRate ? "text-red-500" : "text-emerald-500"} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Avg response time" value={`${avgResponseTime}ms`} />
          <StatCard label="Workflow runs" value={results.length} />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            Run reports
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted-foreground">
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left">Workflow</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Passed</th>
                  <th className="px-3 py-2 text-right">Failed</th>
                  <th className="px-3 py-2 text-right">Avg RT</th>
                  <th className="px-3 py-2 text-right">Started</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const isExpanded = expandedRuns.has(result.id);
                  return (
                    <Fragment key={result.id}>
                      <tr
                        onClick={() => toggleRun(result.id)}
                        className="cursor-pointer border-b border-border text-xs hover:bg-muted/30"
                      >
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                        </td>
                        <td className="max-w-[240px] px-3 py-2.5">
                          <span className="block truncate">{result.workflowName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusPill status={result.status} />
                        </td>
                        <td className="px-3 py-2.5 text-right">{result.summary.total}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-500">{result.summary.passed}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{result.summary.failed}</td>
                        <td className="px-3 py-2.5 text-right">{result.summary.avgResponseTime}ms</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                          {new Date(result.startedAt).toLocaleString()}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border">
                          <td colSpan={8} className="bg-muted/20 p-0">
                            <div className="space-y-2 p-4">
                              {result.stepResults.map((step) => (
                                <div key={step.stepId} className="rounded-md border border-border bg-background p-3">
                                  <div className="mb-2 flex items-center gap-2">
                                    {step.status === "passed" ? (
                                      <CheckCircle2 className="size-4 text-emerald-500" />
                                    ) : (
                                      <XCircle className="size-4 text-red-500" />
                                    )}
                                    <span className="text-sm" style={{ fontWeight: 600 }}>
                                      {step.stepName}
                                    </span>
                                  </div>
                                  {step.calls.map((call) => (
                                    <div
                                      key={call.id}
                                      className="grid grid-cols-[70px_1fr_70px_80px] gap-2 text-[10px] text-muted-foreground"
                                    >
                                      <span className={`rounded px-1.5 py-0.5 font-mono ${METHOD_COLORS[call.method]}`}>
                                        {call.method}
                                      </span>
                                      <span className="truncate font-mono">{call.url}</span>
                                      <span className={`text-right font-mono ${statusColor(call.statusCode)}`}>
                                        {call.statusCode}
                                      </span>
                                      <span className={`text-right font-mono ${responseTimeColor(call.responseTime)}`}>
                                        {call.responseTime}ms
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedCall({ call }: { call: CallRecord }) {
  return (
    <div className="grid gap-4 bg-muted/20 p-4 md:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[10px] text-muted-foreground">Request payload</p>
        <pre className="max-h-36 overflow-auto rounded-md border border-border bg-background p-2 text-[10px]">
          {call.requestPayload || "(empty)"}
        </pre>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] text-muted-foreground">Response body</p>
        <pre className="max-h-36 overflow-auto rounded-md border border-border bg-background p-2 text-[10px]">
          {call.responseBody}
        </pre>
      </div>
      {call.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-500 md:col-span-2">
          {call.error}
        </div>
      )}
      <div className="md:col-span-2">
        <p className="mb-1.5 text-[10px] text-muted-foreground">Assertions</p>
        <div className="space-y-1">
          {call.assertions.map((assertion, index) => (
            <div key={`${assertion.type}-${index}`} className="flex items-center gap-2 text-[10px]">
              {assertion.passed ? (
                <CheckCircle2 className="size-3 text-emerald-500" />
              ) : (
                <XCircle className="size-3 text-red-500" />
              )}
              <span className="text-muted-foreground">
                {assertion.type}
                {assertion.field ? ` (${assertion.field})` : ""}
              </span>
              <span>expected: {assertion.expected}</span>
              {!assertion.passed && <span className="text-red-500">actual: {assertion.actual}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CallHistoryTable({
  calls,
  workflows,
}: {
  calls: CallRecord[];
  workflows: Workflow[];
}) {
  const [filterWorkflow, setFilterWorkflow] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlyFailedAssertions, setOnlyFailedAssertions] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const workflowOptions = useMemo(() => {
    const options = new Map<string, string>();
    workflows.forEach((workflow) => options.set(workflow.id, workflow.name));
    calls.forEach((call) => options.set(call.workflowId, call.workflowName));
    return Array.from(options.entries());
  }, [calls, workflows]);

  const filtered = calls.filter((call) => {
    if (filterWorkflow && call.workflowId !== filterWorkflow) return false;
    if (filterStatus && !String(call.statusCode).startsWith(filterStatus[0])) return false;
    if (onlyErrors && !call.error && call.statusCode < 400) return false;
    if (onlyFailedAssertions && !call.assertions.some((assertion) => !assertion.passed)) {
      return false;
    }
    return true;
  });

  const toggleRow = (id: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Filter className="size-3.5 text-muted-foreground" />
        <select
          value={filterWorkflow}
          onChange={(event) => setFilterWorkflow(event.target.value)}
          className="rounded-md border border-border bg-input-background px-2 py-1 text-xs"
        >
          <option value="">All workflows</option>
          {workflowOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="rounded-md border border-border bg-input-background px-2 py-1 text-xs"
        >
          <option value="">All status codes</option>
          <option value="2xx">2xx success</option>
          <option value="4xx">4xx client error</option>
          <option value="5xx">5xx server error</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(event) => setOnlyErrors(event.target.checked)}
            className="accent-primary"
          />
          Errors only
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyFailedAssertions}
            onChange={(event) => setOnlyFailedAssertions(event.target.checked)}
            className="accent-primary"
          />
          Failed assertions
        </label>
        <span className="ml-auto text-[10px] text-muted-foreground">{filtered.length} records</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[900px]">
          <thead className="sticky top-0 z-10 border-b border-border bg-card">
            <tr className="text-[10px] text-muted-foreground">
              <th className="w-8" />
              <th className="px-3 py-2 text-left">Workflow</th>
              <th className="px-3 py-2 text-left">Step</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">URL</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">RT</th>
              <th className="px-3 py-2 text-center">Assertions</th>
              <th className="px-3 py-2 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((call) => {
              const isExpanded = expandedRows.has(call.id);
              const assertionsPassed = call.assertions.every((assertion) => assertion.passed);
              return (
                <Fragment key={call.id}>
                  <tr
                    onClick={() => toggleRow(call.id)}
                    className="cursor-pointer border-b border-border text-xs hover:bg-muted/30"
                  >
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                    </td>
                    <td className="max-w-[150px] px-3 py-2.5">
                      <span className="block truncate">{call.workflowName}</span>
                    </td>
                    <td className="max-w-[140px] px-3 py-2.5 text-muted-foreground">
                      <span className="block truncate">{call.stepName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${METHOD_COLORS[call.method]}`}>
                        {call.method}
                      </span>
                    </td>
                    <td className="max-w-[230px] px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                      <span className="block truncate">{call.url}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-center font-mono ${statusColor(call.statusCode)}`}>
                      {call.statusCode}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${responseTimeColor(call.responseTime)}`}>
                      {call.responseTime}ms
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {assertionsPassed ? (
                        <CheckCircle2 className="mx-auto size-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="mx-auto size-3.5 text-red-500" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                      {new Date(call.timestamp).toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border">
                      <td colSpan={9} className="p-0">
                        <ExpandedCall call={call} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
            <History className="mb-3 size-8" />
            <p className="text-sm">No call records match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryView({
  results,
  calls,
  workflows,
  onClearResults,
  onClearCalls,
}: {
  results: WorkflowRunResult[];
  calls: CallRecord[];
  workflows: Workflow[];
  onClearResults: () => void;
  onClearCalls: () => void;
}) {
  const [tab, setTab] = useState<"reports" | "calls">("reports");

  const clearCurrent = () => {
    if (tab === "reports") {
      if (results.length && confirm(`Clear ${results.length} report(s)?`)) onClearResults();
      return;
    }
    if (calls.length && confirm(`Clear ${calls.length} call record(s)?`)) onClearCalls();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b border-border bg-card px-4">
        <button
          onClick={() => setTab("reports")}
          className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs transition-colors ${
            tab === "reports"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="size-3.5" /> Reports
        </button>
        <button
          onClick={() => setTab("calls")}
          className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs transition-colors ${
            tab === "calls"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-3.5" /> Call history
        </button>
        <button
          onClick={clearCurrent}
          disabled={tab === "reports" ? results.length === 0 : calls.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Clear
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "reports" ? (
          <RunReportPanel results={results} />
        ) : (
          <CallHistoryTable calls={calls} workflows={workflows} />
        )}
      </div>
    </div>
  );
}
