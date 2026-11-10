"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { samePermissions } from "@/lib/permissions";
import type { MobileRoleDetail } from "@/lib/types";
import { RoleEditSheet } from "../roles/RoleEditSheet";

/** Roles & Permissions — DESKTOP's RolesRoute on the phone. Tap a role to see or change what it can
 * do; built-in roles can be restored to their defaults. No delete, same as DESKTOP for a synced role. */
export function RolesTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [roles, setRoles] = useState<MobileRoleDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** undefined = closed; null = a new role. */
  const [editing, setEditing] = useState<MobileRoleDetail | null | undefined>(undefined);

  function load(): void {
    api
      .listManagedRoles()
      .then(setRoles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load roles."));
  }

  useEffect(load, []);

  return (
    <div className="px-4 py-4 pb-10">
      {canCreate && (
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Role
        </button>
      )}
      {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
      {!roles && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

      <div className="space-y-2">
        {(roles ?? []).map((role) => {
          const changed = role.defaultPermissions !== null && !samePermissions(role.permissions, role.defaultPermissions);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setEditing(role)}
              className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm active:bg-cream-dark"
            >
              <div className="grid size-10 flex-none place-items-center rounded-full bg-navy text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{role.roleName}</p>
                <p className="truncate text-[11px] text-navy/50">
                  {role.employeeCount} employee{role.employeeCount === 1 ? "" : "s"}
                  {role.isSuperAdmin ? " · Every permission" : changed ? " · Changed from defaults" : ""}
                </p>
              </div>
              <span
                className={`flex-none rounded-full border border-dashed px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                  role.isSystemRole ? "border-blue text-blue" : "border-gold text-gold-text"
                }`}
              >
                {role.isSystemRole ? "Built-in" : "Custom"}
              </span>
              <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {editing !== undefined && (
        <RoleEditSheet
          role={editing}
          canEdit={canEdit}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
