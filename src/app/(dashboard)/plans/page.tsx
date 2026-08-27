"use client";

import { useState, useEffect } from "react";

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState("");

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
    const priceCents = Math.round(parseFloat(price) * 100);
    
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, durationDays, priceCents })
    });

    if (res.ok) {
      setName("");
      setDurationDays(30);
      setPrice("");
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Membership Plans</h1>
          <p className="text-gray-500 mt-1">Manage pricing and durations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Plan</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="e.g. 1 Month Standard" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Days)</label>
                <input required type="number" min="1" value={durationDays} onChange={e => setDurationDays(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-md" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (ETB)</label>
                <input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="e.g. 1500" />
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition">
                Create Plan
              </button>
            </div>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading...</td></tr>
                ) : plans.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">No plans found.</td></tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.durationDays} Days</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{(plan.priceCents / 100).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleDelete(plan.id)} className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
