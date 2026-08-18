/**
 * Vehicle Number Validation and Formatting Utilities
 * Strictly enforces ALPHANUMERIC ONLY (no spaces, no special characters/symbols).
 */

/**
 * Strips all spaces, symbols, and special characters from a vehicle number string,
 * returning a clean, uppercase alphanumeric string.
 */
export const sanitizeVehicleNumber = (val: string | null | undefined): string => {
  if (!val) return '';
  return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Checks if a vehicle number consists exclusively of alphanumeric characters (A-Z, 0-9),
 * strictly disallowing spaces and special characters.
 */
export const isValidVehicleNumber = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim();
  if (clean.length < 2 || clean.length > 16) return false;
  return /^[a-zA-Z0-9]+$/.test(clean);
};

/**
 * Validates vehicle number and returns a user-friendly error message if invalid.
 */
export const getVehicleNumberValidationError = (
  val: string | null | undefined,
  isRequired: boolean = true
): string | null => {
  if (!val || !val.trim()) {
    return isRequired ? 'Please enter a Vehicle Number (alphanumeric only, e.g. MH02CP4821).' : null;
  }

  const raw = String(val);

  // Check for spaces
  if (/\s/.test(raw)) {
    return 'Spaces are not allowed in Vehicle Number. Please use alphanumeric characters only (e.g. MH02CP4821).';
  }

  // Check for special characters
  if (/[^a-zA-Z0-9]/.test(raw)) {
    return 'Special characters and symbols (-, _, /, etc.) are not allowed in Vehicle Number. Only letters and numbers allowed (e.g. MH02CP4821).';
  }

  if (raw.length < 2) {
    return 'Vehicle Number must be at least 2 characters long.';
  }

  if (raw.length > 16) {
    return 'Vehicle Number cannot exceed 16 characters.';
  }

  return null;
};
