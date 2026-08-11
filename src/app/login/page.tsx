"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid credentials");
    } else {
      router.push("/screener");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-bgPrimary flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accentBlue rounded-full mix-blend-screen filter blur-[80px] opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accentGreen rounded-full mix-blend-screen filter blur-[80px] opacity-20"></div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-green-500">Vanguard</span>
            </h1>
            <p className="text-textSecondary">Sign in to your trading terminal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-accentRed/10 border border-accentRed/20 text-accentRed text-sm text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/30 border border-borderSubtle rounded-md px-4 py-3 text-white focus:outline-none focus:border-accentGreen transition-colors"
                placeholder="quant@fund.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/30 border border-borderSubtle rounded-md px-4 py-3 text-white focus:outline-none focus:border-accentGreen transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full mt-6 bg-accentGreen hover:bg-green-400 text-black font-semibold py-3 px-4 rounded-md transition-all shadow-[0_0_15px_rgba(0,255,136,0.3)] hover:shadow-[0_0_25px_rgba(0,255,136,0.5)]"
            >
              Access Terminal
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-textSecondary border-t border-borderSubtle pt-6">
            <p>New trader? Simply login with a new email to create an account.</p>
            <Link href="/" className="inline-block mt-4 text-accentBlue hover:text-blue-400 transition-colors">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
