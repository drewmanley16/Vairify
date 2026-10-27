import { formatUnits, parseUnits } from "viem";
export const fmtUSDC = (v: bigint) => Number(formatUnits(v, 6)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
export const toUnits = (s: string) => parseUnits(s, 6);
export const TEST_AMOUNT = "0.01";
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const fmtDate = (ts: bigint | number) => new Date(Number(ts) * 1000).toLocaleString();
export function rememberPaymentId(id: bigint) {
  try { const k = "vairify:paymentIds"; const cur = JSON.parse(localStorage.getItem(k) || "[]") as string[]; if (!cur.includes(id.toString())) localStorage.setItem(k, JSON.stringify([...cur, id.toString()])); } catch { /* ignore */ }
}
export function localPaymentIds(): bigint[] { try { return (JSON.parse(localStorage.getItem("vairify:paymentIds") || "[]") as string[]).map(BigInt); } catch { return []; } }
export function rememberTx(id: bigint, label: string, hash: string) {
  try { const k = `vairify:tx:${id}`; const cur = JSON.parse(localStorage.getItem(k) || "[]") as { label: string; hash: string }[]; localStorage.setItem(k, JSON.stringify([...cur, { label, hash }])); } catch { /* ignore */ }
}
export function localTxs(id: bigint): { label: string; hash: string }[] { try { return JSON.parse(localStorage.getItem(`vairify:tx:${id}`) || "[]"); } catch { return []; } }
export function thresholdPref(): string { try { return localStorage.getItem("vairify:threshold") || "100"; } catch { return "100"; } }
export function setThresholdPref(v: string) { try { localStorage.setItem("vairify:threshold", v); } catch { /* ignore */ } }
