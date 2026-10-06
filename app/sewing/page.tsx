import Link from "next/link";
import { requireRolePage } from "@/lib/auth";
import { getSewingQueue } from "@/lib/sewing";
import StartButton from "./StartButton";

export const dynamic = "force-dynamic";

const LIGHT: Record<string, { bg: string; fg: string }> = {
    GREEN: { bg: "#dcfce7", fg: "#14532d" },
    YELLOW: { bg: "#fef9c3", fg: "#713f12" },
    RED: { bg: "#fee2e2", fg: "#7f1d1d" },
};

export default async function SewingPage() {
    const session = await requireRolePage("sewing_supervisor");
    const orders = await getSewingQueue();
    const cell = { padding: 8, border: "1px solid #d1d5db" } as const;

    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>Sewing Queue</h1>
                <Link href="/" style={{ color: "#1d4ed8" }}>Home / Log out</Link>
            </header>
            <p style={{ marginBottom: 16 }}>Signed in as {session.fullName}</p>

            {orders.length === 0 ? (
                <p>No verified batches are waiting.</p>
            ) : (
                orders.map((o) => {
                    const log = o.logs[0];
                    return (
                        <section
                            key={o.id}
                            style={{ background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 8, padding: 16, marginBottom: 16 }}
                        >
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                {o.orderNo} - {o.recipe.name} x {o.targetQty}
                            </h2>
                            <p style={{ margin: "4px 0 12px" }}>
                                Verified by <strong>{log?.verifier.fullName ?? "unknown"}</strong>
                                {log && <> on {log.timestamp.toISOString().replace("T", " ").slice(0, 16)} UTC</>}
                                {" | "}Fabric wastage: <strong>{log?.wastagePct ?? "n/a"}%</strong>
                                {" | "}Roll: {o.fabricRollId}
                            </p>

                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", color: "#111827" }}>
                                    <thead>
                                        <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                                            {["Component", "Expected", "Counted", "Status"].map((h) => (
                                                <th key={h} style={cell}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {o.items.map((i) => {
                                            const l = LIGHT[i.status ?? ""] ?? { bg: "#e5e7eb", fg: "#111827" };
                                            return (
                                                <tr key={i.id}>
                                                    <td style={cell}>{i.component.componentName}</td>
                                                    <td style={cell}>{i.expectedQty}</td>
                                                    <td style={cell}>{i.actualQty ?? "-"}</td>
                                                    <td style={cell}>
                                                        <span style={{ background: l.bg, color: l.fg, padding: "2px 10px", borderRadius: 999, fontWeight: 700 }}>
                                                            {i.status ?? "-"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <StartButton orderId={o.id} />
                            </div>
                        </section>
                    );
                })
            )}
        </main>
    );
}