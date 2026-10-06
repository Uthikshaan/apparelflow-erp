export type ItemStatusValue = "GREEN" | "YELLOW" | "RED";

export function itemStatus(expected: number, actual: number): ItemStatusValue {
    if (actual < expected) return "RED";
    if (actual > expected) return "YELLOW";
    return "GREEN";
}

// Fabric Wastage % = ((actual - expected) / expected) * 100
export function wastagePct(stdYardsPerPiece: number, targetQty: number, actualYds: number) {
    const expected = stdYardsPerPiece * targetQty;
    return Math.round(((actualYds - expected) / expected) * 10000) / 100;
}

export type CountInput = { componentId: number; actualQty: number };
export type ItemInput = { componentId: number; expectedQty: number };

export function evaluate(items: ItemInput[], counts: CountInput[]) {
    const byId = new Map(counts.map((c) => [c.componentId, c.actualQty]));
    const results = items.map((i) => {
        const actual = byId.get(i.componentId);
        return {
            componentId: i.componentId,
            expectedQty: i.expectedQty,
            actualQty: actual ?? null,
            status: actual === undefined ? null : itemStatus(i.expectedQty, actual),
        };
    });
    const redCount = results.filter((r) => r.status === "RED").length;
    const uncountedCount = results.filter((r) => r.status === null).length;
    return { results, redCount, uncountedCount, canApprove: redCount === 0 && uncountedCount === 0 };
}