import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface CaptchaProps {
  onVerified: (ok: boolean) => void;
}

function newChallenge() {
  const ops = ["+", "−"] as const;
  const op = ops[Math.floor(Math.random() * 2)];
  const a = Math.floor(Math.random() * 9) + 1;
  const b = op === "+" ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * (a - 1)) + 1;
  return { a, b, op, answer: op === "+" ? a + b : a - b };
}

export function Captcha({ onVerified }: CaptchaProps) {
  const [challenge, setChallenge] = useState(newChallenge);
  const [input, setInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);

  const refresh = () => {
    setChallenge(newChallenge());
    setInput("");
    setVerified(false);
    setError(false);
    onVerified(false);
  };

  const check = (val: string) => {
    setInput(val);
    setError(false);
    if (val.trim() === String(challenge.answer)) {
      setVerified(true);
      onVerified(true);
    } else if (val.length > 2) {
      setError(true);
      onVerified(false);
    }
  };

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${
      verified ? "border-green-400 bg-green-50" : error ? "border-red-300 bg-red-50" : "border-border bg-muted/40"
    }`}>
      <div className="flex-1">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2">
          🔒 Security check — humans only
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-foreground font-black text-base font-mono">
            {challenge.a} {challenge.op} {challenge.b} =
          </span>
          {!verified ? (
            <input
              type="number"
              inputMode="numeric"
              value={input}
              onChange={e => check(e.target.value)}
              placeholder="?"
              className={`w-16 text-center bg-background border rounded-lg px-2 py-1.5 text-foreground text-sm font-mono font-bold focus:outline-none transition-colors ${
                error ? "border-red-400 focus:border-red-400" : "border-border focus:border-primary"
              }`}
            />
          ) : (
            <span className="text-green-600 font-black text-base font-mono">{challenge.answer} ✓</span>
          )}
        </div>
        {error && <p className="text-red-500 text-[11px] mt-1">Incorrect answer — please try again</p>}
        {verified && <p className="text-green-600 text-[11px] mt-1 font-medium">Verified ✓ You're human!</p>}
      </div>
      <button
        type="button"
        onClick={refresh}
        title="New challenge"
        className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
      >
        <RefreshCw size={13} className="text-muted-foreground" />
      </button>
    </div>
  );
}
