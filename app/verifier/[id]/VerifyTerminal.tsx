"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { itemStatus, wastagePct } from "@/lib/verification";

type Item = { componentId: number; name: string; expectedQty: number };
type Props = {
    orderId: number;
    orderNo: string;
    recipeName: string;
    targetQty: number;
    fabricRollId: string;
    actualFabricYds: number;
    stdFabricYards: number;
    wastageCap: number;
    items: Item[];
};

type Key = "GREEN" | "YELLOW" | "RED" | "NONE" | "BAD";

const LOOK: Record<Key, { bg: string; fg: string; label: string }> = {
    GREEN: { bg: "#dcfce7", fg: "#14532d", label: "GREEN - match" },
    YELLOW: { bg: "#fef9c3", fg: "#713f12", label: "YELLOW - excess" },
    RED: { bg: "#fee2e2", fg: "#7f1d1d", label: "RED - shortage" },
    NONE: { bg: "#e5e7eb", fg: "#111827", label: "Not counted" },
    BAD: { bg: "#fee2e2", fg: "#7f1d1d", label: "Whole numbers only" },
};

const inputStyle: React.CSSProperties = {
    width: 120,
    padding: "8px 10px",
    fontSize: 16,
    color: "#111827",
    background: "#ffffff",
    border: "2px solid #6b7280",
    borderRadius: 6,
    colorScheme: "light",
};

function rowState(raw: string, expected: number): { key: Key; value: number | null } {
    const t = raw.trim();
    if (t === "") return { key: "NONE", value: null };
    if (!/^\d{1,8}$/.test(t)) return { key: "BAD", value: null };
    const value = Number(t);
    return { key: itemStatus(expected, value), value };
}

export default function VerifyTerminal(p: Props) {
    const router = useRouter();
    const [raw, setRaw] = useState<Record<number, string>>({});
    const [note, setNote] = useState("");
    const [noteError, setNoteError] = useState("");
    const [serverError, setServerError] = useState("");
    const [loading, setLoading] = useState(false);

    const states = p.items.map((i) => ({ item: i, ...rowState(raw[i.componentId] ?? "", i.expectedQty) }));
    const allCounted = states.every((s) => s.key !== "NONE" && s.key !== "BAD");
    const hasRed = states.some((s) => s.key === "RED");
    const canApprove = allCounted && !hasRed && !loading;

    const expectedFabric = p.stdFabricYards * p.targetQty;
    const pct = wastagePct(p.stdFabricYards, p.targetQty, p.actualFabricYds);
    const overCap = pct > p.wastageCap;

    async function send(kind: "approve" | "reject") {
        setServerError("");
        if (kind === "reject" && !note.trim()) {
            setNoteError("A reason is required to reject a batch");
            return;
        }
        setNoteError("");
        setLoading(true);
        try {
            const counts = states
                .filter((s) => s.value !== null)
                .map((s) => ({ componentId: s.item.componentId, actualQty: s.value as number }));
            const res = await fetch(`/api/orders/${p.orderId}/${kind}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(kind === "reject" ? { counts, note: note.trim() } : { counts }),
            });
            const data = await res.json();
            if (!res.ok) {
                setServerError(data.error ?? "Something went wrong");
                return;
            }
            router.push("/verifier");
            router.refresh();
        } catch {
            setServerError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    const cell = { padding: 8, border: "1px solid #d1d5db" } as const;

    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
            <Link href="/verifier" style={{ color: "#1d4ed8" }}>&larr; Back to queue</Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "8px 0" }}>
                Verify {p.orderNo} - {p.recipeName}
            </h1>
            <p>Batch quantity: {p.targetQty} | Fabric roll: {p.fabricRollId} | Fabric used: {p.actualFabricYds} yds</p>

            <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", color: "#111827" }}>
                    <thead>
                        <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                            {["Component", "Expected", "Actual count", "Status"].map((h) => (
                                <th key={h} style={cell}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {states.map((s) => {
                            const look = LOOK[s.key];
                            return (
                                <tr key={s.item.componentId}>
                                    <td style={cell}><label htmlFor={`c${s.item.componentId}`}>{s.item.name}</label></td>
                                    <td style={cell}>{s.item.expectedQty}</td>
                                    <td style={cell}>
                                        <input
                                            id={`c${s.item.componentId}`}
                                            inputMode="numeric"
                                            value={raw[s.item.componentId] ?? ""}
                                            onChange={(e) => setRaw((r) => ({ ...r, [s.item.componentId]: e.target.value }))}
                                            style={inputStyle}
                                        />
                                    </td>
                                    <td style={cell}>
                                        <span style={{ background: look.bg, color: look.fg, padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>
                                            {look.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: "#f3f4f6", borderRadius: 6 }}>
                Fabric: expected {expectedFabric.toFixed(1)} yds, used {p.actualFabricYds} yds, wastage{" "}
                <strong>{pct}%</strong> (cap {p.wastageCap}%)
                {overCap && <span style={{ color: "#b91c1c", fontWeight: 700 }}> - over the wastage cap</span>}
            </div>

            {hasRed && (
                <div role="alert" style={{ marginTop: 12, color: "#7f1d1d", fontWeight: 700 }}>
                    Shortage detected. Approve is blocked. Reject the batch with a reason to send it back for re-cutting.
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                <label htmlFor="note" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                    Rejection reason (required to reject)
                </label>
                <textarea
                    id="note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    style={{ ...inputStyle, width: "100%", fontFamily: "inherit" }}
                />
                {noteError && <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 4 }}>{noteError}</div>}
            </div>

            {serverError && <div role="alert" style={{ color: "#b91c1c", fontWeight: 600, marginTop: 12 }}>{serverError}</div>}

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                    onClick={() => send("approve")}
                    disabled={!canApprove}
                    style={{
                        padding: "10px 20px", fontSize: 16, fontWeight: 700, border: "none", borderRadius: 6,
                        color: "#ffffff", background: canApprove ? "#15803d" : "#6b7280",
                        cursor: canApprove ? "pointer" : "not-allowed",
                    }}
                >
                    Approve Batch
                </button>
                <button
                    onClick={() => send("reject")}
                    disabled={loading}
                    style={{
                        padding: "10px 20px", fontSize: 16, fontWeight: 700, border: "none", borderRadius: 6,
                        color: "#ffffff", background: "#b91c1c", cursor: loading ? "not-allowed" : "pointer",
                    }}
                >
                    Reject Batch
                </button>
            </div>
        </main>
    );
}