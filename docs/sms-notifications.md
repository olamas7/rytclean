# SMS notifications (SMSOnlineGH)

Admin → Configuration → SMS manages the automatic-notification switch, six event switches/templates and deliberate paid connection tests. Host and sender ID are read-only, sourced from the server environment. Only Admin/Super Admin can configure automation or send connection tests. Automatic sending defaults **OFF**.

Manager → SMS Notifications has **Bulk SMS** and **Notification History** tabs, accessible to Manager/Admin/Super Admin only. The old recent-history table has moved out of configuration; history now has server-side search, event/status filters and pagination across all messages, including automatic notifications, connection tests and bulk campaigns. Configuration links to that history tab.

## Setup

1. SMS schema updates are already applied and verified locally; no separate user command is needed. Completed standalone update scripts were removed. Initial `setup_db.js` and tests retain reusable schema modules in `server/migrations/`. These add `sms_settings`, `sms_events` and `sms_outbox`; no bills/payments or SMS are generated.
2. Set `SMS_API_KEY` and `SMS_SENDER_ID` in `server/.env`. Set `SMS_API_HOST=api.smsonlinegh.com` (blank/missing uses that default). Use `NAME=value` syntax for every line. Never put the key in client environment variables or source control. The UI shows only whether a key is configured; it never returns it. Sender/host cannot be overridden through SMS settings or API requests; legacy stored senders are ignored.
3. Restart the server and use **Send Test SMS** with your own 10-digit Ghana phone number. A confirmation warns that testing may incur a charge, even while the master switch is off. Unchanged tests reuse an idempotency key while the screen is open; five attempts per administrator per ten minutes are allowed.
4. Enable the desired events and master switch deliberately. The server worker checks every minute while online. No separate background service is provisioned.

The request follows the working `learn_from/server/sms.js`: POST `/v5/message/sms/send`, `{ text, type: 0, sender, destinations }`, JSON/Accept headers and `Authorization: key ...`. Ghana local `0XXXXXXXXX` is converted to `233XXXXXXXXX` for the provider. The host comes only from trusted server environment configuration and must be a hostname (no protocol, path, credentials or port). Timeout: 15 seconds; redirects are disallowed.

HTTPS is the default; its live compatibility is **not verified**. The reference uses plain HTTP. If the provider requires that transport, deliberately set `SMS_API_PROTOCOL=http` on the server and restart. This transmits credentials/message content without encryption and displays a warning in configuration. There is no silent HTTP fallback.

## Events

- **Registration:** new successful registrations only; no historical backfill.
- **Payment received:** actual payment entries only; not credits/debits or idempotent retries. Uses the same `RCPT-ID` as the printed receipt.
- **Bill issued:** once for each new bill, with frozen amount/reference and due date. A fully prepaid bill can still produce an informational bill-issued SMS; reminders require outstanding debt.
- **Due today:** one reminder per outstanding invoice on its due date.
- **Overdue:** one reminder per outstanding invoice at least seven days overdue. Existing unpaid bills are eligible when enabled; there is no weekly repeat.
- **Plan change:** names the scheduled plan and effective date. Cancellation/replacement/already-effective changes suppress stale queued messages. Repeating an identical customer/plan/effective-date change does not produce another notification.

Templates are limited to 1000 characters before personalisation. Supported placeholders are shown per event and validated server-side. Customer names are uppercase; monetary values are GHS with two decimal places. Unicode/long messages can consume multiple paid SMS units.

Opening debit/credit balances do not create invoices, so they do not generate invoice-based due reminders. Automatic opening-debt SMS, pickup/route notifications and delivery webhooks are not included.

## Bulk SMS

- The additive `sms_campaigns` table and `sms_outbox.campaign_id` column/index are already applied and verified locally. Initial setup/tests retain their reusable schema module. Existing automation settings and messages are preserved; the update sends nothing. No separate update command is left for the user.
- Enter an internal campaign title and message. Both active and inactive customers are included by default, including after Reset Filters; optionally filter by status, category, zone, effective plan, or name/ID/phone search. Templates support `{name}` and `{customerId}` only. A preview matches at most 1000 customers; narrow the filters if more match.
- The server snapshots personalised messages/recipients. Invalid Ghana numbers are skipped, duplicate phones are collapsed to the first matching customer, and counts are shown. If a shared phone belongs to several customers, its first matching customer's name/ID is used. Deselect individual recipients or use Select All/Clear Selection. Preview tables use normal shared MUI tables.
- Previews expire after 15 minutes. Customer/phone/message changes are revalidated at confirmation; stale previews must be regenerated. Newly registered customers are not silently added to an existing preview. The draft belongs to its creator and cannot be confirmed by another manager.
- A confirmation with an explicit charge acknowledgement is required. GSM-7/Unicode SMS unit estimates use the final personalised message, not just the template; actual encoding/charges remain provider-dependent. No balance/pricing API is integrated.
- Confirmation atomically queues all selected recipients and audits the campaign. The campaign ID and selection hash make retries/concurrent confirmations idempotent. Retrying the same draft does not send twice; trying a different selection after confirmation returns a conflict. Generating/confirming a new preview is a new paid campaign, even if its text is identical.
- At most 20 previews and five queued campaigns per creator per ten minutes are allowed. Bulk requests enqueue only; the worker submits up to 50 messages per run while the server is online. An obsolete phone is cancelled if it changes before dispatch. Provider failures/timeouts use the same no-blind-retry safeguards as automatic notifications.
- **Deliberate bulk campaigns are independent of the automatic SMS switch and event switches.** Automatic OFF pauses automatic notifications, not explicitly confirmed bulk campaigns. This is stated before confirmation. Provider credentials/sender are still required. There is no bulk cancel/retry UI or scheduling/import/campaign analytics in this first version.
- Campaign drafts retain recipient/message snapshots (including expired drafts) for audit/retry checks. Protect these tables/backups, and agree retention before production. History is shared among authorised managers/admins, not customers or other staff roles. The old admin-only history API remains for compatibility, but is no longer rendered in Configuration.

## Reliability and privacy

- Outbox inserts share the business transaction: rolled-back registrations/payments cannot send. A savepoint isolates notification-storage failures so registrations/payments still save; failures emit a generic server warning. An unavailable outbox can therefore lose a notification rather than lose business data; there is no historical replay.
- Unique event keys prevent duplicate queue entries. Workers atomically claim each row **before** network I/O; uncertain sends are not automatically retried. A crashed send becomes unknown after five minutes when the worker next runs. Review the provider before any manual resend; there is intentionally no blind retry button.
- Before dispatch, reversed payments, voided bills and obsolete plan changes are cancelled. Reminder balances are rechecked/re-rendered immediately before sending; settled/voided bills and inactive customers are skipped. A payment racing the actual network request cannot retract an already submitted SMS.
- Automatic OFF pauses automatic notifications; explicitly confirmed bulk sends still process. Individual disabled events cancel their queued automatic messages when processing resumes. Paused non-reminder messages can resume when re-enabled; due reminders from earlier dates are cancelled. Each worker run processes up to 50 messages and discovers up to 250 reminder candidates. Runs do not overlap within a server process; slow provider calls can reduce throughput below 50/minute.
- The sample establishes only HTTP 200, not provider response acceptance codes. Therefore HTTP 200 is logged as **submitted_unverified**, never “delivered”. Non-200 is failed; transport errors/timeouts are unknown. Actual delivery reports/provider response parsing remain unimplemented. Provider bodies, Axios errors and authentication headers are never stored in logs/API responses.
- Logs contain phone numbers and message contents and are manager/admin-only. Protect database/backups accordingly. History is server-paginated, while stored history is retained; agree a retention policy before production.

## Verification

The additive SMS and campaign migrations were applied successfully to the configured development database. Existing settings were preserved; no messages were queued/sent and no financial postings were made by these migrations.

All **52 billing/SMS integration tests passed**, using mocked Axios transport and synthetic SMS credentials. They never send paid SMS or read credentials from the reference project's `.env`. Coverage includes permissions, settings/template validation, environment-only host/sender configuration, automatic-event hooks, transaction isolation, missing SMS storage, reminders, provider failures, recipient filtering/deduplication, preview expiry/ownership/revalidation, selected audiences, bulk idempotency, independent-worker claims, atomic campaign rollback, history pagination/search and rate limits. Server syntax checks passed for 33 files; focused client lint, shared UI smoke checks and SMS-specific in-memory render checks also passed.

Run `npm run test:billing` inside `server/` (includes server syntax validation). Run `node scripts/check-shared-ui.cjs` and `node scripts/check-sms-ui.cjs` inside `client/` for focused render checks. SMS UI checks verify route registration, tab/initial-state rendering, the history table, role guard and history removal from settings without API calls. Live provider delivery and full browser/mobile interaction remain unverified. Production builds are intentionally not run.
