import "./_group.css";
import { useState } from "react";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, CreditCard, LockKeyhole, Smartphone, Sprout, Wallet } from "lucide-react";

const order = {
  farm: "Kiamaina Coffee Estate",
  crop: "Arabica coffee",
  location: "Kirinyaga County",
  image: "/__mockup/images/investa-current/coffee.jpg",
  shares: 10,
  sharePrice: 1000,
  fee: 150,
  balance: 8_000,
};

function kes(value: number) {
  return `KES ${value.toLocaleString("en-KE")}`;
}

export function Refined() {
  const [screen, setScreen] = useState<"review" | "fund" | "success">("review");
  const [fundingMethod, setFundingMethod] = useState<"mobile" | "card">("mobile");
  const [walletBalance, setWalletBalance] = useState(order.balance);
  const investment = order.shares * order.sharePrice;
  const total = investment + order.fee;
  const shortfall = Math.max(0, total - walletBalance);
  const progress = screen === "review" ? 2 : screen === "fund" ? 2 : 3;

  return (
    <div className="investa-current min-h-screen bg-[#e9ede9] text-foreground">
      <div className="absolute inset-0 bg-[#0c1b13]/55 backdrop-blur-sm" />
      <main className="relative mx-auto flex min-h-screen max-w-[430px] items-end">
        <section className="max-h-[95dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/50 bg-background shadow-[0_28px_90px_rgba(7,32,19,.34)]">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />
          <header className="flex items-center justify-between px-5 pb-3 pt-4">
            <button onClick={() => setScreen(screen === "success" ? "review" : "review")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/80">
              <ArrowLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold">{screen === "success" ? "Investment recorded" : screen === "fund" ? "Add funds" : "Review investment"}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{order.farm}</p>
            </div>
            <button onClick={() => setScreen("review")} className="rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground">Close</button>
          </header>

          <div className="px-5 pb-7 pt-1">
            <div className="mb-4 flex items-center gap-2" aria-label={`Step ${progress} of 3`}>
              {["Choose shares", "Review & fund", "Complete"].map((label, index) => {
                const active = index + 1 === progress;
                const passed = index + 1 < progress;
                return (
                  <div className="flex flex-1 items-center gap-1.5" key={label}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active || passed ? "bg-[#1c6b45] text-white" : "bg-muted text-muted-foreground"}`}>
                      {passed ? <Check size={12} /> : index + 1}
                    </span>
                    <span className={`text-[9px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    {index < 2 && <span className={`h-px flex-1 ${passed ? "bg-[#1c6b45]" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>

            {screen === "review" && (
              <div className="space-y-3">
                <div className="relative isolate min-h-[130px] overflow-hidden rounded-2xl bg-[#213b2d]">
                  <img src={order.image} alt="Coffee farm" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#13281e]/95 via-[#193126]/40 to-transparent" />
                  <div className="relative flex min-h-[130px] flex-col justify-end p-4 text-white">
                    <p className="text-[9px] font-bold uppercase tracking-[.17em] text-white/75">{order.crop} · {order.location}</p>
                    <h2 className="mt-1 text-xl font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{order.farm}</h2>
                    <p className="mt-1 text-[10px] text-white/80">{order.shares} shares · {kes(order.sharePrice)} each</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="flex items-center justify-between px-4 py-3 text-xs">
                    <span className="text-muted-foreground">Investment amount</span><span className="font-semibold">{kes(investment)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
                    <span className="text-muted-foreground">Platform fee · 1.5%</span><span className="font-semibold">{kes(order.fee)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#d9e5d8] bg-[#eef5ef] px-4 py-3">
                    <span className="text-sm font-bold">Total to pay</span><span className="text-lg font-bold text-[#1c6b45]">{kes(total)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-[10px] text-muted-foreground">
                    <span>Full Season · estimated return</span><span className="font-semibold text-green-700">+KES 1,500–2,800</span>
                  </div>
                </div>

                <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${shortfall ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
                  <div className="flex items-center gap-2">
                    <Wallet size={15} className={shortfall ? "text-amber-700" : "text-green-700"} />
                    <div><p className="text-[10px] font-semibold">KES wallet</p><p className="text-[10px] text-muted-foreground">{kes(walletBalance)} available</p></div>
                  </div>
                  <span className={`text-[10px] font-bold ${shortfall ? "text-amber-800" : "text-green-800"}`}>{shortfall ? `${kes(shortfall)} short` : "Ready"}</span>
                </div>

                <div>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Choose how to fund</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setScreen("fund")} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-xs font-semibold active:scale-[.98]">
                      <Smartphone size={15} className="text-green-700" /> Mobile Money
                    </button>
                    <button onClick={() => { setFundingMethod("card"); setScreen("fund"); }} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-xs font-semibold active:scale-[.98]">
                      <CreditCard size={15} className="text-blue-700" /> Card
                    </button>
                  </div>
                </div>

                {shortfall > 0 ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
                    Your top-up is added to your KES wallet first. You’ll confirm this investment separately after the balance updates.
                  </p>
                ) : (
                  <button onClick={() => setScreen("success")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#155c3b] to-[#218352] py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/15 active:scale-[.98]">
                    <LockKeyhole size={15} /> Confirm investment · {kes(total)}
                  </button>
                )}
                {shortfall > 0 && <p className="text-center text-[9px] text-muted-foreground">Wallet payments keep their existing PIN protection.</p>}
              </div>
            )}

            {screen === "fund" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#163d2a] p-4 text-white">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/70">Top up KES wallet</p>
                  <p className="mt-1 text-2xl font-bold">{kes(shortfall || total)}</p>
                  <p className="mt-1 text-[10px] text-white/75">Funding is separate from your share purchase.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setFundingMethod("mobile")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold ${fundingMethod === "mobile" ? "border-green-600 bg-green-50 text-green-900" : "border-border bg-white"}`}>
                    <Smartphone size={15} /> Mobile Money
                  </button>
                  <button onClick={() => setFundingMethod("card")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold ${fundingMethod === "card" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-border bg-white"}`}>
                    <CreditCard size={15} /> Card
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs font-bold">{fundingMethod === "mobile" ? "M-Pesa · Kenya" : "Credit or debit card"}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Secure checkout via PesaPal</p>
                  {fundingMethod === "mobile" && <p className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">Payment request sent to your saved phone number</p>}
                </div>
                <button onClick={() => { setWalletBalance(walletBalance + (shortfall || total)); setScreen("review"); }} className="w-full rounded-xl bg-[#1c6b45] py-3.5 text-sm font-bold text-white active:scale-[.98]">
                  Continue with {fundingMethod === "mobile" ? "Mobile Money" : "Card"}
                </button>
                <button onClick={() => setScreen("review")} className="w-full py-2 text-xs font-semibold text-muted-foreground">Back to review</button>
              </div>
            )}

            {screen === "success" && (
              <div className="space-y-3">
                <div className="relative isolate min-h-[185px] overflow-hidden rounded-[24px] bg-[#203b2e]">
                  <img src={order.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#14281f]/95 via-[#193126]/50 to-[#193126]/10" />
                  <div className="relative flex min-h-[185px] flex-col justify-between p-4 text-white">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-[#173327]/65 px-2.5 py-1 text-[9px] font-semibold tracking-wide"><CheckCircle2 size={12} /> INVESTMENT RECORDED</span>
                    <div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-white/75">{order.crop} · {order.location}</p><h2 className="mt-1 text-2xl font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{order.farm}</h2><p className="mt-1 text-[10px] text-white/80">Your shares are now in your portfolio.</p></div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#d9e5d8] bg-[#f0f5ed]">
                  <div className="bg-[#244b38] px-4 py-3 text-white"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-white/70">Total paid · fee included</p><p className="mt-1 text-3xl font-bold">{kes(total)}</p></div>
                  <div className="flex items-center justify-between px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Shares acquired</p><p className="mt-0.5 text-xl font-bold">{order.shares} shares</p></div><div className="text-right text-[10px] text-muted-foreground"><p>Investment {kes(investment)}</p><p>Fee {kes(order.fee)}</p></div></div>
                </div>
                <div role="status" className="flex gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-[10px] leading-relaxed text-green-800">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> SMS request accepted by the provider; handset delivery is not confirmed.
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c6b45] py-3.5 text-sm font-bold text-white">View Portfolio <ChevronRight size={15} /></button>
                <div className="flex items-center justify-center gap-2 py-1 text-[9px] text-muted-foreground"><Sprout size={12} /> A more rewarding way to grow together</div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
