import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api";

export const POST = handle<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
    await requireRole("sewing_supervisor");

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid order id");

    // Atomic: only a VERIFIED order can move to SEWING_STARTED
    const moved = await prisma.cuttingOrder.updateMany({
        where: { id, status: "VERIFIED" },
        data: { status: "SEWING_STARTED" },
    });

    if (moved.count !== 1) {
        // Do not reveal details of unverified orders to the sewing role
        throw new ApiError(409, "Order is not available in the sewing queue");
    }

    return Response.json({ ok: true, status: "SEWING_STARTED" });
});