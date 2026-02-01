/**
 * Fundi Service - Business logic for fundi operations
 * Handles validation, data persistence, and file uploads
 */

import { supabase } from "@/integrations/supabase/client";
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

/**
 * Upload a file to Supabase storage and return file metadata
 */
export const uploadFundiFile = async (
  file: File,
  bucket: "fundi-ids" | "fundi-selfies" | "fundi-certificates",
  userId: string,
  fileCategory: string
): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: number;
} | null> => {
  try {
    // Generate unique file path
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${fileCategory}-${timestamp}.${ext}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error(`File upload error (${bucket}):`, error);
      throw error;
    }

    return {
      fileName,
      filePath,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: timestamp,
    };
  } catch (err) {
    console.error("uploadFundiFile error:", err);
    throw err;
  }
};

/**
 * Save fundi registration data to database
 */
export const saveFundiRegistration = async (
  userId: string,
  data: Partial<FundiRegistrationData>
): Promise<FundiRegistrationResponse> => {
  try {
    // Validate submission
    const validation = validateFundiRegistration(data);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }

    const now = Date.now();
    const registrationData = {
      user_id: userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      id_number: data.idNumber,
      id_number_extracted: data.idNumberExtracted || null,
      id_name_extracted: data.idNameExtracted || null,
      
      // File paths (store paths, not raw files)
      id_photo_path: data.idPhotoFile?.filePath || null,
      id_photo_back_path: data.idPhotoBackFile?.filePath || null,
      selfie_path: data.selfieFile?.filePath || null,
      certificate_paths: data.certificateFiles?.map(f => f.filePath) || [],
      
      // GPS Location
      latitude: data.gpsData?.latitude,
      longitude: data.gpsData?.longitude,
      accuracy: data.gpsData?.accuracy,
      altitude: data.gpsData?.altitude || null,
      location_address: data.gpsData?.address,
      location_area: data.gpsData?.area || null,
      location_estate: data.gpsData?.estate || null,
      location_city: data.gpsData?.city || null,
      location_captured_at: data.gpsData?.capturedAt,
      
      // Professional Info
      skills: data.skills || [],
      experience_years: parseInt(data.experience) || 0,
      mpesa_number: data.mpesaNumber,
      
      // Status
      verification_status: VerificationStatus.PENDING,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      submitted_at: new Date(now).toISOString(),
    };

    // Insert into fundi_profiles table
    const { data: inserted, error } = await supabase
      .from("fundi_profiles")
      .insert([registrationData])
      .select();

    if (error) {
      console.error("Database insert error:", error);
      throw error;
    }

    if (!inserted || inserted.length === 0) {
      throw new Error("Failed to save registration data");
    }

    return {
      success: true,
      userId,
      message: "Registration submitted successfully. Awaiting admin review.",
      verificationStatus: VerificationStatus.PENDING,
      data: {
        userId,
        verificationStatus: VerificationStatus.PENDING,
      },
    };
  } catch (err) {
    console.error("saveFundiRegistration error:", err);
    return {
      success: false,
      message: `Registration failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
};

/**
 * Get a fundi's registration by user ID
 * Fundi can only access their own registration
 */
export const getFundiRegistration = async (
  userId: string
): Promise<Partial<FundiRegistrationData> | null> => {
  try {
    const { data, error } = await supabase
      .from("fundi_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error("getFundiRegistration error:", err);
    return null;
  }
};

/**
 * Update fundi verification status (admin only)
 */
export const updateFundiVerificationStatus = async (
  userId: string,
  status: VerificationStatus,
  notes?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("fundi_profiles")
      .update({
        verification_status: status,
        verification_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("updateFundiVerificationStatus error:", err);
    return false;
  }
};
