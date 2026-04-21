# App Starter Template

Reusable full-stack starter for quickly bootstrapping new apps.

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
