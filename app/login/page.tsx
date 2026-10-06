"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO = [
  { label: "Cutting Supervisor", email: "supervisor@apparelflow.com", password: "Supervisor@123" },
  { label: "Cutting Verifier", email: "verifier@apparelflow.com", password: "Verifier@123" },
  { label: "Sewing Supervisor", email: "sewing@apparelflow.com", password: "Sewing@123" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details?.[0]?.message ?? data.error ?? "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 p-4 md:flex-row md:items-start md:pt-24">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg bg-white p-6 shadow" noValidate>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">ApparelFlow ERP</h1>
        <p className="mb-4 text-sm text-slate-700">Cutting Operations &amp; Gatekeeper Terminal</p>

        <label className="mb-1 block text-sm font-medium text-slate-900" htmlFor="email">Email</label>
        <input id="email" type="email" className={inputCls} value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@apparelflow.com" />

        <label className="mb-1 mt-3 block text-sm font-medium text-slate-900" htmlFor="password">Password</label>
        <input id="password" type="password" className={inputCls} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />

        {error && (
          <p role="alert" className="mt-3 rounded border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}
          className="mt-4 w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <aside className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-6 shadow">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Demo credentials</h2>
        <p className="mb-3 text-sm text-slate-700">Click a role to fill the form, then sign in.</p>
        <ul className="space-y-2">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button type="button"
                onClick={() => { setEmail(d.email); setPassword(d.password); setError(""); }}
                className="w-full rounded-md border border-slate-400 px-3 py-2 text-left hover:bg-slate-100">
                <span className="block font-semibold text-slate-900">{d.label}</span>
                <span className="block text-xs text-slate-700">{d.email} / {d.password}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}