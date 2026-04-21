# App Starter Client

React 18 + Vite starter with MUI, Redux, reusable UI helpers, and auth-aware routing.

## Commands

```bash
cd client
npm install
npm start
```

Build:

```bash
npm run build
```

Lint/format:

```bash
npm run lint:fix
npm run prettier
```

## Starter flow

- Public routes: login
- Protected route: `/dashboard/home`
- Auth check endpoint: `GET /api/login/isUserAuth`
- Permissions endpoint: `GET /api/login/my-permissions`

## Notes

- Replace branding in `client/index.html` and login/dashboard views for each new app.
- Keep shared building blocks in `client/src/ui-component` and `client/src/utils`.
