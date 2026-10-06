# AI Optimization Report

**Project:** ApparelFlow ERP: Cutting Operations & Gatekeeper Verification Terminal
**Author:** [Your Full Name]
**Date:** [Date]


---

## 1. Tools & Prompting

| Tool | Used for |
|------|----------|
| Claude (Anthropic) | Deployment and debugging help (Vercel, Neon, Prisma), reading runtime logs, README structure, submission checklist, this report's structure |
| [FILL IN: e.g. ChatGPT / Cursor / Copilot / v0] | [FILL IN: scaffolding, schema design, UI styling, test generation] |

**How I prompted:**

- I gave the AI the assessment requirements and asked it for step-by-step plans, then implemented and checked each step myself.
- For debugging, I pasted the real error text from the Vercel runtime logs and asked for a diagnosis, instead of asking for generic fixes.
- [FILL IN: one or two example prompts you actually used, e.g. "Generate the Prisma schema for these six tables" or "Write Vitest tests for the approval route".]

**What I did not delegate:** the final decisions on the state machine, which role may call which endpoint, and what the server must reject. [VERIFY: keep this only if true.]

---

## 2. Flawed / Broken AI Code

### Flaw 1: Wrong diagnosis of the login 500 error (real, from this project)

**Symptom:** Login on the deployed site returned *Internal Server Error*. The Vercel runtime logs showed `PrismaClientInitializationError` on `POST /api/auth/login`, but the message was truncated in the log table.

**What the AI got wrong:** From the truncated line alone, the AI assumed Prisma Client had not been generated during the build, and advised adding `prisma generate` to the build script and a `postinstall` hook. That was a guess based on the most common cause of that error class.

**How I caught it:** I opened the log entry and read the full message. It said the datasource URL *"must start with the protocol `postgresql://` or `postgres://`"*. The real fault was a malformed `DATABASE_URL` value in Vercel's environment variables, not a missing client generation step. The `prisma generate` change would not have fixed it.

**Lesson:** AI diagnoses from partial evidence. The fix is to read the full error and confirm the cause before changing code.

### Flaw 2: Fix that did not take effect because of deployment behaviour (real, from this project)

**What happened:** After correcting the environment variable, the same error kept appearing. Vercel applies environment variable changes only to new deployments, so the running deployment still used the old value.

**How I resolved it:** I redeployed after the change and confirmed the new deployment timestamp was later than my edit. Login then worked.

### Flaw 3: AI-written documentation that did not match the real code

**What the AI generated:** The README template and the architecture text proposed by the AI used state names (`CUTTING_IN_PROGRESS`) and a description of the tests ("run against an in-memory fake Prisma client") that did not match my code.

**Why it was wrong:** My code uses `IN_PROGRESS` as the first status. My tests do not fake the whole application: they call the real API route handlers and the real session/JWT code, and replace only the Prisma database layer. Documentation that misdescribes the system would mislead an evaluator and hide what the tests really prove.

**How I found it:** I compared the AI's text with my folder structure, my route files, and `tests/gatekeeper.test.ts`, then rewrote the README to match what the code does.

---

## 3. Human Refactoring

**Debugging and deployment**

- Read the full runtime log entries instead of acting on the truncated summary.
- Corrected `DATABASE_URL` so it contains only the connection string (no quotes, spaces, or `DATABASE_URL=` prefix), and redeployed.
- Generated a fresh `JWT_SECRET` for production rather than reusing the local one.
- Turned off Vercel Deployment Protection so evaluators can open the production URL without a Vercel login, then verified in an incognito window.
- Used the stable production domain in the README and submission instead of per-deployment URLs.

**Code structure**

- Kept business rules (traffic-light status, wastage %, approval rules) in `lib/verification.ts` and the Sewing Queue query in `lib/sewing.ts`, separate from the route files, so they can be tested directly.
- Put session and role logic in `lib/auth.ts` so every route uses the same checks.
- Added a database migration (`add_status_index`) to index order status for the Sewing Queue query.
- Split order actions into separate routes (`approve`, `reject`, `resubmit`) so each status change has its own guard.

**Testing**

- 9 automated tests with Vitest (`npm test`): 4 for the traffic-light and wastage rules, and 5 for the gatekeeper rules (Tests 1 to 5 from the assessment).
- The gatekeeper tests call the real route handlers and the real session/JWT code. Only the Prisma database layer is replaced by an in-memory fake.

---

## 4. Defensive Architecture

### State machine

```
IN_PROGRESS → PENDING_VERIFICATION → VERIFIED → Sewing started
                       ↓
                   REJECTED → resubmit → PENDING_VERIFICATION
```

Status changes happen only inside server routes (`approve`, `reject`, `resubmit`, and the sewing `start` route). The client never sends a status value.

### API guards (each one is covered by an automated test)

| Guard | Enforcement | HTTP result |
|-------|-------------|-------------|
| Authentication | Session/JWT read on the server | 401 when logged out |
| Role check | Approve and reject allowed only for the Cutting Verifier; Supervisor and Sewing roles are refused; the Sewing Queue refuses the Verifier | 403 |
| Hard stop | The server computes GREEN/YELLOW/RED from the submitted counts; approval is refused if any component is RED or uncounted | 422 |
| Rejection note | Missing, empty, or whitespace-only note is refused | 400 |
| Query isolation | The Sewing Queue query filters `status = 'VERIFIED'` in the database query; a `?status=` URL parameter is ignored | n/a |
| Identity | The verifier ID stored in the audit log comes from the session; the request body contains only the counts | n/a |
| No side effects on failure | A blocked approval leaves the order in `PENDING_VERIFICATION` and writes nothing to the log | n/a |

### Audit trail

- On approval, the server writes a `verification_logs` record with the verifier ID, the decision, and the fabric wastage %. The component statuses are saved on the verification items.
- Fabric Wastage % = ((Actual Fabric Used − Expected Fabric) ÷ Expected Fabric) × 100, computed on the server.

### Why the UI is not the security boundary

Disabled buttons, hidden tabs, and redirects only improve usability. Every rule above is also enforced in the API, so a direct cURL or Postman request cannot bypass it.

---

## Closing Note

AI tools sped up setup and debugging, but they also produced a confident wrong diagnosis (Flaw 1) that I only caught by reading the full error, and documentation that did not match my code (Flaw 3). I treated AI output as a draft and checked it against logs, my own code, and automated tests before keeping it.