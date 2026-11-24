# RytSales POS - Agent Instructions

## Current RytClean completion standards (user-approved)

- Updated verification preference: do not run production builds unless explicitly requested. Run relevant tests and quick syntax checks proactively for code changes; keep checks focused and avoid repetitive unrelated validation. State what was and was not verified.
- Local-development database updates: apply requested feature schema changes directly and verify them rather than leaving standalone `migrate_*.js` scripts or manual update tasks for the user. Remove completed one-off runners. Keep reusable schema modules required by `server/setup_db.js` and isolated tests; never reset application data or create real bills/payments/SMS as part of schema setup.
- This app is now RytClean waste management, with a mixture of live APIs and mock screens. Older POS routes and frontend-only planning documents are historical, not the current completion scope.
- Use normal MUI `Table` components through `utils/controls/Tables`, NOT DataGrid. Do not introduce new DataGrid usage.
- Table visual standard is the user's reference screenshot: rounded white container, left-aligned title/count with compact search/filter controls alongside, secondary toolbar actions right-aligned, pale blue-grey headers, thin row separators, small navy text, bold primary/muted secondary text, dotted status pills and compact outlined icon actions. Reuse `TableToolbar`, `TableFilter`, `TablePrimaryText` and `TableActionButton`; do not add fake export/print buttons just to match the screenshot.
- New customer IDs are immutable server-generated random five-digit numbers (10000–99999), with database uniqueness and collision retries. Preserve legacy IDs and pickup links. Client categories are configurable under Admin → Configuration; customer category, joined date (defaults to today in Ghana), and optional location description are persisted. See `docs/customer-details-migration.md`.
- Client/customer names must be uppercase: normalise input and server writes, and display legacy names in uppercase without requiring a bulk database rewrite.
- Customer email is optional on create/edit. Validate its format only when provided; allow an empty string in storage. User Manager does not require an email field.
- Customer phone numbers must contain exactly 10 digits, including any leading zero. Enforce numeric input and the 10-digit limit in the client and validate the exact length on the server; international prefixes/separators are not accepted.
- Customers can have one optional house/frontage photo: capture/select through `HousePhotoField`, compress and preview before saving. Uploads are validated JPG/PNG/WebP, max 5 MB server-side, stored privately in `server/uploads/customer-house-photos` and read through the JWT-protected customer photo endpoint. Never expose house photos through the public images directory or commit uploads. Customer and photo metadata save transactionally; back up the uploads directory alongside the database.
- Customer create/edit is inline navigation (`?view=new` / `?view=edit&customer=ID`), not a registration popup. Keep registration concise: no long static instruction paragraphs; retain validation errors and short actionable GPS/upload warnings. Customer table groups Category/Zone and Plan/Joined into two-line cells and uses larger 14px primary text.
- App section/create/edit/detail navigation is inline, not a navigation popup. Reuse `utils/useInlineNavigation` for URL-backed sections and `PageHeader inlineNavigation={inline.navigation}` for the shared conditional Back control; do not add page-specific Back buttons or blindly navigate out of the app with history. Declare nested parents, retain unrelated query parameters, and block Back/Cancel during saves. Root views show no Back control. Confirmations and media/map previews may remain dialogs. Manager → Settings stays last in that menu. See `docs/inline-navigation.md`.
- Monthly subscription billing/ledger is implemented in `server/services/billingAccounts.js` and `/api/billing`, with Manager → Client Billing and per-customer wallet/account views. Bills are in arrears and use frozen plan/rate/policy snapshots. Use integer pesewas and immutable postings/reversals, idempotency keys, duplicate payment-reference checks and customer row locks. Plan switches take effect next month using `customer_plan_history`; price changes use `plan_prices`, never raw `plans.amount` for old bills. Existing clients require explicit billing activation; no inferred arrears. Automatic billing defaults OFF and checks every 15 minutes when enabled. Quarterly/yearly billing and customer-login linking remain unfinished. Read `docs/subscription-billing.md` before modifying finance code.
- Customer payments use `/pay`, `server/services/customerPayments.js` and reusable `customerPayments` schema. A five-digit ID permits a payment destination lookup with full uppercase name (user-approved), NEVER financial-history access. Private session capabilities bind OTP/status/receipt; verify Paystack reference, integer amount, GHS, environment, timestamp and app/customer metadata before atomic ledger posting. Raw-body HMAC webhooks and a verification-only worker cannot double-credit or automatically resubmit uncertain charges. Staff methods are cash/MoMo/cheque/bank wire/bank transfer/other, with server-recorded collector/source; never accept a manual Paystack source. Test-mode payments never credit real balances or queue SMS. The privately copied reference Paystack key is LIVE; per updated user preference, omit the customer-facing live/demo warning and separate real-money acknowledgement, retaining normal customer/amount confirmation and test-mode labels. Tests always mock transport and use synthetic keys. Display `*412*99#` as an alternative but do not add USSD receiving/reconciliation until requested. Read `docs/customer-payments.md` before payment changes; refunds/chargebacks and customer identity linking remain unfinished.
- All action buttons must use the shared custom loading button `LdButton` from `utils/myButtons`; wire real pending state for asynchronous actions and prevent duplicate submissions. Native table sort/pagination and close/navigation icon controls can retain their semantic MUI controls.
- SMSOnlineGH automation is configured under Admin → Configuration → SMS; automatic/event switches default OFF. Manager → SMS Notifications contains bulk campaigns and shared notification history (Manager/Admin/Super Admin only). Deliberately confirmed bulk sends work independently of the automatic switch; preview/selection confirmation, snapshot validation and campaign idempotency prevent duplicate/unreviewed sends. Host/key/sender stay in server environment variables, never writable client settings. Transactional outbox hooks isolate SMS failures from customer/payment saves; worker claims prevent duplicate sends, and uncertain submissions are not automatically retried. HTTP 200 means submitted/unverified, NOT delivered. See `docs/sms-notifications.md` before modifying SMS; tests must mock transport and never send paid messages.
- Prefer shared controls, theme colours, typography and spacing over per-page styling. Apply the checklist in `docs/app-completion-standards.md` as each page is completed.
- Finish each requested page with responsive layout, accessible labels/focus, validation, consistent status/date/GHS formatting, and loading/empty/error states. Explain disabled actions and show readable names before IDs.
- Replace mock data and fixed customer/driver identities with authorised API data as the relevant page is completed; do not present mock actions as persisted success.
- Maps now use the native Google Maps JavaScript API via `services/googleMaps` and `ui-component/maps/`. Reuse the singleton loader, map/overlay components and Ghana-restricted Places (New) search. Preserve coordinates and GeoJSON (`[lng, lat]`); use native editable Polygon/Polyline, NOT the retired Drawing Library. Manual pin/coordinate/landmark entry remains available. Browser credentials belong in `client/.env`; do not print them. Fleet browser tracking is implemented separately below; calculated road routes/native background tracking remain unfinished.
- Fleet operations use `/api/fleet`, `server/services/fleetOperations.js`, reusable `fleetOperations` schema and `views/Management/Fleet/`. Route assignments freeze geometry/customer stops/fuel baselines and reserve driver/vehicle uniquely. Driver and supervisor duties are merged: legacy Supervisor is a driver-role alias scoped by linked driver identity, not old supervisor assignments; new assignments automatically retain the driver's user ID in `supervisor_id`. Browser GPS is foreground/permission-based with explicit stale/gap/rejection states; proximity marks visited, NEVER collected. Complaint-flagged confirmations require private photo evidence in `server/uploads/pickup-evidence`, JWT/assignment-protected. Accountant → Fuel & Cheques uses `server/services/fuelRegister.js` and reusable `fuelRegister` schema: vehicle/driver/date/litres/unit price/cheque, exact half-up calculated totals, optional validated route links and immutable reversals. Reports aggregate issued fuel and route distance independently; no inferred trip allocation. Legacy amounts remain unchanged. Fuel issued is not consumption/proof of fraud; cheque records are not bank clearance or customer billing. See `docs/fleet-operations.md` before modifying tracking/evidence/fuel. Native Android/tracker integration, field pilot and customer-login complaint linking remain unfinished.
- Preserve existing user changes. General component preparation is approved; complete individual pages according to subsequent user commands. Do not perform database migrations or enable paid Google services without the relevant implementation request.

## Architecture

- **Client** (`client/`): React 18 + Vite + Redux Toolkit + MUI
- **Server** (`server/`): Express.js + MySQL (mysql2)
- **No workspace root scripts**: Run commands inside each subdirectory

## Developer Commands

### Client
```bash
cd client
npm install           # Use npm, not yarn
npm start             # Dev server at http://localhost:8101 (proxies /api to server:3101)
npm run build         # Production build to dist/
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix lint errors
npm run prettier      # Format code (but see Prettier Conflict below)
```

### Server
```bash
cd server
npm install           # Use npm
npm run devStart      # Nodemon dev server at port 3101
npm start             # Plain node start
node setup_db.js      # Initialize MySQL database (run once)
```

## Database Setup

1. Ensure MySQL is running with credentials from `server/.env`
2. Run `node server/setup_db.js` to create `ryt_sales` database and default admin (admin/admin123)

## Prettier Conflict

**Important**: `.prettierrc` uses `tabWidth: 2` but `.eslintrc` prettier rules enforce `tabWidth: 4`. Run `npm run lint:fix` first, then `npm run prettier` to format consistently.

## API Conventions

- Server port: `3101`
- Client proxies `/api/*` to `http://localhost:3101`
- JWT token sent via `x-access-token` header
- Multi-tenant via `x-shop-db` header (defaults to `ryt_sales`)
- All API responses use `{ code: 1, ... }` for success, `{ code: 2, message: "..." }` for errors

## Key API Routes

| Route | Purpose |
|-------|---------|
| POST `/api/login` | User authentication |
| GET `/api/login/my-permissions` | Get user permissions by role |
| GET `/api/inventory/categories` | List categories |
| POST `/api/inventory/add-product` | Add product |
| GET `/api/inventory/products` | List products (supports `?search=&category_id=&page=&limit=`) |
| POST `/api/sales/checkout` | Process sale |
| GET `/api/sales/history` | Sales history |

## Tests and verification

- No Jest/Vitest framework is installed. Billing integration tests use Node's built-in runner: `npm run test:billing` inside `server/`.
- The combined suite includes fleet integration tests; `npm run test:fleet` focuses on those. They use the disposable database and a uniquely named temporary evidence directory, never real trips/photos/fuel/SMS. Client fleet/navigation render checks: `node scripts/check-fleet-ui.cjs` and `node scripts/check-inline-navigation.cjs` inside `client/`.
- Billing tests create and remove a uniquely named temporary MySQL database, run a test-only localhost API with its own JWT secret, and leave application data untouched. They require CREATE/DROP DATABASE permission.
- Shared UI smoke checks: `node scripts/check-shared-ui.cjs` inside `client/`.
- Run relevant tests and syntax checks after changes. Do not run production builds unless the user explicitly requests one.

## Database Credentials

Both `server/.env` and `server/db.js` contain hardcoded credentials (`olamas`/`olabody55`). Do not commit real credentials.

## Server DB File Hardcoding Issue

`server/db.js` hardcodes credentials instead of reading from `.env`. Keep them in sync if changing.
