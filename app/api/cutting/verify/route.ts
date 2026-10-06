import { getSession } from "@/lib/auth";

export async function GET() {
    const session = await getSession();

    if (!session) {
        return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    if (session.role !== "cutting_verifier") {
        return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    return Response.json({ ok: true, user: session.fullName });
}