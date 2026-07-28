"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { ApiError, LICENSE_KEY_STORAGE_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();

  const [licenseKey, setLicenseKey] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once a license key has been entered successfully on this phone, it's remembered — a user
  // should never have to type it a second time. "showLicenseField" only reopens if they
  // deliberately ask to switch businesses.
  const [showLicenseField, setShowLicenseField] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    // Read-on-mount — the react.dev-endorsed pattern; this rule is stricter than the docs here.
    const stored = localStorage.getItem(LICENSE_KEY_STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLicenseKey(stored);
    } else {
      setShowLicenseField(true);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(licenseKey, employeeCode, pin);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-11 place-items-center text-base font-extrabold text-navy">
            <img src="/BLUE_LEDGER.png" alt="BLUE LEDGER" />
          </span>
          <h1 className="mt-2 font-display text-xl text-navy">BLUE LEDGER</h1>
          <p className="text-xs font-semibold tracking-wide text-navy/50 uppercase">Owner App</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded border border-red/30 bg-red/10 px-4 py-2.5 text-sm font-semibold text-red">
              {error}
            </div>
          )}

          {showLicenseField ? (
            <label className="block">
              <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">License Key</span>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                autoComplete="off"
                placeholder="From your Business Profile screen"
                className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-sm outline-none focus:border-blue"
              />
            </label>
          ) : (
            <p className="text-center text-[11px] text-navy/40">
              Signing in to this business.{" "}
              <button
                type="button"
                onClick={() => {
                  setShowLicenseField(true);
                  setLicenseKey("");
                }}
                className="font-semibold text-blue underline underline-offset-2"
              >
                Not you?
              </button>
            </p>
          )}

          <label className="block">
            <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">Employee Code</span>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
              autoComplete="username"
              className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold tracking-wide text-navy/60 uppercase">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded border border-navy/20 px-3 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-blue"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue py-3 text-xs font-bold tracking-wide text-white transition hover:bg-blue-press disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
            {submitting ? "SIGNING IN…" : "SIGN IN"}
          </button>

          <p className="text-center text-[11px] text-navy/50">
            Same employee code and PIN you use on the till. This app is read-only.
          </p>
        </form>
      </div>
    </div>
  );
}
