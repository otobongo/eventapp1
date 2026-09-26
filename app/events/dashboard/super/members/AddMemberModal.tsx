"use client";

// AddMemberModal — admin-side "Add new member" form.
//
// Adds a person to the tenant by email + name. Optionally assigns a
// CEM role and seeds a basic profile (status, phone, city). Built on
// the native <dialog> element so we get focus-trap + Esc-close + ARIA
// for free.
//
// What this DOESN'T do:
//   - It does NOT create a Supabase Auth user. The added member is
//     a row in core_tenant_users + core_users, but they have no way
//     to log in until they sign up themselves OR an Invite flow
//     creates the auth user for them. That's a separate feature
//     (the Invite step in the onboarding sequence).
//
// Use case:
//   - "I want to record that Sarah is one of our regulars" — add
//     her here. She'll show up in the directory; her birthday and
//     other CEM data can reference her. If you want her to LOG IN,
//     use the Invite flow instead.

import { X } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/cem/toast";
import { addMemberAction } from "@/lib/cem/member-actions";

export type AddMemberModalRef = {
  open: () => void;
  close: () => void;
};

const MEMBER_STATUSES = [
  { value: "visitor", label: "Visitor" },
  { value: "regular", label: "Regular" },
  { value: "member", label: "Member" },
  { value: "leader", label: "Leader" },
  { value: "staff", label: "Staff" },
] as const;

export const AddMemberModal = forwardRef<AddMemberModalRef>(function AddMemberModal(
  _props,
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<string>("visitor");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        // Reset state every time we open.
        setName("");
        setEmail("");
        setMembershipStatus("visitor");
        setPhone("");
        setCity("");
        setError(null);
        dialogRef.current?.showModal();
      },
      close: () => dialogRef.current?.close(),
    }),
    [],
  );

  function close() {
    dialogRef.current?.close();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await addMemberAction({
        name: name.trim(),
        email: email.trim(),
        profile: {
          membership_status: membershipStatus as
            | "visitor"
            | "regular"
            | "member"
            | "leader"
            | "staff",
          phone: phone.trim() || null,
          city: city.trim() || null,
        },
      });
      if (!r.ok) {
        if (r.error === "already_member") {
          setError("That person is already a member of this tenant.");
        } else if (r.error === "forbidden") {
          setError("Admins only.");
        } else {
          setError(r.error.length < 120 ? r.error : "Couldn't add. Try again.");
        }
        return;
      }
      toast.show("success", `Added ${name.trim()}.`);
      close();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      onClose={() => setError(null)}
      aria-labelledby="add-member-title"
      className="z-50 w-[calc(100vw-32px)] max-w-[480px] overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg p-0 text-cal-text shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between border-b border-cal-border px-6 py-4">
        <div>
          <h2
            id="add-member-title"
            className="m-0 font-display text-[18px] font-medium tracking-[-0.01em]"
          >
            Add a member
          </h2>
          <p className="mt-0.5 text-[12px] text-cal-text-muted">
            They&rsquo;ll appear in the directory. Use Invite separately if
            they need to log in.
          </p>
        </div>
        <form method="dialog" className="contents">
          <button
            type="submit"
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      <form onSubmit={submit} className="grid gap-3 px-6 py-5">
        <Field label="Full name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            autoFocus
            className={fieldClasses}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            className={fieldClasses}
          />
        </Field>
        <Field label="Membership status">
          <select
            value={membershipStatus}
            onChange={(e) => setMembershipStatus(e.target.value)}
            className={fieldClasses}
          >
            {MEMBER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone (optional)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              className={fieldClasses}
            />
          </Field>
          <Field label="City (optional)">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              className={fieldClasses}
            />
          </Field>
        </div>

        {error ? (
          <p
            role="alert"
            className="m-0 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[color:var(--cal-status-deleted-text)]"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-subtle"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

const fieldClasses =
  "block w-full rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
        {label}
        {required ? <span className="ml-0.5 text-cal-brand">*</span> : null}
      </span>
      {children}
    </label>
  );
}
