import { getSession } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";

export const GET = handle(async () => {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Authentication required");
  return Response.json({ user: session });
});