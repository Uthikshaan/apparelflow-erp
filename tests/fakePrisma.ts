/* eslint-disable @typescript-eslint/no-explicit-any */
export const store = {
    users: [] as any[],
    recipes: [] as any[],
    components: [] as any[],
    orders: [] as any[],
    items: [] as any[],
    logs: [] as any[],
};
export const queryLog: any[] = []; // records the `where` of every findMany

const EXPECTED = [50, 50, 100, 50, 100]; // Casual Blouse x 50

export function addOrder(id: number, status: string) {
    store.orders.push({
        id, orderNo: `CUT-0000${id}`, recipeId: 1, targetQty: 50,
        fabricRollId: "FAB-ROLL-1", actualFabricYds: 92, status, createdBy: 1,
    });
    EXPECTED.forEach((expectedQty, idx) =>
        store.items.push({ id: id * 10 + idx, orderId: id, componentId: idx + 1, expectedQty, actualQty: null, status: null })
    );
}

export function resetStore() {
    store.users = [
        { id: 1, role: "cutting_supervisor", fullName: "Sam Supervisor", email: "supervisor@apparelflow.com" },
        { id: 2, role: "cutting_verifier", fullName: "Vera Verifier", email: "verifier@apparelflow.com" },
        { id: 3, role: "sewing_supervisor", fullName: "Sewa Sewing", email: "sewing@apparelflow.com" },
    ];
    store.recipes = [{ id: 1, name: "Casual Blouse", stdFabricYards: 1.8, wastageCap: 5 }];
    store.components = ["Front Body Panel", "Back Body Panel", "Sleeves", "Collar & Stand", "Sleeve Cuffs"]
        .map((componentName, i) => ({ id: i + 1, componentName }));
    store.orders = [];
    store.items = [];
    store.logs = [];
    queryLog.length = 0;
}

const byOrder = (id: number) => store.orders.find((o) => o.id === id);

export const fakePrisma: any = {
    user: {
        findUnique: async ({ where }: any) => store.users.find((u) => u.id === where.id) ?? null,
    },
    cuttingOrder: {
        findUnique: async ({ where }: any) => {
            const o = byOrder(where.id);
            if (!o) return null;
            return {
                ...o,
                recipe: store.recipes.find((r) => r.id === o.recipeId),
                items: store.items.filter((i) => i.orderId === o.id),
            };
        },
        updateMany: async ({ where, data }: any) => {
            const o = byOrder(where.id);
            if (!o || (where.status && o.status !== where.status)) return { count: 0 };
            Object.assign(o, data);
            return { count: 1 };
        },
        findMany: async ({ where }: any) => {
            queryLog.push(where);
            return store.orders
                .filter((o) => !where?.status || o.status === where.status)
                .map((o) => ({
                    ...o,
                    recipe: store.recipes.find((r) => r.id === o.recipeId),
                    items: store.items
                        .filter((i) => i.orderId === o.id)
                        .map((i) => ({ ...i, component: store.components.find((c) => c.id === i.componentId) })),
                    logs: store.logs
                        .filter((l) => l.orderId === o.id && l.decision === "APPROVED")
                        .map((l) => ({ ...l, verifier: store.users.find((u) => u.id === l.verifierId) })),
                }));
        },
    },
    verificationItem: {
        update: async ({ where, data }: any) => {
            const { orderId, componentId } = where.orderId_componentId;
            const item = store.items.find((i) => i.orderId === orderId && i.componentId === componentId);
            Object.assign(item, data);
            return item;
        },
    },
    verificationLog: {
        create: async ({ data }: any) => {
            const row = { id: store.logs.length + 1, timestamp: new Date(), rejectionNote: null, ...data };
            store.logs.push(row);
            return row;
        },
    },
    $transaction: async (fn: any) => fn(fakePrisma),
};