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
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Add New Member</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-gray-300 rounded p-2" 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name *</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full border border-gray-300 rounded p-2" 
              value={lastName} 
              onChange={(e) => setLastName(e.target.value)} 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input 
            type="text" 
            className="mt-1 block w-full border border-gray-300 rounded p-2" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo (Optional)</label>
          {/* capture="user" suggests facing front camera on mobile */}
          <input 
            type="file" 
            accept="image/*"
            capture="user" 
            ref={fileInputRef}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">Take a photo using a webcam or mobile camera, or upload a file.</p>
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
