"use client";
import { useReadContract } from "wagmi";
import { ESCROW_ABI, normalizePayment } from "@/lib/abi";
import { ESCROW_ADDRESS, hasEscrow } from "@/lib/config";
export function usePayment(id: bigint | null) {
  const q = useReadContract({ address: hasEscrow ? ESCROW_ADDRESS : undefined, abi: ESCROW_ABI, functionName: "getPayment", args: id ? [id] : undefined, query: { enabled: !!id && hasEscrow, retry: false } });
  return { ...q, payment: q.data ? normalizePayment(q.data) : null };
}
