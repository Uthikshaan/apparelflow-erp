"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResubmitForm({ orderId, currentYds }: { orderId: number; currentYds: number }) {
    const router = useRouter();
    const [yards, setYards] = useState(String(currentYds));
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit() {
        setError("");
        const t = yards.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) <= 0) {
            setError("Enter a positive number, up to 2 decimals");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/orders/${orderId}/resubmit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actualFabricYds: Number(t) }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Something went wrong");
                return;
            }
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor={`y${orderId}`} style={{ fontWeight: 600 }}>New fabric used (yds)</label>
            <input
                id={`y${orderId}`}
                inputMode="decimal"
                value={yards}
                onChange={(e) => setYards(e.target.value)}
                style={{
                    width: 110, padding: "8px 10px", fontSize: 16, color: "#111827",
                    background: "#ffffff", border: "2px solid #6b7280", borderRadius: 6, colorScheme: "light",
                }}
            />
            <button
                onClick={submit}
                disabled={loading}
                style={{
                    padding: "8px 16px", fontSize: 16, fontWeight: 700, border: "none", borderRadius: 6,
                    color: "#ffffff", background: loading ? "#6b7280" : "#1d4ed8",
                    cursor: loading ? "not-allowed" : "pointer",
                }}
            >
                {loading ? "Resubmitting..." : "Resubmit for verification"}
            </button>
            {error && <span role="alert" style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</span>}
        </div>
    );
}