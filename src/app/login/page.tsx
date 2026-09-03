"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });
      if (data) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(error?.message || "Invalid email or password");
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during login");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-[440px] bg-card text-card-foreground p-8 sm:p-10 rounded-2xl shadow-lg border border-border">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Dumbbell className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center">Gym Access</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">Admin Dashboard</p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Email
            </label>
            <input 
              type="email" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Password
            </label>
            <input 
              type="password" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary-hover h-10 px-4 py-2 w-full mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            Authorized personnel only. Secure connection.
          </p>
        </div>
      </div>
    </div>
  );
}
