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
 * Uploads files in sequence, then saves data to database
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

    // Upload ID Photo
    if (data.idPhotoFile) {
      try {
        const idPhotoFile = data.idPhotoFile as any; // File object from form
        if (idPhotoFile instanceof File) {
          data.idPhotoFile = await uploadFundiFile(
            idPhotoFile,
            "fundi-ids",
            userId,
            "id-front"
          ) as any;
          progress.idPhoto = { complete: true };
          onProgress?.(progress);
        }
      } catch (err) {
        progress.idPhoto = { complete: false, error: (err as Error).message };
        onProgress?.(progress);
        return {
          success: false,
          message: `ID photo upload failed: ${(err as Error).message}`,
        };
      }
    }

    // Upload ID Photo Back (if provided)
    if (data.idPhotoBackFile) {
      try {
        const idPhotoBackFile = data.idPhotoBackFile as any;
        if (idPhotoBackFile instanceof File) {
          data.idPhotoBackFile = await uploadFundiFile(
            idPhotoBackFile,
            "fundi-ids",
            userId,
            "id-back"
          ) as any;
          progress.idPhotoBack = { complete: true };
          onProgress?.(progress);
        }
      } catch (err) {
        progress.idPhotoBack = { complete: false, error: (err as Error).message };
        onProgress?.(progress);
        return {
          success: false,
          message: `ID back photo upload failed: ${(err as Error).message}`,
        };
      }
    }

    // Upload Selfie
    if (data.selfieFile) {
      try {
        const selfieFile = data.selfieFile as any;
        if (selfieFile instanceof File) {
          data.selfieFile = await uploadFundiFile(
            selfieFile,
            "fundi-selfies",
            userId,
            "selfie"
          ) as any;
          progress.selfie = { complete: true };
          onProgress?.(progress);
        }
      } catch (err) {
        progress.selfie = { complete: false, error: (err as Error).message };
        onProgress?.(progress);
        return {
          success: false,
          message: `Selfie upload failed: ${(err as Error).message}`,
        };
      }
    }

    // Upload Certificates (optional)
    if (data.certificateFiles && data.certificateFiles.length > 0) {
      progress.certificates = [];
      for (let i = 0; i < data.certificateFiles.length; i++) {
        try {
          const certFile = data.certificateFiles[i] as any;
          if (certFile instanceof File) {
            data.certificateFiles[i] = await uploadFundiFile(
              certFile,
              "fundi-certificates",
              userId,
              `certificate-${i}`
            ) as any;
            progress.certificates![i] = { complete: true };
          }
        } catch (err) {
          progress.certificates![i] = {
            complete: false,
            error: (err as Error).message,
          };
          console.warn(`Certificate ${i} upload failed:`, err);
        }
      }
      onProgress?.(progress);
    }

    // Save all data to database
    const result = await saveFundiRegistration(userId, data);

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
