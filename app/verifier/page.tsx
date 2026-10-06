import Link from "next/link";
import { requireRolePage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VerifierPage() {
    const session = await requireRolePage("cutting_verifier");
    const orders = await prisma.cuttingOrder.findMany({
        where: { status: "PENDING_VERIFICATION" },
        include: { recipe: true },
        orderBy: { id: "asc" },
    });

    const cell = { padding: 8, border: "1px solid #d1d5db" } as const;

    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>Verification Terminal</h1>
                <Link href="/" style={{ color: "#1d4ed8" }}>Home / Log out</Link>
            </header>
            <p style={{ marginBottom: 16 }}>Signed in as {session.fullName}</p>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Batches waiting for QC</h2>
            {orders.length === 0 ? (
                <p>No batches are waiting for verification.</p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", color: "#111827" }}>
                        <thead>
                            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                                {["Order", "Recipe", "Qty", "Fabric roll", ""].map((h) => (
                                    <th key={h} style={cell}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => (
                                <tr key={o.id}>
                                    <td style={cell}>{o.orderNo}</td>
                                    <td style={cell}>{o.recipe.name}</td>
                                    <td style={cell}>{o.targetQty}</td>
                                    <td style={cell}>{o.fabricRollId}</td>
                                    <td style={cell}>
                                        <Link href={`/verifier/${o.id}`} style={{ color: "#1d4ed8", fontWeight: 700 }}>
                                            Start counting
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}