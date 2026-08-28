"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phone", phone);
    
    if (fileInputRef.current?.files?.[0]) {
      formData.append("photo", fileInputRef.current.files[0]);
    }

    const res = await fetch("/api/members", {
      method: "POST",
      body: formData, // browser automatically sets multipart/form-data boundary
    });

    if (res.ok) {
      router.push("/members");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create member");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-card border border-border p-6 rounded-xl shadow-sm">
      <h1 className="text-2xl font-bold mb-6">Add New Member</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">First Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-input bg-background rounded-lg p-2" 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Last Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-input bg-background rounded-lg p-2" 
              value={lastName} 
              onChange={(e) => setLastName(e.target.value)} 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground">Phone</label>
          <input 
            type="text" 
            className="mt-1 block w-full border border-input bg-background rounded-lg p-2" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Photo (Optional)</label>
          {/* capture="user" suggests facing front camera on mobile */}
          <input 
            type="file" 
            accept="image/*"
            capture="user" 
            ref={fileInputRef}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          <p className="text-xs text-muted-foreground mt-1">Take a photo using a webcam or mobile camera, or upload a file.</p>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-6 bg-muted/20 text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center opacity-50">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-muted-foreground">Enroll Biometrics — Available Soon</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Fingerprint and facial recognition enrollment will be available in a future update. For now, this member will rely on barcode scanning or manual check-in.
          </p>
          <button type="button" disabled className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium cursor-not-allowed opacity-50">
            Start Capture
          </button>
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="px-4 py-2 border border-input bg-background rounded-lg text-foreground hover:bg-muted font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? "Saving..." : "Save Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
