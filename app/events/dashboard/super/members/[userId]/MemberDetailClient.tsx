"use client";

// Member detail / edit page client. Lets the admin update the
// tenant-scoped profile fields. Identity (name, email) is read-only —
// only the member themselves can change those (out of scope for v1).

import { ArrowLeft, UserCheck, UserMinus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/cem/toast";
import {
  setMemberAccountStatusAction,
  updateMemberProfileAction,
} from "@/lib/cem/member-actions";

type MemberDetail = {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
  membership_status:
    | "visitor"
    | "regular"
    | "member"
    | "leader"
    | "staff"
    | "inactive";
  account_status: "active" | "inactive" | "invited";
  joined_at: string | null;
  joined_church_at: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  communication_email_opt_in: boolean;
  communication_sms_opt_in: boolean;
  cem_role: string | null;
};

const MEMBER_STATUSES = [
  { value: "visitor", label: "Visitor" },
  { value: "regular", label: "Regular" },
  { value: "member", label: "Member" },
  { value: "leader", label: "Leader" },
  { value: "staff", label: "Staff" },
  { value: "inactive", label: "Inactive (in church)" },
] as const;

export function MemberDetailClient({ member }: { member: MemberDetail }) {
  // Local state for the editable profile.
  const [membershipStatus, setMembershipStatus] = useState(member.membership_status);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [city, setCity] = useState(member.city ?? "");
  const [joinedAt, setJoinedAt] = useState(
    member.joined_church_at ? member.joined_church_at.slice(0, 10) : "",
  );
  const [emailOptIn, setEmailOptIn] = useState(member.communication_email_opt_in);
  const [smsOptIn, setSmsOptIn] = useState(member.communication_sms_opt_in);
  const [notes, setNotes] = useState(member.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function save() {
    setBusy(true);
    const r = await updateMemberProfileAction({
      user_id: member.user_id,
      patch: {
        membership_status: membershipStatus,
        phone: phone.trim() || null,
        city: city.trim() || null,
        joined_church_at: joinedAt ? new Date(joinedAt) : null,
        communication_email_opt_in: emailOptIn,
        communication_sms_opt_in: smsOptIn,
        notes: notes.trim() || null,
      },
    });
    setBusy(false);
    if (!r.ok) {
      toast.show("error", "Couldn't save. Try again.");
      return;
    }
    toast.show("success", "Saved.");
    startTransition(() => router.refresh());
  }

  async function toggleAccountStatus() {
    const next = member.account_status === "active" ? "inactive" : "active";
    if (
      !window.confirm(
        next === "inactive"
          ? `Deactivate ${member.name}? They lose app access.`
          : `Reactivate ${member.name}?`,
      )
    ) return;
    setBusy(true);
    const r = await setMemberAccountStatusAction({
      user_id: member.user_id,
      status: next,
    });
    setBusy(false);
    if (!r.ok) {
      toast.show("error", "Couldn't update status.");
      return;
    }
    toast.show(
      "success",
      next === "active" ? `Reactivated ${member.name}.` : `Deactivated ${member.name}.`,
    );
    startTransition(() => router.refresh());
  }

  const inactive = member.account_status === "inactive";

  return (
    <div className="mx-auto max-w-[800px] px-6 py-12">
      <Link
        href="/events/dashboard/super/members"
        className="mb-4 inline-flex items-center gap-1 text-[12px] text-cal-text-secondary hover:text-cal-text"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" />
        All members
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            {member.name}
          </h1>
          <p className="mt-1 text-[13px] text-cal-text-secondary">
            {member.email}
          </p>
          {member.is_platform_admin ? (
            <span className="mt-2 inline-flex items-center rounded-md border border-cal-border bg-cal-bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cal-text-secondary">
              Platform admin
            </span>
          ) : null}
          {inactive ? (
            <span className="ml-2 mt-2 inline-flex items-center rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#991b1b]">
              No app access
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleAccountStatus}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle disabled:opacity-50"
        >
          {inactive ? (
            <>
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Reactivate
            </>
          ) : (
            <>
              <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
              Deactivate
            </>
          )}
        </button>
      </header>

      <section className="rounded-lg border border-cal-border bg-cal-card-bg p-6">
        <h2 className="mb-4 font-display text-[18px] font-medium">Profile</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Membership status">
            <select
              value={membershipStatus}
              onChange={(e) =>
                setMembershipStatus(e.target.value as MemberDetail["membership_status"])
              }
              className={fieldClasses}
            >
              {MEMBER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Joined the church on">
            <input
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              className={fieldClasses}
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              className={fieldClasses}
            />
          </Field>

          <Field label="City">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              className={fieldClasses}
            />
          </Field>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wider text-cal-text-secondary">
            Communication
          </h3>
          <div className="grid gap-2">
            <CheckboxField
              label="Email me about church events and updates"
              checked={emailOptIn}
              onChange={setEmailOptIn}
            />
            <CheckboxField
              label="Send me SMS reminders"
              checked={smsOptIn}
              onChange={setSmsOptIn}
            />
          </div>
        </div>

        <div className="mt-6">
          <Field label="Notes (admin-only)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Internal notes about this member. Never shown to them."
              className={`${fieldClasses} resize-y`}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-cal-border pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-cal-border bg-cal-card-bg p-6">
        <h2 className="mb-3 font-display text-[18px] font-medium">App access</h2>
        <dl className="grid gap-2 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-cal-text-secondary">CEM role</dt>
            <dd className="font-mono text-cal-text">{member.cem_role ?? "no role"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-cal-text-secondary">Tenant joined on</dt>
            <dd className="text-cal-text">
              {member.joined_at
                ? new Date(member.joined_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

const fieldClasses =
  "block w-full rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-cal-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-cal-border text-cal-brand focus:ring-2 focus:ring-cal-accent/15"
      />
      {label}
    </label>
  );
}
