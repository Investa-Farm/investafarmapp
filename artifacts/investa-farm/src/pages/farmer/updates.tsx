import { useState } from "react";
import { useListFarmUpdates, useCreateFarmUpdate, useGetMyFarms, getListFarmUpdatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { Plus, Loader2, X, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

export default function FarmerUpdates() {
  const { data: updates, isLoading } = useListFarmUpdates();
  const { data: farms } = useGetMyFarms();
  const createUpdate = useCreateFarmUpdate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [farmId, setFarmId] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    createUpdate.mutate(
      { data: { farmId, title, description } },
      {
        onSuccess: () => {
          setShowForm(false);
          setTitle(""); setDescription("");
          queryClient.invalidateQueries({ queryKey: getListFarmUpdatesQueryKey() });
        },
      }
    );
  };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-updates">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs font-medium">Farm Operations</p>
            <h1 className="text-white text-xl font-bold">Updates</h1>
          </div>
          <button data-testid="button-add-update" onClick={() => setShowForm(s => !s)}
            className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
            <Plus size={18} className="text-white" />
          </button>
        </div>
        <p className="text-white/60 text-xs mt-2">Share field progress with your investors to build trust</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <AnimatePresence>
          {showForm && (
            <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Post Update</p>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <select data-testid="select-farm" value={farmId ?? ""} onChange={e => setFarmId(Number(e.target.value))}
                required className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                <option value="">Select farm</option>
                {farms?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input data-testid="input-update-title" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Update title" required
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
              <textarea data-testid="input-update-description" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe what happened on the farm..." required rows={3}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none" />
              <button data-testid="button-submit-update" type="submit" disabled={createUpdate.isPending}
                className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                {createUpdate.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                {createUpdate.isPending ? "Posting..." : "Post Update"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {isLoading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : updates?.length === 0
            ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ImageIcon size={28} className="text-primary" />
                </div>
                <p className="text-foreground text-sm font-semibold">No updates yet</p>
                <p className="text-muted-foreground text-xs mt-1">Post your first farm update using the + button above.</p>
              </div>
            )
            : updates?.map((u) => (
              <div key={u.id} data-testid={`update-card-${u.id}`} className="bg-card rounded-2xl border border-border overflow-hidden">
                {u.imageUrl && <img src={u.imageUrl} alt={u.title} className="w-full h-44 object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-foreground font-semibold text-sm">{u.title}</p>
                      <p className="text-primary/70 text-xs mt-0.5 font-medium">{u.farmName}</p>
                    </div>
                    <span className="text-muted-foreground text-[10px] flex-shrink-0 ml-2 bg-muted px-2 py-0.5 rounded-full">
                      {u.hoursAgo < 1 ? "Just now" : u.hoursAgo < 24 ? `${u.hoursAgo}h ago` : `${Math.floor(u.hoursAgo / 24)}d ago`}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{u.description}</p>
                </div>
              </div>
            ))
        }
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
