/**
 * Fundi Service - Business logic for fundi operations
 * Handles validation and helper functions
 */

import {
  FundiRegistrationData,
  FundiRegistrationValidation,
  FundiRegistrationResponse,
  VerificationStatus,
} from "./fundi.model";

/**
 * Validate fundi registration data before submission
 */
export const validateFundiRegistration = (
  data: Partial<FundiRegistrationData>
): FundiRegistrationValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.firstName?.trim()) errors.push("First name is required");
  if (!data.lastName?.trim()) errors.push("Last name is required");
  if (!data.email?.trim()) errors.push("Email is required");
  if (!data.phone?.trim()) errors.push("Phone number is required");
  if (!data.idNumber?.trim()) errors.push("ID number is required");

  // File uploads
  if (!data.idPhotoFile) errors.push("ID photo is required");
  if (!data.selfieFile) errors.push("Selfie photo is required");

  // GPS Location
  if (!data.gpsData?.latitude || !data.gpsData?.longitude) {
    errors.push("GPS location is required");
  }
  if (!data.gpsData?.address) {
    warnings.push("Location address could not be resolved");
  }

  // Skills
  if (!data.skills || data.skills.length === 0) {
    errors.push("At least one skill must be selected");
  }

  // Professional info
  if (!data.experience?.trim()) {
    warnings.push("Experience information not provided");
  }
  if (!data.mpesaNumber?.trim()) {
    warnings.push("M-Pesa number not provided");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

