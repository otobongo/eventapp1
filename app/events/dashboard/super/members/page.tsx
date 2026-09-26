// Members list — Super Admin only.
//
// Shows everyone in the current tenant: identity (name, email),
// church-side status (visitor / regular / member / leader / staff /
// inactive), CEM role, contact bits (phone, city), join date.
//
// SECURITY:
// - requireAuth() + role narrowing. Non-admin/super redirect to /no-access.
// - listMembers tenant-scopes the underlying query.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listMembers } from "@/lib/cem/members";
import { MembersClient } from "./MembersClient";

export const metadata = { title: "Members · Church Event Management" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = await requireAuth();
  if (
    session.role !== "admin" &&
    session.role !== "superadmin" &&
    session.role !== "platform_admin"
  ) {
    redirect("/no-access");
  }

  const members = await listMembers(session.tenantId, { includeInactive: true });

  return (
    <MembersClient
      members={members.map((m) => ({
        ...m,
        joined_at: m.joined_at?.toISOString() ?? null,
        joined_church_at: m.joined_church_at?.toISOString() ?? null,
      }))}
    />
  );
}
