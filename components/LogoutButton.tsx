"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="rounded-md border border-slate-500 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100"
    >
      Log out
    </button>
  );
}