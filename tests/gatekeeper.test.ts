/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory cookie jar standing in for next/headers
const jar = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "af_session" && jar.token ? { value: jar.token } : undefined),
        set: (_name: string, value: string) => { jar.token = value; },
        delete: () => { jar.token = null; },
    }),
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./fakePrisma")).fakePrisma }));

import { createSession } from "@/lib/auth";
import { POST as approve } from "@/app/api/orders/[id]/approve/route";
import { POST as reject } from "@/app/api/orders/[id]/reject/route";
import { GET as sewingQueue } from "@/app/api/sewing/queue/route";
import { store, queryLog, resetStore, addOrder } from "./fakePrisma";

const SUPERVISOR = 1, VERIFIER = 2, SEWING = 3;

async function loginAs(userId: number | null) {
    jar.token = null;
    if (userId) await createSession(userId); // the REAL session code signs a real JWT
}

function post(handler: any, id: number, body: unknown) {
    const req = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return handler(req, { params: Promise.resolve({ id: String(id) }) });
}

const allGreen = [
    { componentId: 1, actualQty: 50 },
    { componentId: 2, actualQty: 50 },
    { componentId: 3, actualQty: 100 },
    { componentId: 4, actualQty: 50 },
    { componentId: 5, actualQty: 100 },
];

beforeEach(() => {
    resetStore();
    addOrder(1, "PENDING_VERIFICATION");
});

describe("Gatekeeper rules", () => {
    it("Test 1: an order with all GREEN components can be approved by an authenticated Verifier", async () => {
        await loginAs(VERIFIER);
        const res = await post(approve, 1, { counts: allGreen });

        expect(res.status).toBe(200);
        expect(store.orders[0].status).toBe("VERIFIED");
        expect(store.items.every((i) => i.status === "GREEN")).toBe(true);
        expect(store.logs).toHaveLength(1);
        expect(store.logs[0]).toMatchObject({ decision: "APPROVED", verifierId: VERIFIER, orderId: 1 });
        expect(store.logs[0].wastagePct).toBeCloseTo(2.22, 2);
    });

    it("Test 2: an order with at least one RED (shortage) component blocks approval", async () => {
        await loginAs(VERIFIER);
        const counts = allGreen.map((c) => (c.componentId === 5 ? { ...c, actualQty: 80 } : c));
        const res = await post(approve, 1, { counts });
        const body = await res.json();

        expect(res.status).toBe(422);
        expect(body.details.redCount).toBe(1);
        expect(store.orders[0].status).toBe("PENDING_VERIFICATION"); // not moved
        expect(store.logs).toHaveLength(0); // nothing written

        // An uncounted component is blocked too
        const missing = await post(approve, 1, { counts: allGreen.slice(0, 4) });
        expect(missing.status).toBe(422);
        expect(store.orders[0].status).toBe("PENDING_VERIFICATION");
    });

    it("Test 3: rejecting without a reason note is refused by backend validation", async () => {
        await loginAs(VERIFIER);

        for (const note of [undefined, "", "   "]) {
            const res = await post(reject, 1, { counts: [], note });
            expect(res.status).toBe(400);
        }
        expect(store.orders[0].status).toBe("PENDING_VERIFICATION");
        expect(store.logs).toHaveLength(0);

        const ok = await post(reject, 1, { counts: [], note: "Fabric defect on sleeves" });
        expect(ok.status).toBe(200);
        expect(store.orders[0].status).toBe("REJECTED");
        expect(store.logs[0]).toMatchObject({ decision: "REJECTED", rejectionNote: "Fabric defect on sleeves" });
    });

    it("Test 4: non-verifier roles receive 403 Forbidden (and logged-out gets 401)", async () => {
        for (const role of [SUPERVISOR, SEWING]) {
            await loginAs(role);
            const a = await post(approve, 1, { counts: allGreen });
            const r = await post(reject, 1, { counts: [], note: "x" });
            expect(a.status).toBe(403);
            expect(r.status).toBe(403);
        }
        await loginAs(null);
        expect((await post(approve, 1, { counts: allGreen })).status).toBe(401);

        expect(store.orders[0].status).toBe("PENDING_VERIFICATION");
        expect(store.logs).toHaveLength(0);
    });

    it("Test 5: unapproved orders never appear in the Sewing Queue query", async () => {
        addOrder(2, "REJECTED");
        addOrder(3, "IN_PROGRESS");
        addOrder(4, "VERIFIED");
        store.logs.push({ id: 1, orderId: 4, verifierId: VERIFIER, decision: "APPROVED", wastagePct: 2.22, timestamp: new Date() });

        await loginAs(SEWING);
        // Try to manipulate the query string
        const res = await sewingQueue(new Request("http://localhost/api/sewing/queue?status=PENDING_VERIFICATION"), {});
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.orders.map((o: any) => o.orderNo)).toEqual(["CUT-00004"]);
        expect(body.orders.every((o: any) => o.status === "VERIFIED")).toBe(true);
        // The filter is in the database query itself
        expect(queryLog.at(-1)).toMatchObject({ status: "VERIFIED" });

        // Other roles cannot read the queue at all
        await loginAs(VERIFIER);
        expect((await sewingQueue(new Request("http://localhost/api/sewing/queue"), {})).status).toBe(403);
    });
});