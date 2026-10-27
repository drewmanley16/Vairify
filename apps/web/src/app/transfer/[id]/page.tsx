"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Button, Card, GhostButton, Badge, Callout, Mono } from "@/components/ui";
import Progress, { nextStepText } from "@/components/Progress";
import { STATES } from "@/lib/abi";
import { ESCROW_ADDRESS, addrUrl, hasEscrow, txUrl } from "@/lib/config";
import { fmtDate, fmtUSDC, localTxs, rememberTx } from "@/lib/format";
import { usePayment } from "@/lib/usePayment";
import { ESCROW_ABI } from "@/lib/abi";

export default function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const pid = (() => { try { return BigInt(id); } catch { return null; } })();
  const { address, isConnected } = useAccount(); const publicClient = usePublicClient(); const { writeContractAsync, isPending } = useWriteContract();
  const { payment, isLoading, error } = usePayment(pid); const [txs, setTxs] = useState<{ label: string; hash: string }[]>([]);
  useEffect(() => { if (pid) setTxs(localTxs(pid)); }, [pid]);
  async function act(fn: "releasePayment" | "cancelPayment" | "expirePayment", label: string) { try { const h = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: fn, args: [pid!] }); toast.success(`${label} submitted`); if (pid) { rememberTx(pid, label, h); setTxs(localTxs(pid)); } await publicClient?.waitForTransactionReceipt({ hash: h }); window.location.reload(); } catch (e) { toast.error(e instanceof Error ? e.message : `${label} failed`); } }
  if (!hasEscrow) return <Card>Escrow contract not configured. Set NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS.</Card>;
  if (!pid) return <Card>Invalid payment ID.</Card>;
  if (isLoading) return <Card>Loading payment from the contract…</Card>;
  if (error || !payment) return <Card>Payment not found on this contract. Check the ID and that you are on the correct network.</Card>;
  const expired = Date.now() / 1000 > Number(payment.expiration); const isSender = address?.toLowerCase() === payment.sender.toLowerCase(); const canRelease = payment.state === 1 && isSender; const canCancel = (payment.state === 0 || payment.state === 1) && isSender; const canExpire = expired && (payment.state === 0 || payment.state === 1);
  return <div className="mx-auto max-w-3xl space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Transfer #{payment.paymentId.toString()}</h1><Badge tone={payment.state === 2 ? "ok" : payment.state === 3 ? "bad" : "warn"}>{STATES[payment.state]}</Badge></div>
    <div className="grid gap-4 md:grid-cols-2"><Card><Progress state={payment.state} /><p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{nextStepText(payment.state, expired)}</p></Card>
    <Card className="space-y-2 text-sm"><div className="flex justify-between"><span>Total</span><strong>{fmtUSDC(payment.totalAmount)} USDC</strong></div><div className="flex justify-between"><span>Test payment</span><strong>{fmtUSDC(payment.testAmount)} USDC</strong></div><div className="flex justify-between"><span>Remaining in escrow</span><strong>{fmtUSDC(payment.remainingAmount)} USDC</strong></div><div className="flex justify-between"><span>Expires</span><strong>{fmtDate(payment.expiration)}</strong></div><div><p className="font-medium">Sender</p><a className="text-teal-700" href={addrUrl(payment.sender)} target="_blank" rel="noreferrer"><Mono>{payment.sender}</Mono></a></div><div><p className="font-medium">Recipient</p><a className="text-teal-700" href={addrUrl(payment.recipient)} target="_blank" rel="noreferrer"><Mono>{payment.recipient}</Mono></a></div></Card></div>
    {payment.state === 1 && <Callout><strong>Sender approval required.</strong> Review the full recipient address above and confirm it belongs to your intended counterparty before releasing. This page never releases funds automatically.</Callout>}
    {!isConnected && <Callout>Connect a wallet to take action on this transfer.</Callout>}
    <Card><h2 className="font-semibold">Actions</h2><div className="mt-3 flex flex-wrap gap-2">
      {payment.state === 0 && <Link href={`/receive/${payment.paymentId}`}><Button>Go to recipient verification</Button></Link>}
      {canRelease && <Button disabled={isPending} onClick={() => act("releasePayment", "releasePayment")}>{isPending ? "Waiting…" : `Release ${fmtUSDC(payment.remainingAmount)} USDC`}</Button>}
      {canCancel && <GhostButton disabled={isPending} onClick={() => act("cancelPayment", "cancelPayment")}>Cancel and refund</GhostButton>}
      {canExpire && <GhostButton disabled={isPending} onClick={() => act("expirePayment", "expirePayment")}>Expire and refund unpaid balance</GhostButton>}
      {!canRelease && !canCancel && !canExpire && payment.state !== 0 && <p className="text-sm text-zinc-500">No action is available for this state.</p>}
    </div>{!isSender && isConnected && <p className="mt-2 text-xs text-zinc-500">Only the original sender can release or cancel this payment.</p>}</Card>
    <Card><h2 className="font-semibold">Transactions from this browser</h2>{txs.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No transactions for this payment were recorded in this browser. Only hashes returned by real wallet transactions are shown; hashes are not fabricated.</p> : <ul className="mt-2 space-y-2 text-sm">{txs.map((t, i) => <li key={i}>{t.label}: <a className="text-teal-700" href={txUrl(t.hash)} target="_blank" rel="noreferrer"><Mono>{t.hash}</Mono></a></li>)}</ul>}<p className="mt-3 text-sm">Escrow contract: <a className="text-teal-700" href={addrUrl(ESCROW_ADDRESS)} target="_blank" rel="noreferrer"><Mono>{ESCROW_ADDRESS}</Mono></a></p></Card>
  </div>;
}
