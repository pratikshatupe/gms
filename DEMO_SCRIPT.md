# CorpGMS SaaS Demo — 5 Minute Walkthrough

> Script verified against the codebase on 2026-04-19. See **Verification notes**
> at the bottom for exact labels, file references, and two small wording fixes.

---

## 1. Landing
> "CorpGMS — powerful SaaS platform for corporate offices."

→ Click **Log In** (top-right nav).

## 2. Login
→ Select **Super Admin** → click **🔐 Log In as Super Admin**.
Lands on Dashboard (Platform Overview).

## 3. Dashboard
> "Look — ₹4.8 lakh MRR, 147 organisations, 2.3% churn. Full SaaS business view."

→ Point to the red Critical Alerts card: **"3 failed payments need attention"**.

## 4. Click MRR card
Navigates to **Subscription**.

> "15 customer organisations. 3 have payment issues — I can retry them all at once."

→ Point to the **Retry All** button (red alert card, top of page).

## 5. Click Emirates Group row
**OrgDetailDrawer** opens (right-side panel, four tabs).

> "Here's billing detail: invoice history, MRR, change plan, discount, credits — full customer billing lifecycle."

Tabs to point at: **Overview / Payments / Activity / Actions**.

## 6. Click "Organisations" in sidebar
Opens the Admin Panel (`/admin`).

> "This is deeper customer management — not billing-focused like Subscription. Think of it as the customer success tool."

## 7. Support scenario (verbal)
> "Say a customer complains their dashboard doesn't load. Let me debug what they see."

## 8. Impersonate
On any row in the **Organisations** tab, click the **violet log-in icon** (tooltip: *Impersonate a Director of {Org Name}*).

> "I'm now logged in as their Director — I see exactly what they see."

App swaps to the Director view immediately.

## 9. Amber banner
> "Clearly marked. Duration ticks live. Every impersonation is logged with operator, target, timestamp, and duration — the audit trail compliance frameworks like SOC 2 and ISO 27001 require."

## 10. End impersonation
Click **End Impersonation** (right side of banner) → back to Super Admin.
Navigate to **/admin → Impersonation Log** tab.

> "Full audit trail — IMPERSONATE_START and IMPERSONATE_END entries."

## 11. Role-aware views (verbal close)
> "All of this is role-aware. Director sees their organisation. Manager sees their office. Reception sees today's visitors. Service Staff sees their tasks. Five distinct views, one platform."

---

## Verification notes (2026-04-19)

### Numbers (data/mockData.jsx)
- MRR: **₹4,82,450** → "₹4.8 lakh" ✅
- Active orgs: **147** ✅
- Churn rate: **2.3%** ✅
- Failed payments: **3** ✅
- Total org rows in Subscription table: **15** (13 Active + 2 Trial)

### Labels (exact strings shown to user)
- Sidebar: **"Organisations"** (Sidebar.jsx:30) — note: not "Admin"
- Topbar page title: **"Organisations Management"**
- Admin tabs: Overview / Organisations / Support Tickets / Impersonation Log
- Drawer tabs: Overview / Payments / Activity / Actions
- Banner: **amber** (`bg-amber-100`), sticky at top, ticks every 30s

### Wording fixes vs. spoken script
1. **Step 8** — original script says "Drawer → User Impersonate". The row's
   impersonate button is **one-click direct** — it synthesises the org's
   primary Director (Arjun Mehta) without opening the drawer. The
   drawer-based path (open drawer → Users tab → Impersonate per-user)
   still exists but is a different flow. Script above uses the one-click path.
2. **Step 8 icon** — the button shows lucide's `LogIn` icon, not a 🔐 padlock.
   The 🔐 emoji is on the Impersonation Log *tab*, not the row button.

### Live-demo failure modes to watch for
- Impersonation refuses to start if a session is already active → "Impersonation could not start" toast. End any prior impersonation first.
- The audit log persists in `localStorage` — clearing browser storage between rehearsals wipes prior IMPERSONATE_START/END entries. Run a fresh impersonation right before showing the log tab.
- The MRR-card → Subscription navigation depends on react-router; if you reload mid-demo on a non-root path, log back in to restore the session.
