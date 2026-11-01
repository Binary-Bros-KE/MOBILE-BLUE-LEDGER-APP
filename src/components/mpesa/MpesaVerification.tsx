"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, ApiError, isOfflineError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { loadWithOfflineFallback } from "@/lib/offline-cache";
import type { MpesaPaymentMatch, MpesaVerificationMode, MpesaVerificationRecord, MpesaVerificationState, MpesaVerifications } from "@/lib/types";

/** Codes are stored and compared uppercase and trimmed, however they were typed. */
export function mpesaCodeKey(code: string): string {
  return code.trim().toUpperCase();
}

/** One code's indicator: null means no verification in play, so nothing is shown at all. */
export function mpesaStatusForCode(verifications: MpesaVerifications | null | undefined, code: string | null | undefined): MpesaVerificationRecord["status"] | null {
  if (!verifications || !code) return null;
  return verifications[mpesaCodeKey(code)]?.status ?? null;
}

export function mpesaVerificationActive(state: MpesaVerificationState | null): boolean {
  return Boolean(state?.available && state.mode !== "off");
}

export function mpesaVerificationStrict(state: MpesaVerificationState | null): boolean {
  return Boolean(state?.available && state.mode === "strict");
}

/** This storefront's verification state. Cached per storefront so strict still holds with no
 * connection: a code can't be verified offline, so an M-Pesa sale waits (cash still works). Null
 * until known: the controls then simply don't show. */
export function useMpesaVerificationState(locationId: string | null | undefined): MpesaVerificationState | null {
  const [loaded, setLoaded] = useState<{ locationId: string; state: MpesaVerificationState } | null>(null);
  useEffect(() => {
    if (!locationId) return undefined;
    let cancelled = false;
    loadWithOfflineFallback(`mpesaVerification:${locationId}`, () => api.getMpesaVerification(locationId), isOfflineError)
      .then((result) => {
        if (!cancelled) setLoaded({ locationId, state: result.data });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locationId]);
  return loaded && loaded.locationId === locationId ? loaded.state : null;
}

/** The small Verified / Not verified indicator. Null (verification wasn't in play) shows nothing. */
export function MpesaStatusPill({ status }: { status: MpesaVerificationRecord["status"] | null | undefined }) {
  if (!status) return null;
  return status === "verified" ? (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-green/40 bg-green/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-green uppercase">
      <ShieldCheck className="size-3" aria-hidden="true" />
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gold/40 bg-gold/5 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-gold-text uppercase">
      <ShieldAlert className="size-3" aria-hidden="true" />
      Not verified
    </span>
  );
}

/**
 * Checkout / payment forms: Check Payment lists unclaimed payments on this till for the amount, and
 * the cashier taps the right one to confirm it. Verify checks a typed code. Either way the code is
 * reserved for this sale (`claimKey`) so it can't be used twice. Strict just means the form won't
 * submit without a verified code; this control behaves the same in both modes.
 */
export function MpesaVerifyControl({
  locationId,
  state,
  amountCents,
  code,
  claimKey,
  verifications,
  currency,
  onUseCode,
  onVerified,
}: {
  locationId: string;
  state: MpesaVerificationState;
  /** What this payment should be for; null skips the amount check (e.g. a split row not filled in yet). */
  amountCents: number | null;
  code: string;
  claimKey: string;
  verifications: MpesaVerifications;
  currency: string;
  onUseCode: (code: string) => void;
  onVerified: (code: string, record: MpesaVerificationRecord) => void;
}) {
  const [matches, setMatches] = useState<MpesaPaymentMatch[] | null>(null);
  const [busy, setBusy] = useState<"check" | "verify" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const record = code.trim() ? verifications[mpesaCodeKey(code)] : undefined;

  async function checkPayment(): Promise<void> {
    if (!amountCents) {
      setMessage("Enter the amount first.");
      return;
    }
    setBusy("check");
    setMessage(null);
    try {
      const found = await api.checkMpesaPayment({ locationId, amountCents, claimKey });
      setMatches(found);
      if (found.length === 0) setMessage(`No unclaimed payment of ${formatCents(amountCents, currency)} has reached this till yet.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't reach the server to check payments.");
    } finally {
      setBusy(null);
    }
  }

  async function verify(target: string): Promise<void> {
    setBusy("verify");
    setMessage(null);
    try {
      const result = await api.verifyMpesaCode({ locationId, code: target, amountCents, claimKey });
      if (result.outcome === "verified" && result.record) {
        onUseCode(result.code);
        onVerified(result.code, result.record);
        setMatches(null);
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't reach the server to verify this code.");
    } finally {
      setBusy(null);
    }
  }

  if (record?.status === "verified") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-bold text-green">
        <CheckCircle2 className="size-4 flex-none" aria-hidden="true" />
        Verified{record.payerName ? ` — ${record.payerName}` : ""}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-navy/10 bg-cream-dark/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void checkPayment()}
          disabled={busy !== null}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blue px-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy === "check" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}
          Check Payment
        </button>
        <button
          type="button"
          onClick={() => void verify(code)}
          disabled={busy !== null || !code.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-navy/20 bg-white px-3 text-xs font-bold text-navy disabled:opacity-50"
        >
          {busy === "verify" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-3.5" aria-hidden="true" />}
          Verify Code
        </button>
        <span className="text-[10px] font-bold text-navy/50">{state.mode === "strict" ? "Required for this storefront" : "Optional"}</span>
      </div>

      {matches && matches.length > 0 && (
        <div className="mt-2 space-y-1">
          {matches.map((match) => (
            <button
              key={match.code}
              type="button"
              onClick={() => void verify(match.code)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-navy/15 bg-white px-2.5 py-2 text-left text-xs active:bg-cream-dark"
            >
              <span className="min-w-0 break-words font-bold text-navy">{match.payerName ?? "Name not shared"}</span>
              <span className="flex-none text-[11px] font-bold text-navy/50">
                {match.code} · {formatCents(match.amountCents, currency)}
              </span>
            </button>
          ))}
        </div>
      )}
      {message && <p className="mt-2 text-[11px] font-bold text-red">{message}</p>}
    </div>
  );
}

/**
 * Receipt / invoice detail: the indicator for one recorded code, Verify, and (admin only) Try Different
 * Code. A different code replaces the old one only if it verifies and isn't on any other sale; on
 * failure nothing changes and the old code stays.
 */
export function MpesaSaleCodeActions({
  saleId,
  code,
  verifications,
  canReplace,
  showCode = false,
  onChanged,
}: {
  saleId: string;
  code: string;
  verifications: MpesaVerifications | null | undefined;
  /** approvals.approve — the same check SERVER makes before accepting a different code. */
  canReplace: boolean;
  /** A split sale has several codes, so each needs naming. */
  showCode?: boolean;
  onChanged: () => void;
}) {
  const status = mpesaStatusForCode(verifications, code);
  const [correcting, setCorrecting] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!status) return null;

  async function submit(target: string, replacesCode: string | null): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.verifyMpesaSaleCode({ saleId, code: target, replacesCode });
      if (result.outcome === "verified") {
        setCorrecting(false);
        setNewCode("");
        onChanged();
      } else {
        setMessage(replacesCode ? `${result.message} The sale keeps ${code}.` : result.message);
      }
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't verify this code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        {showCode && <span className="text-[11px] font-bold break-all text-navy/70">{code}</span>}
        <MpesaStatusPill status={status} />
        {status === "unverified" && (
          <button type="button" onClick={() => void submit(code, null)} disabled={busy} className="flex items-center gap-1 text-[11px] font-bold text-blue disabled:opacity-50">
            {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3" aria-hidden="true" />}
            Verify
          </button>
        )}
        {status === "unverified" && canReplace && (
          <button type="button" onClick={() => setCorrecting((value) => !value)} className="text-[11px] font-bold text-navy/50">
            Try different code
          </button>
        )}
      </div>
      {correcting && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Correct M-Pesa code"
            className="h-9 min-w-0 flex-1 rounded-lg border border-navy/15 px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submit(newCode, code)}
            disabled={busy || !newCode.trim()}
            className="h-9 flex-none rounded-lg bg-blue px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            Verify &amp; Replace
          </button>
        </div>
      )}
      {message && <p className="mt-1 text-[11px] font-bold text-red">{message}</p>}
    </div>
  );
}

const MODE_OPTIONS: Array<{ value: MpesaVerificationMode; label: string; description: string }> = [
  { value: "off", label: "Off", description: "No verification. M-Pesa codes are recorded as typed." },
  { value: "loose", label: "Loose", description: "Cashiers can check and verify payments, but a sale can complete without it." },
  { value: "strict", label: "Strict", description: "An M-Pesa code must verify before the sale can complete." },
];

/** Payment verification for one till. Only appears once till credentials are saved. Strict needs the
 * till connected first: without payment notifications almost nothing could ever verify. */
export function MpesaVerificationSettings({ locationId }: { locationId: string }) {
  const [state, setState] = useState<MpesaVerificationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMpesaVerification(locationId)
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  if (!state?.available) return null;

  async function run(action: () => Promise<MpesaVerificationState>, failure: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-dashed border-navy/15 pt-4">
      <p className="text-sm font-bold text-navy">Payment verification</p>
      <p className="mt-0.5 text-xs text-navy/50">Check M-Pesa codes against real payments received on this till.</p>

      <div className="mt-3 space-y-1.5">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={busy || (option.value === "strict" && !state.connected)}
            onClick={() => void run(() => api.saveMpesaVerificationMode(locationId, option.value), "Could not save the verification mode.")}
            className={`w-full rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${state.mode === option.value ? "border-blue bg-blue/5" : "border-navy/15"}`}
          >
            <span className="block text-xs font-bold text-navy">{option.label}</span>
            <span className="block text-[11px] text-navy/50">{option.description}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-cream-dark/40 px-3 py-2">
        {state.connected ? (
          <p className="flex items-center gap-1.5 text-xs font-bold text-green">
            <CheckCircle2 className="size-4 flex-none" aria-hidden="true" />
            Receiving payment notifications from Safaricom
          </p>
        ) : (
          <>
            <p className="text-xs text-navy/60">Connect this till so Safaricom notifies us of each payment. Until then only M-Pesa prompt payments can be verified, and Strict is unavailable.</p>
            {state.connectError && <p className="mt-1 text-[11px] font-bold text-red">{state.connectError}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => api.connectMpesaVerification(locationId), "Could not connect this till.")}
              className="mt-2 flex h-9 items-center gap-1.5 rounded-lg bg-blue px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              Connect Till
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-[11px] font-bold text-red">{error}</p>}
    </div>
  );
}
