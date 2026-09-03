"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, CheckCircle2, Loader2 } from "lucide-react";

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [deviceUserId, setDeviceUserId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEnrollFingerprint = async () => {
    setError("");
    const pin = deviceUserId.trim() || String(Math.floor(1000 + Math.random() * 9000));
    setDeviceUserId(pin);
    setEnrolling(true);
    setEnrollStatus("Place finger 3 times on device sensor when prompted...");

    try {
      const res = await fetch("/api/biometrics/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUserId: pin,
          name: `${firstName} ${lastName}`.trim() || `Member ${pin}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollSuccess(true);
        setEnrollStatus("Fingerprint enrolled successfully on device!");
      } else {
        setEnrollStatus(null);
        setError(data.error || "Enrollment failed on device. Please try again.");
      }
    } catch (err: any) {
      setEnrollStatus(null);
      setError(err?.message || "Failed to reach device");
    } finally {
      setEnrolling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phone", phone);
    if (deviceUserId) {
      formData.append("deviceUserId", deviceUserId);
    }
    
    if (fileInputRef.current?.files?.[0]) {
      formData.append("photo", fileInputRef.current.files[0]);
    }

    const res = await fetch("/api/members", {
      method: "POST",
      body: formData,
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
    <div className="flex-1 overflow-y-auto bg-background p-6 lg:p-10">
      <div className="max-w-2xl mx-auto bg-card border border-border p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Add New Member</h1>
      
      {error && <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">First Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-input bg-background rounded-lg p-2 text-sm" 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Last Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-input bg-background rounded-lg p-2 text-sm" 
              value={lastName} 
              onChange={(e) => setLastName(e.target.value)} 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground">Phone</label>
          <input 
            type="text" 
            className="mt-1 block w-full border border-input bg-background rounded-lg p-2 text-sm" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Photo (Optional)</label>
          <input 
            type="file" 
            accept="image/*"
            capture="user" 
            ref={fileInputRef}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          <p className="text-xs text-muted-foreground mt-1">Take a photo using a webcam or mobile camera, or upload a file.</p>
        </div>

        {/* Biometric Enrollment */}
        <div className="border border-border rounded-xl p-5 bg-card text-card-foreground space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Biometric Fingerprint Enrollment</h3>
                <p className="text-xs text-muted-foreground">Register fingerprint directly on the connected ZKTeco device</p>
              </div>
            </div>
            {enrollSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Device User PIN / ID</label>
              <input 
                type="text" 
                placeholder="Auto-assigned if empty (e.g. 101)"
                value={deviceUserId}
                onChange={(e) => setDeviceUserId(e.target.value)}
                className="w-full border border-input bg-background rounded-lg p-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button 
                type="button" 
                onClick={handleEnrollFingerprint}
                disabled={enrolling}
                className="w-full h-10 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {enrolling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Capturing...
                  </>
                ) : enrollSuccess ? (
                  "Re-capture Fingerprint"
                ) : (
                  "Start Fingerprint Capture"
                )}
              </button>
            </div>
          </div>

          {enrollStatus && (
            <p className={`text-xs ${enrollSuccess ? 'text-green-600 font-medium' : 'text-primary animate-pulse'}`}>
              {enrollStatus}
            </p>
          )}
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
    </div>
  );
}
