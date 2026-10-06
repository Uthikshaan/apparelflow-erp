import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function handle<Ctx = unknown>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { error: err.message, details: err.details },
          { status: err.status }
        );
      }
      if (err instanceof ZodError) {
        return Response.json(
          {
            error: "Validation failed",
            details: err.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 }
        );
      }
      console.error(err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}