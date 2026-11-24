# Customer payments, Paystack and staff collections

## Customer workflow

- Open **`/pay`** (no login required), choose **Pay with Customer ID** on the login screen, or use Customer → Payments. Enter the immutable five-digit customer ID, then confirm the full uppercase name/ID, amount, payment wallet number, network and a payment contact email.
- Customer registration email remains optional. Paystack requires a contact email for this payment; it does not update the customer's stored email. The payer's wallet can belong to someone paying on the customer's behalf.
- Direct MoMo follows the reference project's `/charge` and `/charge/submit_otp` structure: MTN (`mtn`), Telecel (`vod`) and AT Money (`tgo`), GHS integer pesewas, phone approval/OTP, followed by independent server verification. Never collect a wallet PIN in the app.
- Online amounts range from GHS 1.00 to GHS 100,000.00, with at most two decimals. Partial and advance payments are allowed and use the same oldest-first ledger allocation as staff collections. A payment does not activate billing, generate an invoice or change a plan.
- Only a verified success produces a printable/save-as-PDF receipt. Pending, uncertain, mismatched and failed requests are not receipts. Customer receipts can show later office-ledger reversal, which is not a provider refund.
- **Alternative: dial `*412*99#`, follow the prompts and keep the five-digit customer ID ready.** This is clearly displayed in checkout, on the login screen and on receipts. **No USSD receiving endpoint, callback, menu or reconciliation integration has been added.** Staff must review any USSD collection before recording it manually; do not assume it has automatically credited the app.

## Privacy and recovery

A five-digit ID is a payment destination, not authentication. At the user's request, lookup shows the full uppercase customer name to confirm who is being paid, plus a random private payment-session token; it never returns phone/email/address, debts, statements or past payments. This intentionally makes the name discoverable by customer ID. Customer-login-to-account linking remains unfinished and the staff all-account APIs remain protected.

Only the session that started a payment can poll it, submit its OTP or obtain its receipt. Tokens expire after 24 hours and only their SHA-256 hashes are stored in the database. The browser retains the capability and reference in **sessionStorage**, not URLs/localStorage. This is sensitive bearer access: use HTTPS and shared-device hygiene. Staff can review/reverify a transaction if a session is lost/expired. The reference alone does not grant receipt/history access.

Resume an existing request after a network interruption. Request keys are persisted before submission, and a session-scoped recovery endpoint finds the existing attempt. Never start another charge because approval is slow. Recent unresolved payments for the same customer block another charge for 30 minutes. Public lookup/charge/OTP/status routes have process-local IP limits; production needs trusted proxy configuration, a shared rate limiter/WAF and appropriate abuse monitoring. An ID lookup is not a substitute for strong identity verification.

## Staff collections, records and invoices

- Accountant → Payments / Client Billing → Client Account → **Record Payment** records a collection on the customer's behalf: **Cash, MoMo / Mobile Money, Cheque, Bank Wire, Bank Transfer or Other**. Non-cash methods require a reference; use the description to explain Other. This form records money already received; it never initiates a gateway charge or clears a cheque.
- Source and collector are set server-side from the authenticated staff member, not caller-supplied labels. Collector names are snapshotted; original staff IDs remain in the audit trail. Existing manual entries derive their collector from the retained user record without rewriting ledger amounts.
- **Payments / Receipts** combines verified live client Paystack payments and staff collections, with source/method/status filters and collector search. Print receipts directly from the table or the customer's Payments tab; successful staff entry opens that tab.
- **Paystack Transactions** separately lists all locally started attempts, including pending, OTP, unknown, failed, review, successful and test-mode attempts. A successful live attempt links to its ledger receipt. **Verify** independently rechecks the existing transaction and never issues a second charge. Office users can inspect the relevant account. This is not an import of unrelated transactions from the reference merchant account.
- The accountant can already generate an individual client's invoices using **Generate Due Bills** in their account, or generate all due bills. Only activated monthly accounts and completed calendar months are eligible; no invented arrears or current-month advance invoices. Existing invoices can be printed directly from Bills or viewed/printed within the account. An opening debit adjustment is not an invoice.
- Corrections remain immutable ledger reversals with a reason. A reversal does **not** refund Paystack, cancel a cheque or reverse a bank transfer. Provider refunds/chargebacks/disputes need a separate implementation and deliberate accounting policy.

## Verification and duplicate safeguards

1. Store the expected customer, amount, environment and random server-generated reference **before** calling Paystack. Lock the customer while preparing an attempt; retain request fingerprints and uniqueness. A timeout is uncertain, not a failed payment to blindly resubmit.
2. Verify using `GET https://api.paystack.co/transaction/verify/:reference`. Require success, exact reference/amount, GHS currency, the original test/live domain, valid non-future payment timestamp and matching RytClean/customer metadata. Mismatches require office review and do not credit the ledger.
3. Lock customer then payment, append the payment to the existing immutable ledger, rebalance, queue the optional payment SMS and mark the gateway row posted in **one transaction**. Reference/request uniqueness and row locks prevent duplicate credit across polling, signed webhooks, worker runs and office verification. Reconciliation retains the provider's actual payment date rather than its later posting date.
4. Webhooks authenticate the **raw request bytes** using timing-safe HMAC-SHA512 and then independently verify the reference. They do not trust callback amounts alone. Invalid signatures cannot post anything. Other merchant/application references are ignored, never imported automatically.
5. The server checks up to ten pending/uncertain attempts each minute while running, without overlapping runs in one process. It only verifies existing requests, never retries charge submission. Multiple processes can verify concurrently but cannot credit twice. Review states are excluded from automatic retry; staff can deliberately reverify after investigation. HTTP 200/charge acknowledgement alone never means a posted payment.

## Credentials and deployment

`PAYSTACK_SECRET_KEY` lives only in ignored **`server/.env`**. On the user's request the reference project's existing credential was copied there privately; it was not printed, committed or placed in the frontend. **That reference credential is LIVE: customer-approved charges collect real money for the configured reference merchant. This is not a simulated demo.** Per the user's updated preference, the customer UI no longer shows the live-payment/demo warning or requires a separate real-money acknowledgement. The normal customer/amount confirmation and phone approval remain; test mode remains clearly labelled. No live provider request was made during implementation/testing. Use your own `sk_test_` key for a no-money sandbox, or replace it with the client's own merchant credentials when authorised, then restart the server.

Test-mode successes appear in the gateway register and have **TEST ONLY — NOT A PAYMENT RECEIPT** printouts. They never alter real customer balances, invoice settlement, Total Paid or SMS outbox. Do not use real-money demonstrations where a sandbox is intended.

The webhook path is **`POST /api/customer-payments/webhook`**. For deployment configure its publicly reachable HTTPS URL in the appropriate merchant's Paystack dashboard with the account owner's consent; no reference-account dashboard setting was changed. Local outbound polling/reconciliation works without a public webhook. The backend must remain running. Cross-merchant credential swaps cannot verify old attempts from the original merchant; reconcile pending transactions before changing credentials.

Public routes under `/api/customer-payments`: `GET /config`, `POST /lookup`, `POST /charge`, `POST /otp`, `GET /current`, `GET /status/:reference`, and the signed webhook. Financial staff APIs: `GET /api/billing/gateway-payments` and `POST /api/billing/gateway-payments/:id/verify`. Financial routes now also recheck the current active database role, not just token role claims.

The reusable `server/migrations/customerPayments.js` is used by setup and disposable tests. Its additive fields/tables were applied directly locally and repeat application verified; existing customer, invoice, ledger, fuel and SMS row snapshots stayed unchanged. It creates no real payment/session/charge, bill or SMS. Protect stored wallet/contact details and private session capabilities in backups; agree retention/cleanup before deployment. No automatic financial/history deletion is enabled.

## Checks and limitations

Run `npm run test:billing` inside `server/` and `node scripts/check-payments-ui.cjs` inside `client/`. Tests use synthetic credentials, mocked Paystack/SMS transport, a disposable database and isolated HTTP server; they never read/use the reference key for provider calls. Coverage includes privacy/session scoping, validation/confirmation, exact amounts, concurrency/idempotency, uncertainty/recovery, OTP, raw-body signatures, verification mismatches, test-mode isolation, atomic crediting, reconciliation, staff provenance and current-role checks.

Live Paystack credential/account/channel acceptance, real phone approval/OTP, merchant settlement, public webhook delivery, print dialogs and full browser/mobile interactions have **not** been verified. No production build or real charge/SMS was run. Customer identity linking, card/hosted checkout, refunds/chargebacks and USSD backend remain separate work.
