import Link from "next/link";
import { requireRolePage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrderForm from "./OrderForm";
import ResubmitForm from "./ResubmitForm";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
    IN_PROGRESS: { bg: "#e5e7eb", fg: "#111827" },
    PENDING_VERIFICATION: { bg: "#fef3c7", fg: "#78350f" },
    REJECTED: { bg: "#fee2e2", fg: "#7f1d1d" },
    VERIFIED: { bg: "#dcfce7", fg: "#14532d" },
    SEWING_STARTED: { bg: "#dbeafe", fg: "#1e3a8a" },
};

export default async function SupervisorPage() {
    const session = await requireRolePage("cutting_supervisor");

    const [recipes, orders] = await Promise.all([
        prisma.recipe.findMany({
            include: { components: { orderBy: { id: "asc" } } },
            orderBy: { id: "asc" },
        }),
        prisma.cuttingOrder.findMany({
            where: { createdBy: session.userId },
            include: {
                recipe: true,
                logs: {
                    where: { decision: "REJECTED" },
                    include: { verifier: { select: { fullName: true } } },
                    orderBy: { timestamp: "desc" },
                    take: 1,
                },
            },
            orderBy: { id: "desc" },
        }),
    ]);

    const recipeOptions = recipes.map((r) => ({
        id: r.id,
        code: r.recipeCode,
        name: r.name,
        components: r.components.map((c) => ({ name: c.componentName, pieces: c.piecesPerGarment })),
    }));

    const cell = { padding: 8, border: "1px solid #d1d5db" } as const;

    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>Cutting Orders</h1>
                <Link href="/" style={{ color: "#1d4ed8" }}>Home / Log out</Link>
            </header>
            <p style={{ marginBottom: 16 }}>Signed in as {session.fullName}</p>

            <OrderForm recipes={recipeOptions} />

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "32px 0 8px" }}>My orders</h2>
            {orders.length === 0 ? (
                <p>No orders yet.</p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", color: "#111827" }}>
                        <thead>
                            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                                {["Order", "Recipe", "Qty", "Fabric roll", "Yards", "Status"].map((h) => (
                                    <th key={h} style={cell}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => {
                                const c = STATUS_COLORS[o.status] ?? STATUS_COLORS.IN_PROGRESS;
                                const rej = o.logs[0];
                                return [
                                    <tr key={o.id}>
                                        <td style={cell}>{o.orderNo}</td>
                                        <td style={cell}>{o.recipe.name}</td>
                                        <td style={cell}>{o.targetQty}</td>
                                        <td style={cell}>{o.fabricRollId}</td>
                                        <td style={cell}>{o.actualFabricYds}</td>
                                        <td style={cell}>
                                            <span style={{ background: c.bg, color: c.fg, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>
                                                {o.status.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                    </tr>,
                                    o.status === "REJECTED" && rej ? (
                                        <tr key={`${o.id}-rej`}>
                                            <td colSpan={6} style={{ ...cell, background: "#fef2f2" }}>
                                                <p style={{ marginBottom: 8 }}>
                                                    <strong>Rejected by {rej.verifier.fullName}:</strong> {rej.rejectionNote}
                                                </p>
                                                <ResubmitForm orderId={o.id} currentYds={o.actualFabricYds} />
                                            </td>
                                        </tr>
                                    ) : null,
                                ];
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}