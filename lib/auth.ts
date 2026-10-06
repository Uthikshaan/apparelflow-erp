import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./prisma";
import { ApiError } from "./api";

export type Role = "cutting_supervisor" | "cutting_verifier" | "sewing_supervisor";
export type Session = { userId: number; role: Role; fullName: string; email: string };

const COOKIE = "af_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secretKey() {
    const s = process.env.JWT_SECRET;
    if (!s || s.length < 32) throw new Error("JWT_SECRET missing or too short");
    return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(userId))
        .setIssuedAt()
        .setExpirationTime(`${MAX_AGE}s`)
        .sign(secretKey());

    (await cookies()).set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MAX_AGE,
    });
}

export async function destroySession() {
    (await cookies()).delete(COOKIE);
}

// cache() makes sure the DB is queried only once per request,
// even if a page and its layout both call getSession().
export const getSession = cache(async (): Promise<Session | null> => {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secretKey(), {
            algorithms: ["HS256"],
        });
        const user = await prisma.user.findUnique({
            where: { id: Number(payload.sub) },
            select: { id: true, role: true, fullName: true, email: true },
        });
        if (!user) return null;
        return {
            userId: user.id,
            role: user.role as Role,
            fullName: user.fullName,
            email: user.email,
        };
    } catch {
        return null; // expired or tampered token
    }
});

/** For API routes. Throws 401 if not logged in, 403 if the role is not allowed. */
export async function requireRole(...allowed: Role[]): Promise<Session> {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required");
    if (!allowed.includes(session.role)) throw new ApiError(403, "Forbidden: insufficient role");
    return session;
}

/** For pages (server components). Redirects instead of throwing.
 *  Do NOT call this inside a try/catch, because redirect() works by throwing. */
export async function requireRolePage(...allowed: Role[]): Promise<Session> {
    const session = await getSession();
    if (!session) redirect("/login");
    if (!allowed.includes(session.role)) redirect("/forbidden");
    return session;
}