import { useState } from "react";
import { useLocation } from "wouter";
import { Users, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { getToken } from "@/lib/auth";

const KENYAN_COUNTIES = [
  "Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Malindi","Kitale","Garissa","Kakamega",
  "Kisii","Nyeri","Meru","Embu","Machakos","Narok","Kericho","Bomet","Homa Bay","Migori",
  "Siaya","Vihiga","Bungoma","Busia","Trans Nzoia","Uasin Gishu","Elgeyo-Marakwet","Nandi","Baringo",
  "Laikipia","Samburu","Isiolo","Marsabit","Mandera","Wajir","Tana River","Lamu","Kilifi","Kwale",
  "Taita-Taveta","Makueni","Kajiado","Murang'a","Kirinyaga","Nyahururu","Kiambu","Nyandarua","Tharaka-Nithi",
];

export default function GroupSetup() {
  const [, setLocation] = useLocation();
  const [groupName, setGroupName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [location, setLocation2] = useState("");
  const [county, setCounty] = useState("");
  const [memberCount, setMemberCount] = useState(5);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/groups/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: groupName, registrationNumber: regNumber, location, county, memberCount, description }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => setLocation("/farmer"), 1500);
    } catch { setError("Network error."); setLoading(false); }
  };

  if (success) {
    return (
      <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-b from-[#f0fdf4] to-white">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground text-center">Group Registered!</h2>
        <p className="text-muted-foreground text-sm text-center">Your farmer group has been submitted for verification. Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gradient-to-b from-[#f0fdf4] to-white pb-10" data-testid="group-setup">
      {/* Header */}
      <div className="hero-header pt-12 pb-6 px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold">Register Farmer Group</h1>
            <p className="text-white/80 text-xs">Step 2 of 2 — Group Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-1.5 flex-1 bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full w-full"/></div>
          <div className="h-1.5 flex-1 bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full w-full"/></div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}

        <p className="text-muted-foreground text-sm leading-relaxed">
          Farmers register and apply for loans as a <strong className="text-foreground">group/cooperative</strong>. Please provide your group's official details.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <GField label="Group Name" placeholder="e.g. Nakuru Maize Farmers Group" value={groupName} set={setGroupName} />
          <GField label="Registration Number" placeholder="e.g. OP.218/051/10-163" value={regNumber} set={setRegNumber} />
          <GField label="Physical Location / Village" placeholder="e.g. Rongai, Nakuru" value={location} set={setLocation2} />

          <div className="space-y-1.5">
            <label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">County</label>
            <select value={county} onChange={e => setCounty(e.target.value)} required
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-white text-sm focus:outline-none focus:border-primary">
              <option value="">Select county</option>
              {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Number of Members</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMemberCount(m => Math.max(1,m-1))} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground font-bold text-lg">-</button>
              <input type="number" value={memberCount} onChange={e => setMemberCount(Number(e.target.value))} min={1}
                className="flex-1 border border-border rounded-xl px-4 py-3 text-foreground bg-white text-sm text-center font-bold focus:outline-none focus:border-primary" />
              <button type="button" onClick={() => setMemberCount(m => m+1)} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground font-bold text-lg">+</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Group Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What crops does your group grow? Any certifications?"
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-white text-sm focus:outline-none focus:border-primary resize-none" />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-green-700 text-xs leading-relaxed">
              <strong>Group Leader:</strong> You will be registered as the <strong>Group Leader</strong>. Other members can be added later. Your group details will be verified before loan applications are approved.
            </p>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading ? "Registering Group..." : "Register Group & Continue"}
          </button>
        </form>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-700 text-xs leading-relaxed">
            <strong>Why set up a group?</strong> Group registration unlocks access to cooperative loans, shared input procurement, and multi-farmer contracts. You can complete this step later from your Profile.
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem("investa_group_setup_skipped", "1");
            setLocation("/farmer");
          }}
          className="w-full text-center text-muted-foreground text-sm py-2 hover:text-foreground transition-colors"
        >
          Set up group later → Continue to dashboard
        </button>
      </div>
    </div>
  );
}

function GField({ label, placeholder, value, set, required: req = true }: { label: string; placeholder: string; value: string; set: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">{label}</label>
      <input type="text" value={value} onChange={e => set(e.target.value)} placeholder={placeholder} required={req}
        className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-white text-sm focus:outline-none focus:border-primary transition-colors" />
    </div>
  );
}
