"use client";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { CHAIN, WALLETCONNECT_PROJECT_ID } from "@/lib/config";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
const config = getDefaultConfig({ appName: "Vairify", projectId: WALLETCONNECT_PROJECT_ID, chains: [CHAIN], ssr: true });
export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return <WagmiProvider config={config}><QueryClientProvider client={qc}><RainbowKitProvider>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>;
}
