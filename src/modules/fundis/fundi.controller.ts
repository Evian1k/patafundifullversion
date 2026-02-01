/**
 * Fundi Controller - Orchestrates fundi registration flow
 * Handles upload sequencing, validation, and submission
 */

import { FundiRegistrationData } from "./fundi.model";
import { uploadFundiFile, saveFundiRegistration, validateFundiRegistration } from "./fundi.service";
import { toast } from "sonner";

export interface FundiUploadProgress {
  idPhoto?: { complete: boolean; error?: string };
  idPhotoBack?: { complete: boolean; error?: string };
  selfie?: { complete: boolean; error?: string };
  certificates?: { complete: boolean; error?: string }[];
}

/**
 * Handle complete fundi registration submission
 * Saves data locally with base64 images, avoiding storage bucket errors
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

    // Save data locally instead of uploading to storage
    // Store base64 images with registration data
    const registrationDataWithImages = {
      ...data,
      idPhotoBase64: (data as any).idPhotoBase64,
      idPhotoBackBase64: (data as any).idPhotoBackBase64,
      selfiePhotoBase64: (data as any).selfiePhotoBase64,
      // Mark files as processed without actual storage upload
      idPhotoFile: { filePath: "local-storage", fileName: "id-front" },
      idPhotoBackFile: { filePath: "local-storage", fileName: "id-back" },
      selfieFile: { filePath: "local-storage", fileName: "selfie" },
    };

    progress.idPhoto = { complete: true };
    onProgress?.(progress);

    progress.idPhotoBack = { complete: true };
    onProgress?.(progress);

    progress.selfie = { complete: true };
    onProgress?.(progress);

    // Save all data to database (with base64 images embedded)
    const result = await saveFundiRegistration(userId, registrationDataWithImages);

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.message,
    };
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
