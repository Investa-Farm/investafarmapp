import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, Upload, CheckCircle2, Clock, X,
  FileText, AlertCircle, Loader2, Building2, Star, Eye,
  ChevronRight, Lock, BadgeCheck, FileImage, ExternalLink,
} from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const DOC_TYPES = [
  {
    value: "national_id",
    label: "National ID (Front)",
    emoji: "🪪",
    hint: "Front side of your national identity card",
    required: true,
    category: "identity",
  },
  {
    value: "national_id_back",
    label: "National ID (Back)",
    emoji: "🪪",
    hint: "Back side of your national identity card",
    required: true,
    category: "identity",
  },
  {
    value: "business_registration",
    label: "Business Registration",
    emoji: "📋",
    hint: "Certificate of incorporation or business registration certificate",
    required: true,
    category: "business",
  },
  {
    value: "financial_statement",
    label: "Financial Statement",
    emoji: "💰",
    hint: "Bank statement or financial records for the last 3 months",
    required: true,
    category: "business",
  },
  {
    value: "selfie",
    label: "Selfie with ID",
    emoji: "🤳",
    hint: "Clear selfie holding your national ID — must show your face clearly",
    required: true,
    category: "identity",
  },
  {
    value: "other",
    label: "Supporting Document",
    emoji: "📎",
    hint: "Any additional supporting document (optional)",
    required: false,
    category: "other",
  },
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

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("application/pdf");
}
function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url);
}

function DocViewerModal({ doc, onClose }: { doc: KycDoc; onClose: () => void }) {
  const pdf = isPdf(doc.fileUrl);
  const img = isImage(doc.fileUrl);
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/85 flex flex-col"
        onClick={onClose}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-black/90 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              {pdf ? <FileText size={14} className="text-white" /> : <FileImage size={14} className="text-white" />}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{doc.title}</p>
              <p className="text-white/50 text-[10px]">{DOC_TYPES.find(d => d.value === doc.docType)?.label ?? doc.docType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <ExternalLink size={13} className="text-white" />
            </a>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          {pdf ? (
            <div className="w-full h-full rounded-xl overflow-hidden bg-white">
              <iframe src={doc.fileUrl + "#toolbar=0&navpanes=0"} className="w-full h-full border-0" title={doc.title} />
            </div>
          ) : img ? (
            <img src={doc.fileUrl} alt={doc.title} className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl" />
          ) : (
            <div className="bg-white/10 rounded-2xl p-8 text-center">
              <FileText size={48} className="text-white/50 mx-auto mb-4" />
              <p className="text-white font-semibold mb-3">Cannot preview this file</p>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm">
                <ExternalLink size={14} /> Open File
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default function AgribusinessKyc() {
  const token = getToken();
  const user = getStoredUser();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, { file: File; preview: string; isImage: boolean }>>({});
  const [submitDone, setSubmitDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<KycDoc | null>(null);
  const [activeUploadType, setActiveUploadType] = useState<DocTypeValue | null>(null);

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
  const rejectedCount = kycDocs.filter(d => d.status === "rejected").length;
  const requiredDocs = DOC_TYPES.filter(d => d.required);
  const requiredUploaded = requiredDocs.filter(d => uploadedTypes.has(d.value)).length;
  const progressPct = Math.round((requiredUploaded / requiredDocs.length) * 100);
  const allApproved = approvedCount >= requiredDocs.length;

  const handleFileSelect = (docType: DocTypeValue, file: File) => {
    const preview = URL.createObjectURL(file);
    setStaged(prev => ({ ...prev, [docType]: { file, preview, isImage: file.type.startsWith("image/") } }));
  };

  const handleUpload = async (docType: DocTypeValue) => {
    const entry = staged[docType];
    if (!entry) return;
    setUploadingDoc(docType);
    setError(null);
    try {
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

      setStaged(prev => {
        const next = { ...prev };
        URL.revokeObjectURL(entry.preview);
        delete next[docType];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      await refetch();
      setSubmitDone(true);
      setActiveUploadType(null);
      setTimeout(() => setSubmitDone(false), 4000);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploadingDoc(null);
    }
  };

  const docStatusFor = (docType: string): KycDoc | undefined =>
    kycDocs.find(d => d.docType === docType);

  // Group docs by category
  const identityDocs = DOC_TYPES.filter(d => d.category === "identity");
  const businessDocs = DOC_TYPES.filter(d => d.category === "business");
  const otherDocs = DOC_TYPES.filter(d => d.category === "other");

  // Upload bottom sheet portal
  const uploadSheet = activeUploadType ? createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end justify-center"
        onClick={() => { setActiveUploadType(null); setError(null); }}
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {(() => {
            const doc = DOC_TYPES.find(d => d.value === activeUploadType)!;
            const stagedEntry = staged[activeUploadType];
            const isUp = uploadingDoc === activeUploadType;
            return (
              <div className="px-5 pb-10 pt-2">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                      {doc.emoji}
                    </div>
                    <div>
                      <p className="font-bold text-base text-foreground">{doc.label}</p>
                      <p className="text-muted-foreground text-xs">{doc.hint}</p>
                    </div>
                  </div>
                  <button onClick={() => { setActiveUploadType(null); setError(null); }}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>

                {/* File preview */}
                {stagedEntry && (
                  <div className="mb-4 relative">
                    {stagedEntry.isImage ? (
                      <img src={stagedEntry.preview} alt="preview" className="w-full h-40 object-cover rounded-2xl border border-border" />
                    ) : (
                      <div className="w-full h-40 rounded-2xl border border-border bg-muted/50 flex flex-col items-center justify-center gap-2">
                        <FileText size={36} className="text-primary" />
                        <p className="text-foreground text-sm font-semibold">{stagedEntry.file.name}</p>
                        <p className="text-primary text-xs font-medium">✓ Ready to upload</p>
                      </div>
                    )}
                    <button
                      onClick={() => setStaged(prev => { const n = { ...prev }; URL.revokeObjectURL(stagedEntry.preview); delete n[activeUploadType]; return n; })}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <label className={`w-full h-14 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2.5 cursor-pointer transition-all
                    ${stagedEntry ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"}`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(activeUploadType, file);
                        e.target.value = "";
                      }}
                    />
                    <Upload size={16} />
                    <span className="font-semibold text-sm">{stagedEntry ? "Change file" : "Select file (photo or PDF)"}</span>
                  </label>

                  {stagedEntry && (
                    <button
                      onClick={() => handleUpload(activeUploadType)}
                      disabled={isUp}
                      className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                      {isUp ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : <><ShieldCheck size={16} /> Submit Document</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <div className="app-shell pb-10 page-enter" style={{ background: "#f8faf8" }}>
      {uploadSheet}
      {viewingDoc && <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}

      {/* Hero header */}
      <div className="relative overflow-hidden" style={{ minHeight: 200 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 45%, #15803d 80%, #16a34a 100%)" }} />
        {/* Dot texture */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Glow */}
        <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full bg-green-400/20 blur-3xl" />

        <div className="relative z-10 pt-12 px-5 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setLocation("/agribusiness")}
              className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="flex-1">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-widest">Business Verification</p>
              <h1 className="text-white font-extrabold text-xl leading-tight">KYC Documents</h1>
            </div>
            <img src={logoSrc} alt="Investa" className="h-8 opacity-85" style={{ filter: "brightness(0) invert(1)" }} />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Uploaded", val: kycDocs.length, color: "text-white", bg: "bg-white/10" },
              { label: "Pending", val: pendingCount, color: "text-amber-200", bg: "bg-amber-400/20" },
              { label: "Approved", val: approvedCount, color: "text-green-200", bg: "bg-green-400/20" },
              { label: "Rejected", val: rejectedCount, color: "text-red-200", bg: "bg-red-400/20" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-2.5 text-center border border-white/10`}>
                <p className={`font-extrabold text-lg leading-none ${s.color}`}>{s.val}</p>
                <p className="text-white/50 text-[9px] mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-white/70 text-[10px] font-semibold">Verification Progress</p>
              <p className="text-white text-[10px] font-bold">{requiredUploaded}/{requiredDocs.length} required docs</p>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
            {allApproved && (
              <div className="mt-2 flex items-center gap-1.5">
                <BadgeCheck size={14} className="text-green-300" />
                <p className="text-green-300 text-[10px] font-bold">All required documents approved! ✨</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Success toast */}
        <AnimatePresence>
          {submitDone && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-green-800 font-bold text-sm">Document submitted!</p>
                <p className="text-green-600 text-xs">Our team will review within 24–48 hours.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* What you need */}
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Star size={15} className="text-blue-600" />
            </div>
            <p className="font-bold text-sm text-foreground">What You Need</p>
          </div>
          <div className="space-y-2">
            {[
              { icon: "🪪", label: "National ID (front & back)" },
              { icon: "📋", label: "Business registration certificate" },
              { icon: "💰", label: "Bank statement (last 3 months)" },
              { icon: "🤳", label: "Selfie holding your ID" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <p className="text-foreground text-xs font-medium">{item.label}</p>
                <ChevronRight size={11} className="text-muted-foreground ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Identity Documents */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Identity Documents</p>
          </div>
          <div className="space-y-2.5">
            {identityDocs.map(doc => <DocCard key={doc.value} doc={doc} kycDoc={docStatusFor(doc.value)} staged={staged[doc.value]} isUploading={uploadingDoc === doc.value} onSelect={handleFileSelect} onUpload={handleUpload} onView={setViewingDoc} onOpenSheet={setActiveUploadType} />)}
          </div>
        </div>

        {/* Business Documents */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-4 bg-green-500 rounded-full" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Business Documents</p>
          </div>
          <div className="space-y-2.5">
            {businessDocs.map(doc => <DocCard key={doc.value} doc={doc} kycDoc={docStatusFor(doc.value)} staged={staged[doc.value]} isUploading={uploadingDoc === doc.value} onSelect={handleFileSelect} onUpload={handleUpload} onView={setViewingDoc} onOpenSheet={setActiveUploadType} />)}
          </div>
        </div>

        {/* Optional Documents */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-4 bg-gray-400 rounded-full" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Optional</p>
          </div>
          <div className="space-y-2.5">
            {otherDocs.map(doc => <DocCard key={doc.value} doc={doc} kycDoc={docStatusFor(doc.value)} staged={staged[doc.value]} isUploading={uploadingDoc === doc.value} onSelect={handleFileSelect} onUpload={handleUpload} onView={setViewingDoc} onOpenSheet={setActiveUploadType} />)}
          </div>
        </div>

        {/* Security note */}
        <div className="bg-muted/60 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Lock size={14} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your documents are encrypted in transit and at rest. They are only accessed by our verified compliance team and are never shared with third parties.
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

function DocCard({
  doc, kycDoc, staged, isUploading, onSelect, onUpload, onView, onOpenSheet,
}: {
  doc: typeof DOC_TYPES[number];
  kycDoc: KycDoc | undefined;
  staged: { file: File; preview: string; isImage: boolean } | undefined;
  isUploading: boolean;
  onSelect: (type: DocTypeValue, file: File) => void;
  onUpload: (type: DocTypeValue) => void;
  onView: (doc: KycDoc) => void;
  onOpenSheet: (type: DocTypeValue) => void;
}) {
  const status = kycDoc?.status;
  const isApproved = status === "approved";
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const uploaded = !!kycDoc;

  const borderColor = isApproved ? "border-green-200" : isRejected ? "border-red-200" : isPending ? "border-amber-200" : "border-border";
  const bgColor = isApproved ? "bg-green-50/60" : isRejected ? "bg-red-50/40" : isPending ? "bg-amber-50/40" : "bg-white";

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm ${borderColor} ${bgColor}`}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0
            ${isApproved ? "bg-green-100" : isRejected ? "bg-red-100" : isPending ? "bg-amber-100" : "bg-muted"}`}>
            {doc.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-foreground font-bold text-sm">{doc.label}</p>
              {!doc.required && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Optional</span>}
              {isApproved && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={8} /> Approved
                </span>
              )}
              {isPending && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                  <Clock size={8} /> Under Review
                </span>
              )}
              {isRejected && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Re-upload Needed
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">{doc.hint}</p>
          </div>
        </div>

        {/* Preview of existing doc */}
        {kycDoc && !isRejected && (
          <div className="mt-3 bg-background rounded-xl border border-border p-2.5 flex items-center gap-2">
            <FileText size={13} className="text-muted-foreground flex-shrink-0" />
            <p className="text-muted-foreground text-[11px] truncate flex-1">{kycDoc.title}</p>
            {kycDoc.fileUrl && (
              <button onClick={() => onView(kycDoc)}
                className="flex items-center gap-1 text-primary text-[10px] font-bold flex-shrink-0">
                <Eye size={11} /> View
              </button>
            )}
          </div>
        )}

        {/* Rejection message */}
        {isRejected && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2">
            <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-[11px]">This document was rejected. Please upload a clearer copy.</p>
          </div>
        )}

        {/* Upload action */}
        {(!uploaded || isRejected) && (
          <button
            onClick={() => onOpenSheet(doc.value)}
            className="mt-3 w-full h-11 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm shadow-primary/20">
            <Upload size={13} /> Upload Document
          </button>
        )}

        {uploaded && !isRejected && isApproved && (
          <p className="mt-3 text-center text-green-600 text-[11px] font-semibold">✅ Verified and approved</p>
        )}
        {uploaded && !isRejected && isPending && (
          <p className="mt-3 text-center text-amber-600 text-[11px] font-semibold">⏳ Awaiting review by our compliance team</p>
        )}
      </div>
    </div>
  );
}
