// Shared platform tables (`core_` prefix).
// Per PRD Section 3. Used by every solution (CEM, Fold, Stedfast, MPR Portal).

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────

export const appStatusEnum = pgEnum("app_status", ["active", "inactive", "beta"]);

export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "trial"]);

export const domainVerificationStatusEnum = pgEnum("domain_verification_status", [
  "pending", // Domain added, DNS not yet verified
  "dns_verified", // DNS records confirmed, SSL not yet provisioned
  "active", // DNS verified + SSL provisioned, fully operational
  "failed", // Verification attempted but failed
]);

// Tenant-scoped membership status (church-specific status of a person
// within a given tenant). Distinct from core_tenant_users.status,
// which controls whether the person has app access at all.
//
// - visitor:  First-time or occasional attender
// - regular:  Attends reliably, hasn't formally joined
// - member:   Formally joined the church
// - leader:   Heads a department, ministry, or team
// - staff:    Paid employee
// - inactive: No longer attending. Preserves history without churn.
//             Note: this only marks the person as inactive in CHURCH
//             terms; app access is still controlled by
//             core_tenant_users.status.
export const memberStatusEnum = pgEnum("member_status", [
  "visitor",
  "regular",
  "member",
  "leader",
  "staff",
  "inactive",
]);

// ── core_tenants ──────────────────────────────────────────────────────
// A church or organization. Identified by slug (subdomain) or custom domain.

export const coreTenants = pgTable("core_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "New Song Parish Berlin"
  slug: text("slug").notNull().unique(), // "newsong" (used as subdomain)
  logo_url: text("logo_url"),
  timezone: text("timezone").default("Europe/Berlin"),
  status: tenantStatusEnum("status").default("active"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ── core_users ────────────────────────────────────────────────────────
// A person. Globally unique by email. Exists once across the entire platform.

export const coreUsers = pgTable("core_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar_url: text("avatar_url"),
  password_hash: text("password_hash"), // null if using OAuth
  is_platform_admin: boolean("is_platform_admin").default(false), // true for Otobong
  email_verified: boolean("email_verified").default(false),
  last_login_at: timestamp("last_login_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ── core_apps ─────────────────────────────────────────────────────────
// Registry of available solutions on the platform.

export const coreApps = pgTable("core_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // "cem", "fold", "stedfast", "mpr"
  name: text("name").notNull(), // "Church Event Management"
  description: text("description"),
  status: appStatusEnum("status").default("active"),
  created_at: timestamp("created_at").defaultNow(),
});

// ── core_tenant_apps ──────────────────────────────────────────────────
// Which tenant has access to which solution.
// If no row exists for (tenant, app), that tenant cannot use that app.

export const coreTenantApps = pgTable(
  "core_tenant_apps",
  {
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => coreTenants.id, { onDelete: "cascade" }),
    app_id: uuid("app_id")
      .notNull()
      .references(() => coreApps.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true),
    enabled_at: timestamp("enabled_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenant_id, table.app_id] }),
  }),
);

// ── core_tenant_users ─────────────────────────────────────────────────
// User membership in a tenant. A user can belong to multiple tenants.

export const coreTenantUsers = pgTable(
  "core_tenant_users",
  {
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => coreTenants.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => coreUsers.id, { onDelete: "cascade" }),
    joined_at: timestamp("joined_at").defaultNow(),
    status: text("status").default("active"), // "active", "inactive", "invited"
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenant_id, table.user_id] }),
  }),
);

// ── core_tenant_user_roles ────────────────────────────────────────────
// Role assignment scoped to tenant + app.
// Same user can have different roles in different apps within the same tenant.

export const coreTenantUserRoles = pgTable("core_tenant_user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => coreUsers.id, { onDelete: "cascade" }),
  app_id: uuid("app_id")
    .notNull()
    .references(() => coreApps.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "member", "lead", "admin", "superadmin"
  assigned_at: timestamp("assigned_at").defaultNow(),
  assigned_by: uuid("assigned_by").references(() => coreUsers.id),
});

// ── core_tenant_domains ───────────────────────────────────────────────
// Custom domain mapping for tenants. Each tenant gets a default subdomain
// (from core_tenants.slug). This table adds optional custom domains
// (e.g., newsongberlin.org). A tenant can have multiple custom domains;
// one can be marked as primary.

export const coreTenantDomains = pgTable("core_tenant_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => coreTenants.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(), // "newsongberlin.org"
  verification_status: domainVerificationStatusEnum("verification_status").default("pending"),
  verification_token: text("verification_token"), // for TXT record check
  verified: boolean("verified").default(false),
  ssl_provisioned: boolean("ssl_provisioned").default(false),
  is_primary: boolean("is_primary").default(false), // If true, subdomain redirects here
  created_at: timestamp("created_at").defaultNow(),
  verified_at: timestamp("verified_at"),
  ssl_provisioned_at: timestamp("ssl_provisioned_at"),
  added_by: uuid("added_by").references(() => coreUsers.id),
});

// ── core_tenant_member_profiles ─────────────────────────────────────
//
// Tenant-scoped, app-agnostic information about a person within a
// specific tenant. The "rich profile" that future apps (Fold,
// Stedfast, MPR Portal) all share. CEM consumes it via joins, never
// duplicates it.
//
// Architectural shape (Pattern A — see thread on identity model):
//
//   core_users                  ← global identity (email, name, avatar)
//   core_tenant_users           ← "this person belongs to this church"
//   core_tenant_member_profiles ← THIS table: church-specific data
//                                  about that person (phone, status,
//                                  joined date, etc.)
//   core_tenant_user_roles      ← per-app permissions
//
// Why a separate table instead of columns on core_users or
// core_tenant_users:
//   - core_users is identity only; it stays small.
//   - core_tenant_users holds a foreign key + state, not data fields.
//   - This separation lets Fold/Stedfast etc. extend the profile
//     with their own optional columns over time without bloating
//     the membership row.
//
// Composite PK (tenant_id, user_id): one profile per person per
// tenant. Same person at two churches → two profile rows, possibly
// different data (different phone, different membership_status).
//
// SECURITY:
//   - Tenant-scoped at the row level by definition.
//   - RLS policies (added in the migration) require the caller to
//     either be a member of the tenant, or a platform admin.

export const coreTenantMemberProfiles = pgTable(
  "core_tenant_member_profiles",
  {
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => coreTenants.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => coreUsers.id, { onDelete: "cascade" }),
    // Contact (optional)
    phone: text("phone"),
    city: text("city"),
    // Joining context
    joined_church_at: timestamp("joined_church_at"),
    membership_status: memberStatusEnum("membership_status").default("visitor"),
    // Communication opt-ins (default false; users opt in explicitly)
    communication_email_opt_in: boolean("communication_email_opt_in").default(false),
    communication_sms_opt_in: boolean("communication_sms_opt_in").default(false),
    // Free-text notes for admins. NEVER shown to the member themselves.
    notes: text("notes"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenant_id, table.user_id] }),
  }),
);
