import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api";
import { itemStatus, wastagePct } from "@/lib/verification";

const bodySchema = z.object({
    note: z.string().trim().min(1, "A rejection reason is required").max(500),
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
    const { note, counts } = bodySchema.parse(raw);
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

    const expectedById = new Map(order.items.map((i) => [i.componentId, i.expectedQty]));
    if (counts.some((c) => !expectedById.has(c.componentId))) {
        throw new ApiError(400, "Count submitted for a component that is not in this order");
    }

    const pct = wastagePct(order.recipe.stdFabricYards, order.targetQty, order.actualFabricYds);

    await prisma.$transaction(async (tx) => {
        const moved = await tx.cuttingOrder.updateMany({
            where: { id, status: "PENDING_VERIFICATION" },
            data: { status: "REJECTED" },
        });
        if (moved.count !== 1) throw new ApiError(409, "Order was already processed");

        for (const c of counts) {
            await tx.verificationItem.update({
                where: { orderId_componentId: { orderId: id, componentId: c.componentId } },
                data: { actualQty: c.actualQty, status: itemStatus(expectedById.get(c.componentId)!, c.actualQty) },
            });
        }
        await tx.verificationLog.create({
            data: {
                orderId: id,
                verifierId: session.userId,
                decision: "REJECTED",
                rejectionNote: note,
                wastagePct: pct,
            },
        });
    });

    return Response.json({ ok: true, orderNo: order.orderNo, status: "REJECTED" });
});