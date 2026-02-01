/**
 * Fundi Model - Type definitions for fundi registration data
 * Represents the structure of a fundi (service professional) registration submission
 */

export enum VerificationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface FundiGPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  address: string;
  area?: string;
  estate?: string;
  city?: string;
  capturedAt: number;
}

export interface FundiFileUpload {
  fileName: string;
  filePath: string; // Path in storage bucket
  fileSize: number;
  mimeType: string;
  uploadedAt: number;
}

export interface FundiRegistrationData {
  // Identifiers
  userId: string; // Supabase auth user ID
  
  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // ID Verification
  idNumber: string;
  idNumberExtracted?: string; // From OCR
  idNameExtracted?: string; // From OCR
  
  // File Uploads
  idPhotoFile?: FundiFileUpload; // ID front
  idPhotoBackFile?: FundiFileUpload; // ID back
  selfieFile?: FundiFileUpload;
  certificateFiles?: FundiFileUpload[];
  
  // Location Data
  gpsData: FundiGPSData;
  
  // Professional Info
  skills: string[];
  experience: string; // Years of experience
  mpesaNumber: string;
  
  // Verification Status
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
}

/**
 * Validation interface for registration submission
 */
export interface FundiRegistrationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Response from fundi registration submission
 */
export interface FundiRegistrationResponse {
  success: boolean;
  userId?: string;
  message: string;
  verificationStatus?: VerificationStatus;
  data?: Partial<FundiRegistrationData>;
}
