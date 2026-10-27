"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ShieldCheck, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export default function Header() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); try { localStorage.setItem("vairify:theme", d ? "dark" : "light"); } catch {} };
  useEffect(() => { try { if (localStorage.getItem("vairify:theme") === "dark") { setDark(true); document.documentElement.classList.add("dark"); } } catch {} }, []);
  return <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg"><ShieldCheck className="text-teal-700" /> Vairify</Link>
      <nav className="hidden items-center gap-5 text-sm font-medium md:flex"><Link href="/dashboard">Dashboard</Link><Link href="/send">Send</Link><Link href="/#how-it-works">How it works</Link></nav>
      <div className="flex items-center gap-2"><button onClick={toggle} aria-label="Toggle theme" className="rounded-xl border border-zinc-300 p-2 dark:border-zinc-700">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><ConnectButton /></div>
    </div>
  </header>;
}
