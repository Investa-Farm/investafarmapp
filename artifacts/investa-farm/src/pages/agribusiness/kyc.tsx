import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  ArrowLeft, ShieldCheck, Upload, CheckCircle2, Clock, X,
  FileText, Camera, AlertCircle, Loader2, Building2
} from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const DOC_TYPES = [
  { value: "national_id",    label: "National ID (Front)", emoji: "🪪", hint: "Front side of your national ID card" },
  { value: "national_id_back", label: "National ID (Back)", emoji: "🪪", hint: "Back side of your national ID card" },
  { value: "business_registration", label: "Business Registration", emoji: "📋", hint: "Certificate of incorporation or business registration" },
  { value: "financial_statement", label: "Financial Statement", emoji: "💰", hint: "Bank statement or financial records (last 3 months)" },
  { value: "selfie",         label: "Selfie with ID", emoji: "🤳", hint: "Clear selfie holding your national ID" },
  { value: "other",          label: "Other Document", emoji: "📎", hint: "Any additional supporting document" },
] as const;

type DocTypeValue = typeof DOC_TYPES[number]["value"];

interface KycDoc {
  id: number;
  docType: string;
  title: string;
  fileUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function AgribusinessKyc() {
  const token = getToken();
  const user = getStoredUser();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, { file: File; preview: string }>>({});
  const [submitDone, setSubmitDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocType, setActiveDocType] = useState<DocTypeValue | null>(null);

  const { data: kycDocs = [], refetch } = useQuery<KycDoc[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const uploadedTypes = new Set(kycDocs.map(d => d.docType));
  const approvedCount = kycDocs.filter(d => d.status === "approved").length;
  const pendingCount = kycDocs.filter(d => d.status === "pending").length;

  const handleFileSelect = (docType: DocTypeValue, file: File) => {
    const preview = URL.createObjectURL(file);
    setStaged(prev => ({ ...prev, [docType]: { file, preview } }));
  };

  const handleUpload = async (docType: DocTypeValue) => {
    const entry = staged[docType];
    if (!entry) return;
    setUploading(docType);
    setError(null);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", entry.file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");

      const fileUrl = uploadData.url ?? uploadData.fileUrl ?? uploadData.path;

      // Register KYC document
      const docInfo = DOC_TYPES.find(d => d.value === docType);
      const kycRes = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          docType,
          title: docInfo?.label ?? docType,
          fileUrl,
          notes: `Uploaded by ${user?.name ?? "user"} for business KYC verification`,
        }),
      });
      const kycData = await kycRes.json();
      if (!kycRes.ok) throw new Error(kycData.error ?? "Failed to register document");

      // Clear staged and refresh
      setStaged(prev => {
        const next = { ...prev };
        delete next[docType];
        URL.revokeObjectURL(entry.preview);
        return next;
      });
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      await refetch();
      setSubmitDone(true);
      setTimeout(() => setSubmitDone(false), 3000);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const docStatusFor = (docType: string): KycDoc | undefined =>
    kycDocs.find(d => d.docType === docType);

  return (
    <div className="app-shell pb-10 page-enter">
      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 160 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setLocation("/agribusiness")}
              className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="flex-1">
              <p className="text-white/70 text-xs">Business Verification</p>
              <h1 className="text-white font-bold text-lg">KYC Documents</h1>
            </div>
            <img src={logoSrc} alt="Investa" className="h-7 opacity-90" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          {/* Progress */}
          <div className="flex items-center gap-3 pb-4">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, (kycDocs.length / DOC_TYPES.length) * 100)}%` }} />
            </div>
            <span className="text-white/80 text-xs font-semibold">{kycDocs.length}/{DOC_TYPES.length} uploaded</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* Status card */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Uploaded", val: kycDocs.length, color: "text-foreground" },
            { label: "Pending", val: pendingCount, color: "text-amber-600" },
            { label: "Approved", val: approvedCount, color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className={`font-bold text-xl ${s.color}`}>{s.val}</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Success toast */}
        {submitDone && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-green-700 text-sm font-medium">Document uploaded successfully!</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} className="text-red-400" /></button>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-emerald-800 font-semibold text-sm mb-1">📋 Required Documents</p>
          <p className="text-emerald-700 text-xs leading-relaxed">
            Upload your business documents for verification. Our team reviews documents within 24–48 hours. You need at least <strong>2 approved documents</strong> to operate fully on the platform.
          </p>
        </div>

        {/* Document list */}
        <div className="space-y-3">
          {DOC_TYPES.map(doc => {
            const existing = docStatusFor(doc.value);
            const stagedEntry = staged[doc.value];
            const isUploading = uploading === doc.value;
            const isAlreadyUploaded = !!existing;

            return (
              <div key={doc.value} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
                      ${existing?.status === "approved" ? "bg-green-100" : existing?.status === "rejected" ? "bg-red-100" : existing ? "bg-amber-100" : "bg-muted"}`}>
                      {doc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-foreground font-semibold text-sm">{doc.label}</p>
                        {existing?.status === "approved" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-0.5">
                            <CheckCircle2 size={8} /> Approved
                          </span>
                        )}
                        {existing?.status === "pending" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                            <Clock size={8} /> Under Review
                          </span>
                        )}
                        {existing?.status === "rejected" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            Re-upload Needed
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">{doc.hint}</p>
                    </div>
                  </div>

                  {/* Preview if staged */}
                  {stagedEntry && (
                    <div className="mt-3 relative">
                      <img src={stagedEntry.preview} alt="preview"
                        className="w-full h-28 object-cover rounded-xl border border-border" />
                      <button
                        onClick={() => setStaged(prev => { const n = { ...prev }; URL.revokeObjectURL(stagedEntry.preview); delete n[doc.value]; return n; })}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  )}

                  {/* Existing doc preview */}
                  {existing && !stagedEntry && (
                    <div className="mt-3 bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <p className="text-muted-foreground text-[11px] truncate flex-1">{existing.title}</p>
                      {existing.fileUrl && (
                        <a href={existing.fileUrl} target="_blank" rel="noreferrer"
                          className="text-primary text-[11px] font-semibold underline flex-shrink-0">View</a>
                      )}
                    </div>
                  )}

                  {/* Upload controls */}
                  {(!isAlreadyUploaded || existing?.status === "rejected") && (
                    <div className="mt-3 flex gap-2">
                      <label className={`flex-1 h-9 rounded-xl border-2 border-dashed flex items-center justify-center gap-1.5 cursor-pointer transition-all text-xs font-semibold
                        ${stagedEntry ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(doc.value, file);
                            e.target.value = "";
                          }}
                        />
                        <Upload size={13} />
                        {stagedEntry ? "Change file" : "Select file"}
                      </label>
                      {stagedEntry && (
                        <button
                          onClick={() => handleUpload(doc.value)}
                          disabled={isUploading}
                          className="flex-1 h-9 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60">
                          {isUploading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                          {isUploading ? "Uploading…" : "Upload"}
                        </button>
                      )}
                    </div>
                  )}

                  {isAlreadyUploaded && existing?.status !== "rejected" && !stagedEntry && (
                    <div className="mt-3">
                      <p className="text-muted-foreground text-[11px] text-center">
                        {existing?.status === "approved" ? "✅ Document approved" : "⏳ Awaiting review by our team"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div className="bg-muted/50 rounded-2xl p-4">
          <p className="text-muted-foreground text-xs leading-relaxed text-center">
            🔒 Your documents are encrypted and only accessed by our verification team. They are never shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
