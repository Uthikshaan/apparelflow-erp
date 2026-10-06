"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartButton({ orderId }: { orderId: number }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function start() {
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`/api/sewing/${orderId}/start`, { method: "POST" });
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
        <div>
            <button
                onClick={start}
                disabled={loading}
                style={{
                    padding: "10px 20px", fontSize: 16, fontWeight: 700, border: "none", borderRadius: 6,
                    color: "#ffffff", background: loading ? "#6b7280" : "#1d4ed8",
                    cursor: loading ? "not-allowed" : "pointer",
                }}
            >
                {loading ? "Starting..." : "Start Sewing Assembly"}
            </button>
            {error && <div role="alert" style={{ color: "#b91c1c", fontWeight: 600, marginTop: 6 }}>{error}</div>}
        </div>
    );
}