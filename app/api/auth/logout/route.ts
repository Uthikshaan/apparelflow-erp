import { destroySession } from "@/lib/auth";
import { handle } from "@/lib/api";

export const POST = handle(async () => {
  await destroySession();
  return Response.json({ ok: true });
});