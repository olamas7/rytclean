# Subscription billing

## Account model

- Bill in arrears, at the end of the service cycle. Monthly billing uses calendar months.
- Debit = service charge; credit = payment/discount/reversal, distinguished by entry type. Balance = debits minus credits; positive means owing, negative means available credit.
- Keep bill line amounts and service periods as immutable snapshots. Corrections use reversals, not deletion. Prevent duplicate bills for a customer/service period and apply payments oldest-first.
- Customer plan switches are scheduled for the next month, without a separate switch fee. The current cycle retains its assigned plan and price. The customer form shows the next plan; the customer list and account view display current and pending plans separately. Selecting the current plan cancels a pending change. Unrecognised legacy plans can be repaired without creating charges; unstarted future registrations can be corrected before service begins.
- Mid-month first-month policy is configurable: **full_month** (default) or **prorated** (remaining days including joined date / actual days in that month). Store a snapshot of the applied policy/calculation when producing the first bill. Changing settings must not recalculate posted bills.
- Quarterly/yearly first-period and customer-switch alignment rules still need agreement before enabling billing for those cases. The monthly first-month option must not silently be applied to longer cycles.

## Implemented configuration

- Manager → Settings → Plan Settings: create/edit plans, current amount, next-cycle amount/effective date, assigned customer count, shared table, validated forms and protected saves.
- Admin → Configuration → Billing: full-month vs prorated first-month policy. The same component is also available from Manager → Settings → Billing Settings (administrator writes only).
- Manager → Client Billing: live client accounts, bills, and payments. Customer Management's wallet action opens the same account statement inline. Accountant Dashboard, Payments and Invoices use real billing records rather than mock payments.
- Each account has Statement, Bills and Payments tabs, running balances, billed/paid/overdue totals, printable bills/statements/receipts, staff payment entry, debit/credit adjustments, and reasoned reversals. Client direct-MoMo Paystack payments now post to this same ledger after independent verification; see `docs/customer-payments.md` for payment provenance, gateway safeguards, live-key warnings and test-mode isolation.
- A plan's amount is for its entire selected cycle, not a monthly amount to multiply again for quarterly/yearly plans.
- Zero-priced plans and zero grace days are valid. Pickup frequency is a positive integer; grace days a non-negative integer; monetary amounts have at most two decimal places.
- Plan codes are immutable to preserve existing `customers.plan_code` links. An assigned plan's billing cycle cannot be changed; create a separate plan instead.
- Deactivation prevents new assignments while preserving existing accounts.

## Price changes

`plan_prices` stores date-effective price versions. New plans are available at their configured price today. Existing plan amount edits create/update a future version effective the first day of next month (UTC/Ghana). Editing the same pending change replaces that pending value; setting the amount back to the current amount cancels the unstarted change. Active/past price versions are not overwritten.

Future billing must use `resolvePlanPrice(connection, planId, cycleStart)` from `server/services/planPricing.js`, then snapshot the result on the bill. A price that becomes available while a cycle is underway does not change that cycle: lookup uses the **cycle start**, not invoice creation date. For longer cycles, the new amount applies when their next cycle starts after the price's effective date.

**Do not bill directly from `plans.amount`:** it is the latest configured amount (which may be scheduled). `GET /api/admin/plans` exposes `amount` as the currently effective amount and `nextAmount` / `nextEffectiveDate` separately. These dates indicate plan-rate availability, not the individual customer's billing date.

The initial migration records the currently known plan prices from the migration date onward. It cannot reconstruct past price history. Billing a service cycle starting before this baseline must be reviewed/seeded explicitly; the resolver intentionally refuses to guess. It is not safe to generate historical arrears from today's plan amounts.

## Database

The additive pricing schema update is already applied and verified locally. Its completed standalone script was removed; initial setup/tests reuse `server/migrations/subscriptionPricing.js`. It creates price versions and a singleton billing-settings row; no charges, invoices, payments or ledger entries are generated. No separate user command is needed.

Plan/configuration mutations are permission-checked and audited. Plan and price changes commit transactionally. Builds/tests and browser execution have not been run, per user preference.

The focused subscription-pricing migration has been applied successfully to the configured development database.

## Activation and first bills

The additive billing-account schema update is applied and verified locally. Its completed standalone script was removed; initial setup/tests reuse `server/migrations/billingAccounts.js`. Existing customers start as **needs_review**, without charges, payments or invented arrears. Open their account and activate billing with a service start date of today or later. Old amounts owing must be reviewed and posted as explicit debit adjustments with a reason, not inferred from today's prices. A legacy customer with an unknown plan needs its plan corrected before activation.

New active monthly customers joining today or in the future are enrolled from their joined date. Backdated registrations, inactive customers, and non-monthly plans require review. An active account's joined date is locked; accounts with posted ledger entries also retain their joined date.

Activation snapshots the first-month policy and currently applicable monthly rate. Future-start cycles are re-snapshotted when service begins. The bill stores the plan/name/rate/service dates, first-month calculation, actual month/service days, issue date, due date and final charge in integer pesewas. Proration includes the starting service day and rounds to the nearest pesewa. A bill is issued only after its calendar month is complete; grace days run from its actual issue date.

Inactivating a customer prevents future cycles: an already started/frozen service cycle is billed before billing is paused; a not-yet-started cycle is paused without charge. Cancellation-specific proration is not implemented.

## Runs and automatic billing

**Generate Due Bills** is an explicit confirmed action. It processes only activated monthly accounts and completed service months. Database uniqueness on customer/service period plus account row locking protects against duplicate bills across retries/workers. Processing is bounded to 250 eligible accounts per run and 24 catch-up periods per account; rerun if more remain. Missing historical prices and unsupported cycles hold accounts for review instead of guessing a charge.

Automatic billing defaults to **off**. Administrators may enable it under Configuration → Billing. The server checks every 15 minutes while running. No external cron, gateway or always-on worker is provisioned; keep the server online. Scheduled operational plan changes are synchronised by this task even when automatic charging is disabled. Customer/account reads use effective plan history so they don't need to wait for that sync.

## Ledger safeguards

- All amounts are GHS, stored as integer pesewas. Debits increase what is owed, credits decrease it. Negative balances are available customer credit.
- Payments and discounts/credit adjustments are different entry types, so Total Paid does not count discounts as money collected.
- Credits, including advance payments, settle oldest outstanding charges first; unused credit carries forward. Bill settlement values are rebuilt transactionally after a posting or reversal. Debit adjustments also consume available credit according to charge date.
- Entries are not edited/deleted. Reversing an entry appends its opposite, records the reason, and excludes the reversed pair from current allocation; reversing a bill marks it voided without allowing duplicate automatic regeneration of the same period.
- Payment/adjustment requests carry idempotency keys and fingerprints. Retrying the same request returns its original result; reusing a key with different details is rejected. Non-cash payments require a transaction reference; method/reference duplicates are also rejected across accounts, even when a different request key is used.
- Account row locks serialize posting, reversal, activation and billing. Mutations are audited with actor and reason. Financial endpoints allow Admin, Super Admin, Manager and Accountant roles only. Other staff can register clients but cannot change an existing client's plan.
- Statements run in posting order, not user-entered transaction date. Backdated manual entries retain their recorded transaction date and posting/audit trail. Future-dated payments/adjustments are not allowed.

## Remaining scope / verification

The financial account screens are staff-only. A customer login must be explicitly linked to its customer record before self-service statements can be exposed. The customer payment view now offers five-digit-ID payment at `/pay` and in the portal, without exposing statements/history or treating an ID as authentication. A private payment capability provides access only to that session's payment/receipt. Staff can print/share statements and receipts. Do not grant customer-role users the all-accounts financial API.

Quarterly/yearly billing alignment, gateway refunds/chargebacks, customer portal identity linking and the remaining financial-report screens are separate work. Direct-MoMo Paystack collection, verification/reconciliation and signed webhooks are implemented; USSD is an informational payment alternative only, not an integrated backend. Old financial report/template pages outside this change may still contain mock data.

On the user's explicit test request, 21 billing integration tests passed against real MySQL in an isolated disposable database. Coverage includes money/date handling, activation, arrears safeguards, full-month/prorated charges, price/plan changes, credits, payment/invoice reversals, role/JWT checks, concurrency, idempotency, automatic-billing opt-in and transaction rollback. The temporary database was removed; application customer/financial data was not modified.

The client production build, shared UI smoke checks and focused billing/customer UI lint checks also passed. A JSX closure error in the automatic-billing switch was found and fixed. Build warnings remain for legacy Sass API usage and a large JavaScript chunk. Browser/device testing (including Google Maps, camera/GPS, actual print dialogs and end-to-end user interactions) remains outstanding before production use.

To rerun on request: `npm run test:billing` from `server/`. This uses Node's built-in test runner and existing MySQL credentials, requires permission to create/drop its uniquely named `rytclean_billing_test_*` database, and never posts to the running application API. The test-only server uses an ephemeral localhost port and its own JWT secret. Tests control session time only in the temporary database, not the real server clock or application DB. No external test framework is installed.
