

# Sales Agent System — Audit & Completion Plan

## Issues Found

### 1. BUG: No toggle to deactivate/reactivate agents
The agent form has no `status` field. New agents get `active` by default, but there's no way to set an agent to `inactive` from the UI. The status badge is shown but not editable.

### 2. BUG: Edit order does NOT update agent_id
In `handleEditSave()` (line 374), the update payload does not include `agent_id`. If you edit an order and change the customer, the agent won't update.

### 3. BUG: Edit order does NOT auto-lookup agent on customer change
The `useEffect` for agent auto-lookup (line 218) only watches `customerId` (create form), not `editCustomerId`. Changing the customer in edit mode won't auto-select the agent.

### 4. BUG: Commission "Issue" allows duplicate payments
Clicking "Issue" inserts a new `agent_commissions` record every time. There's no check for existing paid records — you can issue commission multiple times for the same agent+month.

### 5. BUG: Commission summary card shows 0 until you visit the report tab
`commissionData` is only populated when `activeTab === "report"`, but the summary card at the top always renders it. On first load (agents tab), it shows PKR 0.

### 6. MISSING: No agent_id visible on the ProformaInvoices create/edit form
The `agentId` state is set but there is no visible field showing which agent is auto-selected. Users can't see or override the agent.

### 7. MISSING: No pagination on Sales Agents page
Customers and allocations lists have no pagination. With many customers, the allocation checkbox list will be very long.

### 8. MISSING: No status filter for agents
Can't filter between active and inactive agents.

### 9. MISSING: Commission report has no export/print
No way to generate a PDF or Excel of commission data for records.

---

## Implementation Plan

### Fix 1: Add status toggle to agent form
Add a Status select (active/inactive) to the agent create/edit dialog. Wire it into the save payload.

### Fix 2-3: Fix edit order agent handling
- Add `editAgentId` state
- Auto-lookup agent when `editCustomerId` changes (same pattern as create)
- Include `agent_id` in `handleEditSave` payload
- Show a "Sales Agent" display field in both create and edit forms

### Fix 4: Prevent duplicate commission issuance
Before inserting, check if an `agent_commissions` record already exists for that agent+month. If it does, show an error toast.

### Fix 5: Load commission data on page mount
Call `loadCommissionReport()` on initial load regardless of active tab, so the summary card shows correct data.

### Fix 6: Show agent field in order forms
Add a read-only "Sales Agent" display (with override SearchableSelect) in both create and edit order forms in ProformaInvoices.

### Fix 7: Add search/filter to customer allocation list
Add a text filter for the customer checkbox list to make large lists manageable.

### Fix 8: Add active/inactive filter for agents tab
Add a simple status filter dropdown above the agents table.

---

## Files to Edit

| File | Changes |
|------|---------|
| `src/pages/SalesAgents.tsx` | Add status toggle in form, duplicate commission guard, load commission on mount, customer list search filter |
| `src/pages/ProformaInvoices.tsx` | Add agent display field in create/edit forms, fix editAgentId state + auto-lookup + save |

