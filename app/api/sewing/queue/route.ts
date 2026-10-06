import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getSewingQueue } from "@/lib/sewing";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
    await requireRole("sewing_supervisor"); // 401 / 403 otherwise

    // Query string is deliberately ignored: ?status=PENDING_VERIFICATION changes nothing.
    const orders = await getSewingQueue();

    return Response.json({
        orders: orders.map((o) => {
            const log = o.logs[0];
            return {
                orderNo: o.orderNo,
                recipe: o.recipe.name,
                targetQty: o.targetQty,
                fabricRollId: o.fabricRollId,
                status: o.status,
                verifiedBy: log?.verifier.fullName ?? null,
                verifiedAt: log?.timestamp ?? null,
                wastagePct: log?.wastagePct ?? null,
                items: o.items.map((i) => ({
                    component: i.component.componentName,
                    expectedQty: i.expectedQty,
                    actualQty: i.actualQty,
                    status: i.status,
                })),
            };
        }),
    });
});