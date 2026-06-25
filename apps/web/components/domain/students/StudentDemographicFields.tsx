"use client";

import { useMemo } from "react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  isUgandanNationality,
  NATIONALITY_OPTIONS,
  OTHER_VALUE,
  RELIGION_OPTIONS,
  splitSelectOther,
} from "./studentOptions";
import { UGANDA_DISTRICTS } from "./ugandaDistricts";

const compactControl = "h-7 text-[12px]";

interface NationalityFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function NationalityField({ value, onChange, className = compactControl }: NationalityFieldProps) {
  const { select, other } = splitSelectOther(value, NATIONALITY_OPTIONS);

  return (
    <div className="space-y-1.5">
      <Select
        value={select}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER_VALUE) onChange(other);
          else onChange(next);
        }}
        className={className}
      >
        <option value="">—</option>
        {NATIONALITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other…</option>
      </Select>
      {select === OTHER_VALUE && (
        <Input
          value={other}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter country"
          className={className}
        />
      )}
    </div>
  );
}

interface ReligionFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ReligionField({ value, onChange, className = compactControl }: ReligionFieldProps) {
  const { select, other } = splitSelectOther(value, RELIGION_OPTIONS);

  return (
    <div className="space-y-1.5">
      <Select
        value={select}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER_VALUE) onChange(other);
          else onChange(next);
        }}
        className={className}
      >
        <option value="">—</option>
        {RELIGION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other…</option>
      </Select>
      {select === OTHER_VALUE && (
        <Input
          value={other}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter religion"
          className={className}
        />
      )}
    </div>
  );
}

interface DistrictFieldProps {
  nationality: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DistrictField({ nationality, value, onChange, className = compactControl }: DistrictFieldProps) {
  const selectValue = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return UGANDA_DISTRICTS.find((d) => d.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
  }, [value]);

  const districtOptions = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed && !UGANDA_DISTRICTS.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      return [...UGANDA_DISTRICTS, selectValue].sort((a, b) => a.localeCompare(b));
    }
    return UGANDA_DISTRICTS;
  }, [selectValue, value]);

  if (!isUgandanNationality(nationality)) return null;

  return (
    <FormField label="District" required>
      <Select value={selectValue} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="">—</option>
        {districtOptions.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
