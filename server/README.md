# RytClean Server

Express + MySQL API backend for RytClean with JWT auth.

## Commands

```bash
cd server
npm install
npm run devStart
```

Initialize database schema:

```bash
node setup_db.js
```

## Environment

Copy `server/.env.example` to `server/.env` and set values.

## Starter endpoints

- `POST /api/login`
- `GET /api/login/isUserAuth`
- `GET /api/login/my-permissions`

## Default admin

- Username: `admin`
- Password: `admin123`

Change it after first login.
