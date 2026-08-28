"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { hasRole } from "@/lib/roles";

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isOwner = hasRole(session, ['OWNER']);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  
  const [member, setMember] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setMember(data);
          setFirstName(data.firstName);
          setLastName(data.lastName);
          setPhone(data.phone || "");
          setIsBlocked(data.isBlocked);
          setIsArchived(data.isArchived);
        }
        setFetching(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phone", phone);
    
    if (isOwner) {
      formData.append("isBlocked", isBlocked.toString());
      formData.append("isArchived", isArchived.toString());
    }

    if (fileInputRef.current?.files?.[0]) {
      formData.append("photo", fileInputRef.current.files[0]);
    }

    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      body: formData,
    });

    if (res.ok) {
      router.push("/members");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update member");
      setLoading(false);
    }
  };

  const handleRegenerateBarcode = async () => {
    if (!confirm("Are you sure? The old barcode card will become instantly invalid!")) return;
    
    const res = await fetch(`/api/members/${id}/barcode`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setMember({ ...member, barcode: data.barcode });
      alert("Barcode regenerated successfully. Please print a new card.");
    } else {
      alert("Failed to regenerate barcode.");
    }
  };

  if (fetching) return <div className="p-6">Loading...</div>;
  if (!member) return <div className="p-6 text-red-600">Member not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Edit Member</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 mb-4">
            {member.photoUrl ? (
              <img src={member.photoUrl} alt="Current photo" className="w-24 h-24 rounded-lg object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-medium border border-border">No Photo</div>
            )}
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Update Photo</label>
              <input 
                type="file" 
                accept="image/*"
                capture="user" 
                ref={fileInputRef}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

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

          {isOwner && (
            <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={isBlocked} 
                  onChange={(e) => setIsBlocked(e.target.checked)} 
                  className="rounded text-red-600"
                />
                <span className="text-red-700 font-medium">Block Member (Deny Entry)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={isArchived} 
                  onChange={(e) => setIsArchived(e.target.checked)} 
                  className="rounded text-gray-600"
                />
                <span className="text-gray-700 font-medium">Archive Member (Hide from lists)</span>
              </label>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2 border-t border-border mt-4">
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-destructive/5 border border-destructive/20 p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold text-destructive mb-2">Danger Zone</h2>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="font-medium text-destructive">Regenerate Barcode</p>
            <p className="text-sm text-destructive/80 mt-1">Current Barcode: <span className="font-mono bg-destructive/10 px-1.5 py-0.5 rounded text-destructive">{member.barcode}</span></p>
            <p className="text-xs text-destructive/70 mt-1">This will invalidate the current card immediately.</p>
          </div>
          <button 
            onClick={handleRegenerateBarcode}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-medium transition-colors"
          >
            Regenerate Barcode
          </button>
        </div>
      </div>
    </div>
  );
}
