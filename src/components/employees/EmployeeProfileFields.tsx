"use client";

import type { EmployeeProfileInput } from "@/lib/types";
import { SheetField, sheetInputClass } from "../BottomSheet";

/** Mirrors DESKTOP's GENDER_OPTIONS. */
const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const;

/** Form state for the optional profile fields — "" means not set. */
export type EmployeeProfileDraft = Record<keyof EmployeeProfileInput, string>;

export function emptyProfileDraft(): EmployeeProfileDraft {
  return { middleName: "", gender: "", dateOfBirth: "", alternativePhone: "", email: "", department: "", jobTitle: "", hireDate: "" };
}

export function profileDraftFrom(source: { [K in keyof EmployeeProfileInput]: string | null }): EmployeeProfileDraft {
  return {
    middleName: source.middleName ?? "",
    gender: source.gender ?? "",
    dateOfBirth: source.dateOfBirth ?? "",
    alternativePhone: source.alternativePhone ?? "",
    email: source.email ?? "",
    department: source.department ?? "",
    jobTitle: source.jobTitle ?? "",
    hireDate: source.hireDate ?? "",
  };
}

/** Draft -> request body: blanks become null (SERVER does the same either way). */
export function profileInputFrom(draft: EmployeeProfileDraft): EmployeeProfileInput {
  const value = (text: string) => text.trim() || null;
  return {
    middleName: value(draft.middleName),
    gender: (value(draft.gender) as EmployeeProfileInput["gender"]) ?? null,
    dateOfBirth: value(draft.dateOfBirth),
    alternativePhone: value(draft.alternativePhone),
    email: value(draft.email),
    department: value(draft.department),
    jobTitle: value(draft.jobTitle),
    hireDate: value(draft.hireDate),
  };
}

/** The optional profile fields shared by Add Employee ("More details") and Edit Details — the same
 * set as DESKTOP's Employee form, minus photo and salary defaults. Middle name is rendered by the
 * caller next to first/last name, so it isn't repeated here. */
export function EmployeeProfileFields({ value, onChange }: { value: EmployeeProfileDraft; onChange: (patch: Partial<EmployeeProfileDraft>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SheetField label="Job title">
          <input value={value.jobTitle} onChange={(e) => onChange({ jobTitle: e.target.value })} className={sheetInputClass} />
        </SheetField>
        <SheetField label="Department">
          <input value={value.department} onChange={(e) => onChange({ department: e.target.value })} className={sheetInputClass} />
        </SheetField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SheetField label="Email">
          <input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} className={sheetInputClass} />
        </SheetField>
        <SheetField label="Alternative phone">
          <input type="tel" value={value.alternativePhone} onChange={(e) => onChange({ alternativePhone: e.target.value })} className={sheetInputClass} />
        </SheetField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SheetField label="Gender">
          <select value={value.gender} onChange={(e) => onChange({ gender: e.target.value })} className={sheetInputClass}>
            <option value="">—</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </SheetField>
        <SheetField label="Date of birth">
          <input type="date" value={value.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} className={sheetInputClass} />
        </SheetField>
      </div>
      <SheetField label="Hire date">
        <input type="date" value={value.hireDate} onChange={(e) => onChange({ hireDate: e.target.value })} className={sheetInputClass} />
      </SheetField>
    </>
  );
}
