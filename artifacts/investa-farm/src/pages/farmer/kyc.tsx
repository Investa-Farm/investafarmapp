import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, FileText, CheckCircle2, Clock, XCircle, Trash2, Plus, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { getToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type KycDoc = {
  id: number; docType: string; title: string; fileUrl: string;
  notes?: string; status: string; createdAt: string;
};

const DOC_TYPES = [
  { value: "farm_report",       label: "Farm Report",        desc: "Seasonal farm production report" },
  { value: "national_id",       label: "National ID",        desc: "Copy of national identity card" },
  { value: "land_title",        label: "Land Title / Lease", desc: "Proof of land ownership or lease" },
  { value: "group_certificate", label: "Group Certificate",  desc: "Official group registration cert" },
  { value: "financial_statement", label: "Financial Statement", desc: "Bank statement or M-Pesa history" },
  { value: "other",             label: "Other Document",     desc: "Any other supporting document" },
];

const statusIcon = (s: string) => {
  if (s === "approved") return <CheckCircle2 size={14} className="text-green-600" />;
  if (s === "rejected") return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-yellow-500" />;
};
const statusClass = (s: string) =>
  s === "approved" ? "badge-approved" : s === "rejected" ? "badge-rejected" : s === "submitted" ? "badge-submitted" : "badge-pending";

export default function FarmerKyc() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [popupDocType, setPopupDocType] = useState<string | null>(null);
  const [docType, setDocType] = useState("farm_report");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const token = getToken();

  const { data: docs = [], isLoading } = useQuery<KycDoc[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const upload = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      closePopup();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/kyc/documents/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-docs"] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitle(t => t || file.name.replace(/\.[^.]+$/, ""));
    setFilePreview(file.name);
    setFileUrl(`uploaded://${file.name}/${Date.now()}`);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl) return;
    upload.mutate({ docType: popupDocType ?? docType, title, fileUrl, notes: notes || undefined });
  };

  const openPopup = (dt: string) => {
    setPopupDocType(dt);
    setDocType(dt);
    setTitle(""); setFileUrl(""); setNotes(""); setFilePreview(null);
  };

  const closePopup = () => {
    setPopupDocType(null);
    setTitle(""); setFileUrl(""); setNotes(""); setFilePreview(null); setImagePreviewUrl(null);
  };

  const submitted = docs.length;
  const approved  = docs.filter(d => d.status === "approved").length;
  const total     = DOC_TYPES.length;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-kyc">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setLocation("/farmer")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/80 text-xs">Document Verification</p>
            <h1 className="text-white text-lg font-bold">KYC & Farm Reports</h1>
          </div>
        </div>
        {/* Progress — two rows: submitted + approved */}
        <div className="bg-white/20 rounded-xl p-3 space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/80 text-xs">Documents Submitted</span>
              <span className="text-white font-bold text-sm">{submitted}/{total}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${(submitted / total) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/80 text-xs">Documents Approved</span>
              <span className="text-white font-bold text-sm">{approved}/{total}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="bg-green-300 rounded-full h-2 transition-all duration-500"
                style={{ width: `${(approved / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Checklist of required docs */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Required Documents</p>
          {DOC_TYPES.map(dt => {
            const uploaded = docs.find(d => d.docType === dt.value);
            return (
              <div key={dt.value} className={`flex items-center gap-3 p-3 rounded-xl border ${uploaded ? "border-green-200 bg-green-50" : "border-border bg-white"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${uploaded ? "bg-green-100" : "bg-muted"}`}>
                  <FileText size={15} className={uploaded ? "text-green-600" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${uploaded ? "text-green-700" : "text-foreground"}`}>{dt.label}</p>
                  <p className="text-muted-foreground text-[10px]">{dt.desc}</p>
                </div>
                {uploaded ? (
                  <div className="flex items-center gap-1.5">
                    {statusIcon(uploaded.status)}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass(uploaded.status)}`}>
                      {uploaded.status}
                    </span>
                  </div>
                ) : (
                  <button onClick={() => openPopup(dt.value)}
                    className="text-[10px] font-medium text-primary border border-primary/30 rounded-lg px-2.5 py-1 flex items-center gap-1 active:scale-95 transition-transform">
                    <Plus size={10} /> Upload
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Uploaded docs list */}
        {docs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Uploaded Documents ({docs.length})</p>
            {docs.map(doc => (
              <div key={doc.id} data-testid={`doc-${doc.id}`} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-muted-foreground text-[10px]">{DOC_TYPES.find(d => d.value === doc.docType)?.label ?? doc.docType}</p>
                  {doc.notes && <p className="text-muted-foreground text-[10px] italic truncate">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass(doc.status)}`}>{doc.status}</span>
                  <button onClick={() => remove.mutate(doc.id)} className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {submitted >= total ? (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setLocation("/farmer")}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <CheckCircle2 size={18} /> All Documents Submitted — View Dashboard
          </motion.button>
        ) : (
          <button onClick={() => openPopup("farm_report")} data-testid="button-upload"
            className="w-full bg-primary/10 border border-primary/30 text-primary font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={16} /> Upload New Document
          </button>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-blue-700 text-xs leading-relaxed">
            <strong>Verification Timeline:</strong> Documents are reviewed within 2–3 business days. You'll receive a notification once your KYC is approved. Loan applications require at least a <strong>Farm Report</strong> and <strong>National ID</strong>.
          </p>
        </div>
      </div>

      <BottomNav role="farmer" />

      {/* Upload Popup Modal — rendered via portal to escape app-shell stacking context */}
      {createPortal(
        <AnimatePresence>
          {popupDocType && (
            <motion.div
              className="fixed inset-0 z-[9999] flex items-end justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePopup} />
              <motion.div
                className="relative w-full max-w-[430px] bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
              >
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Upload Document</h2>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {DOC_TYPES.find(d => d.value === popupDocType)?.label}
                    </p>
                  </div>
                  <button onClick={closePopup} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Type</label>
                    <select value={popupDocType} onChange={e => setPopupDocType(e.target.value)}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                      {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title / Document Name</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q1 2026 Farm Report" required
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File</label>
                    <label className={`w-full border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors ${filePreview ? "border-green-300 bg-green-50" : "border-border hover:border-primary/50"}`}>
                      {imagePreviewUrl ? (
                        <div className="relative">
                          <img src={imagePreviewUrl} alt="Document preview" className="w-full max-h-44 object-contain bg-gray-50" />
                          <div className="absolute bottom-0 inset-x-0 bg-green-600/90 px-3 py-1.5 flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-white" />
                            <p className="text-white text-xs font-medium truncate">{filePreview}</p>
                          </div>
                        </div>
                      ) : filePreview ? (
                        <div className="p-5 flex flex-col items-center gap-2">
                          <CheckCircle2 size={28} className="text-green-500" />
                          <p className="text-green-700 text-sm font-medium text-center">{filePreview}</p>
                          <p className="text-green-500 text-xs">File selected — ready to upload</p>
                        </div>
                      ) : (
                        <div className="p-5 flex flex-col items-center gap-2">
                          <Upload size={28} className="text-muted-foreground" />
                          <p className="text-foreground text-sm font-medium">Tap to select file</p>
                          <p className="text-muted-foreground text-xs">PDF, JPG, PNG up to 10MB</p>
                        </div>
                      )}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..."
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                  </div>

                  <button type="submit" disabled={upload.isPending || !fileUrl}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-green-200">
                    {upload.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {upload.isPending ? "Uploading…" : "Submit Document"}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
