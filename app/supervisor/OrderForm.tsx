"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RecipeOption = {
    id: number;
    code: string;
    name: string;
    components: { name: string; pieces: number }[];
};

// High-contrast styles: dark text on a white background, always.
const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 16,
    color: "#111827",
    background: "#ffffff",
    border: "2px solid #6b7280",
    borderRadius: 6,
    colorScheme: "light",
};
const errorStyle: React.CSSProperties = { color: "#b91c1c", fontSize: 14, marginTop: 4 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, marginBottom: 4, color: "#111827" };

export default function OrderForm({ recipes }: { recipes: RecipeOption[] }) {
    const router = useRouter();
    const [recipeId, setRecipeId] = useState<string>(recipes[0] ? String(recipes[0].id) : "");
    const [qty, setQty] = useState("");
    const [roll, setRoll] = useState("");
    const [yards, setYards] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [serverError, setServerError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const recipe = recipes.find((r) => String(r.id) === recipeId);
    const qtyValid = /^[1-9]\d{0,5}$/.test(qty); // whole number, no decimals/negatives/letters
    const qtyNum = qtyValid ? Number(qty) : null;

    function validate() {
        const e: Record<string, string> = {};
        if (!recipeId) e.recipeId = "Choose a recipe";
        if (!qty.trim()) e.targetQty = "Quantity is required";
        else if (!/^\d+$/.test(qty.trim())) e.targetQty = "Whole numbers only (no decimals, negatives or letters)";
        else if (Number(qty) < 1) e.targetQty = "Quantity must be at least 1";
        else if (Number(qty) > 100000) e.targetQty = "Quantity must be 100000 or less";
        if (!roll.trim()) e.fabricRollId = "Fabric roll ID is required";
        else if (roll.trim().length > 50) e.fabricRollId = "Max 50 characters";
        if (!yards.trim()) e.actualFabricYds = "Fabric used is required";
        else if (!/^\d+(\.\d{1,2})?$/.test(yards.trim())) e.actualFabricYds = "Positive number, up to 2 decimals";
        else if (Number(yards) <= 0) e.actualFabricYds = "Must be greater than 0";
        return e;
    }

    async function onSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setServerError("");
        setSuccess("");
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        setLoading(true);
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipeId: Number(recipeId),
                    targetQty: Number(qty),
                    fabricRollId: roll.trim(),
                    actualFabricYds: Number(yards),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (Array.isArray(data.details)) {
                    const fe: Record<string, string> = {};
                    for (const d of data.details) fe[d.field] = d.message;
                    setErrors(fe);
                }
                setServerError(data.error ?? "Something went wrong");
                return;
            }
            setSuccess(`Order ${data.order.orderNo} submitted for verification.`);
            setQty("");
            setRoll("");
            setYards("");
            router.refresh(); // reload the orders list from the server
        } catch {
            setServerError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form
            onSubmit={onSubmit}
            noValidate
            style={{ background: "#ffffff", color: "#111827", padding: 20, borderRadius: 8, border: "1px solid #d1d5db" }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>New cutting order</h2>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>
                    <label htmlFor="recipe" style={labelStyle}>Recipe</label>
                    <select id="recipe" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} style={inputStyle}>
                        {recipes.map((r) => (
                            <option key={r.id} value={r.id} style={{ color: "#111827", background: "#ffffff" }}>
                                {r.name} ({r.code})
                            </option>
                        ))}
                    </select>
                    {errors.recipeId && <div style={errorStyle}>{errors.recipeId}</div>}
                </div>

                <div>
                    <label htmlFor="qty" style={labelStyle}>Target batch quantity</label>
                    <input
                        id="qty"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="e.g. 50"
                        style={inputStyle}
                    />
                    {errors.targetQty && <div style={errorStyle}>{errors.targetQty}</div>}
                </div>

                <div>
                    <label htmlFor="roll" style={labelStyle}>Fabric roll ID</label>
                    <input
                        id="roll"
                        value={roll}
                        onChange={(e) => setRoll(e.target.value)}
                        placeholder="e.g. FAB-ROLL-882"
                        style={inputStyle}
                    />
                    {errors.fabricRollId && <div style={errorStyle}>{errors.fabricRollId}</div>}
                </div>

                <div>
                    <label htmlFor="yards" style={labelStyle}>Actual fabric used (yards)</label>
                    <input
                        id="yards"
                        inputMode="decimal"
                        value={yards}
                        onChange={(e) => setYards(e.target.value)}
                        placeholder="e.g. 92"
                        style={inputStyle}
                    />
                    {errors.actualFabricYds && <div style={errorStyle}>{errors.actualFabricYds}</div>}
                </div>
            </div>

            {recipe && (
                <div style={{ marginTop: 16, padding: 12, background: "#f3f4f6", borderRadius: 6 }}>
                    <strong>Expected component counts</strong>
                    <ul style={{ margin: "8px 0 0 18px" }}>
                        {recipe.components.map((c) => (
                            <li key={c.name}>
                                {c.name}: {qtyNum ? qtyNum * c.pieces : "-"} pcs
                                <span style={{ color: "#4b5563" }}> ({c.pieces} per garment)</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {serverError && <div role="alert" style={{ ...errorStyle, marginTop: 12, fontWeight: 600 }}>{serverError}</div>}
            {success && <div role="status" style={{ color: "#14532d", marginTop: 12, fontWeight: 600 }}>{success}</div>}

            <button
                type="submit"
                disabled={loading}
                style={{
                    marginTop: 16,
                    padding: "10px 20px",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: loading ? "#6b7280" : "#1d4ed8",
                    border: "none",
                    borderRadius: 6,
                    cursor: loading ? "not-allowed" : "pointer",
                }}
            >
                {loading ? "Submitting..." : "Submit for verification"}
            </button>
        </form>
    );
}