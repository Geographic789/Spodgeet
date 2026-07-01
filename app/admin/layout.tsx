"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  async function handleLogout() {
    await fetch("/api/admin-logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (isLoginPage) return <>{children}</>;

  const navLinks = [
    { href: "/admin/races",          label: "Races" },
    { href: "/admin/gamification",   label: "Gamification" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-moss-200/70 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin/races" className="flex items-baseline gap-2">
              <span className="font-display text-lg tracking-wide text-moss-700">SPODGEET</span>
              <span className="label-eyebrow">admin</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname.startsWith(l.href)
                      ? "text-moss-700"
                      : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/plan/new" target="_blank" className="btn-primary text-xs hidden sm:inline-flex">
              Open app →
            </Link>
            <button onClick={handleLogout} className="btn-secondary text-xs">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
