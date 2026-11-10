"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PERMISSION_ACTION_LABELS, PERMISSION_MODULES, samePermissions, type PermissionsMap } from "@/lib/permissions";
import type { MobileRoleDetail } from "@/lib/types";
import { BottomSheet, SheetError, SheetField, sheetInputClass } from "../BottomSheet";

/**
 * Create or edit a role — DESKTOP's Roles & Permissions editor on the phone: name, description and a
 * toggle per module action. "Restore defaults" (built-in roles only) puts the toggles back to how the
 * role came out of the box; nothing is saved until Save. SERVER applies the same rules: a built-in
 * role keeps its name, Super Admin can't be edited, and only a Super Admin can change their own role.
 */
export function RoleEditSheet({ role, canEdit, onClose, onSaved }: { role: MobileRoleDetail | null; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const isNew = role === null;
  const [roleName, setRoleName] = useState(role?.roleName ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<PermissionsMap>(() => structuredClone(role?.permissions ?? { dashboard: ["view"], owner_app: ["view"] }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readOnly = !isNew && (!canEdit || role.isSuperAdmin);
  const defaults = role?.defaultPermissions ?? null;
  const onDefaults = defaults !== null && samePermissions(permissions, defaults);

  function toggle(moduleKey: string, action: string): void {
    if (readOnly) return;
    setNotice(null);
    setPermissions((prev) => {
      const current = prev[moduleKey] ?? [];
      // Unticking keeps an empty list rather than dropping the key — an explicit "nothing here",
      // exactly like DESKTOP's editor (see its toggleAction).
      const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
      return { ...prev, [moduleKey]: next };
    });
  }

  function toggleRow(moduleKey: string, actions: readonly string[]): void {
    if (readOnly) return;
    setNotice(null);
    setPermissions((prev) => ({ ...prev, [moduleKey]: (prev[moduleKey] ?? []).length === actions.length ? [] : [...actions] }));
  }

  function restoreDefaults(): void {
    if (!defaults) return;
    setPermissions(structuredClone(defaults));
    setNotice("Back to the defaults — tap Save to keep them.");
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!roleName.trim()) return setError("Enter a role name.");
    setSaving(true);
    setError(null);
    try {
      const body = { roleName: roleName.trim(), description: description.trim() || null, permissions };
      if (isNew) await api.createRole(body);
      else await api.updateRole(role.id, body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the role.");
    } finally {
      setSaving(false);
    }
  }

  const subtitle = isNew
    ? "Pick what people with this role can do."
    : role.isSuperAdmin
      ? "Super Admin always has every permission."
      : `${role.employeeCount} employee${role.employeeCount === 1 ? "" : "s"} · ${role.isSystemRole ? "Built-in role" : "Custom role"}`;

  return (
    <BottomSheet title={isNew ? "New Role" : role.roleName} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        <SheetError message={error} />
        <SheetField label="Role name">
          <input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            disabled={readOnly || Boolean(role?.isSystemRole)}
            required
            className={sheetInputClass}
          />
        </SheetField>
        <SheetField label="Description (optional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} className={sheetInputClass} />
        </SheetField>

        {defaults && canEdit && (
          <button
            type="button"
            onClick={restoreDefaults}
            disabled={onDefaults}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy/15 py-2.5 text-xs font-bold text-navy disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {onDefaults ? "On the default permissions" : "Restore defaults"}
          </button>
        )}
        {notice && <p className="text-xs font-semibold text-green">{notice}</p>}

        <div className="divide-y divide-navy/10 rounded-lg border border-navy/10">
          {PERMISSION_MODULES.map((module) => {
            const granted = role?.isSuperAdmin ? [...module.actions] : (permissions[module.key] ?? []);
            const all = granted.length === module.actions.length;
            return (
              <div key={module.key} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs font-bold text-navy">{module.label}</p>
                  {!readOnly && module.actions.length > 1 && (
                    <button type="button" onClick={() => toggleRow(module.key, module.actions)} className="flex-none text-[11px] font-bold text-blue">
                      {all ? "None" : "All"}
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {module.actions.map((action) => {
                    const on = granted.includes(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggle(module.key, action)}
                        disabled={readOnly}
                        aria-pressed={on}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          on ? "border-blue bg-blue text-white" : "border-navy/15 bg-white text-navy/50"
                        } disabled:opacity-70`}
                      >
                        {PERMISSION_ACTION_LABELS[action] ?? action}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : isNew ? "Create Role" : "Save Changes"}
          </button>
        )}
      </form>
    </BottomSheet>
  );
}
