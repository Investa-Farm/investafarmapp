import "./_group.css";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, Wallet } from "lucide-react";

const order = {
  farm: "Kiamaina Coffee Estate",
  shares: 10,
  sharePrice: 1000,
  duration: "~6 months",
  returnRange: "KES 1,500 – KES 2,800",
  balance: 8_000,
};

function kes(value: number) {
  return `KES ${value.toLocaleString("en-KE")}`;
}

export function Current() {
  const [showSuccess, setShowSuccess] = useState(false);
  const principal = order.shares * order.sharePrice;
  const shortfall = Math.max(0, principal - order.balance);

  return (
    <div className="investa-current min-h-screen bg-slate-200 text-foreground">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <main className="relative mx-auto flex min-h-screen max-w-[430px] items-end">
        <section className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-background shadow-2xl">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              {showSuccess ? null : <ArrowLeft size={17} className="text-muted-foreground" />}
              <div>
                <p className="font-bold">{showSuccess ? "Investment Complete!" : "Review Order"}</p>
                <p className="text-xs text-muted-foreground">{order.farm}</p>
              </div>
            </div>
            <button className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground" onClick={() => setShowSuccess(false)}>
              {showSuccess ? "Review" : "Close"}
            </button>
          </header>

          <div className="space-y-4 px-5 pb-8 pt-4">
            {!showSuccess ? (
              <>
                <div className="overflow-hidden rounded-2xl bg-muted/50">
                  {[
                    ["Farm", order.farm],
                    ["Shares", `${order.shares} shares`],
                    ["Price per share", kes(order.sharePrice)],
                    ["Exit strategy", "Full Season Exit"],
                    ["Expected duration", order.duration],
                    ["Estimated return", order.returnRange],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-right text-sm font-semibold">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-primary/5 px-4 py-4">
                    <span className="font-bold">Total to Pay</span>
                    <span className="text-lg font-bold text-primary">{kes(principal)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">Insufficient wallet balance</p>
                  <p className="mt-1 text-[11px] text-amber-800">Top up {kes(shortfall)} to proceed with this investment.</p>
                </div>

                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white">
                  <Wallet size={15} /> Top Up KES Wallet
                </button>
                <button onClick={() => setShowSuccess(true)} className="w-full text-xs font-semibold text-primary underline underline-offset-4">
                  Preview the original confirmation
                </button>
              </>
            ) : (
              <div className="space-y-4 py-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">You’re invested</h2>
                    <p className="mt-1 text-sm text-muted-foreground">You now own {order.shares} shares of {order.farm}</p>
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount invested</span><b>{kes(principal)}</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shares owned</span><b>{order.shares} shares</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Exit strategy</span><b>Full Season</b></div>
                  <div className="flex items-center gap-2 border-t border-green-200 pt-2 text-xs text-green-800"><Clock3 size={13} /> Expected return: {order.returnRange}</div>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white">
                  View Portfolio <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
