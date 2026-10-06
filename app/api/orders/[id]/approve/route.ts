import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api";
import { evaluate, wastagePct } from "@/lib/verification";

const bodySchema = z.object({
    counts: z
        .array(
            z.object({
                componentId: z.number().int().positive(),
                actualQty: z.number().int().min(0).max(10_000_000),
            })
        )
        .max(100)
        .default([]),
});

export const POST = handle<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
    // 1. RBAC on the server: only verifiers (401 / 403 otherwise)
    const session = await requireRole("cutting_verifier");

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid order id");

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw new ApiError(400, "Request body must be valid JSON");
    }
    const { counts } = bodySchema.parse(raw);
    if (new Set(counts.map((c) => c.componentId)).size !== counts.length) {
        throw new ApiError(400, "Duplicate component in counts");
    }

    const order = await prisma.cuttingOrder.findUnique({
        where: { id },
        include: { items: true, recipe: true },
    });
    if (!order) throw new ApiError(404, "Order not found");
    if (order.status !== "PENDING_VERIFICATION") {
        throw new ApiError(409, `Order is ${order.status}, not pending verification`);
    }

    const validIds = new Set(order.items.map((i) => i.componentId));
    if (counts.some((c) => !validIds.has(c.componentId))) {
        throw new ApiError(400, "Count submitted for a component that is not in this order");
    }

    // 2. THE HARD STOP: any RED or uncounted component => 422
    const ev = evaluate(order.items, counts);
    if (!ev.canApprove) {
        throw new ApiError(422, "Approval blocked: shortage or uncounted component", {
            redCount: ev.redCount,
            uncountedCount: ev.uncountedCount,
            items: ev.results,
        });
    }

    const pct = wastagePct(order.recipe.stdFabricYards, order.targetQty, order.actualFabricYds);

    // 3. Atomic: status change + counts + audit log all succeed or none do
    await prisma.$transaction(async (tx) => {
        const moved = await tx.cuttingOrder.updateMany({
            where: { id, status: "PENDING_VERIFICATION" }, // guards against double-submit races
            data: { status: "VERIFIED" },
        });
        if (moved.count !== 1) throw new ApiError(409, "Order was already processed");

        for (const r of ev.results) {
            await tx.verificationItem.update({
                where: { orderId_componentId: { orderId: id, componentId: r.componentId } },
                data: { actualQty: r.actualQty, status: r.status },
            });
        }
        await tx.verificationLog.create({
            data: {
                orderId: id,
                verifierId: session.userId, // from the session, never the body
                decision: "APPROVED",
                wastagePct: pct,
                // timestamp is set by the database (default now())
            },
        });
    });

    return Response.json({ ok: true, orderNo: order.orderNo, status: "VERIFIED", wastagePct: pct });
});