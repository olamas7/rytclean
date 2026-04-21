# RytSales POS - Agent Instructions

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

## No Tests Configured

No Jest, Vitest, or other test frameworks are set up. Do not assume test commands exist.

## Database Credentials

Both `server/.env` and `server/db.js` contain hardcoded credentials (`olamas`/`olabody55`). Do not commit real credentials.

## Server DB File Hardcoding Issue

`server/db.js` hardcodes credentials instead of reading from `.env`. Keep them in sync if changing.
