"use client";

// Super Admin Dashboard client (FR-7).
//
// Tabs: Forwarded (ready_for_approval) / Approved / Returned / All.
// Per-row actions on Forwarded: Approve / Send Back / Delete.

import { Eye, Trash2, FileText, Settings, Ban, BookOpen, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatsRow } from "@/components/cem/stats-row";
import { StatusBadge } from "@/components/cem/status-badge";
import { useToast } from "@/components/cem/toast";
import {
  approveRequestAction,
  cancelEventAction,
  deleteRequestAction,
  sendBackToAdminAction,
} from "@/lib/cem/request-actions";
import type { RequestListItem, RequestStatus } from "@/lib/cem/types";

type TabKey = "forwarded" | "approved" | "returned" | "all";

const TABS: Array<{ key: TabKey; label: string; statuses?: RequestStatus[] }> = [
  { key: "forwarded", label: "Forwarded", statuses: ["ready_for_approval"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "returned", label: "Returned", statuses: ["returned"] },
  { key: "all", label: "All" },
];

export function SuperAdminDashboardClient({
  stats,
  requests,
  isPlatformAdmin = false,
}: {
  stats: { forwarded: number; approved: number; returned: number; totalRequests: number };
  requests: RequestListItem[];
  /** Only platform admins see the Scriptures link; the curated list is platform-wide. */
  isPlatformAdmin?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("forwarded");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const counts: Record<TabKey, number> = {
    forwarded: stats.forwarded,
    approved: stats.approved,
    returned: stats.returned,
    all: stats.totalRequests,
  };

  const visible = (() => {
    const t = TABS.find((x) => x.key === tab);
    if (!t || !t.statuses) return requests.filter((r) => r.status !== "deleted");
    return requests.filter((r) => t.statuses!.includes(r.status));
  })();

  async function handleApprove(id: string) {
    setBusyId(id);
    setError(null);
    const r = await approveRequestAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Request approved and published.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }
  async function handleSendBack(id: string) {
    setBusyId(id);
    setError(null);
    const r = await sendBackToAdminAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Sent back to admin.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }
  async function handleCancel(id: string, title: string) {
    const reason = window.prompt(
      `Cancel "${title}"?\n\nWhy? (will be shown to all attendees)`,
      "",
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.show("error", "Please provide a reason (3+ characters).");
      return;
    }
    setBusyId(id);
    setError(null);
    const r = await cancelEventAction({ requestId: id, reason: trimmed });
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Event cancelled. Attendees will be notified.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }
  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Permanently delete "${title}"?\n\nThis cannot be undone.`)) return;
    setBusyId(id);
    setError(null);
    const r = await deleteRequestAction(id);
    if (!r.ok) {
      setError(humanError(r.error));
      toast.show("error", humanError(r.error));
    } else {
      toast.show("success", "Request deleted.");
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            Super Admin Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-cal-text-secondary">
            Final approval. Approve to publish, send back for revision, or delete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/events/dashboard/super/members"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Members
          </Link>
          <Link
            href="/events/dashboard/super/audit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Audit Log
          </Link>
          {/* Platform-admin only: scripture is global, not tenant-scoped. */}
          {isPlatformAdmin ? (
            <Link
              href="/events/dashboard/super/scriptures"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Scriptures
            </Link>
          ) : null}
          <Link
            href="/events/dashboard/super/settings"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent focus-visible:ring-offset-2"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </Link>
        </div>
      </header>

      <div className="mb-8">
        <StatsRow
          ariaLabel="Super admin statistics"
          stats={[
            { number: stats.forwarded, label: "Awaiting approval" },
            { number: stats.approved, label: "Approved" },
            { number: stats.returned, label: "Returned" },
            { number: stats.totalRequests, label: "Total requests" },
          ]}
        />
      </div>

      <div role="tablist" aria-label="Approval queue" className="mb-3 flex flex-wrap gap-1 border-b border-cal-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent ${
                active
                  ? "border-cal-brand text-cal-text"
                  : "border-transparent text-cal-text-secondary hover:text-cal-text"
              }`}
            >
              {t.label}
              <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-cal-bg-subtle px-1 text-[10px] font-semibold text-cal-text-muted">
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[color:var(--cal-status-deleted-text)]"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-cal-text-muted">
            No requests in this category.
          </div>
        ) : (
          <ul>
            {visible.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 border-b border-cal-border px-6 py-3 last:border-b-0 hover:bg-cal-bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-cal-text">{r.title}</div>
                  <div className="mt-0.5 text-[12px] text-cal-text-muted">
                    {r.department_name ?? "—"} · forwarded {formatDate(r.forwarded_at)}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="View details"
                    aria-label="View details"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {r.status === "ready_for_approval" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(r.id)}
                        disabled={busyId === r.id}
                        className="inline-flex h-7 items-center rounded-md bg-cal-brand px-2.5 text-[11px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendBack(r.id)}
                        disabled={busyId === r.id}
                        className="inline-flex h-7 items-center rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted"
                      >
                        Send back
                      </button>
                    </>
                  ) : null}
                  {/* EC-07: cancel an already-approved event. */}
                  {r.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(r.id, r.title)}
                      disabled={busyId === r.id}
                      title="Cancel this event"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-cal-border bg-transparent px-2.5 text-[11px] font-medium text-cal-text transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fecaca] disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" aria-hidden="true" />
                      Cancel
                    </button>
                  ) : null}
                  {r.status !== "deleted" ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.title)}
                      disabled={busyId === r.id}
                      title="Delete request"
                      aria-label="Delete request"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-[color:var(--cal-status-deleted-text)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired.";
    case "forbidden":
      return "Super admin only.";
    case "invalid_state":
      return "This request was updated by someone else. Refresh and try again.";
    case "date_required_for_publish":
      return "This request needs a date before it can be approved.";
    default:
      return "Couldn't complete. Try again.";
  }
}
