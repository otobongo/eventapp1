// Member detail / edit page — Super Admin only.
//
// SECURITY:
// - requireAuth() + role narrowing.
// - getMember() returns null if the user isn't a member of THIS
//   tenant. We 404 in that case so cross-tenant snooping returns
//   the same response as a non-existent member.

import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getMember } from "@/lib/cem/members";
import { MemberDetailClient } from "./MemberDetailClient";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage(props: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireAuth();
  if (
    session.role !== "admin" &&
    session.role !== "superadmin" &&
    session.role !== "platform_admin"
  ) {
    redirect("/no-access");
  }

  const { userId } = await props.params;
  // Basic UUID-shape validation. Bad input → 404.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    notFound();
  }

  const member = await getMember(session.tenantId, userId);
  if (!member) {
    notFound();
  }

  return (
    <MemberDetailClient
      member={{
        ...member,
        joined_at: member.joined_at?.toISOString() ?? null,
        joined_church_at: member.joined_church_at?.toISOString() ?? null,
      }}
    />
  );
}
