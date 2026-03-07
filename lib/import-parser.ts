import * as XLSX from "xlsx";

export const REQUIRED_IMPORT_FIELDS = ["full_name", "phone"] as const;

export type ParsedImportRow = {
  full_name?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  preferred_location?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  property_type?: string;
  source?: string;
  notes_summary?: string;
};

type StringImportField = Exclude<keyof ParsedImportRow, "budget_min" | "budget_max">;

const STRING_IMPORT_FIELDS: StringImportField[] = [
  "full_name",
  "phone",
  "alternate_phone",
  "email",
  "city",
  "preferred_location",
  "property_type",
  "source",
  "notes_summary"
];

function isStringImportField(value: string): value is StringImportField {
  return STRING_IMPORT_FIELDS.includes(value as StringImportField);
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function toJsonRows(fileName: string, fileBuffer: Buffer): Record<string, unknown>[] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Only CSV and XLSX are supported");
  }

  const workbook = XLSX.read(fileBuffer, {
    type: "buffer"
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: ""
  });

  return rawRows.map((row) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });
    return normalized;
  });
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseImportFile(
  fileName: string,
  fileBuffer: Buffer,
  mapping: Record<string, string>
): Array<{ raw: Record<string, unknown>; parsed: ParsedImportRow; errors: string[] }> {
  const rows = toJsonRows(fileName, fileBuffer);

  return rows.map((raw) => {
    const parsed: ParsedImportRow = {};
    Object.entries(mapping).forEach(([destinationField, sourceHeader]) => {
      const normalizedSource = normalizeHeader(sourceHeader);
      const sourceValue = raw[normalizedSource];
      if (
        destinationField === "budget_min" ||
        destinationField === "budget_max"
      ) {
        parsed[destinationField as "budget_min" | "budget_max"] = parseNumber(sourceValue);
      } else if (sourceValue !== undefined && sourceValue !== null && String(sourceValue).trim() !== "") {
        if (isStringImportField(destinationField)) {
          parsed[destinationField] = String(sourceValue).trim();
        }
      }
    });

    const errors: string[] = [];
    REQUIRED_IMPORT_FIELDS.forEach((requiredField) => {
      const value = parsed[requiredField];
      if (!value || String(value).trim().length === 0) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    });

    return {
      raw,
      parsed,
      errors
    };
  });
}
