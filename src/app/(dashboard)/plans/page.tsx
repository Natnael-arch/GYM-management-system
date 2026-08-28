"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Dumbbell, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    const res = await fetch("/api/plans");
    if (res.ok) setPlans(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const priceCents = Math.round(parseFloat(price) * 100);
    
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, durationDays, priceCents })
    });

    setIsSubmitting(false);

    if (res.ok) {
      setName("");
      setDurationDays(30);
      setPrice("");
      setIsModalOpen(false);
      fetchPlans();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create plan. Are you an OWNER?");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
    if (res.ok) fetchPlans();
    else {
      const err = await res.json();
      alert(err.error || "Failed to delete plan.");
    }
  };

  return (
    <>
      <TopBar 
        title="Membership Plans" 
        subtitle="Manage pricing and durations" 
        action={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        }
      />
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center p-12 text-muted-foreground">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-card border border-border rounded-2xl">
            <Dumbbell className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-bold">No Plans Configured</h3>
            <p className="text-muted-foreground mt-1">Create your first membership plan to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plans.map(plan => (
              <div key={plan.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 bg-destructive/10 text-destructive rounded-full hover:bg-destructive/20 transition-colors"
                    title="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <Badge variant="neutral">{plan.durationDays} Days</Badge>
                </div>
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums tracking-tight">{(plan.priceCents / 100).toFixed(0)}</span>
                    <span className="text-muted-foreground font-medium">ETB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Plan">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Plan Name</label>
            <input 
              required 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-3 py-2 bg-background border border-input rounded-lg" 
              placeholder="e.g. 1 Month Standard" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Duration (Days)</label>
              <input 
                required 
                type="number" 
                min="1" 
                value={durationDays} 
                onChange={e => setDurationDays(parseInt(e.target.value))} 
                className="w-full px-3 py-2 bg-background border border-input rounded-lg" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Price (ETB)</label>
              <input 
                required 
                type="number" 
                min="0" 
                step="0.01" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="w-full px-3 py-2 bg-background border border-input rounded-lg" 
                placeholder="0.00" 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-4 bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Plan'}
          </button>
        </form>
      </Modal>
    </>
  );
}
