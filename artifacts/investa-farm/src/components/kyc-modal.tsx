import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, CheckCircle2, Clock, XCircle, Trash2, Loader2, Camera, MapPin, Info, ShieldCheck, AlertCircle, Video, VideoOff, Navigation, Home, ChevronDown } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";

type KycDoc = {
  id: number; docType: string; title: string; fileUrl: string;
  notes?: string; status: string; createdAt: string;
};

const DOC_TYPES = [
  { value: "national_id",        label: "National ID (Front)",  desc: "Front of your national identity card" },
  { value: "national_id_back",   label: "National ID (Back)",   desc: "Back of your national identity card" },
  { value: "selfie",             label: "Live Selfie",          desc: "Live photo of yourself for identity match", isSelfie: true },
  { value: "farm_report",        label: "Farm Report",          desc: "Seasonal farm production report" },
  { value: "land_title",         label: "Land Title / Lease",   desc: "Proof of land ownership or lease" },
  { value: "group_certificate",  label: "Group Certificate",    desc: "Official group registration cert" },
];

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa","Homa Bay",
  "Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii","Kisumu",
  "Kitui","Kwale","Laikipia","Lamu","Machakos","Makueni","Mandera","Marsabit","Meru",
  "Migori","Mombasa","Murang'a","Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua",
  "Nyeri","Samburu","Siaya","Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia",
  "Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot",
];

const statusIcon = (s: string) => {
  if (s === "approved") return <CheckCircle2 size={13} className="text-green-600" />;
  if (s === "rejected") return <XCircle size={13} className="text-red-500" />;
  return <Clock size={13} className="text-amber-500" />;
};

function UploadPopup({
  docType, onClose, onSuccess,
}: {
  docType: typeof DOC_TYPES[0]; onClose: () => void; onSuccess: () => void;
}) {
  const token = getToken();
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cameraMode, setCameraMode] = useState(docType.isSelfie);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qc = useQueryClient();

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: docType.isSelfie ? "user" : "environment" }, audio: false,
      });
      setStream(s);
    } catch {
      setCameraMode(false);
    }
  }, [docType.isSelfie]);

  useEffect(() => {
    if (cameraMode && !stream) startCamera();
  }, [cameraMode, stream, startCamera]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()); }, [stream]);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedSelfie(dataUrl);
    setFileUrl(`selfie://captured/${Date.now()}`);
    setTitle("Live Selfie");
    stopCamera();
  }, [stopCamera]);

  const retakeSelfie = useCallback(() => {
    setCapturedSelfie(null);
    setFileUrl("");
    setCameraMode(true);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitle(t => t || file.name.replace(/\.[^.]+$/, ""));
    setFilePreview(file.name);
    setFileUrl(`uploaded://${file.name}/${Date.now()}`);
    if (file.type.startsWith("image/")) {
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImagePreviewUrl(null);
    }
  };

  const upload = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ docType: docType.value, title: title || docType.label, fileUrl, notes: notes || undefined }),
      });
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-docs"] });
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
      onSuccess();
    },
  });

  const isSelfie = docType.isSelfie;
  const ready = !!fileUrl;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { stopCamera(); onClose(); }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-[380px] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="hero-header px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">{docType.label}</h3>
            <p className="text-white/70 text-xs mt-0.5">{docType.desc}</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isSelfie ? (
            <div className="space-y-3">
              {capturedSelfie ? (
                <div className="space-y-2">
                  <img src={capturedSelfie} alt="Selfie" className="w-full rounded-2xl object-cover aspect-video" />
                  <div className="flex gap-2">
                    <button onClick={retakeSelfie} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                      <VideoOff size={13} /> Retake
                    </button>
                    <button onClick={() => upload.mutate()} disabled={upload.isPending}
                      className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {upload.isPending ? "Uploading…" : "Use this selfie"}
                    </button>
                  </div>
                </div>
              ) : stream ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 border-4 border-white/20 rounded-2xl pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-40 rounded-[50%] border-2 border-white/50" />
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <button onClick={captureSelfie}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2">
                    <Camera size={16} /> Take Photo
                  </button>
                  <button onClick={() => { stopCamera(); setCameraMode(false); }}
                    className="w-full py-2 text-muted-foreground text-xs">
                    Upload file instead
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setCameraMode(true)}
                    className="w-full border-2 border-dashed border-primary/40 rounded-2xl p-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Video size={22} className="text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-semibold text-sm">Take Live Selfie</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Works on phone and laptop cameras</p>
                    </div>
                  </button>
                  <p className="text-center text-muted-foreground text-xs">— or —</p>
                  <label className="w-full border border-dashed border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer">
                    <Upload size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">{filePreview ?? "Upload existing selfie photo"}</span>
                    <input type="file" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                  </label>
                  {ready && (
                    <button onClick={() => upload.mutate()} disabled={upload.isPending}
                      className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {upload.isPending ? "Uploading…" : "Submit Selfie"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={docType.label}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
              <label className={`w-full border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors ${filePreview ? "border-green-300 bg-green-50" : "border-border"}`}>
                {imagePreviewUrl ? (
                  <div className="relative">
                    <img src={imagePreviewUrl} alt="Preview" className="w-full max-h-40 object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-green-600/90 px-3 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-white" />
                      <p className="text-white text-xs font-medium truncate">{filePreview}</p>
                    </div>
                  </div>
                ) : filePreview ? (
                  <div className="p-5 flex flex-col items-center gap-2">
                    <CheckCircle2 size={22} className="text-green-500" />
                    <p className="text-green-700 text-sm font-medium">{filePreview}</p>
                  </div>
                ) : (
                  <div className="p-5 flex flex-col items-center gap-2">
                    <Upload size={22} className="text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">Tap to choose file or photo</p>
                    <p className="text-muted-foreground/60 text-xs">PDF, JPG or PNG</p>
                  </div>
                )}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              </label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
              {ready && (
                <button onClick={() => upload.mutate()} disabled={upload.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {upload.isPending ? "Uploading…" : "Submit Document"}
                </button>
              )}
            </div>
          )}
          {upload.isError && (
            <p className="text-red-500 text-xs text-center">Upload failed. Please try again.</p>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

interface KycModalProps { open: boolean; onClose: () => void; onVerified?: () => void; }

export function KycModal({ open, onClose }: KycModalProps) {
  const qc = useQueryClient();
  const token = getToken();
  const [uploadDoc, setUploadDoc] = useState<typeof DOC_TYPES[0] | null>(null);

  // Location state
  const [county, setCounty] = useState("");
  const [subCounty, setSubCounty] = useState("");
  const [ward, setWard] = useState("");
  const [landmark, setLandmark] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  const { data: docs = [], isLoading } = useQuery<KycDoc[]>({
    queryKey: ["kyc-docs"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: kycStatus } = useQuery<{ isVerified: boolean; approved: number; total: number; allUploaded: boolean }>({
    queryKey: ["kyc-status"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } });
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

  const captureGPS = () => {
    setGpsStatus("loading");
    setGpsCoords(null);
    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsStatus("done");
      },
      (err) => {
        console.warn("GPS error:", err.code, err.message);
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const saveLocation = async () => {
    if (!county) return;
    setLocationSaving(true);
    try {
      await fetch("/api/kyc/location", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          county, subCounty, ward, landmark, physicalAddress,
          gpsLat: gpsCoords?.lat, gpsLng: gpsCoords?.lng, gpsAccuracy: gpsCoords?.accuracy,
        }),
      });
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 3000);
    } catch { /* silent */ } finally {
      setLocationSaving(false);
    }
  };

  const approved = docs.filter(d => d.status === "approved").length;
  const pending = docs.filter(d => d.status === "pending").length;
  const isVerified = kycStatus?.isVerified ?? approved >= 2;
  const allUploaded = kycStatus?.allUploaded ?? false;
  const totalRequired = DOC_TYPES.length;
  const uploadedCount = DOC_TYPES.filter(dt => docs.find(d => d.docType === dt.value)).length;

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
                    <h2 className="text-white font-bold text-lg">KYC Verification</h2>
                    <p className="text-white/70 text-xs">
                      {isVerified ? "✓ Verified — funding & trading enabled" : "Identity, Location & Documents"}
                    </p>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/80 text-xs">Documents Uploaded</span>
                    <span className="text-white font-bold text-sm">{uploadedCount}/{totalRequired}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${(uploadedCount / totalRequired) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
                {isLoading ? (
                  <div className="text-center py-8"><Loader2 size={20} className="animate-spin text-primary mx-auto" /></div>
                ) : (
                  <>
                    {isVerified && (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-green-700 font-semibold text-sm">KYC Approved</p>
                          <p className="text-green-600 text-xs mt-0.5">You can now apply for funding and trade shares.</p>
                        </div>
                      </div>
                    )}

                    {!isVerified && allUploaded && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-3">
                        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-blue-700 font-semibold text-sm">All Documents Submitted — Under Review</p>
                          <p className="text-blue-600 text-xs mt-0.5">Our admin team reviews within 24–48 hours. You'll be notified by email.</p>
                        </div>
                      </div>
                    )}

                    {!isVerified && !allUploaded && pending > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
                        <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-amber-700 font-semibold text-sm">Upload All Required Documents</p>
                          <p className="text-amber-600 text-xs mt-0.5">Please upload all {totalRequired} documents to submit for review.</p>
                        </div>
                      </div>
                    )}

                    {/* ── SECTION 1: Farm Location ── */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin size={13} className="text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">Farm Location Details</p>
                      </div>

                      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                        {/* County */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">County *</label>
                          <div className="relative">
                            <select value={county} onChange={e => setCounty(e.target.value)}
                              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary appearance-none pr-8">
                              <option value="">Select county…</option>
                              {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          </div>
                        </div>

                        {/* Sub-county & Ward */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sub-County / Town</label>
                            <input value={subCounty} onChange={e => setSubCounty(e.target.value)}
                              placeholder="e.g. Githunguri"
                              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ward / Village</label>
                            <input value={ward} onChange={e => setWard(e.target.value)}
                              placeholder="e.g. Kambaa"
                              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                          </div>
                        </div>

                        {/* Physical address */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Home size={10} /> Physical Address
                          </label>
                          <input value={physicalAddress} onChange={e => setPhysicalAddress(e.target.value)}
                            placeholder="Plot no. / road / estate…"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                        </div>

                        {/* Nearest landmark */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nearest Landmark *</label>
                          <input value={landmark} onChange={e => setLandmark(e.target.value)}
                            placeholder="e.g. Next to Githunguri High School, 500m from Safaricom tower"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                          <p className="text-[10px] text-muted-foreground">Help our agents find your farm — be as specific as possible.</p>
                        </div>

                        {/* GPS capture */}
                        <div className="bg-white border border-border rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Navigation size={14} className="text-primary" />
                              <span className="text-xs font-semibold">GPS Coordinates</span>
                            </div>
                            <button
                              onClick={captureGPS}
                              disabled={gpsStatus === "loading"}
                              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                                gpsStatus === "done"
                                  ? "bg-green-100 text-green-700"
                                  : gpsStatus === "error"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-primary text-white"
                              } disabled:opacity-50`}
                            >
                              {gpsStatus === "loading" && <Loader2 size={10} className="animate-spin" />}
                              {gpsStatus === "done" && <CheckCircle2 size={10} />}
                              {gpsStatus === "error" && <AlertCircle size={10} />}
                              {gpsStatus === "idle" && <Navigation size={10} />}
                              {gpsStatus === "loading" ? "Locating…" : gpsStatus === "done" ? "Captured ✓" : gpsStatus === "error" ? "Retry" : "Capture Location"}
                            </button>
                          </div>
                          {gpsStatus === "done" && gpsCoords && (
                            <div className="bg-green-50 rounded-lg px-3 py-2 text-[11px] text-green-700 font-mono">
                              {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                              {gpsCoords.accuracy && <span className="text-green-500 font-sans ml-2">±{gpsCoords.accuracy}m</span>}
                            </div>
                          )}
                          {gpsStatus === "error" && (
                            <p className="text-[10px] text-red-500">
                              Could not access your location. Please allow location access in your browser settings and try again, or fill in the landmark field above.
                            </p>
                          )}
                          {gpsStatus === "idle" && (
                            <p className="text-[10px] text-muted-foreground">
                              Tap to capture your phone's GPS position. This helps our field agents verify your farm location.
                            </p>
                          )}
                        </div>

                        {/* Save location button */}
                        <button
                          onClick={saveLocation}
                          disabled={!county || locationSaving}
                          className="w-full py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all active:scale-95"
                        >
                          {locationSaving ? <Loader2 size={12} className="animate-spin" /> : locationSaved ? <CheckCircle2 size={12} /> : <MapPin size={12} />}
                          {locationSaved ? "Location Saved!" : locationSaving ? "Saving…" : "Save Farm Location"}
                        </button>
                      </div>
                    </div>

                    {/* ── SECTION 2: Documents ── */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText size={13} className="text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">Required Documents</p>
                      </div>

                      <div className="space-y-2">
                        {DOC_TYPES.map(dt => {
                          const uploaded = docs.find(d => d.docType === dt.value);
                          return (
                            <div key={dt.value} className={`flex items-center gap-3 p-3 rounded-xl border ${uploaded ? "border-green-200 bg-green-50" : "border-border bg-white"}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${uploaded ? "bg-green-100" : "bg-muted"}`}>
                                {dt.isSelfie
                                  ? <Camera size={15} className={uploaded ? "text-green-600" : "text-muted-foreground"} />
                                  : <FileText size={15} className={uploaded ? "text-green-600" : "text-muted-foreground"} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${uploaded ? "text-green-700" : "text-foreground"}`}>{dt.label}</p>
                                <p className="text-muted-foreground text-[10px]">{dt.desc}</p>
                              </div>
                              {uploaded ? (
                                <div className="flex items-center gap-1.5">
                                  {statusIcon(uploaded.status)}
                                  <span className="text-[9px] font-medium capitalize">{uploaded.status}</span>
                                  <button onClick={() => remove.mutate(uploaded.id)} className="w-5 h-5 rounded bg-red-50 flex items-center justify-center ml-1">
                                    <Trash2 size={10} className="text-red-400" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setUploadDoc(dt)}
                                  className="text-[10px] font-medium text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                                  {dt.isSelfie ? <Camera size={9} /> : <Upload size={9} />}
                                  {dt.isSelfie ? "Selfie" : "Upload"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-amber-700 text-[10px] leading-relaxed flex items-start gap-2">
                        <ShieldCheck size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
                        Complete your farm location details and upload all <strong>{totalRequired} documents</strong> including a live selfie. Our admin team reviews all submissions within 24–48 hours.
                      </p>
                    </div>
                  </>
                )}
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
