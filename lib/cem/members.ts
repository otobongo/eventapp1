// Members data layer (tenant-scoped).
//
// "Members" here means the people who belong to a tenant (a church).
// This module returns the joined view across:
//   - core_users               (global identity: name, email, avatar)
//   - core_tenant_users        (tenant membership row + status)
//   - core_tenant_member_profiles (tenant-scoped profile data)
//   - core_tenant_user_roles   (per-app roles)
//
// Why this lives in lib/cem/:
//   - For now, the only UI consuming Members is the CEM super-admin
//     dashboard. Future apps (Fold, etc.) will likely want their own
//     members surface, at which point this module's pure-query parts
//     get extracted to lib/members/. For v1, keeping it under cem/
//     mirrors how the rest of the app is organised.
//
// SECURITY:
//   - Every read is tenant-scoped via the input tenantId.
//   - The action layer (lib/cem/member-actions.ts) gates writes by
//     role (admin / superadmin / platform_admin only).
//   - core_users rows are global, but we only ever JOIN them through
//     core_tenant_users — we never expose users from other tenants.

import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coreTenantMemberProfiles,
  coreTenantUserRoles,
  coreTenantUsers,
  coreUsers,
} from "@/db/schema";

// ── Types ───────────────────────────────────────────────────────────

export type MemberStatus =
  | "visitor"
  | "regular"
  | "member"
  | "leader"
  | "staff"
  | "inactive";

export type MembershipStatus = "active" | "inactive" | "invited";

/** A member as displayed in the admin Members list. */
export type MemberListItem = {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  membership_status: MemberStatus;
  /** core_tenant_users.status — controls app access. */
  account_status: MembershipStatus;
  joined_at: Date | null;
  joined_church_at: Date | null;
  phone: string | null;
  city: string | null;
  /** CEM role, if any. Null = the person is a member of the tenant
   *  but has no CEM role yet (e.g. invite hasn't been processed). */
  cem_role: string | null;
};

export type MemberDetail = MemberListItem & {
  notes: string | null;
  communication_email_opt_in: boolean;
  communication_sms_opt_in: boolean;
  is_platform_admin: boolean;
};

// ── Reads ───────────────────────────────────────────────────────────

/**
 * List all members of a tenant. Joins identity + membership + profile +
 * the tenant's CEM role (if any). Excluded: inactive memberships, by
 * default — pass includeInactive=true to see them.
 */
export async function listMembers(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
): Promise<MemberListItem[]> {
  const { includeInactive = false } = options;

  const rows = await db
    .select({
      user_id: coreUsers.id,
      email: coreUsers.email,
      name: coreUsers.name,
      avatar_url: coreUsers.avatar_url,
      account_status: coreTenantUsers.status,
      joined_at: coreTenantUsers.joined_at,
      membership_status: coreTenantMemberProfiles.membership_status,
      joined_church_at: coreTenantMemberProfiles.joined_church_at,
      phone: coreTenantMemberProfiles.phone,
      city: coreTenantMemberProfiles.city,
      cem_role: sql<string | null>`(
        SELECT role FROM core_tenant_user_roles ctur
        JOIN core_apps ca ON ca.id = ctur.app_id
        WHERE ctur.tenant_id = ${coreTenantUsers.tenant_id}
          AND ctur.user_id = ${coreTenantUsers.user_id}
          AND ca.slug = 'cem'
        LIMIT 1
      )`,
    })
    .from(coreTenantUsers)
    .innerJoin(coreUsers, eq(coreUsers.id, coreTenantUsers.user_id))
    .leftJoin(
      coreTenantMemberProfiles,
      and(
        eq(coreTenantMemberProfiles.tenant_id, coreTenantUsers.tenant_id),
        eq(coreTenantMemberProfiles.user_id, coreTenantUsers.user_id),
      ),
    )
    .where(eq(coreTenantUsers.tenant_id, tenantId))
    .orderBy(asc(coreUsers.name));

  return rows
    .filter((r) =>
      includeInactive ? true : (r.account_status ?? "active") !== "inactive",
    )
    .map((r) => ({
      user_id: r.user_id,
      email: r.email,
      name: r.name,
      avatar_url: r.avatar_url,
      membership_status: (r.membership_status ?? "visitor") as MemberStatus,
      account_status: (r.account_status ?? "active") as MembershipStatus,
      joined_at: r.joined_at,
      joined_church_at: r.joined_church_at,
      phone: r.phone,
      city: r.city,
      cem_role: r.cem_role,
    }));
}

/**
 * Get a single member's full detail (everything in MemberListItem
 * plus admin-only fields like notes + communication opt-ins).
 *
 * Returns null if the user is not a member of this tenant. Tenant
 * scoping is critical here: a platform admin querying another
 * tenant's user must still get null unless that user is also a
 * member of the tenant being queried.
 */
export async function getMember(
  tenantId: string,
  userId: string,
): Promise<MemberDetail | null> {
  const rows = await db
    .select({
      user_id: coreUsers.id,
      email: coreUsers.email,
      name: coreUsers.name,
      avatar_url: coreUsers.avatar_url,
      is_platform_admin: coreUsers.is_platform_admin,
      account_status: coreTenantUsers.status,
      joined_at: coreTenantUsers.joined_at,
      membership_status: coreTenantMemberProfiles.membership_status,
      joined_church_at: coreTenantMemberProfiles.joined_church_at,
      phone: coreTenantMemberProfiles.phone,
      city: coreTenantMemberProfiles.city,
      notes: coreTenantMemberProfiles.notes,
      communication_email_opt_in:
        coreTenantMemberProfiles.communication_email_opt_in,
      communication_sms_opt_in:
        coreTenantMemberProfiles.communication_sms_opt_in,
      cem_role: sql<string | null>`(
        SELECT role FROM core_tenant_user_roles ctur
        JOIN core_apps ca ON ca.id = ctur.app_id
        WHERE ctur.tenant_id = ${coreTenantUsers.tenant_id}
          AND ctur.user_id = ${coreTenantUsers.user_id}
          AND ca.slug = 'cem'
        LIMIT 1
      )`,
    })
    .from(coreTenantUsers)
    .innerJoin(coreUsers, eq(coreUsers.id, coreTenantUsers.user_id))
    .leftJoin(
      coreTenantMemberProfiles,
      and(
        eq(coreTenantMemberProfiles.tenant_id, coreTenantUsers.tenant_id),
        eq(coreTenantMemberProfiles.user_id, coreTenantUsers.user_id),
      ),
    )
    .where(
      and(
        eq(coreTenantUsers.tenant_id, tenantId),
        eq(coreTenantUsers.user_id, userId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    user_id: r.user_id,
    email: r.email,
    name: r.name,
    avatar_url: r.avatar_url,
    is_platform_admin: r.is_platform_admin ?? false,
    account_status: (r.account_status ?? "active") as MembershipStatus,
    joined_at: r.joined_at,
    membership_status: (r.membership_status ?? "visitor") as MemberStatus,
    joined_church_at: r.joined_church_at,
    phone: r.phone,
    city: r.city,
    notes: r.notes,
    communication_email_opt_in: r.communication_email_opt_in ?? false,
    communication_sms_opt_in: r.communication_sms_opt_in ?? false,
    cem_role: r.cem_role,
  };
}

// ── Mutations ───────────────────────────────────────────────────────

export type ProfilePatch = {
  membership_status?: MemberStatus;
  phone?: string | null;
  city?: string | null;
  joined_church_at?: Date | null;
  communication_email_opt_in?: boolean;
  communication_sms_opt_in?: boolean;
  notes?: string | null;
};

/**
 * Upsert a member's tenant-scoped profile. Caller is responsible for
 * verifying admin/superadmin role before invoking.
 *
 * Atomic: uses onConflictDoUpdate against the (tenant_id, user_id)
 * composite primary key, so a missing profile gets created and an
 * existing one gets patched in one statement.
 */
export async function upsertMemberProfile(
  tenantId: string,
  userId: string,
  patch: ProfilePatch,
): Promise<void> {
  await db
    .insert(coreTenantMemberProfiles)
    .values({
      tenant_id: tenantId,
      user_id: userId,
      membership_status: patch.membership_status ?? "visitor",
      phone: patch.phone ?? null,
      city: patch.city ?? null,
      joined_church_at: patch.joined_church_at ?? null,
      communication_email_opt_in: patch.communication_email_opt_in ?? false,
      communication_sms_opt_in: patch.communication_sms_opt_in ?? false,
      notes: patch.notes ?? null,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        coreTenantMemberProfiles.tenant_id,
        coreTenantMemberProfiles.user_id,
      ],
      set: {
        ...(patch.membership_status !== undefined && {
          membership_status: patch.membership_status,
        }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
        ...(patch.city !== undefined && { city: patch.city }),
        ...(patch.joined_church_at !== undefined && {
          joined_church_at: patch.joined_church_at,
        }),
        ...(patch.communication_email_opt_in !== undefined && {
          communication_email_opt_in: patch.communication_email_opt_in,
        }),
        ...(patch.communication_sms_opt_in !== undefined && {
          communication_sms_opt_in: patch.communication_sms_opt_in,
        }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        updated_at: new Date(),
      },
    });
}

/**
 * Set the account status on the tenant-membership row. "inactive"
 * blocks app access entirely. Distinct from membership_status on
 * the profile, which is the church's view of the person.
 */
export async function setMemberAccountStatus(
  tenantId: string,
  userId: string,
  status: MembershipStatus,
): Promise<void> {
  await db
    .update(coreTenantUsers)
    .set({ status })
    .where(
      and(
        eq(coreTenantUsers.tenant_id, tenantId),
        eq(coreTenantUsers.user_id, userId),
      ),
    );
}

/**
 * Add a person to a tenant. Creates:
 *   - core_users row if no user with this email exists
 *   - core_tenant_users row (status = 'active' by default)
 *   - core_tenant_member_profiles row with the supplied profile bits
 *   - core_tenant_user_roles row with the supplied CEM role (if any)
 *
 * Idempotent on (tenant_id, user_id) — if the person is ALREADY a
 * member of this tenant, throws "already_member" so the caller can
 * choose to update instead.
 *
 * Does NOT create a Supabase Auth user. That's a separate concern
 * (the Invite flow handles it; direct admin-add can leave the
 * person without a way to log in until they sign up themselves).
 */
export async function addMemberByEmail(
  tenantId: string,
  input: {
    email: string;
    name: string;
    cem_role?: "member" | "lead" | "admin" | "superadmin";
    profile?: ProfilePatch;
  },
): Promise<{ user_id: string; created_user: boolean }> {
  const normalizedEmail = input.email.trim().toLowerCase();

  // Find or create the core_users row.
  const existing = await db
    .select({ id: coreUsers.id })
    .from(coreUsers)
    .where(eq(coreUsers.email, normalizedEmail))
    .limit(1);

  let userId: string;
  let createdUser = false;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    const inserted = await db
      .insert(coreUsers)
      .values({
        email: normalizedEmail,
        name: input.name,
        email_verified: false,
      })
      .returning({ id: coreUsers.id });
    userId = inserted[0].id;
    createdUser = true;
  }

  // Check membership.
  const memberRow = await db
    .select({ tenant_id: coreTenantUsers.tenant_id })
    .from(coreTenantUsers)
    .where(
      and(
        eq(coreTenantUsers.tenant_id, tenantId),
        eq(coreTenantUsers.user_id, userId),
      ),
    )
    .limit(1);
  if (memberRow.length > 0) {
    throw new Error("already_member");
  }

  // Create membership + profile + (optional) CEM role.
  await db.insert(coreTenantUsers).values({
    tenant_id: tenantId,
    user_id: userId,
    status: "active",
  });

  if (input.profile) {
    await upsertMemberProfile(tenantId, userId, input.profile);
  }

  if (input.cem_role) {
    // Look up the CEM app id.
    const cemApp = await db.execute(
      sql`SELECT id FROM core_apps WHERE slug = 'cem' LIMIT 1`,
    );
    const cemAppId = (cemApp[0] as { id: string } | undefined)?.id;
    if (cemAppId) {
      await db.execute(sql`
        INSERT INTO core_tenant_user_roles (tenant_id, user_id, app_id, role)
        VALUES (${tenantId}, ${userId}, ${cemAppId}, ${input.cem_role})
      `);
    }
  }

  return { user_id: userId, created_user: createdUser };
}
