CREATE TYPE "public"."member_status" AS ENUM('visitor', 'regular', 'member', 'leader', 'staff', 'inactive');--> statement-breakpoint
CREATE TABLE "core_tenant_member_profiles" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text,
	"city" text,
	"joined_church_at" timestamp,
	"membership_status" "member_status" DEFAULT 'visitor',
	"communication_email_opt_in" boolean DEFAULT false,
	"communication_sms_opt_in" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "core_tenant_member_profiles_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "cem_departments" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "core_tenant_member_profiles" ADD CONSTRAINT "core_tenant_member_profiles_tenant_id_core_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_tenant_member_profiles" ADD CONSTRAINT "core_tenant_member_profiles_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- RLS for core_tenant_member_profiles.
-- - SELECT: tenant members (any authenticated user with a row in
--   core_tenant_users for this tenant) OR platform admins.
-- - INSERT/UPDATE/DELETE: same gate, plus the application action
--   layer additionally restricts mutation to admin/superadmin
--   roles per app context.

ALTER TABLE "core_tenant_member_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "core_tenant_member_profiles_member_select"
ON "core_tenant_member_profiles"
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin()
  OR tenant_id IN (SELECT public.user_tenant_ids())
);
--> statement-breakpoint

CREATE POLICY "core_tenant_member_profiles_admin_write"
ON "core_tenant_member_profiles"
FOR ALL
TO authenticated
USING (
  public.is_platform_admin()
  OR tenant_id IN (SELECT public.user_tenant_ids())
)
WITH CHECK (
  public.is_platform_admin()
  OR tenant_id IN (SELECT public.user_tenant_ids())
);