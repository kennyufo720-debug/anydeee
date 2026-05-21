# Anydeee Database Setup

This project uses Vercel Serverless Functions with a Postgres-compatible `DATABASE_URL`.
The same API layer works with Supabase, Neon, Vercel Postgres, or any pooled Postgres URL.

## 1. Create a staging database

Recommended quick options:

- Supabase: create a new project and copy the pooled connection string.
- Neon: create a new project and copy the pooled connection string.

Use a staging/test project first. Do not put production user data into a temporary database.

## 2. Run the schema

Open your database SQL editor and run:

```sql
-- paste sql/schema.sql here
```

The schema creates:

- `users`
- `sessions`
- `orders`
- `transactions`
- `admin_audit_logs`

## 3. Configure Vercel environment variables

Set these variables in Vercel Project Settings:

```env
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=require
AUTH_SECRET=use-a-long-random-string-at-least-24-characters
DATABASE_SSL=true
```

`AUTH_SECRET` is used to hash session tokens before storing them. Rotate it carefully:
rotating this value invalidates existing sessions.

## 4. API endpoints

- `GET /api/health` checks whether the database is configured.
- `POST /api/register` creates a user and sets an HttpOnly session cookie.
- `POST /api/login` validates credentials and sets an HttpOnly session cookie.
- `GET /api/me` returns the current session user.
- `POST /api/logout` destroys the current session.
- `GET /api/orders` lists current user orders.
- `POST /api/orders` creates a current user order.

## 5. Current scope

This is the first proper database boundary. It moves auth/session away from
front-end `localStorage`, but it does not yet implement production KYC review,
admin RBAC, deposits, withdrawals, or on-chain settlement. Those should be built
as separate server-side APIs on top of this schema.
