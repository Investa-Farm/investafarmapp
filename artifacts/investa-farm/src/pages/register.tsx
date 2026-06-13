import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import { Loader2, Tractor, BarChart2, Handshake, Package } from "lucide-react";

type RoleKey = "investor" | "farmer" | "agribusiness";
type AgribizType = "farmer_connector" | "input_supplier";

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleKey>("investor");
  const [agribizType, setAgribizType] = useState<AgribizType>("farmer_connector");
  const [error, setError] = useState("");

  const register = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const finalRole = role === "agribusiness" ? "agribusiness" : role;
    register.mutate(
      {
        data: {
          name,
          email,
          password,
          role: finalRole as "farmer" | "investor",
          agribizType: role === "agribusiness" ? agribizType : undefined,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          setToken(data.token);
          storeUser({ ...data.user, agribizType: role === "agribusiness" ? agribizType : undefined });
          setLocation(`/verify-otp?email=${encodeURIComponent(email)}`);
        },
        onError: () => setError("Registration failed. Email may already be in use."),
      }
    );
  };

  const roles: { key: RoleKey; Icon: any; label: string; desc: string }[] = [
    { key: "investor", Icon: BarChart2, label: "Investor", desc: "Buy farm shares" },
    { key: "farmer",   Icon: Tractor,   label: "Farmer",   desc: "Raise farm capital" },
    { key: "agribusiness", Icon: Handshake, label: "Agribusiness", desc: "Supply chain partner" },
  ];

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-white flex flex-col pb-10" data-testid="register-page">
      {/* Green top accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary to-green-400 w-full" />

      <div className="pt-12 pb-5 px-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
          <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
            <path d="M20 6C12.268 6 6 12.268 6 20s6.268 14 14 14 14-6.268 14-14S27.732 6 20 6z" fill="white" fillOpacity="0.2"/>
            <path d="M12 24c2-4 5-7 8-8 3-1 6 1 8 4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M20 14v10M16 18l4-4 4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Join Investa Farm</h1>
          <p className="text-muted-foreground text-sm mt-1">Create your free account</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-white rounded-3xl border border-border p-6 space-y-4">
          {error && (
            <div data-testid="error-message" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-foreground text-xs font-semibold uppercase tracking-wider">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`role-${key}`}
                  onClick={() => setRole(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    role === key ? "border-primary bg-primary/8" : "border-border bg-muted/40"
                  }`}
                >
                  <Icon size={20} className={role === key ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-xs font-semibold ${role === key ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`text-[9px] text-center leading-tight ${role === key ? "text-primary/70" : "text-muted-foreground/70"}`}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Agribusiness sub-type */}
          {role === "agribusiness" && (
            <div className="space-y-2">
              <label className="text-foreground text-xs font-semibold uppercase tracking-wider">Agribusiness Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAgribizType("farmer_connector")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                    agribizType === "farmer_connector" ? "border-primary bg-primary/8" : "border-border bg-muted/40"
                  }`}
                >
                  <Handshake size={20} className={agribizType === "farmer_connector" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-xs font-semibold ${agribizType === "farmer_connector" ? "text-primary" : "text-muted-foreground"}`}>Farmer Connector</span>
                  <span className={`text-[9px] text-center leading-tight ${agribizType === "farmer_connector" ? "text-primary/70" : "text-muted-foreground/70"}`}>
                    Onboard & support farmers
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAgribizType("input_supplier")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                    agribizType === "input_supplier" ? "border-primary bg-primary/8" : "border-border bg-muted/40"
                  }`}
                >
                  <Package size={20} className={agribizType === "input_supplier" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-xs font-semibold ${agribizType === "input_supplier" ? "text-primary" : "text-muted-foreground"}`}>Input Supplier</span>
                  <span className={`text-[9px] text-center leading-tight ${agribizType === "input_supplier" ? "text-primary/70" : "text-muted-foreground/70"}`}>
                    Supply seeds & inputs
                  </span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { label: "Full Name", id: "name", value: name, set: setName, type: "text", placeholder: "John Kamau" },
              { label: "Email", id: "email", value: email, set: setEmail, type: "email", placeholder: "you@example.com" },
              { label: "Password", id: "password", value: password, set: setPassword, type: "password", placeholder: "Min 8 characters" },
            ].map(({ label, id, value, set, type, placeholder }) => (
              <div key={id} className="space-y-1.5">
                <label className="text-foreground text-xs font-semibold uppercase tracking-wider">{label}</label>
                <input
                  data-testid={`input-${id}`}
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  required
                  minLength={id === "password" ? 6 : undefined}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
            ))}

            <button
              data-testid="button-register"
              type="submit"
              disabled={register.isPending}
              className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-md shadow-primary/20"
            >
              {register.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {register.isPending ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="border-t border-border pt-4">
            <p className="text-center text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/login">
                <span data-testid="link-login" className="text-primary font-semibold hover:text-primary/80">Sign in</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
