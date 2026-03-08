/**
 * Centralized error handling for the Real Estate CRM.
 * Converts raw DB/Supabase errors into user-friendly messages.
 * Always log the original error for debugging.
 */

const DB_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /foreign key constraint/i,
    message: "The selected item is not configured correctly. Please ensure all referenced records exist."
  },
  {
    pattern: /unique.*constraint|duplicate key/i,
    message: "This record already exists. Please check for duplicates and try again."
  },
  {
    pattern: /not.*null constraint/i,
    message: "A required field is missing. Please fill in all required fields."
  },
  {
    pattern: /check constraint/i,
    message: "One or more values are invalid. Please check your inputs."
  },
  {
    pattern: /violates.*constraint.*user_profiles_company_email_unique/i,
    message: "A user with this email already exists in your company."
  },
  {
    pattern: /role_key.*references.*roles/i,
    message: "The selected role is not configured. Please create the role first, then assign it."
  },
  {
    pattern: /JWT expired|token.*expired/i,
    message: "Your session has expired. Please log in again."
  },
  {
    pattern: /permission denied/i,
    message: "You do not have permission to perform this action."
  },
  {
    pattern: /row-level security/i,
    message: "Access denied. You may not have permission to view or modify this record."
  },
  {
    pattern: /connection.*refused|ECONNREFUSED/i,
    message: "Unable to connect to the server. Please try again in a moment."
  },
  {
    pattern: /timeout/i,
    message: "The request timed out. Please try again."
  }
];

/**
 * Maps a database or API error to a user-friendly string.
 * Logs the original error to the console.
 */
export function mapDbError(error: unknown, context?: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  // Log original error for debugging
  console.error(`[CRM Error]${context ? ` [${context}]` : ""}:`, error);

  for (const { pattern, message } of DB_ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }

  return "Something went wrong. Please try again or contact support if the problem persists.";
}

/**
 * Parse error message from a failed API Response.
 */
export async function mapApiResponseError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: string; message?: string };
    return json.error ?? json.message ?? "An unexpected error occurred.";
  } catch {
    return "An unexpected error occurred.";
  }
}

/**
 * Specific friendly messages for common user management scenarios.
 */
export const USER_ERRORS = {
  roleNotFound:
    "The selected role is not configured. Please go to Roles & Permissions and create this role first.",
  emailDuplicate:
    "A user with this email already exists in your company.",
  cannotDeactivateSelf:
    "You cannot deactivate your own account.",
  cannotRemoveLastAdmin:
    "There must always be at least one active Company Admin. Assign another admin first.",
  invalidPassword:
    "Password must be at least 8 characters long.",
  inviteEmailFailed:
    "User was created but the invitation email could not be sent. Please share login credentials manually."
} as const;

export const LEAD_ERRORS = {
  assigneeNotFound:
    "The selected assignee does not exist or belongs to a different company.",
  invalidStage:
    "The selected pipeline stage is not valid."
} as const;
