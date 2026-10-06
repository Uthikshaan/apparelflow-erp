import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";

const LoginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const POST = handle(async (req) => {
  const body = await req.json().catch(() => null);
  const { email, password } = LoginSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) throw new ApiError(401, "Invalid email or password");

  await createSession(user.id);
  return Response.json({
    user: { id: user.id, fullName: user.fullName, role: user.role },
  });
});