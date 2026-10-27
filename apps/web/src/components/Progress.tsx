import { STATES } from "@/lib/abi";
import { cn } from "@/lib/cn";
export default function Progress({ state }: { state: number }) {
  const steps = state === 3 ? ["Created", "Cancelled"] : ["Escrowed + test sent", "Recipient confirmed", state === 2 ? "Released" : "Sender release"];
  const done = state === 0 ? 1 : state === 1 ? 2 : 3;
  return <div><p className="text-sm font-medium">Status: {STATES[state] ?? "Unknown"}</p><ol className="mt-3 space-y-2">{steps.map((s, i) => <li key={s} className="flex items-center gap-2 text-sm"><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", i < done ? "bg-teal-700 text-white" : "bg-zinc-200 dark:bg-zinc-800")}>{i + 1}</span><span className={i < done ? "" : "text-zinc-500"}>{s}</span></li>)}</ol></div>;
}
export function nextStepText(state: number, expired: boolean) {
  if (state === 2) return "Done. The remaining balance has been released to the recipient.";
  if (state === 3) return "This payment was cancelled. Any unpaid balance was refunded to the sender.";
  if (expired) return "This payment is past its expiration. The sender (or anyone) can call expire to refund the unpaid balance.";
  if (state === 0) return "Next: the recipient connects the receiving wallet and signs the receipt confirmation. No funds move until then.";
  return "Next: the sender reviews the full recipient address and sends the final release transaction. Nothing is released automatically.";
}
