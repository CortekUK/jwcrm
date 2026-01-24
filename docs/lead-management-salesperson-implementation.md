# Lead Management - Salesperson & Source Assignment System

## Overview

This document outlines the implementation requirements for extending the lead management system with:
- A new **Salesperson** role
- **Lead Sources** management (Google Ads, Instagram, Website, etc.)
- **Automatic lead assignment** based on source-salesperson mapping
- **Round-robin distribution** for load balancing

---

## Hierarchy Structure

\`\`\`
Sources (immutable/permanent)
    ↓
Salespeople (assigned to sources)
    ↓
Leads (automatically assigned based on source)
\`\`\`

**Key Insight**: Sources are like Departments in HR module - they're created first and are relatively permanent. Salespeople are like Employees - they can be reassigned or replaced without losing lead history.

---

## 1. New Role: Salesperson

### Role Definition
- Add `salesperson` to the `UserRole` type
- Salesperson is an internal role (like hr, finance, lead_management)
- Salespeople can only see leads assigned to them (filtered view)
- Lead Manager sees all leads across all salespeople

### Salesperson Dashboard
- Route: `/admin/salesperson` or dedicated `/salesperson`
- Sidebar items:
  - **My Leads** - Table of assigned leads (same view as lead manager but filtered)
  - **Performance** (optional) - Stats on closed leads, revenue, etc.

### Salesperson Permissions
- Can view only their assigned leads
- Can update lead status
- Can add notes/call logs
- Can create proposals for their leads
- **Cannot** reassign leads to others
- **Cannot** see other salespeople's leads

---

## 2. Lead Sources Management

### Source Entity
Sources represent channels through which leads are acquired.

**Predefined Sources** (from client requirements):
1. Google Ads
2. Instagram
3. Website Forms
4. LinkedIn
5. B2B / Corporate
6. Referral
7. Death Cases (government cases)

### Source CRUD
- **Location**: New tab in Lead Management dashboard (like Departments in HR)
- **Route**: `/admin/lead-management/sources`
- **Operations**: Create, Read, Update, Delete sources
- **Fields**:
  - `id` (UUID)
  - `name` (TEXT, required) - e.g., "Google Ads"
  - `description` (TEXT, optional)
  - `is_active` (BOOLEAN, default true)
  - `created_at`, `updated_at`

### Source-Salesperson Assignment
When creating/editing a source:
1. Show "Assign Salespeople" dropdown (multi-select)
2. Only show salespeople NOT already assigned to another source
3. A salesperson can only be assigned to ONE source at a time

---

## 3. Lead Assignment System

### Automatic Assignment (Round-Robin)

When a new lead is created with a source:
1. Look up which salespeople are assigned to that source
2. If **one salesperson** → assign directly
3. If **multiple salespeople** → use round-robin:
   - Find salesperson with lowest current workload (pending leads count)
   - Or alternate in sequence (true round-robin)
4. Set `assigned_to` and `assigned_at` on the lead

### Manual Assignment Override

Lead Manager can manually reassign any lead:
- In the leads table, show "Assigned To" column
- Clicking shows dropdown of salespeople assigned to that lead's source
- Lead Manager can change assignment at any time

### Assignment Flow Diagram

\`\`\`
New Lead Created
       ↓
Source Selected (required field)
       ↓
Lookup Salespeople for Source
       ↓
   ┌───────────────────────┐
   │ Multiple Salespeople? │
   └───────────────────────┘
         ↓ Yes        ↓ No
    Round-Robin    Direct Assign
         ↓              ↓
   ┌─────────────────────┐
   │ Lead Assigned To    │
   │ Salesperson         │
   └─────────────────────┘
         ↓
   Email Notification to Salesperson
\`\`\`

---

## 4. Database Schema Changes

### New Table: `lead_sources`

\`\`\`sql
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_lead_sources_updated_at
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
\`\`\`

### New Table: `source_salesperson_assignments`

\`\`\`sql
CREATE TABLE source_salesperson_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES lead_sources(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),

  -- Each salesperson can only be assigned to one source
  UNIQUE(salesperson_id)
);

CREATE INDEX idx_source_assignments_source ON source_salesperson_assignments(source_id);
CREATE INDEX idx_source_assignments_salesperson ON source_salesperson_assignments(salesperson_id);
\`\`\`

### Modify Table: `leads`

\`\`\`sql
-- Add assignment fields to leads table
ALTER TABLE leads
  ADD COLUMN source_id UUID REFERENCES lead_sources(id),
  ADD COLUMN assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN assigned_at TIMESTAMPTZ;

-- Migrate existing source text to source_id (optional, can keep both)
-- Or keep the old 'source' TEXT column for backward compatibility

CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_source_id ON leads(source_id);
\`\`\`

### Add Salesperson Role

\`\`\`sql
-- Ensure salesperson role exists in user_roles for assigned users
-- This is handled through the existing user management system
\`\`\`

---

## 5. UI Components

### 5.1 Sources Management Page

**Route**: `/admin/lead-management/sources`

**Components**:
- `SourcesTable` - List all sources with name, description, assigned salespeople count
- `CreateSourceDialog` - Form with name, description, salesperson multi-select
- `EditSourceDialog` - Same as create with existing values

**Table Columns**:
| Name | Description | Salespeople | Status | Actions |
|------|-------------|-------------|--------|---------|
| Google Ads | Leads from Google... | Ibrahim, Waheed | Active | Edit, Delete |

### 5.2 Lead Manager View (Enhanced)

**Existing Route**: `/admin/lead-management/leads`

**Changes**:
- Add "Assigned To" column showing salesperson name
- Add "Source" column (now showing source from `lead_sources` table)
- Add filter by Salesperson dropdown
- Add filter by Source dropdown
- Click on salesperson name → navigate to salesperson's dashboard

**Lead Row Actions**:
- Edit lead (existing)
- Reassign lead (new) - dropdown of salespeople for that source

### 5.3 Salesperson Dashboard

**Route**: `/admin/salesperson` (for unified admin) or `/salesperson` (dedicated)

**Sidebar**:
\`\`\`
📊 Dashboard (performance stats)
👥 My Leads (filtered leads table)
⚙️ Settings
\`\`\`

**My Leads View**:
- Same table as Lead Manager but filtered to `assigned_to = current_user`
- Same columns EXCEPT "Assigned To" (always themselves)
- Same actions: edit status, add notes, create proposal

**Dashboard Stats** (optional):
- Total assigned leads
- Leads by status (not_started, pending, won, lost)
- Conversion rate
- Revenue closed

### 5.4 Individual Lead Page

**Route**: `/admin/lead-management/leads/[id]`

**Purpose**: Detailed view of a single lead with all related data

**Sections**:
1. **Lead Info** - Name, email, phone, company, source, status
2. **Assignment** - Assigned to, assigned at, reassign button (lead manager only)
3. **Proposals** - List of proposals/invoices for this lead
4. **Activity Log** (future) - Call logs, notes, status changes
5. **Reminders** (future) - Scheduled follow-ups

---

## 6. Navigation Config Updates

### Add to `dashboards.ts`

\`\`\`typescript
// Salesperson nav items (in unified admin)
const salespersonNavItems: NavItem[] = [
  { path: "/admin/salesperson", labelKey: "salesperson:dashboard", icon: LayoutDashboard },
  { path: "/admin/salesperson/leads", labelKey: "salesperson:myLeads", icon: Users },
  { path: "/admin/salesperson/settings", labelKey: "common:settings", icon: Settings },
];

// Update lead management nav items
const leadManagementNavItems: NavItem[] = [
  { path: "/admin/lead-management", labelKey: "leadManagement:dashboard", icon: LayoutDashboard },
  { path: "/admin/lead-management/leads", labelKey: "leadManagement:leads", icon: Users },
  { path: "/admin/lead-management/sources", labelKey: "leadManagement:sources", icon: Globe }, // NEW
  { path: "/admin/lead-management/settings", labelKey: "common:settings", icon: Settings },
];
\`\`\`

### Update Role Types

\`\`\`typescript
// In useAuth.tsx
export type UserRole = "client" | "admin" | "superadmin" | "hr" | "finance" | "lead_management" | "salesperson";

// In useSelectedRole.tsx
export const INTERNAL_ROLES: UserRole[] = ["superadmin", "admin", "hr", "finance", "lead_management", "salesperson"];
\`\`\`

---

## 7. Email Notifications

### When Lead is Assigned

Send email to salesperson:
- Subject: "New Lead Assigned: {lead_name}"
- Body: Lead details, source, link to lead in dashboard

### When Lead is Reassigned

Send email to new salesperson:
- Subject: "Lead Reassigned to You: {lead_name}"
- Body: Lead details, previous status, link to lead

---

## 8. RLS Policies

### Leads Table Policies

\`\`\`sql
-- Salesperson can only see their assigned leads
CREATE POLICY "salesperson_view_assigned_leads" ON leads
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'superadmin', 'lead_management')
    )
  );

-- Salesperson can update their assigned leads
CREATE POLICY "salesperson_update_assigned_leads" ON leads
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());
\`\`\`

### Source Tables Policies

\`\`\`sql
-- Only lead_management and admin can manage sources
CREATE POLICY "manage_sources" ON lead_sources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'superadmin', 'lead_management')
    )
  );
\`\`\`

---

## 9. Implementation Priority

### Phase 1 - Core (Today)
1. ✅ Add `salesperson` role to type system
2. ✅ Create salesperson dashboard route and sidebar
3. ✅ Add `assigned_to` field to leads table
4. ✅ Add assignment dropdown in lead manager view
5. ✅ Filter leads for salesperson view

### Phase 2 - Sources (Tuesday)
1. Create `lead_sources` table
2. Create `source_salesperson_assignments` table
3. Build Sources management page (CRUD)
4. Salesperson assignment in source form
5. Update lead creation to use source_id
6. Implement round-robin auto-assignment

### Phase 3 - Polish (Later)
1. Individual lead detail page
2. Email notifications
3. Performance dashboard for salespeople
4. Call logging / activity tracking
5. Reminders system

---

## 10. API Endpoints Needed

### Sources
- `GET /api/lead-management/sources` - List all sources
- `POST /api/lead-management/sources` - Create source
- `PUT /api/lead-management/sources/[id]` - Update source
- `DELETE /api/lead-management/sources/[id]` - Delete source

### Salespeople
- `GET /api/lead-management/salespeople` - List all users with salesperson role
- `GET /api/lead-management/salespeople/available` - List salespeople not assigned to any source

### Lead Assignment
- `POST /api/lead-management/leads/[id]/assign` - Manually assign lead
- `GET /api/lead-management/leads/my-leads` - Get current user's assigned leads

---

## 11. Translations Needed

### English (`leadManagement.json`)
\`\`\`json
{
  "sources": "Sources",
  "manageSources": "Manage Sources",
  "createSource": "Create Source",
  "editSource": "Edit Source",
  "sourceName": "Source Name",
  "sourceDescription": "Description",
  "assignedSalespeople": "Assigned Salespeople",
  "assignTo": "Assign To",
  "reassign": "Reassign",
  "assignedTo": "Assigned To",
  "assignedAt": "Assigned At",
  "noSalespersonAssigned": "Not Assigned",
  "selectSalesperson": "Select Salesperson",
  "autoAssigned": "Auto-assigned",
  "manuallyAssigned": "Manually assigned"
}
\`\`\`

### Salesperson namespace (`salesperson.json`)
\`\`\`json
{
  "dashboard": "Dashboard",
  "myLeads": "My Leads",
  "performance": "Performance",
  "totalLeads": "Total Leads",
  "leadsWon": "Leads Won",
  "leadsLost": "Leads Lost",
  "conversionRate": "Conversion Rate",
  "revenueGenerated": "Revenue Generated"
}
\`\`\`

---

## Summary

This implementation adds a complete salesperson workflow to the lead management system:

1. **Lead Manager** creates sources and assigns salespeople to them
2. **Leads** come in and are automatically assigned via round-robin
3. **Salespeople** see only their leads and work them through the pipeline
4. **Lead Manager** has overview of all leads and can reassign as needed

The architecture follows the same patterns as the HR module (Departments → Job Roles → Employees), making it consistent with the existing codebase.
