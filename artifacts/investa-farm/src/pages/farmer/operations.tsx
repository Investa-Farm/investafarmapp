import { useState } from "react";
import { useGetFarmerDashboard } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, isDemoAccount } from "@/lib/auth";
import { Leaf, Droplets, Sun, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

const defaultTasks = [
  { id: 1, label: "Seeds Planted", done: true, icon: "🌱", notes: "50 kg certified hybrid seeds — Rows A–D", category: "Planting" },
  { id: 2, label: "Fertilizer Applied", done: true, icon: "🪣", notes: "DAP fertilizer — 25 kg per acre", category: "Nutrition" },
  { id: 3, label: "Irrigation Due", done: false, icon: "💧", notes: "Scheduled for today — drip system", category: "Water" },
  { id: 4, label: "Pesticide Spray", done: false, icon: "🌿", notes: "Week 3 schedule — aphid prevention", category: "Protection" },
  { id: 5, label: "Soil Test", done: false, icon: "🔬", notes: "Send samples to extension officer", category: "Quality" },
];

export default function FarmerOperations() {
  const { data: dashboard, isLoading } = useGetFarmerDashboard();
  const isDemo = isDemoAccount();
  const [tasks, setTasks] = useState(isDemo ? defaultTasks : []);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now(), label: newLabel, done: false, icon: "📋", notes: newNotes, category: "Custom"
    }]);
    setNewLabel(""); setNewNotes(""); setShowAdd(false);
  };

  const done = tasks.filter(t => t.done).length;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="farmer-operations">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs font-medium">Farm Management</p>
            <h1 className="text-white text-xl font-bold">Operations</h1>
          </div>
          <button onClick={() => setShowAdd(s => !s)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
            <Plus size={17} className="text-white" />
          </button>
        </div>
        <div className="mt-3 bg-white/10 rounded-xl p-3 flex items-center justify-between">
          <span className="text-white/80 text-xs">Tasks completed today</span>
          <span className="text-white font-bold text-sm">{done}/{tasks.length}</span>
        </div>
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Season stats */}
        {isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : dashboard && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Farms Active", val: String(dashboard.activeFarms) },
              { label: "Growth", val: `${dashboard.growthPercent}%` },
              { label: "Investors", val: String(dashboard.totalInvestors) },
            ].map(({ label, val }) => (
              <div key={label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className="text-foreground font-bold text-base">{val}</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add task form */}
        <AnimatePresence>
          {showAdd && (
            <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              onSubmit={addTask} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Add Task</p>
                <button type="button" onClick={() => setShowAdd(false)}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="Task name" required
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary" />
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-primary" />
              <button type="submit"
                className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">
                Add Task
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Task list */}
        <div>
          <p className="text-sm font-semibold mb-3">Today's Tasks</p>
          <div className="space-y-2">
            {tasks.map((task) => (
              <button key={task.id} data-testid={`task-${task.id}`} onClick={() => toggleTask(task.id)}
                className={`w-full bg-card rounded-2xl border p-4 flex items-start gap-3 text-left transition-all active:scale-[0.98] ${task.done ? "border-green-200 bg-green-50/30" : "border-border"}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${task.done ? "bg-green-100" : "bg-muted"}`}>
                  {task.done ? <CheckCircle2 size={18} className="text-green-600" /> : <span>{task.icon}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${task.done ? "text-green-700 line-through opacity-60" : "text-foreground"}`}>
                      {task.label}
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${task.done ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {task.done ? "Done" : "Pending"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">{task.notes}</p>
                  <span className="text-[10px] text-primary/70 font-medium mt-1 inline-block">{task.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Earnings summary */}
        {dashboard && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm font-semibold text-primary mb-3">Season Earnings</p>
            <div className="space-y-2">
              {[
                { label: "Funds Received", val: formatKES(dashboard.fundsReceived) },
                { label: "Profit Estimate", val: formatKES(dashboard.profit) },
                { label: "Funding Target", val: formatKES(dashboard.fundingTarget) },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-foreground font-semibold text-sm">{val}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, (dashboard.fundsReceived / dashboard.fundingTarget) * 100)}%` }} />
            </div>
            <p className="text-muted-foreground text-[10px] mt-1 text-right">
              {Math.round((dashboard.fundsReceived / dashboard.fundingTarget) * 100)}% funded
            </p>
          </div>
        )}
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
