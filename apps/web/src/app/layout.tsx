import type { Metadata } from "next";
import { Toaster } from "sonner";
import Providers from "./providers";
import Header from "@/components/Header";
import "./globals.css";
export const metadata: Metadata = { title: "Vairify — Verify before you send", description: "Verify before you send. Escrow USDC, send a tiny test payment, confirm receipt, then release." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Providers><Header /><main className="mx-auto max-w-6xl px-4 py-8">{children}</main><footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-zinc-500">Vairify is unaudited. Do not use it with real funds without an independent security review. A wallet signature proves wallet authorization, not real-world identity.</footer><Toaster richColors /></Providers></body></html>;
}
