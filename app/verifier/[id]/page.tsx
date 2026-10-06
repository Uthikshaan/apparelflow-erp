import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import VerifyTerminal from "./VerifyTerminal";

export const dynamic = "force-dynamic";

export default async function VerifyOrderPage({ params }: { params: Promise<{ id: string }> }) {
    await requireRolePage("cutting_verifier");

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) redirect("/verifier");

    const order = await prisma.cuttingOrder.findUnique({
        where: { id: orderId },
        include: {
            recipe: true,
            items: { include: { component: true }, orderBy: { id: "asc" } },
        },
    });
    if (!order || order.status !== "PENDING_VERIFICATION") redirect("/verifier");

    return (
        <VerifyTerminal
            orderId={order.id}
            orderNo={order.orderNo}
            recipeName={order.recipe.name}
            targetQty={order.targetQty}
            fabricRollId={order.fabricRollId}
            actualFabricYds={order.actualFabricYds}
            stdFabricYards={order.recipe.stdFabricYards}
            wastageCap={order.recipe.wastageCap}
            items={order.items.map((i) => ({
                componentId: i.componentId,
                name: i.component.componentName,
                expectedQty: i.expectedQty,
            }))}
        />
    );
}