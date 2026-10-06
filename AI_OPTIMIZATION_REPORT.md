# AI Optimization Report

**Project:** ApparelFlow ERP: Cutting Operations & Gatekeeper Verification Terminal
**Author:** [Your Full Name]
**Date:** [Date]

> **How to use this file:** Everything marked `[FILL IN]` or `[VERIFY]` can only be answered by you. Replace those parts with what actually happened in your project, and delete this note. Do not keep any claim you cannot point to in your own code or chat history. Evaluators will compare this report with your commits.

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

### Flaw 3: [FILL IN: a code-level flaw from your own implementation]

> The assessment asks for at least two flaws; the two above come from debugging. A reviewer will also want to see code-level issues. Only include one if you actually met it. Examples of things worth checking in your AI-generated code:
>
> - **RBAC only in the UI:** a hidden button or client redirect with no role check in the API route.
> - **Trusting the request body:** reading `verifierId` or a timestamp from the client instead of the JWT/session.
> - **Weak numeric validation:** `Number(value)` or `parseInt` accepting `"12abc"`, decimals, negatives, or empty strings.
> - **Approval check using only the UI's traffic lights:** the server must recompute RED/YELLOW/GREEN from the stored counts.
> - **Sewing queue filter in JavaScript** after fetching all orders, instead of `where: { status: 'VERIFIED' }` in the query.
> - **Low contrast inputs:** white or light-grey text inside inputs and dropdowns (the assessment's zero-tolerance defect).
> - **Re-render loops or stale state** in the verifier terminal when counts change.

**Template for this entry:**

- **File / function:** `[FILL IN]`
- **What the AI generated:** `[FILL IN]`
- **Why it was wrong or unsafe:** `[FILL IN]`
- **How I found it:** `[FILL IN: manual test, cURL, test failure, code review]`

---

## 3. Human Refactoring

**Debugging and deployment**

- Read the full runtime log entries instead of acting on the truncated summary.
- Corrected `DATABASE_URL` so it contains only the connection string (no quotes, spaces, or `DATABASE_URL=` prefix), and redeployed.
- Generated a fresh `JWT_SECRET` for production rather than reusing the local one.
- Turned off Vercel Deployment Protection so evaluators can open the production URL without a Vercel login, then verified in an incognito window.
- Used a stable production domain in the README and submission instead of per-deployment URLs.

**Code hardening** `[FILL IN: replace with what you really changed]`

- Moved business rules (traffic-light status, wastage %, allowed state transitions) into plain functions so they can be unit tested. `[VERIFY]`
- Added server-side validation for all inputs (positive integers only, required fields, mandatory rejection note). `[VERIFY]`
- Recomputed component status on the server before approval instead of trusting client-provided statuses. `[VERIFY]`
- Fixed input and dropdown contrast: dark text on light backgrounds in default, focus, and open states. `[VERIFY]`
- `[FILL IN: any other change]`

**Testing** `[VERIFY]`

- Automated tests for: all-GREEN approval, RED shortage blocked, rejection without a note, non-verifier 403, and sewing queue isolation. Run with `npm test`.
- Manual cURL/Postman checks of 403, 422, and queue isolation against the live URL.

---

## 4. Defensive Architecture

> Describe only what your code does. The structure below follows the assessment's requirements; edit each row to match your implementation.

### State machine

```
CUTTING_IN_PROGRESS → PENDING_VERIFICATION → VERIFIED → SEWING
                              ↓
                          REJECTED → (re-cut) → PENDING_VERIFICATION
```

- Only defined transitions are allowed. A request to move an order to any other status is rejected by the server. `[VERIFY]`
- Status changes happen only inside server routes, never from a client-supplied status field. `[VERIFY]`

### API guards

| Guard | Enforcement | HTTP result |
|-------|-------------|-------------|
| Authentication | Session/JWT read on the server for every protected route | 401 |
| Role check | Approve/reject allowed only for `cutting_verifier`; order creation only for `cutting_supervisor`; sewing endpoints only for `sewing_supervisor` | 403 |
| Hard stop | Server recomputes status for every component; approval is refused if any is RED, missing, or uncounted | 422 |
| Rejection note | Reject requires a non-empty note | 400 / 422 |
| Input validation | Positive whole numbers only; empty, negative, decimal, and non-numeric values rejected | 400 / 422 |
| Query isolation | Sewing queue query uses `status = 'VERIFIED'` at the database level | n/a |
| Identity | Verifier ID and timestamps come from the session, never from the request body | n/a |

### Audit trail

- On approval, the verifier's user ID, timestamp, component variances, and wastage % are written to `verification_logs`. `[VERIFY]`
- Fabric Wastage % = ((Actual Fabric Used − Expected Fabric) ÷ Expected Fabric) × 100, computed on the server. `[VERIFY]`
- No route updates or deletes audit rows once written. `[VERIFY]`

### Why the UI is not the security boundary

Disabled buttons, hidden tabs, and redirects only improve usability. Every rule above is also enforced in the API, so a direct cURL or Postman request cannot bypass it.

---

## Closing Note

AI tools sped up setup and debugging, but they also produced a confident wrong diagnosis (Flaw 1) that I only caught by reading the full error. I treated AI output as a draft: I verified it against logs, tests, and direct API requests before keeping it.
