import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { handle, ApiError } from "@/lib/api";

// Strict types: strings, negatives and decimals are all rejected.
const createOrderSchema = z.object({
    recipeId: z.number().int().positive(),
    targetQty: z.number().int().positive().max(100000),
    fabricRollId: z.string().trim().min(1, "Fabric roll ID is required").max(50),
    actualFabricYds: z.number().positive().max(1000000),
});

export const POST = handle(async (req) => {
    // 1. Server-side RBAC: only cutting supervisors (401 / 403 otherwise)
    const session = await requireRole("cutting_supervisor");

    // 2. Validate the body
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw new ApiError(400, "Request body must be valid JSON");
    }
    const input = createOrderSchema.parse(raw);

    // 3. Load the recipe and its components
    const recipe = await prisma.recipe.findUnique({
        where: { id: input.recipeId },
        include: { components: true },
    });
    if (!recipe) throw new ApiError(404, "Recipe not found");

    // 4. Create the order and its expected counts in ONE transaction
    const order = await prisma.$transaction(async (tx) => {
        const created = await tx.cuttingOrder.create({
            data: {
                orderNo: `TMP-${crypto.randomUUID()}`, // replaced just below
                recipeId: recipe.id,
                targetQty: input.targetQty,
                fabricRollId: input.fabricRollId,
                actualFabricYds: input.actualFabricYds,
                status: "PENDING_VERIFICATION",
                createdBy: session.userId, // from the session, never from the body
                items: {
                    create: recipe.components.map((c) => ({
                        componentId: c.id,
                        expectedQty: input.targetQty * c.piecesPerGarment,
                    })),
                },
            },
        });
        return tx.cuttingOrder.update({
            where: { id: created.id },
            data: { orderNo: `CUT-${String(created.id).padStart(5, "0")}` },
            include: { items: { include: { component: true } } },
        });
    });

    return Response.json({ order }, { status: 201 });
});