# Linda LIM POS Web Starter

This workspace contains a starter web interface for an existing VB.NET Windows Forms system backed by MySQL.

## Structure

- `client/`: React + Vite frontend
- `server/`: Express API + MySQL connection layer
- `pos-mobile/`: React Native POS terminal (Windows/Android tablets)

## What this starter already does

- Connects a Node.js API to your existing MySQL database
- Exposes health, login, session, and schema preview endpoints
- Uses the existing `users` table for sign-in with SHA-256 password compatibility
- Shows a React login page and protected dashboard that can list tables and preview sample rows
- Gives you a clean base to migrate WinForms screens one module at a time

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Fill in the MySQL values for the same database used by your VB.NET application.
3. Add a strong `SESSION_SECRET` value.
4. Make sure the `users` table contains `user_id`, `username`, `password_hash`, `role`, `full_name`, `ACTIVE`, and `created_at`.
5. Confirm the old VB.NET app uses plain SHA-256 of the password text. If it applies transformations before hashing, mirror that logic in `server/services/userService.js`.
6. Start the API:

```powershell
npm run dev --prefix server
```

7. Start the React app:

```powershell
npm run dev --prefix client
```

8. Open `http://localhost:5173`.

## API endpoints

- `GET /api/health`: API status and database connection check
- `POST /api/auth/login`: start a session using the existing `users` table
- `GET /api/auth/me`: read the current signed-in user from the session cookie
- `POST /api/auth/logout`: end the current session
- `GET /api/tables`: list tables in the configured database after sign-in
- `GET /api/tables/:tableName/rows?limit=12`: preview rows from one table after sign-in

## Suggested next work

1. Identify the first WinForms screen you want to replace after login.
2. Add role-based page routing based on the `role` value from the `users` table.
3. Replace the generic dashboard with business-specific React pages.
4. Later, if desired, migrate SHA-256 passwords to a stronger scheme after compatibility is proven.