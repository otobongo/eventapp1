"use server";

// Member admin server actions.
//
// SECURITY:
// - Every action re-reads the session and gates by admin/superadmin
//   role on the resolved tenant. Client UI hiding is cosmetic.
// - All inputs Zod-validated before they reach the data layer.
// - Tenant scoping comes from the session (never from input).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  addMemberByEmail,
  setMemberAccountStatus,
  upsertMemberProfile,
  type ProfilePatch,
} from "./members";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const UuidSchema = z.string().uuid();

const MemberStatusSchema = z.enum([
  "visitor",
  "regular",
  "member",
  "leader",
  "staff",
  "inactive",
]);

const AccountStatusSchema = z.enum(["active", "inactive", "invited"]);

const CemRoleSchema = z.enum(["member", "lead", "admin", "superadmin"]);

const ProfilePatchSchema = z
  .object({
    membership_status: MemberStatusSchema.optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    joined_church_at: z.coerce.date().nullable().optional(),
    communication_email_opt_in: z.boolean().optional(),
    communication_sms_opt_in: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

const AddMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120),
  cem_role: CemRoleSchema.optional(),
  profile: ProfilePatchSchema.optional(),
});

const UpdateProfileSchema = z.object({
  user_id: UuidSchema,
  patch: ProfilePatchSchema,
});

const SetAccountStatusSchema = z.object({
  user_id: UuidSchema,
  status: AccountStatusSchema,
});

function isAdminOrSuper(role: string | undefined): boolean {
  return role === "admin" || role === "superadmin" || role === "platform_admin";
}

export async function addMemberAction(
  input: unknown,
): Promise<ActionResult<{ user_id: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdminOrSuper(session.role)) return { ok: false, error: "forbidden" };

  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_payload" };
  }

  try {
    const { user_id } = await addMemberByEmail(session.tenantId, {
      email: parsed.data.email,
      name: parsed.data.name,
      cem_role: parsed.data.cem_role,
      profile: parsed.data.profile as ProfilePatch | undefined,
    });
    revalidatePath("/events/dashboard/super/members");
    return { ok: true, data: { user_id } };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "create_failed";
    return { ok: false, error: reason };
  }
}

export async function updateMemberProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdminOrSuper(session.role)) return { ok: false, error: "forbidden" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_payload" };
  }

  try {
    await upsertMemberProfile(
      session.tenantId,
      parsed.data.user_id,
      parsed.data.patch as ProfilePatch,
    );
    revalidatePath("/events/dashboard/super/members");
    revalidatePath(`/events/dashboard/super/members/${parsed.data.user_id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update_failed" };
  }
}

export async function setMemberAccountStatusAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isAdminOrSuper(session.role)) return { ok: false, error: "forbidden" };

  const parsed = SetAccountStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_payload" };
  }

  try {
    await setMemberAccountStatus(
      session.tenantId,
      parsed.data.user_id,
      parsed.data.status,
    );
    revalidatePath("/events/dashboard/super/members");
    revalidatePath(`/events/dashboard/super/members/${parsed.data.user_id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "status_failed" };
  }
}
