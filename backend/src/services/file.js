import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure fundis subdirectory exists
const fundisDir = path.join(uploadsDir, 'fundis');
if (!fs.existsSync(fundisDir)) {
  fs.mkdirSync(fundisDir, { recursive: true });
}

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // If uploads were cleaned while the server is running, recreate the directory on demand.
    try {
      if (!fs.existsSync(fundisDir)) {
        fs.mkdirSync(fundisDir, { recursive: true });
      }
    } catch (err) {
      return cb(err);
    }
    // Store in /uploads/fundis/ directory
    cb(null, fundisDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    // Generate unique filenames based on field name
    let filename;
    if (file.fieldname === 'idPhoto') {
      filename = `id_${timestamp}${ext}`;
    } else if (file.fieldname === 'idPhotoBack') {
      filename = `id_back_${timestamp}${ext}`;
    } else if (file.fieldname === 'selfie') {
      filename = `selfie_${timestamp}${ext}`;
    } else {
      filename = `${file.fieldname}_${timestamp}${ext}`;
    }
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
  }

  if (file.size > maxSize) {
    return cb(new Error('File too large. Maximum size is 10MB.'));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * Get public file URL
 */
export const getFileUrl = (filePath, baseUrl = process.env.BACKEND_URL) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  // Files are stored in /uploads/fundis/ so ensure path is correct
  const normalizedPath = filePath.includes('fundis/') ? filePath : `fundis/${filePath}`;
  return `${baseUrl || 'http://localhost:5000'}/uploads/${normalizedPath}`;
};

/**
 * Delete file
 */
export const deleteFile = (filePath) => {
  try {
    const fullPath = path.join(uploadsDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};
