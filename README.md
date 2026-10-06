# ApparelFlow ERP: Cutting Operations & Gatekeeper Verification Terminal

Full-stack implementation of the Cutting Verification checkpoint for ApparelFlow ERP (Webtezza Software Engineering Intern Assessment).

**Live URL:** https://apparelflow-erp-vert.vercel.app/login
**Repository:** https://github.com/Uthikshaan/apparelflow-erp

## Demo Credentials

| Role | Email | Password | Can do |
|------|-------|----------|--------|
| Cutting Supervisor | supervisor@apparelflow.com | Supervisor@123 | Create cutting orders, track progress |
| Cutting Verifier | verifier@apparelflow.com | Verifier@123 | Count components, approve/reject batches |
| Sewing Supervisor | sewing@apparelflow.com | Sewing@123 | View verified batches, start sewing |

## Tech Stack

- Next.js (App Router) + TypeScript
- PostgreSQL (Neon) with Prisma ORM
- JWT authentication (httpOnly cookie)
- Vitest for automated tests
- Deployed on Vercel

## Architecture Summary

ApparelFlow is a Next.js (App Router) application written in TypeScript. Each role has its own page under `app/` (`supervisor`, `verifier`, `sewing`), and all data changes go through API routes under `app/api/` (auth, orders, cutting verification, sewing queue). Business rules live in `lib/`: `verification.ts` holds the traffic-light and wastage logic and the approval rules, `sewing.ts` holds the Sewing Queue query, and `auth.ts` handles JWT sessions and role checks, so every route enforces permissions on the server. Data is stored in PostgreSQL (Neon) through Prisma, with migrations and the seed script in `prisma/`. Automated tests with Vitest are in `tests/` and run against an in-memory fake Prisma client.

### State Machine

`CUTTING_IN_PROGRESS → PENDING_VERIFICATION → VERIFIED → SEWING`
`PENDING_VERIFICATION → REJECTED → (re-cut) → PENDING_VERIFICATION`

(Adjust to match your actual status names.)

### Server-Side Security

| Rule | Enforcement |
|------|-------------|
| Non-verifier approving a batch | 403 Forbidden |
| Approval with any RED, missing, or uncounted component | 422 Unprocessable Entity |
| Rejection without a note | 400/422 validation error |
| Sewing queue | Query filters `status = 'VERIFIED'` in the database |
| Verifier ID and timestamp | Taken from the JWT/session, never from the request body |
| Audit trail | Written once on approval (verifier ID, timestamp, variances, wastage %) |

### Traffic-Light Logic

- GREEN: actual == expected
- YELLOW: actual > expected (batch may proceed)
- RED: actual < expected (approval blocked)

Fabric Wastage % = ((Actual Fabric Used − Expected Fabric) ÷ Expected Fabric) × 100

## Database Schema

| Table | Key columns | Relationships |
|-------|-------------|---------------|
| users | id, email, password_hash, role, full_name, created_at | Has many orders and verification logs |
| recipes | id, recipe_code, name, category, std_fabric_yards, wastage_cap | Has many components and orders |
| recipe_components | id, recipe_id, component_name, pieces_per_garment, image_url | Belongs to recipe |
| cutting_orders | id, order_no, recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by, timestamps | Belongs to recipe and user |
| verification_items | id, order_id, component_id, expected_qty, actual_qty, status | Belongs to order and component |
| verification_logs | id, order_id, verifier_id, decision, rejection_note, wastage_pct, timestamp | Belongs to order and verifier |

Seeded recipes: **REC-BL01 Casual Blouse** and **REC-CT02 Crop Top**.

## Local Setup

```bash
git clone https://github.com/Uthikshaan/apparelflow-erp.git
cd apparelflow-erp
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL="postgresql://neondb_owner:npg_evx9Okz6jmFc@ep-bold-field-b4t3hwwv-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

JWT_SECRET="9a2f2f5ac075b810110440301f201d90edb4424173075f0d16c493945b29718e49e7d3e85232f4329cc5fa14b526bad4"
```

Then:

```bash
npx prisma migrate deploy   # or: npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:3000.

## Running Tests

```bash
npm test
```

Covers: all-GREEN approval, RED shortage blocking, rejection without note, non-verifier 403, and sewing queue isolation.

## Project Structure

app/
  api/
    auth/            login, logout, me
    orders/          create/list orders; [id]/approve, reject, resubmit
    cutting/verify/  verifier submits component counts
    sewing/          queue (VERIFIED only); [id]/start
  login/ supervisor/ verifier/ sewing/ forbidden/    role pages
components/          shared UI (LogoutButton)
lib/
  api.ts             API helpers
  auth.ts            JWT session and role checks
  prisma.ts          Prisma client
  sewing.ts          Sewing Queue query
  verification.ts    traffic-light, wastage and approval rules
prisma/
  schema.prisma      data model
  migrations/        init + status index
  seed.ts            recipes and demo users
tests/
  gatekeeper.test.ts, verification.test.ts, fakePrisma.ts

## AI Usage

See [AI_OPTIMIZATION_REPORT.md](./AI_OPTIMIZATION_REPORT.md).