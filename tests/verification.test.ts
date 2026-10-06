import { describe, it, expect } from "vitest";
import { itemStatus, wastagePct, evaluate } from "@/lib/verification";

describe("traffic-light rules", () => {
    it("GREEN when equal, YELLOW when excess, RED when short", () => {
        expect(itemStatus(100, 100)).toBe("GREEN");
        expect(itemStatus(100, 101)).toBe("YELLOW");
        expect(itemStatus(100, 99)).toBe("RED");
        expect(itemStatus(100, 0)).toBe("RED");
    });

    it("excess (YELLOW) does not block approval", () => {
        const ev = evaluate(
            [{ componentId: 1, expectedQty: 10 }],
            [{ componentId: 1, actualQty: 12 }]
        );
        expect(ev.canApprove).toBe(true);
    });

    it("any RED or uncounted component blocks approval", () => {
        const items = [{ componentId: 1, expectedQty: 10 }, { componentId: 2, expectedQty: 10 }];
        expect(evaluate(items, [{ componentId: 1, actualQty: 10 }, { componentId: 2, actualQty: 9 }]).canApprove).toBe(false);
        expect(evaluate(items, [{ componentId: 1, actualQty: 10 }]).canApprove).toBe(false);
    });

    it("wastage % follows the formula", () => {
        // expected 1.8 * 50 = 90 yds, used 92 => 2.22%
        expect(wastagePct(1.8, 50, 92)).toBe(2.22);
        expect(wastagePct(1.8, 50, 90)).toBe(0);
    });
});