import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, CheckCircle2, Clock, XCircle, Loader2, Shield, Info, Camera, AlertCircle, Video, VideoOff, Trash2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";

type KycDoc = { id: number; docType: string; title: string; status: string; createdAt: string };

const INV_DOC_TYPES = [
  { value: "national_id",         label: "National ID (Front)", desc: "Government-issued photo ID", isSelfie: false },
  { value: "national_id_back",    label: "National ID (Back)",  desc: "Back of your national ID", isSelfie: false },
  { value: "selfie",              label: "Live Selfie",         desc: "Live photo for identity match", isSelfie: true },
  { value: "financial_statement", label: "Financial Statement", desc: "Bank statement or M-Pesa history", isSelfie: false },
];

function UploadPopup({
  docType,
  onClose,
  onSuccess,
}: {
  docType: typeof INV_DOC_TYPES[0];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const token = getToken();
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qc = useQueryClient();

  const startCamera = useCallback(async () => {
    setCameraReady(false);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      // srcObject assigned via useEffect once video element is mounted
    } catch {
      setCameraReady(false);
    }
  }, []);

  // Sync stream → video element as soon as both are available
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const vid = videoRef.current;
    vid.srcObject = stream;
    vid.play().catch(() => {});
    // Fallback: mark ready after 1.5s in case onLoadedMetadata never fires
    const t = setTimeout(() => setCameraReady(true), 1500);
    return () => clearTimeout(t);
  }, [stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraReady(false);
  }, [stream]);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedSelfie(dataUrl);
    setFileUrl(dataUrl); // store actual image data so admin can view it
    setTitle("Live Selfie");
    stopCamera();
  }, [stopCamera]);

  const retakeSelfie = () => {
    setCapturedSelfie(null);
    setFileUrl("");
    startCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitle(t => t || file.name.replace(/\.[^.]+$/, ""));
    setFilePreview(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [submitted, setSubmitted] = useState(false);

  const upload = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ docType: docType.value, title: title || docType.label, fileUrl }),
      });
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
      setSubmitted(true);
      setTimeout(() => onSuccess(), 1400);
    },
  });

  const ready = !!fileUrl;

  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white rounded-3xl p-8 flex flex-col items-center gap-3 shadow-2xl max-w-[280px] text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-1">
            <CheckCircle2 size={36} className="text-green-600" />
          </div>
          <h3 className="text-foreground font-bold text-lg">Document Submitted</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your {docType.label} has been uploaded and is now <strong className="text-orange-600">under review</strong>. We'll notify you once it's verified.
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <Loader2 size={12} className="animate-spin text-muted-foreground" />
            <span className="text-muted-foreground text-xs">Processing…</span>
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { stopCamera(); onClose(); }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="hero-header px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">{docType.label}</h3>
            <p className="text-white/70 text-xs">{docType.desc}</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {docType.isSelfie ? (
            <>
              {capturedSelfie ? (
                <>
                  <img src={capturedSelfie} alt="Selfie" className="w-full rounded-2xl object-cover aspect-video" />
                  <div className="flex gap-2">
                    <button onClick={retakeSelfie} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium flex items-center justify-center gap-1.5">
                      <VideoOff size={13} /> Retake
                    </button>
                    <button onClick={() => upload.mutate()} disabled={upload.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {upload.isPending ? "Uploading…" : "Use selfie"}
                    </button>
                  </div>
                </>
              ) : stream ? (
                <>
                  <div className="relative rounded-2xl overflow-hidden" style={{ background: "#111" }}>
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="text-white/70 animate-spin" />
                          <p className="text-white/50 text-xs">Starting camera…</p>
                        </div>
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full object-cover"
                      style={{ transform: "scaleX(-1)", minHeight: 220, display: "block" }}
                      onLoadedMetadata={() => { videoRef.current?.play().catch(() => {}); setCameraReady(true); }}
                      onCanPlay={() => setCameraReady(true)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-28 h-36 rounded-[50%] border-2 border-white/70" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
                    </div>
                    <p className="absolute bottom-2 w-full text-center text-white/70 text-[10px]">Position your face in the oval</p>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <button onClick={captureSelfie}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2">
                    <Camera size={16} /> Take Photo
                  </button>
                  <button onClick={() => stopCamera()} className="w-full text-muted-foreground text-xs py-1">Upload file instead</button>
                </>
              ) : (
                <>
                  <button onClick={startCamera}
                    className="w-full border-2 border-dashed border-primary/40 rounded-2xl p-6 flex flex-col items-center gap-2">
                    <Video size={24} className="text-primary" />
                    <p className="text-foreground font-semibold text-sm">Take Live Selfie</p>
                    <p className="text-muted-foreground text-xs">Works on phone and laptop cameras</p>
                  </button>
                  <p className="text-center text-muted-foreground text-xs">— or upload photo —</p>
                  <label className="w-full border border-dashed border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer">
                    <Upload size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-xs">{filePreview ?? "Choose selfie photo"}</span>
                    <input type="file" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                  </label>
                  {ready && (
                    <button onClick={() => upload.mutate()} disabled={upload.isPending}
                      className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {upload.isPending ? "Uploading…" : "Submit"}
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={docType.label}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
              <label className={`w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer ${filePreview ? "border-green-300 bg-green-50" : "border-border"}`}>
                {filePreview
                  ? <><CheckCircle2 size={22} className="text-green-500" /><p className="text-green-700 text-sm font-medium">{filePreview}</p></>
                  : <><Upload size={22} className="text-muted-foreground" /><p className="text-muted-foreground text-sm">Tap to select file</p><p className="text-muted-foreground/60 text-xs">PDF, JPG or PNG</p></>}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              </label>
              {ready && (
                <button onClick={() => upload.mutate()} disabled={upload.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {upload.isPending ? "Uploading…" : "Submit Document"}
                </button>
              )}
            </>
          )}
          {upload.isError && <p className="text-red-500 text-xs text-center">Upload failed. Please try again.</p>}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

interface InvestorKycModalProps { open: boolean; onClose: () => void; onVerified?: () => void; }

export function InvestorKycModal({ open, onClose }: InvestorKycModalProps) {
  const qc = useQueryClient();
  const token = getToken();
  const [uploadDoc, setUploadDoc] = useState<typeof INV_DOC_TYPES[0] | null>(null);

  const { data: docs = [], isLoading } = useQuery<KycDoc[]>({
    queryKey: ["kyc-docs"],
    enabled: open && !!token,
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: status } = useQuery<{ isVerified: boolean; approved: number; allUploaded: boolean }>({
    queryKey: ["kyc-status"],
    enabled: open && !!token,
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { isVerified: false, approved: 0, allUploaded: false };
      return r.json();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/kyc/documents/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
    },
  });

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle2 size={13} className="text-green-600" />;
    if (s === "rejected") return <XCircle size={13} className="text-red-500" />;
    return <Clock size={13} className="text-amber-500" />;
  };

  const uploadedCount = INV_DOC_TYPES.filter(dt => docs.find(d => d.docType === dt.value)).length;
  const allUploaded = status?.allUploaded ?? false;

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "92vh" }}>

              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-white font-bold text-lg">Investor Verification</h2>
                    <p className="text-white/70 text-xs">KYC required before trading</p>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-white" />
                    <span className="text-white text-xs font-medium">
                      {status?.isVerified ? "✓ Verified — you can trade" : `${uploadedCount}/${INV_DOC_TYPES.length} documents uploaded`}
                    </span>
                  </div>
                  {status?.isVerified && <CheckCircle2 size={16} className="text-white" />}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
                {isLoading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>}

                {status?.isVerified && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-700 font-semibold text-sm">KYC Approved</p>
                      <p className="text-green-600 text-xs mt-0.5">Your identity is verified. You can buy and trade shares.</p>
                    </div>
                  </div>
                )}

                {!status?.isVerified && allUploaded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-3">
                    <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-700 font-semibold text-sm">All Documents Submitted — Under Review</p>
                      <p className="text-blue-600 text-xs mt-0.5">Our admin team will review within 24–48 hours. You'll receive an email and in-app notification when approved.</p>
                    </div>
                  </div>
                )}

                {!status?.isVerified && !allUploaded && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                    <p className="text-green-800 text-xs leading-relaxed">
                      <strong>Why KYC?</strong> Kenya's CMA requires identity verification for all investment accounts. Upload all <strong>{INV_DOC_TYPES.length} required documents</strong> including a live selfie to submit for review.
                    </p>
                  </div>
                )}

                {!status?.isVerified && !allUploaded && uploadedCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-700 text-xs">Upload all remaining documents to submit your KYC for admin review.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Required Documents</p>
                  {INV_DOC_TYPES.map(dt => {
                    const uploaded = docs.find(d => d.docType === dt.value);
                    return (
                      <div key={dt.value} className={`flex items-center gap-3 p-3 rounded-xl border ${uploaded ? "border-green-200 bg-green-50" : "border-border bg-white"}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${uploaded ? "bg-green-100" : "bg-muted"}`}>
                          {dt.isSelfie
                            ? <Camera size={14} className={uploaded ? "text-green-600" : "text-muted-foreground"} />
                            : <FileText size={14} className={uploaded ? "text-green-600" : "text-muted-foreground"} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${uploaded ? "text-green-700" : "text-foreground"}`}>{dt.label}</p>
                          <p className="text-muted-foreground text-[10px]">{dt.desc}</p>
                        </div>
                        {uploaded ? (
                          <div className="flex items-center gap-1.5">
                            {statusIcon(uploaded.status)}
                            <span className="text-[9px] capitalize text-muted-foreground">{uploaded.status}</span>
                            <button onClick={() => remove.mutate(uploaded.id)} className="w-5 h-5 rounded bg-red-50 flex items-center justify-center ml-1">
                              <Trash2 size={10} className="text-red-400" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setUploadDoc(dt)}
                            className="text-[10px] font-medium text-primary border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-1">
                            {dt.isSelfie ? <Camera size={9} /> : <Upload size={9} />}
                            {dt.isSelfie ? "Selfie" : "Upload"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadDoc && (
          <UploadPopup
            docType={uploadDoc}
            onClose={() => setUploadDoc(null)}
            onSuccess={() => setUploadDoc(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
