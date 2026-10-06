import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api";

const bodySchema = z.object({
    actualFabricYds: z.number().positive().max(1_000_000),
});

export const POST = handle<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
    const session = await requireRole("cutting_supervisor"); // 401 / 403 otherwise

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid order id");

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw new ApiError(400, "Request body must be valid JSON");
    }
    const { actualFabricYds } = bodySchema.parse(raw);

    const order = await prisma.cuttingOrder.findUnique({ where: { id } });
    // Only the supervisor who created the order may resubmit it
    if (!order || order.createdBy !== session.userId) throw new ApiError(404, "Order not found");

    await prisma.$transaction(async (tx) => {
        const moved = await tx.cuttingOrder.updateMany({
            where: { id, status: "REJECTED" }, // only REJECTED can go back to pending
            data: { status: "PENDING_VERIFICATION", actualFabricYds },
        });
        if (moved.count !== 1) throw new ApiError(409, "Only rejected orders can be resubmitted");

        // Clear the old counts so the verifier starts fresh.
        // The rejection log row is kept forever (audit trail).
        await tx.verificationItem.updateMany({
            where: { orderId: id },
            data: { actualQty: null, status: null },
        });
    });

    return Response.json({ ok: true, status: "PENDING_VERIFICATION" });
});