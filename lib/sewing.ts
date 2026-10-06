import { prisma } from "./prisma";

// The ONLY way the sewing floor reads orders.
// The status filter is fixed in the query: no parameter can change it.
export function getSewingQueue() {
    return prisma.cuttingOrder.findMany({
        where: { status: "VERIFIED" },
        include: {
            recipe: true,
            items: { include: { component: true }, orderBy: { id: "asc" } },
            logs: {
                where: { decision: "APPROVED" },
                include: { verifier: { select: { fullName: true } } },
                orderBy: { timestamp: "desc" },
                take: 1,
            },
        },
        orderBy: { id: "asc" },
    });
}