import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const recipes = [
  {
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: 1.8,
    wastageCap: 5.0,
    components: [
      { componentName: "Front Body Panel", piecesPerGarment: 1 },
      { componentName: "Back Body Panel", piecesPerGarment: 1 },
      { componentName: "Sleeves (Left & Right)", piecesPerGarment: 2 },
      { componentName: "Collar & Stand", piecesPerGarment: 1 },
      { componentName: "Sleeve Cuffs", piecesPerGarment: 2 },
    ],
  },
  {
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: 1.1,
    wastageCap: 8.0,
    components: [
      { componentName: "Front Chest Panel", piecesPerGarment: 1 },
      { componentName: "Back Support Panel", piecesPerGarment: 1 },
      { componentName: "Neck Binding Strip", piecesPerGarment: 1 },
      { componentName: "Hem Elastic Casing", piecesPerGarment: 1 },
      { componentName: "Side Strap Accents", piecesPerGarment: 2 },
    ],
  },
];

const users = [
  { email: "supervisor@apparelflow.com", fullName: "Sam Supervisor", role: Role.cutting_supervisor, password: "Supervisor@123" },
  { email: "verifier@apparelflow.com", fullName: "Vera Verifier", role: Role.cutting_verifier, password: "Verifier@123" },
  { email: "sewing@apparelflow.com", fullName: "Sewa Sewing", role: Role.sewing_supervisor, password: "Sewing@123" },
];

async function main() {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, passwordHash },
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
  }

  for (const r of recipes) {
    const { components, ...data } = r;
    const recipe = await prisma.recipe.upsert({
      where: { recipeCode: r.recipeCode },
      update: data,
      create: data,
    });
    const existing = await prisma.recipeComponent.count({ where: { recipeId: recipe.id } });
    if (existing === 0) {
      await prisma.recipeComponent.createMany({
        data: components.map((c) => ({ ...c, recipeId: recipe.id })),
      });
    }
  }

  console.log("Seed complete: 3 users, 2 recipes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());