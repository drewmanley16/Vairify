"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { isAddress, parseUnits } from "viem";
import { toast } from "sonner";
import Link from "next/link";
import { Button, Card, GhostButton, Input, Label, Callout, Mono } from "@/components/ui";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abi";
import { CHAIN, ESCROW_ADDRESS, USDC_ADDRESS, hasEscrow } from "@/lib/config";
import { TEST_AMOUNT, fmtUSDC, rememberPaymentId, rememberTx, setThresholdPref, thresholdPref, toUnits } from "@/lib/format";

export default function SendPage() {
  const { address, isConnected } = useAccount(); const chainId = useChainId(); const publicClient = usePublicClient();
  const [recipient, setRecipient] = useState(""); const [amount, setAmount] = useState("5000"); const [threshold, setThreshold] = useState("100");
  const [days, setDays] = useState("7"); const [step, setStep] = useState<"form" | "review">("form"); const [gas, setGas] = useState<string | null>(null);
  useEffect(() => { setThreshold(thresholdPref()); }, []);
  const total = useMemo(() => { try { return toUnits(amount || "0"); } catch { return 0n; } }, [amount]);
  const test = parseUnits(TEST_AMOUNT, 6); const finalAmt = total > test ? total - test : 0n;
  const expiration = useMemo(() => BigInt(Math.floor(Date.now() / 1000) + Number(days || "0") * 86400), [days]);
  const { data: balance } = useReadContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: address && hasEscrow ? [address, ESCROW_ADDRESS] : undefined, query: { enabled: !!address && hasEscrow } });
  const { writeContractAsync, isPending } = useWriteContract();
  const needsApproval = hasEscrow && (allowance ?? 0n) < total;
  useEffect(() => { if (!publicClient || !hasEscrow || !isAddress(recipient) || total === 0n) return; publicClient.estimateContractGas({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createPayment", args: [recipient as `0x${string}`, total, test, expiration], account: address }).then(g => setGas(g.toString())).catch(() => setGas(null)); }, [publicClient, recipient, total, expiration, address]);
  const valid = isAddress(recipient) && total > test && expiration > BigInt(Math.floor(Date.now() / 1000));
  async function approve() { try { const h = await writeContractAsync({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [ESCROW_ADDRESS, total] }); toast.success(`Approval submitted: ${h}`); await publicClient?.waitForTransactionReceipt({ hash: h }); refetchAllowance(); } catch (e) { toast.error(e instanceof Error ? e.message : "Approval failed"); } }
  async function create() { if (!hasEscrow) return; try { const h = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createPayment", args: [recipient as `0x${string}`, total, test, expiration] }); toast.success("Payment creation submitted"); const receipt = await publicClient?.waitForTransactionReceipt({ hash: h }); let id: bigint | null = null; for (const log of receipt?.logs ?? []) { try { const { decodeEventLog } = await import("viem"); const ev = decodeEventLog({ abi: ESCROW_ABI, data: log.data, topics: log.topics }); if (ev.eventName === "PaymentCreated") id = ev.args.paymentId as bigint; } catch {} } if (id) { rememberPaymentId(id); rememberTx(id, "createPayment", h); window.location.href = `/transfer/${id}`; } else { toast.success(`Created. Transaction: ${h}`); } } catch (e) { toast.error(e instanceof Error ? e.message : "Payment creation failed"); } }
  if (!hasEscrow) return <Card><h1 className="text-2xl font-bold">Escrow contract not configured</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Set NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS in apps/web/.env.local to a deployed VairifyEscrow address on {CHAIN.name}, then restart the app. No payment can be created until then, and no balance or history is fabricated here.</p></Card>;
  return <div className="mx-auto max-w-2xl space-y-6"><h1 className="text-3xl font-bold">New transfer</h1>
    {!isConnected && <Callout>Connect your wallet to send. You must be on {CHAIN.name} (chain {CHAIN.id}).</Callout>}
    {chainId !== CHAIN.id && isConnected && <Callout>Wrong network: connected chain {chainId}, expected {CHAIN.id} ({CHAIN.name}). Switch networks in your wallet.</Callout>}
    <Card className="space-y-4">
      <div><Label>Recipient wallet address</Label><Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" /></div>
      <div><Label>USDC amount</Label><Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" /></div>
      <div><Label>Verification threshold (your preference only)</Label><Input value={threshold} onChange={e => { setThreshold(e.target.value); setThresholdPref(e.target.value); }} inputMode="decimal" /><p className="mt-1 text-xs text-zinc-500">Stored locally in this browser. It is NOT enforced on chain by this MVP, and it does not apply to transfers made outside Vairify. Every transfer created here uses two-party verification regardless of this value.</p></div>
      <div><Label>Expiration (days from now)</Label><Input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" /></div>
      <div className="grid grid-cols-2 gap-3 text-sm"><div>Test amount (fixed)</div><div className="text-right font-semibold">0.01 USDC</div><div>Network</div><div className="text-right">{CHAIN.name}</div><div>Your USDC balance</div><div className="text-right">{balance !== undefined ? `${fmtUSDC(balance as bigint)} USDC` : "—"}</div><div>Estimated gas (createPayment)</div><div className="text-right">{gas ? `${gas} gas units` : "Estimated at transaction time"}</div></div>
      {step === "form" ? <Button disabled={!valid || !isConnected} onClick={() => setStep("review")}>Review transfer</Button> : <div className="space-y-4 rounded-xl border p-4"><h2 className="font-semibold">Review the full recipient address</h2><Mono>{recipient}</Mono><p className="text-sm">Check every character. The recipient address can never be changed after creation.</p><div className="space-y-1 text-sm"><div className="flex justify-between"><span>Total</span><strong>{fmtUSDC(total)} USDC</strong></div><div className="flex justify-between"><span>Test payment</span><strong>0.01 USDC</strong></div><div className="flex justify-between"><span>Final payment</span><strong>{fmtUSDC(finalAmt)} USDC</strong></div><div className="flex justify-between"><span>Expires</span><strong>{new Date(Number(expiration) * 1000).toLocaleString()}</strong></div></div><div className="flex flex-wrap gap-2"><GhostButton onClick={() => setStep("form")}>Edit</GhostButton>{needsApproval ? <Button disabled={isPending} onClick={approve}>{isPending ? "Waiting…" : `Approve ${fmtUSDC(total)} USDC`}</Button> : <Button disabled={isPending || !isConnected} onClick={create}>{isPending ? "Waiting…" : "Deposit in escrow and send test"}</Button>}</div>{needsApproval && <p className="text-xs text-zinc-500">Approval is a separate wallet transaction. After it confirms, the deposit button appears here.</p>}</div>}
    </Card>
    <p className="text-sm text-zinc-500">The contract is unaudited. Use test funds only.</p>
  </div>;
}
