import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { setToken, storeUser } from "@/lib/auth";
import { TrendingUp, Loader2, Tractor, BarChart2, Handshake, Package } from "lucide-react";

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
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gradient-to-b from-[#0a2e10] via-[#0f3d1a] to-[#143d1a] flex flex-col pb-10" data-testid="register-page">
      <div className="pt-14 pb-6 px-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto border border-green-500/30">
          <TrendingUp size={28} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-[Space_Grotesk]">Join Investa Farm</h1>
          <p className="text-white/60 text-sm mt-1">Create your free account</p>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-6 space-y-4">
          {error && (
            <div data-testid="error-message" className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-white/70 text-xs font-medium uppercase tracking-wider">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`role-${key}`}
                  onClick={() => setRole(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                    role === key ? "border-green-400 bg-green-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  <Icon size={20} className={role === key ? "text-green-400" : "text-white/50"} />
                  <span className={`text-xs font-medium ${role === key ? "text-white" : "text-white/50"}`}>{label}</span>
                  <span className={`text-[9px] text-center leading-tight ${role === key ? "text-white/70" : "text-white/30"}`}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Agribusiness sub-type */}
          {role === "agribusiness" && (
            <div className="space-y-2">
              <label className="text-white/70 text-xs font-medium uppercase tracking-wider">Agribusiness Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAgribizType("farmer_connector")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                    agribizType === "farmer_connector" ? "border-green-400 bg-green-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  <Handshake size={20} className={agribizType === "farmer_connector" ? "text-green-400" : "text-white/50"} />
                  <span className={`text-xs font-medium ${agribizType === "farmer_connector" ? "text-white" : "text-white/50"}`}>Farmer Connector</span>
                  <span className={`text-[9px] text-center leading-tight ${agribizType === "farmer_connector" ? "text-white/70" : "text-white/30"}`}>
                    Onboard & support farmers
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAgribizType("input_supplier")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                    agribizType === "input_supplier" ? "border-green-400 bg-green-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  <Package size={20} className={agribizType === "input_supplier" ? "text-green-400" : "text-white/50"} />
                  <span className={`text-xs font-medium ${agribizType === "input_supplier" ? "text-white" : "text-white/50"}`}>Input Supplier</span>
                  <span className={`text-[9px] text-center leading-tight ${agribizType === "input_supplier" ? "text-white/70" : "text-white/30"}`}>
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
                <label className="text-white/70 text-xs font-medium uppercase tracking-wider">{label}</label>
                <input
                  data-testid={`input-${id}`}
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  required
                  minLength={id === "password" ? 6 : undefined}
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-green-400/50 transition-colors"
                />
              </div>
            ))}

            <button
              data-testid="button-register"
              type="submit"
              disabled={register.isPending}
              className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {register.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {register.isPending ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="border-t border-white/10 pt-4">
            <p className="text-center text-white/50 text-sm">
              Already have an account?{" "}
              <Link href="/login">
                <span data-testid="link-login" className="text-green-400 font-medium hover:text-green-300">Sign in</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
