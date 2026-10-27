import { baseSepolia, base, type Chain } from "wagmi/chains";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
export const CHAIN: Chain = CHAIN_ID === 8453 ? base : baseSepolia;
export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS || "") as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "vairify-placeholder";
export const BASESCAN = CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
export const txUrl = (h: string) => `${BASESCAN}/tx/${h}`;
export const addrUrl = (a: string) => `${BASESCAN}/address/${a}`;
export const hasEscrow = ESCROW_ADDRESS.length === 42;
