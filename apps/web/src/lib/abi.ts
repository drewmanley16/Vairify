export const ESCROW_ABI = [
  { type: "function", name: "createPayment", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "totalAmount", type: "uint256" }, { name: "testAmount", type: "uint256" }, { name: "expiration", type: "uint256" }], outputs: [{ name: "paymentId", type: "uint256" }] },
  { type: "function", name: "confirmReceipt", stateMutability: "nonpayable", inputs: [{ name: "paymentId", type: "uint256" }, { name: "signature", type: "bytes" }], outputs: [] },
  { type: "function", name: "releasePayment", stateMutability: "nonpayable", inputs: [{ name: "paymentId", type: "uint256" }], outputs: [] },
  { type: "function", name: "cancelPayment", stateMutability: "nonpayable", inputs: [{ name: "paymentId", type: "uint256" }], outputs: [] },
  { type: "function", name: "expirePayment", stateMutability: "nonpayable", inputs: [{ name: "paymentId", type: "uint256" }], outputs: [] },
  { type: "function", name: "getPayment", stateMutability: "view", inputs: [{ name: "paymentId", type: "uint256" }], outputs: [{ name: "payment", type: "tuple", components: [{ name: "paymentId", type: "uint256" }, { name: "sender", type: "address" }, { name: "recipient", type: "address" }, { name: "totalAmount", type: "uint256" }, { name: "remainingAmount", type: "uint256" }, { name: "testAmount", type: "uint256" }, { name: "expiration", type: "uint256" }, { name: "state", type: "uint8" }] }] },
  { type: "function", name: "nextPaymentId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "event", name: "PaymentCreated", inputs: [{ name: "paymentId", type: "uint256", indexed: true }, { name: "sender", type: "address", indexed: true }, { name: "recipient", type: "address", indexed: true }, { name: "totalAmount", type: "uint256" }, { name: "testAmount", type: "uint256" }, { name: "expiration", type: "uint256" }] },
] as const;
export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
export const STATES = ["AwaitingRecipient", "AwaitingSender", "Released", "Cancelled"] as const;
export type Payment = { paymentId: bigint; sender: string; recipient: string; totalAmount: bigint; remainingAmount: bigint; testAmount: bigint; expiration: bigint; state: number };
export function normalizePayment(raw: unknown): Payment | null {
  const r = raw as Record<string, unknown> | unknown[];
  if (!r) return null;
  const get = (k: string, i: number) => (Array.isArray(r) ? r[i] : r[k]);
  if (get("sender", 1) === "0x0000000000000000000000000000000000000000") return null;
  return { paymentId: get("paymentId", 0) as bigint, sender: get("sender", 1) as string, recipient: get("recipient", 2) as string, totalAmount: get("totalAmount", 3) as bigint, remainingAmount: get("remainingAmount", 4) as bigint, testAmount: get("testAmount", 5) as bigint, expiration: get("expiration", 6) as bigint, state: Number(get("state", 7)) };
}
