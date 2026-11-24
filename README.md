# RytClean

Cleaner Today, Greener Tomorrow.

## What is included

- React 18 + Vite client with MUI, Redux, routing, and reusable custom components.
- Express + MySQL server with JWT authentication endpoints.
- Protected routes and permission guard wired out of the box.

## Quick start

1) Install dependencies

```bash
cd client
npm install
cd ../server
npm install
```

2) Configure environment files

- Copy `client/.env.example` to `client/.env`
- Copy `server/.env.example` to `server/.env`

3) Initialize database

```bash
cd server
node setup_db.js
```

Default login: `admin` / `admin123`.

4) Run both apps

```bash
cd server
npm run devStart
```

```bash
cd client
npm start
```

Client: `http://localhost:8101`
Server: `http://localhost:3101`

## Google Maps

Set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` in `client/.env`.
Enable Maps JavaScript API and Places API (New), restrict the browser key to your websites, then restart the client.
See [Google Maps integration](docs/google-maps.md) for features, configuration and limitations.

## Client billing

Open **Manager → Client Billing**, or the wallet action on a customer row, for account statements, bills, payments and receipts.
Existing accounts require explicit monthly billing activation; the migration does not create historical arrears.
Automatic billing is off by default and can be enabled under **Admin → Configuration → Billing**.
See [subscription billing](docs/subscription-billing.md) for activation, scheduling, supported cycles and financial safeguards.
