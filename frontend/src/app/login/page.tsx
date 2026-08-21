"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // signIn is a network round trip. Without this the button gave no sign it
  // had been pressed, and a second press fired a second request.
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("That email and password don't match an account.");
        setSubmitting(false);
        return;
      }
      router.push("/screener");
      router.refresh();
      // Deliberately left submitting: the route change is in flight, and
      // re-enabling the button here would flash it live for the frame before
      // navigation commits.
    } catch {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const fieldClass =
    // No focus:outline-none. The global :focus-visible ring in globals.css is
    // the keyboard affordance for the whole app, and the old rule here deleted
    // it on the two most important inputs in the product. The border change is
    // an addition to that ring, not a replacement for it.
    "min-h-11 w-full rounded-lg border border-borderSubtle bg-black/30 px-4 text-textPrimary " +
    "transition-colors duration-150 hover:border-borderStrong focus:border-accentGreen " +
    "disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgPrimary p-4">
      <div className="glass-panel relative w-full max-w-md overflow-hidden p-8">
        {/* Two soft blooms, one per accent, at the diagonal corners. They are
            the only decoration on the page and they stay behind the content. */}
        <div
          aria-hidden
          className="absolute right-0 top-0 h-32 w-32 rounded-full bg-accentBlue opacity-20 mix-blend-screen blur-[80px]"
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-accentGreen opacity-20 mix-blend-screen blur-[80px]"
        />

        <div className="relative z-10">
          <div className="mb-8">
            {/* The product name carries weight and the accent token, not a
                gradient fill: gradient text is the one treatment that reads as
                decoration on a surface whose whole job is to be trusted. */}
            <h1 className="text-3xl font-bold tracking-tight text-textPrimary">
              Welcome to <span className="text-accentGreen">Flint</span>
            </h1>
            <p className="mt-2 text-textSecondary">Sign in to your trading terminal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Reserved region rather than a conditional node, so an arriving
                error slides the form down by nothing. aria-live announces it. */}
            <div aria-live="polite" className="min-h-0">
              {error && (
                <div className="rounded-lg border border-accentRed/25 bg-accentRed/10 p-3 text-sm text-accentRed">
                  {error}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-textSecondary">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className={fieldClass}
                placeholder="quant@fund.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-textSecondary">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className={fieldClass}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={clsx(
                // The glow is built from the accent token. It previously used
                // rgba(0,255,136,…), a green that appears nowhere else in the
                // palette, so the button lit the panel a different colour from
                // the text right above it.
                "mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold",
                "transition-[background-color,box-shadow,opacity] duration-150",
                submitting
                  ? "cursor-not-allowed bg-accentGreen/40 text-black/60"
                  : "bg-accentGreen text-black shadow-glowGreen hover:bg-emerald-300 hover:shadow-[0_0_28px_rgba(52,211,153,0.35)] active:bg-emerald-400",
              )}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? "Signing in…" : "Access Terminal"}
            </button>
          </form>

          <div className="mt-8 border-t border-borderSubtle pt-6 text-sm text-textSecondary">
            <p>New here? Sign in with a new email and an account is created for you.</p>
            <Link
              href="/"
              className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-accentBlue transition-colors duration-150 hover:text-blue-300"
            >
              <ArrowLeft size={14} /> Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
