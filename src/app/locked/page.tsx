"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/** Landed on whenever any API call 403s with code "WORKING_HOURS_LOCKED" (see api.ts's
 * handleWorkingHoursLocked) — the session itself is still valid, just temporarily blocked, so
 * there's nothing to log back into. Self-polls /mobile/me (the one endpoint every screen already
 * calls on mount) every 30s — the moment it stops 403-ing, this redirects back to "/" with no
 * re-login needed. The only narrowly-scoped polling loop in this app (see api.ts's own note that
 * nothing else here runs a background interval). */
export default function LockedPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    function check(): void {
      api
        .getMe()
        .then(() => {
          // No error means the lock has lifted (schedule reopened, or a Super Admin turned manual
          // lock off) — same session, straight back into the app.
          if (!cancelled) router.replace("/");
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.code === "WORKING_HOURS_LOCKED") {
            // Still locked — nothing else to do, the next tick checks again. Best-effort reason
            // parse from the message text isn't attempted here; the copy below covers both cases
            // generically enough that the specific reason isn't essential.
            return;
          }
          // Any other error (network drop, genuine 401 already redirected by api.ts) — nothing to
          // do here either; a 401 has already sent the browser to /login by the time this runs.
        });
    }

    check();
    const interval = setInterval(check, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red/10 text-red">
          <Clock className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-xl text-navy">System Locked</h1>
        <p className="mt-2 text-sm font-semibold text-navy/60">
          This system is locked outside working hours. It unlocks itself automatically once your storefront reopens, or your Super Admin turns
          it back on.
        </p>

        <button
          type="button"
          onClick={() => logout()}
          className="mx-auto mt-6 flex items-center justify-center gap-2 rounded bg-navy/5 px-4 py-2.5 text-xs font-bold tracking-wide text-navy/70 transition hover:bg-navy/10"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
