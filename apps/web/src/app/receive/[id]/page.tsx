"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useSignTypedData, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Button, Card, Callout, Mono, Badge } from "@/components/ui";
import { ESCROW_ABI, STATES } from "@/lib/abi";
import { CHAIN_ID, ESCROW_ADDRESS, addrUrl, hasEscrow } from "@/lib/config";
import { fmtDate, fmtUSDC, rememberTx } from "@/lib/format";
import { usePayment } from "@/lib/usePayment";

export default function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const pid = (() => { try { return BigInt(id); } catch { return null; } })();
  const { address, isConnected } = useAccount(); const publicClient = usePublicClient(); const { signTypedDataAsync } = useSignTypedData(); const { writeContractAsync, isPending } = useWriteContract();
  const { payment, isLoading, error } = usePayment(pid); const [sig, setSig] = useState<string | null>(null); const [done, setDone] = useState(false);
  if (!hasEscrow) return <Card>Escrow contract not configured. Set NEXT_PUBLIC_VAIRIFY_ESCROW_ADDRESS.</Card>;
  if (!pid) return <Card>Invalid payment ID.</Card>;
  if (isLoading) return <Card>Loading payment from the contract…</Card>;
  if (error || !payment) return <Card>Payment not found on this contract. Check the link and network.</Card>;
  const matches = address?.toLowerCase() === payment.recipient.toLowerCase(); const expired = Date.now() / 1000 > Number(payment.expiration);
  async function signAndSubmit() {
    try {
      const signature = await signTypedDataAsync({ domain: { name: "VairifyEscrow", version: "1", chainId: CHAIN_ID, verifyingContract: ESCROW_ADDRESS }, types: { Receipt: [{ name: "paymentId", type: "uint256" }, { name: "escrow", type: "address" }, { name: "chainId", type: "uint256" }, { name: "sender", type: "address" }, { name: "recipient", type: "address" }, { name: "totalAmount", type: "uint256" }, { name: "testAmount", type: "uint256" }, { name: "expiration", type: "uint256" }] }, primaryType: "Receipt", message: { paymentId: payment!.paymentId, escrow: ESCROW_ADDRESS, chainId: BigInt(CHAIN_ID), sender: payment!.sender as `0x${string}`, recipient: payment!.recipient as `0x${string}`, totalAmount: payment!.totalAmount, testAmount: payment!.testAmount, expiration: payment!.expiration } });
      setSig(signature);
      const h = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "confirmReceipt", args: [payment!.paymentId, signature] });
      rememberTx(payment!.paymentId, "confirmReceipt", h); await publicClient?.waitForTransactionReceipt({ hash: h }); setDone(true); toast.success("Receipt confirmed on chain");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Confirmation failed"); }
  }
  return <div className="mx-auto max-w-2xl space-y-6"><h1 className="text-3xl font-bold">Confirm receipt</h1><Badge>{STATES[payment.state]}</Badge>
    <Callout><strong>Important limitation:</strong> signing proves authorization by this wallet. It does not prove the real-world identity of the intended recipient. If you did not expect this payment, do not sign.</Callout>
    <Card className="space-y-3 text-sm"><div className="flex justify-between"><span>Total amount</span><strong>{fmtUSDC(payment.totalAmount)} USDC</strong></div><div className="flex justify-between"><span>Test payment</span><strong>{fmtUSDC(payment.testAmount)} USDC</strong></div><div className="flex justify-between"><span>Final payment (after sender release)</span><strong>{fmtUSDC(payment.remainingAmount)} USDC</strong></div><div className="flex justify-between"><span>Expires</span><strong>{fmtDate(payment.expiration)}</strong></div><div><p className="font-medium">Destination address (must match your connected wallet)</p><a className="text-teal-700" href={addrUrl(payment.recipient)} target="_blank" rel="noreferrer"><Mono>{payment.recipient}</Mono></a></div><div><p className="font-medium">Sender</p><Mono>{payment.sender}</Mono></div></Card>
    <Card className="space-y-3"><h2 className="font-semibold">What you are signing</h2><p className="text-sm text-zinc-600 dark:text-zinc-300">An EIP-712 Receipt message binding this payment ID, the escrow contract, the chain, sender, recipient, total amount, test amount, and expiration. This signature does not move funds, share a private key, or cost you USDC. It only lets the contract mark this payment as receipt-confirmed, after which the sender must still separately release the final amount.</p>
    {!isConnected && <p className="text-sm">Connect the receiving wallet to continue.</p>}
    {isConnected && !matches && <Callout>Connected wallet does not match the recipient address above. Switch accounts in your wallet to the receiving wallet, or do not sign.</Callout>}
    {expired && <Callout>This payment is expired. A confirmation signature will be rejected by the contract.</Callout>}
    {done || payment.state >= 1 ? <p className="font-semibold text-emerald-700">Receipt acknowledged. The sender must now review and release the final payment. Nothing else is required from you here.</p> : <Button disabled={!isConnected || !matches || expired || isPending} onClick={signAndSubmit}>{isPending ? "Waiting…" : "Sign receipt confirmation"}</Button>}
    {sig && <p className="text-xs text-zinc-500">Signature created in this browser. It was submitted to confirmReceipt; see the transfer page for the transaction hash.</p>}
    </Card>
    <Link href={`/transfer/${payment.paymentId}`} className="text-sm font-medium text-teal-700">View transfer details</Link>
  </div>;
}
