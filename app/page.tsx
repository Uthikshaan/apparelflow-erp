import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, type Role } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

const LINKS: Record<Role, { href: string; label: string }> = {
  cutting_supervisor: { href: "/supervisor", label: "Cutting Orders" },
  cutting_verifier: { href: "/verifier", label: "Verification Terminal" },
  sewing_supervisor: { href: "/sewing", label: "Sewing Queue" },
};

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const link = LINKS[session.role];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {session.fullName}</h1>
        <p className="mt-1 text-slate-800">Role: <strong>{session.role}</strong></p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={link.href}
            className="rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Open {link.label}
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}