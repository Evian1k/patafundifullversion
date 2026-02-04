/**
 * Fundi Controller - Orchestrates fundi registration flow
 * Handles upload sequencing, validation, and submission
 */

import { FundiRegistrationData } from "./fundi.model";
import { validateFundiRegistration } from "./fundi.service";
import { apiClient } from "@/lib/api";

export interface FundiUploadProgress {
  idPhoto?: { complete: boolean; error?: string };
  idPhotoBack?: { complete: boolean; error?: string };
  selfie?: { complete: boolean; error?: string };
  certificates?: { complete: boolean; error?: string }[];
}

/**
 * Handle complete fundi registration submission
 * Uses new REST API backend
 */
export const handleFundiSubmission = async (
  userId: string,
  data: Partial<FundiRegistrationData>,
  onProgress?: (progress: FundiUploadProgress) => void
): Promise<{ success: boolean; message: string }> => {
  try {
    if (!userId) {
      return { success: false, message: "User not authenticated" };
    }

    // Validate data first
    const validation = validateFundiRegistration(data);
    if (!validation.isValid) {
      return { success: false, message: validation.errors.join("; ") };
    }

    const progress: FundiUploadProgress = {};

    // Prepare FormData for multipart submission
    const formData = new FormData();

    // Add personal info
    formData.append('firstName', data.firstName || '');
    formData.append('lastName', data.lastName || '');
    formData.append('email', data.email || '');
    formData.append('phone', data.phone || '');
    formData.append('idNumber', data.idNumber || '');

    // Add GPS data
    if (data.gpsData) {
      formData.append('latitude', String(data.gpsData.latitude));
      formData.append('longitude', String(data.gpsData.longitude));
      formData.append('accuracy', String(data.gpsData.accuracy || 50));
      if (data.gpsData.altitude) {
        formData.append('altitude', String(data.gpsData.altitude));
      }
      formData.append('locationAddress', data.gpsData.address || '');
      formData.append('locationArea', data.gpsData.area || '');
      formData.append('locationCity', data.gpsData.city || '');
    }

    // Add professional info
    formData.append('skills', JSON.stringify(data.skills || []));
    formData.append('experienceYears', String(data.experience || 0));
    if (data.mpesaNumber) {
      formData.append('mpesaNumber', data.mpesaNumber);
    }

    // Add files
    if (data.idPhotoFile instanceof File) {
      formData.append('idPhoto', data.idPhotoFile);
      progress.idPhoto = { complete: true };
      onProgress?.(progress);
    }

    if (data.idPhotoBackFile instanceof File) {
      formData.append('idPhotoBack', data.idPhotoBackFile);
      progress.idPhotoBack = { complete: true };
      onProgress?.(progress);
    }

    if (data.selfieFile instanceof File) {
      formData.append('selfie', data.selfieFile);
      progress.selfie = { complete: true };
      onProgress?.(progress);
    }

    // Add certificates if provided
    if (data.certificateFiles && Array.isArray(data.certificateFiles)) {
      data.certificateFiles.forEach((file: any, index: number) => {
        if (file instanceof File) {
          formData.append('certificates', file);
        }
      });
      progress.certificates = [{ complete: true }];
      onProgress?.(progress);
    }

    // Submit to API
    const result = await apiClient.submitFundiRegistration(formData);

    if (result.success) {
      return {
        success: true,
        message: result.message || 'Registration submitted successfully',
      };
    } else {
      return {
        success: false,
        message: result.message || 'Registration failed',
      };
    }
  } catch (err) {
    console.error("handleFundiSubmission error:", err);
    return {
      success: false,
      message: `Registration failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
};

/**
 * Handle file selection and conversion for upload
 */
export const prepareFileForUpload = async (
  file: File
): Promise<File> => {
  // Basic validation
  if (!file) throw new Error("No file provided");

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: JPEG, PNG, WebP`);
  }

  return file;
};
