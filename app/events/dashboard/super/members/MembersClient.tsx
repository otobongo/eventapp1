"use client";

// Members list client — search + filter + add modal + row actions.

import { Edit3, Plus, UserMinus, UserCheck, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/cem/toast";
import { setMemberAccountStatusAction } from "@/lib/cem/member-actions";
import {
  AddMemberModal,
  type AddMemberModalRef,
} from "./AddMemberModal";

type MemberStatus =
  | "visitor"
  | "regular"
  | "member"
  | "leader"
  | "staff"
  | "inactive";

type MemberRow = {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  membership_status: MemberStatus;
  account_status: "active" | "inactive" | "invited";
  joined_at: string | null;
  joined_church_at: string | null;
  phone: string | null;
  city: string | null;
  cem_role: string | null;
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  visitor: "Visitor",
  regular: "Regular",
  member: "Member",
  leader: "Leader",
  staff: "Staff",
  inactive: "Inactive",
};

const STATUS_COLOR: Record<MemberStatus, { bg: string; text: string; border: string }> = {
  visitor:  { bg: "#f0f9ff", text: "#075985", border: "#bae6fd" },
  regular:  { bg: "#f0fdf4", text: "#14532d", border: "#bbf7d0" },
  member:   { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7" },
  leader:   { bg: "#fef3c7", text: "#854d0e", border: "#fde68a" },
  staff:    { bg: "#f3e8ff", text: "#581c87", border: "#d8b4fe" },
  inactive: { bg: "#f3f4f6", text: "#4b5563", border: "#d1d5db" },
};

type Filter = "all" | MemberStatus;

export function MembersClient({ members }: { members: MemberRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const addModalRef = useRef<AddMemberModalRef>(null);

  const visible = useMemo(() => {
    let rows = members;
    if (filter !== "all") {
      rows = rows.filter((m) => m.membership_status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.city ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [members, filter, search]);

  // Stats per status — useful for the filter chips.
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: members.length,
      visitor: 0,
      regular: 0,
      member: 0,
      leader: 0,
      staff: 0,
      inactive: 0,
    };
    for (const m of members) c[m.membership_status]++;
    return c;
  }, [members]);

  async function handleToggleAccountStatus(row: MemberRow) {
    const next = row.account_status === "active" ? "inactive" : "active";
    const verb = next === "active" ? "Reactivate" : "Deactivate";
    if (
      !window.confirm(
        next === "inactive"
          ? `Deactivate ${row.name}? They lose app access; data is preserved.`
          : `Reactivate ${row.name}? They regain app access.`,
      )
    ) return;
    setBusyId(row.user_id);
    const r = await setMemberAccountStatusAction({
      user_id: row.user_id,
      status: next,
    });
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", "Couldn't update status. Try again.");
      return;
    }
    toast.show("success", `${verb}d ${row.name}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            Members
          </h1>
          <p className="mt-1 text-[13px] text-cal-text-secondary">
            Everyone in your church. Add, edit, or deactivate members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => addModalRef.current?.open()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add member
        </button>
      </header>

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-cal-border">
        {(
          ["all", "visitor", "regular", "member", "leader", "staff", "inactive"] as Filter[]
        ).map((key) => {
          const active = filter === key;
          const label = key === "all" ? "All" : STATUS_LABEL[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent ${
                active
                  ? "border-cal-brand text-cal-text"
                  : "border-transparent text-cal-text-secondary hover:text-cal-text"
              }`}
            >
              {label}
              <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-cal-bg-subtle px-1 text-[10px] font-semibold text-cal-text-muted">
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or city…"
          maxLength={200}
          className="w-full max-w-[360px] rounded-lg border border-cal-border bg-cal-bg px-3 py-1.5 text-[12px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-cal-text-muted">
            {members.length === 0
              ? "No members yet. Add your first member to get started."
              : "No members match these filters."}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-cal-border bg-cal-bg-subtle text-left text-[10px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                <th className="px-6 py-2.5">Name</th>
                <th className="w-[140px] px-3 py-2.5">Status</th>
                <th className="w-[120px] px-3 py-2.5">CEM Role</th>
                <th className="w-[180px] px-3 py-2.5">Contact</th>
                <th className="w-[100px] px-3 py-2.5">Location</th>
                <th className="w-[100px] px-6 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const inactive = m.account_status === "inactive";
                const sc = STATUS_COLOR[m.membership_status];
                return (
                  <tr
                    key={m.user_id}
                    className={`border-b border-cal-border last:border-b-0 hover:bg-cal-bg-subtle ${
                      inactive ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-6 py-2.5">
                      <div className="font-medium text-cal-text">{m.name}</div>
                      <div className="text-[11px] text-cal-text-muted">
                        {m.email}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: sc.text, backgroundColor: sc.bg, borderColor: sc.border }}
                      >
                        {STATUS_LABEL[m.membership_status]}
                      </span>
                      {inactive ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-cal-text-muted">
                          (no access)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-cal-text-secondary">
                      {m.cem_role ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-cal-text-secondary">
                      {m.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-cal-text-secondary">
                      {m.city ?? "—"}
                    </td>
                    <td className="px-6 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/events/dashboard/super/members/${m.user_id}`}
                          title="View / edit"
                          aria-label="View / edit"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleAccountStatus(m)}
                          disabled={busyId === m.user_id}
                          title={inactive ? "Reactivate" : "Deactivate"}
                          aria-label={inactive ? "Reactivate" : "Deactivate"}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent disabled:opacity-50"
                        >
                          {inactive ? (
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <AddMemberModal ref={addModalRef} />
    </div>
  );
}
