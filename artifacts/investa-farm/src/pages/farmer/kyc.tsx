import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, FileText, CheckCircle2, Clock, XCircle, Trash2, Plus, Loader2, X, Image, Eye, FileImage, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { getToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type KycDoc = {
  id: number; docType: string; title: string; fileUrl: string;
  notes?: string; status: string; createdAt: string;
};

const DOC_TYPES = [
  { value: "national_id",       label: "National ID",        desc: "Copy of national identity card" },
  { value: "farm_report",       label: "Farm Report",        desc: "Seasonal farm production report" },
  { value: "land_title",        label: "Land Title / Lease", desc: "Proof of land ownership or lease" },
  { value: "group_certificate", label: "Group Certificate",  desc: "Official group registration cert" },
  { value: "financial_statement", label: "Financial Statement", desc: "Bank statement or M-Pesa history" },
  { value: "other",             label: "Other Document",     desc: "Any other supporting document" },
];

const FARMER_DOC_TYPES = new Set(DOC_TYPES.map(d => d.value));

const statusIcon = (s: string) => {
  if (s === "approved") return <CheckCircle2 size={14} className="text-green-600" />;
  if (s === "rejected") return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-yellow-500" />;
};
const statusClass = (s: string) =>
  s === "approved" ? "badge-approved" : s === "rejected" ? "badge-rejected" : s === "submitted" ? "badge-submitted" : "badge-pending";

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/80 flex flex-col"
        onClick={onClose}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/90 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              {pdf ? <FileText size={15} className="text-white" /> : <FileImage size={15} className="text-white" />}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{doc.title}</p>
              <p className="text-white/50 text-[10px]">{DOC_TYPES.find(d => d.value === doc.docType)?.label ?? doc.docType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"
            >
              <ExternalLink size={14} className="text-white" />
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"
            >
              <X size={15} className="text-white" />
            </button>
          </div>
        </div>

        {/* Viewer body */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          {pdf ? (
            <div className="w-full h-full rounded-xl overflow-hidden bg-white">
              <iframe
                src={doc.fileUrl + "#toolbar=0&navpanes=0"}
                className="w-full h-full border-0"
                title={doc.title}
                onLoad={() => {}}
              />
            </div>
          ) : img ? (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <img
                src={doc.fileUrl}
                alt={doc.title}
                className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
              />
            </div>
          ) : (
            <div className="bg-white/10 rounded-2xl p-8 text-center">
              <FileText size={48} className="text-white/50 mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">Cannot preview this file type</p>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm"
              >
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

export default function FarmerKyc() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [popupDocType, setPopupDocType] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<KycDoc | null>(null);
  const [docType, setDocType] = useState("farm_report");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUnderReview, setShowUnderReview] = useState(false);
  const token = getToken();

  const { data: rawDocs = [], isLoading } = useQuery<KycDoc[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });
  const docs = rawDocs.filter(d => FARMER_DOC_TYPES.has(d.docType) || d.docType === "other");

  const uploadFile = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error ?? "File upload failed");
    }
    const { url } = await r.json();
    return url;
  };

  const upload = useMutation({
    mutationFn: async (body: { docType: string; title: string; fileUrl: string; notes?: string }) => {
      const r = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Document save failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      closePopup();
      const updated: KycDoc[] = qc.getQueryData(["kyc-docs"]) ?? [];
      const uploadedTypes = new Set(updated.map(d => d.docType));
      const allCovered = DOC_TYPES.every(dt => uploadedTypes.has(dt.value));
      if (allCovered) setShowUnderReview(true);
    },
    onError: (e: Error) => setUploadError(e.message),
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
    setSelectedFile(file);
    setTitle(t => t || file.name.replace(/\.[^.]+$/, ""));
    setFilePreview(file.name);
    setUploadError(null);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError(null);
    try {
      const fileUrl = await uploadFile(selectedFile);
      upload.mutate({ docType: popupDocType ?? docType, title, fileUrl, notes: notes || undefined });
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    }
  };

  const openPopup = (dt: string) => {
    setPopupDocType(dt);
    setDocType(dt);
    setTitle(""); setSelectedFile(null); setNotes(""); setFilePreview(null);
    setImagePreviewUrl(null); setUploadError(null);
  };

  const closePopup = () => {
    setPopupDocType(null);
    setTitle(""); setSelectedFile(null); setNotes(""); setFilePreview(null);
    setImagePreviewUrl(null); setUploadError(null);
  };

  const isUploading = upload.isPending;

  const popup = popupDocType !== null ? createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
        onClick={closePopup}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-full max-w-[430px] bg-background rounded-t-3xl p-5 pb-10 shadow-2xl"
          onClick={e => e.stopPropagation()}>

          {/* Handle bar */}
          <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Upload size={18} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-base">Upload Document</p>
                <p className="text-muted-foreground text-xs">{DOC_TYPES.find(d => d.value === popupDocType)?.label}</p>
              </div>
            </div>
            <button onClick={closePopup} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Document Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. National ID – John Kamau" required
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>

            {/* File picker */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Select File *</label>
              <label className={`w-full border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer transition-all flex items-center justify-center min-h-[110px] ${filePreview ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"}`}>
                <input type="file" className="hidden"
                  accept="image/*,application/pdf,.pdf,.doc,.docx"
                  onChange={handleFileChange} />
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="Preview"
                    className="w-full h-44 object-cover rounded-2xl" />
                ) : filePreview ? (
                  <div className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <FileText size={24} className="text-primary" />
                    </div>
                    <p className="text-foreground text-sm font-semibold text-center break-all">{filePreview}</p>
                    <p className="text-primary text-xs mt-1 font-medium">✓ File selected — ready to upload</p>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2">
                      <Image size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-foreground text-sm font-semibold">Tap to select file</p>
                    <p className="text-muted-foreground text-xs mt-1">JPG, PNG, WEBP or PDF · max 10 MB</p>
                  </div>
                )}
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} placeholder="Any additional information…"
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-700 text-sm font-medium">{uploadError}</p>
              </div>
            )}

            <button type="submit" disabled={!selectedFile || isUploading}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/20">
              {isUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : <><Upload size={16} /> Upload Document</>}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  const requiredUploaded = DOC_TYPES.filter(dt => docs.some(d => d.docType === dt.value));
  const allRequiredUploaded = requiredUploaded.length >= DOC_TYPES.length;

  if (showUnderReview || (!isLoading && allRequiredUploaded && docs.length >= DOC_TYPES.length)) {
    return (
      <div className="app-shell pb-20 page-enter">
        <div className="hero-header pt-12 pb-5 px-5">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setLocation("/farmer")} aria-label="Back to dashboard"
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div>
              <p className="text-white/70 text-xs font-medium">Account Verification</p>
              <h1 className="text-white text-xl font-bold">KYC Documents</h1>
            </div>
          </div>
        </div>
        <div className="px-4 pt-8 flex flex-col items-center text-center gap-5">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-24 h-24 rounded-full bg-amber-100 border-4 border-amber-300 flex items-center justify-center">
            <Clock size={44} className="text-amber-500" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-foreground font-extrabold text-xl mb-2">Under Review</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              All your documents have been submitted. Our team will verify them within <strong>24–48 hours</strong> and notify you by email.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
            <p className="text-amber-800 font-bold text-xs mb-2.5">📋 Documents Submitted</p>
            <div className="space-y-1.5">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2">
                  {doc.status === "approved" ? <CheckCircle2 size={12} className="text-green-500" /> : <Clock size={12} className="text-amber-500" />}
                  <span className="text-amber-700 text-xs">{DOC_TYPES.find(d => d.value === doc.docType)?.label ?? doc.docType}</span>
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusClass(doc.status)}`}>{doc.status}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="w-full space-y-2">
            <button onClick={() => setShowUnderReview(false)}
              className="w-full border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95 transition-transform">
              View Documents
            </button>
            <button onClick={() => setLocation("/farmer")}
              className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm active:scale-95 transition-transform">
              Back to Dashboard
            </button>
          </motion.div>
        </div>
        <BottomNav role="farmer" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 page-enter">
      {popup}
      {viewingDoc && <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}

      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setLocation("/farmer")} aria-label="Back to dashboard"
            className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-xs font-medium">Account Verification</p>
            <h1 className="text-white text-xl font-bold">KYC Documents</h1>
          </div>
        </div>
        <p className="text-white/60 text-xs mt-1 leading-relaxed">
          Upload clear photos or scans of your documents. Our team reviews within 24–48 hours.
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Upload progress overview */}
        {!isLoading && docs.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-semibold text-sm">Verification Progress</p>
              <span className="text-xs text-muted-foreground">{docs.filter(d => d.status === "approved").length}/{docs.length} approved</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${docs.length > 0 ? (docs.filter(d => d.status === "approved").length / docs.length) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-2.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-500" /> {docs.filter(d => d.status === "approved").length} approved</span>
              <span className="flex items-center gap-1"><Clock size={10} className="text-amber-500" /> {docs.filter(d => d.status === "pending").length} pending</span>
              <span className="flex items-center gap-1"><XCircle size={10} className="text-red-500" /> {docs.filter(d => d.status === "rejected").length} rejected</span>
            </div>
          </div>
        )}

        {/* Document type grid */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Required Documents</p>
          <div className="space-y-2.5">
            {DOC_TYPES.map(dt => {
              const uploaded = docs.find(d => d.docType === dt.value);
              return (
                <div key={dt.value} className={`flex items-center gap-3 p-3.5 rounded-2xl border ${uploaded ? "border-green-200 bg-green-50/70" : "border-border bg-card"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${uploaded ? "bg-green-100" : "bg-muted"}`}>
                    <FileText size={16} className={uploaded ? "text-green-600" : "text-muted-foreground"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${uploaded ? "text-green-700" : "text-foreground"}`}>{dt.label}</p>
                    <p className="text-muted-foreground text-[10px]">{dt.desc}</p>
                  </div>
                  {uploaded ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingDoc(uploaded)}
                        className="flex items-center gap-1 bg-white border border-green-200 text-green-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm"
                      >
                        <Eye size={11} /> View
                      </button>
                      <div className="flex items-center gap-1">
                        {statusIcon(uploaded.status)}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass(uploaded.status)}`}>
                          {uploaded.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openPopup(dt.value)}
                      className="bg-primary text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shadow-sm shadow-primary/20">
                      <Plus size={12} /> Upload
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Uploaded document list */}
        {docs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Uploaded Documents</p>
              <button onClick={() => openPopup("other")}
                className="text-primary text-xs font-semibold flex items-center gap-1">
                <Plus size={12} /> Add More
              </button>
            </div>
            <div className="space-y-2.5">
              {isLoading ? (
                [1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)
              ) : (
                docs.map(doc => {
                  const pdf = isPdf(doc.fileUrl);
                  const img = isImage(doc.fileUrl);
                  return (
                    <div key={doc.id}>
                      <div className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                        {/* Thumbnail */}
                        <button
                          onClick={() => setViewingDoc(doc)}
                          className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center active:scale-90 transition-transform"
                        >
                          {img ? (
                            <img src={doc.fileUrl} alt="" className="w-11 h-11 object-cover" />
                          ) : pdf ? (
                            <div className="w-11 h-11 bg-red-50 flex items-center justify-center">
                              <FileText size={20} className="text-red-500" />
                            </div>
                          ) : (
                            <FileText size={18} className="text-primary" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-sm font-semibold truncate">{doc.title}</p>
                          <p className="text-muted-foreground text-[10px]">{DOC_TYPES.find(d => d.value === doc.docType)?.label ?? doc.docType} · {pdf ? "PDF" : img ? "Image" : "File"}</p>
                          {doc.status === "rejected" && doc.notes && (
                            <p className="text-red-600 text-[10px] font-semibold mt-1">❌ Reason: {doc.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* View button */}
                          <button
                            onClick={() => setViewingDoc(doc)}
                            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center active:scale-90 transition-transform"
                            aria-label="View document"
                            title="View document"
                          >
                            <Eye size={14} className="text-primary" />
                          </button>
                          {statusIcon(doc.status)}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusClass(doc.status)}`}>{doc.status}</span>
                          {doc.status !== "approved" && (
                            <button onClick={() => remove.mutate(doc.id)} aria-label="Delete document"
                              className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center active:scale-90 transition-transform">
                              <Trash2 size={13} className="text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                      {doc.status === "rejected" && (
                        <div className="mt-2 mx-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
                          <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-red-700 text-[11px] font-bold">Document Rejected</p>
                            {doc.notes ? (
                              <p className="text-red-600 text-[10px] mt-0.5">{doc.notes}</p>
                            ) : (
                              <p className="text-red-500 text-[10px] mt-0.5">Please re-upload a clearer version of this document.</p>
                            )}
                          </div>
                          <button
                            onClick={() => { remove.mutate(doc.id); openPopup(doc.docType); }}
                            className="text-[10px] font-bold text-red-700 border border-red-300 rounded-lg px-2 py-1 flex-shrink-0 active:scale-95 bg-white"
                          >
                            Re-upload
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && docs.length === 0 && (
          <div className="bg-muted/40 rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Upload size={28} className="text-primary" />
            </div>
            <p className="text-foreground font-semibold text-sm">No documents uploaded yet</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              Start uploading your KYC documents to get verified and access full platform features.
            </p>
            <button onClick={() => openPopup("national_id")}
              className="mt-4 bg-primary text-white font-bold py-3 px-6 rounded-2xl text-sm flex items-center gap-2 mx-auto active:scale-95 transition-transform shadow-lg shadow-primary/20">
              <Plus size={14} /> Upload First Document
            </button>
          </div>
        )}

        {/* Upload button */}
        {docs.length > 0 && (
          <button onClick={() => openPopup("other")}
            className="w-full border-2 border-dashed border-primary/40 bg-primary/5 py-4 rounded-2xl text-primary font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Plus size={16} /> Add Another Document
          </button>
        )}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-blue-800 font-semibold text-xs mb-1.5">📋 What We Need</p>
          <ul className="space-y-1">
            {[
              "Clear, readable copies of official documents",
              "Photos taken in good lighting (no shadows)",
              "Files must be JPG, PNG, WEBP or PDF",
              "Maximum file size: 10 MB per document",
            ].map(item => (
              <li key={item} className="text-blue-700 text-[10px] flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
