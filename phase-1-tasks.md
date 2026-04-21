# Garbage Collection UI - Phase 1 Build Checklist

This checklist converts `info.txt` into an implementation sequence for the current scope:
- Use template navigation/layout as-is
- Frontend-only with static mock data
- No role guards/auth work in this phase
- Single tenant, one sidebar, light mode only

## 0) Kickoff and Guardrails

- [ ] Confirm app boots from template without regressions (`client` run).
- [ ] Keep existing sidebar/topbar/layout structure unchanged.
- [ ] Define shared constants for statuses and labels (pickup, payment, ticket).
- [ ] Create route map doc for all new menus/pages before building screens.

## 1) Project Structure (Client)

- [ ] Create/confirm folders:
  - [ ] `client/src/mocks/data`
  - [ ] `client/src/services/mockApi`
  - [ ] `client/src/features/customer`
  - [ ] `client/src/features/management`
  - [ ] `client/src/components/shared`
- [ ] Add central route constants file.
- [ ] Add central menu config file (Customer Portal + Management Portal groups).

## 2) Mock Data Layer

- [ ] Add static datasets:
  - [ ] customers
  - [ ] drivers
  - [ ] pickupRequests
  - [ ] payments
  - [ ] subscriptionPlans
  - [ ] complaints
  - [ ] tickets
  - [ ] zones
  - [ ] routes
  - [ ] notifications
  - [ ] revenueSummary
- [ ] Ensure relational integrity (`customerId`, `driverId`, `zoneId`, etc.).
- [ ] Add enough records for table pagination and filtering.

## 3) Mock Service Layer

- [ ] Create service modules per domain (`customer`, `pickup`, `payment`, `ticket`, `report`).
- [ ] Return standardized response shape:
  - [ ] success: `{ code: 1, data, message }`
  - [ ] error: `{ code: 2, message }`
- [ ] Simulate loading delay and basic error toggles for UI-state testing.

## 4) Shared Reusable Components

- [ ] Build/reuse shared blocks aligned to template style:
  - [ ] StatCard
  - [ ] StatusBadge
  - [ ] DataTable wrapper
  - [ ] FilterBar
  - [ ] Timeline/Stepper status UI
  - [ ] EmptyState
  - [ ] LoadingState skeleton wrapper
  - [ ] ErrorState alert block
- [ ] Make components mobile-safe and table/card adaptable.

## 5) Customer Portal Screens

- [ ] Customer Dashboard
- [ ] Subscription / Plans
- [ ] Book Pickup
- [ ] Pickup Tracking
- [ ] Payments
- [ ] Complaints / Support
- [ ] Profile

Screen acceptance baseline (apply to each page):
- [ ] Route is wired from sidebar/menu config.
- [ ] Data comes from mock service (not inline hardcoded in component).
- [ ] Loading/empty/error UI handled.
- [ ] Responsive behavior verified on mobile + desktop.

## 6) Management Portal Screens

### Admin Menus
- [ ] Admin Dashboard
- [ ] Customer Management
- [ ] Pickup Management
- [ ] Driver Assignment
- [ ] Zones and Routes
- [ ] Complaints Overview
- [ ] Reports Overview

### Driver Menus
- [ ] Driver Dashboard
- [ ] Assigned Pickups
- [ ] Pickup Detail
- [ ] Route

### Accountant Menus
- [ ] Accountant Dashboard
- [ ] Payments Management
- [ ] Invoices
- [ ] Financial Reports

### Support Menus
- [ ] Support Dashboard
- [ ] Ticket Management
- [ ] Customer Issue Detail

### Supervisor Menus
- [ ] Supervisor Dashboard
- [ ] Driver Monitoring
- [ ] Pickup Oversight

## 7) Navigation and Routing Integration

- [ ] Register all routes under existing template router flow.
- [ ] Keep one shared sidebar; add grouped menus only.
- [ ] Default landing route opens to dashboard.
- [ ] Remove/hide unused auth gating for this phase if it blocks navigation.

## 8) UX and Visual Consistency (Template-Aligned)

- [ ] Keep template typography, spacing, and card patterns consistent.
- [ ] Keep light mode only; remove dark-mode toggles from scope paths.
- [ ] Use consistent badge colors for status enums across all pages.
- [ ] Ensure forms have validation UI states (required, invalid, helper text).

## 9) Data Tables and Filters

- [ ] Add reusable search/filter patterns for management tables.
- [ ] Add pagination controls where records exceed one page.
- [ ] Use consistent empty/no-result messaging.

## 10) Final Hardening

- [ ] Lint and resolve issues (`client` lint workflow).
- [ ] Run formatter sequence per project rule (`lint:fix` then `prettier`).
- [ ] Sanity-check all menu links and route transitions.
- [ ] Verify no backend calls remain in new screens.

## Suggested Delivery Order

1. Project structure + menu config + route constants
2. Mock data + mock services
3. Shared components
4. Customer portal pages
5. Management portal pages (Admin -> Driver -> Support -> Accountant -> Supervisor)
6. Final consistency pass, lint/format, responsive QA

## Definition of Done (Phase 1)

- [ ] All listed pages are reachable from the existing sidebar/menu structure.
- [ ] UI is responsive and stable in light mode.
- [ ] All screens use centralized mock data through service modules.
- [ ] No role-based guards/auth flows block page access.
- [ ] Code is organized for straightforward API integration in next phase.
