# ApparelFlow ERP: Cutting Operations & Gatekeeper Verification Terminal

Full-stack implementation of the Cutting Verification checkpoint for ApparelFlow ERP (Webtezza Software Engineering Intern Assessment).

**Live URL:** https://YOUR-APP.vercel.app
**Repository:** https://github.com/YOUR-USERNAME/apparelflow-erp

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

[2-4 sentences: how the app is structured, e.g. API routes under `app/api`, domain logic in `lib/`, middleware for auth.]

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
git clone https://github.com/YOUR-USERNAME/apparelflow-erp.git
cd apparelflow-erp
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
JWT_SECRET="generate with: openssl rand -base64 32"
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

[Short tree of the key folders: app/api, lib, prisma, tests.]

## AI Usage

See [AI_OPTIMIZATION_REPORT.md](./AI_OPTIMIZATION_REPORT.md).