import Tesseract from 'tesseract.js';
import sharp from 'sharp';

/**
 * Extract text from image using OCR
 */
export const extractTextFromImage = async (imagePath) => {
  try {
    // Optimize image first
    const processedPath = imagePath.replace(/\.[^.]+$/, '-processed.jpg');
    await sharp(imagePath)
      .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
      .normalize()
      .jpeg({ quality: 90 })
      .toFile(processedPath);

    // Run OCR
    const { data: { text } } = await Tesseract.recognize(
      processedPath,
      'eng',
      {
        logger: () => {} // Silent
      }
    );

    return text;
  } catch (error) {
    console.error('OCR error:', error);
    return '';
  }
};

/**
 * Extract ID number from text (multiple formats)
 */
export const extractIdNumber = (text) => {
  if (!text) return null;

  // Kenya ID format (6 digits)
  const kenyaMatch = text.match(/\b\d{6}\b/);
  if (kenyaMatch) return kenyaMatch[0];

  // Passport format (1-2 letters + digits)
  const passportMatch = text.match(/[A-Z]{1,2}\d{6,7}/);
  if (passportMatch) return passportMatch[0];

  // General format: any sequence of digits
  const digitsMatch = text.match(/\b\d{5,10}\b/);
  if (digitsMatch) return digitsMatch[0];

  return null;
};

/**
 * Extract name from text (usually last word or multi-word sequence)
 */
export const extractName = (text) => {
  if (!text) return null;

  // Split into words and filter out very short words
  const words = text
    .split(/\s+/)
    .filter(w => w.length > 2 && /^[A-Za-z\s-]+$/.test(w))
    .map(w => w.trim());

  if (words.length === 0) return null;

  // Take last 1-3 words as name
  return words.slice(-3).join(' ').toUpperCase();
};

/**
 * Normalize text for comparison
 */
export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
};

/**
 * Check if extracted name matches provided name
 */
export const nameMatches = (extractedName, providedName, threshold = 0.8) => {
  if (!extractedName || !providedName) return false;

  const normalized1 = normalizeText(extractedName);
  const normalized2 = normalizeText(providedName);

  // Exact match
  if (normalized1 === normalized2) return true;

  // Check if words match
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');

  const matchingWords = words1.filter(w => words2.includes(w)).length;
  const totalWords = Math.max(words1.length, words2.length);

  return (matchingWords / totalWords) >= threshold;
};

/**
 * Check if extracted ID matches provided ID
 */
export const idMatches = (extractedId, providedId) => {
  if (!extractedId || !providedId) return false;

  const normalized1 = extractedId.replace(/\D/g, '');
  const normalized2 = providedId.replace(/\D/g, '');

  return normalized1 === normalized2;
};

/**
 * Perform full OCR verification
 */
export const verifyOCRData = async (imagePath, providedName, providedId) => {
  try {
    const extractedText = await extractTextFromImage(imagePath);
    const extractedId = extractIdNumber(extractedText);
    const extractedName = extractName(extractedText);

    const nameValid = nameMatches(extractedName, providedName);
    const idValid = idMatches(extractedId, providedId);

    return {
      success: nameValid && idValid,
      extractedName,
      extractedId,
      nameValid,
      idValid,
      extractedText,
      issues: [
        !nameValid && `Name mismatch: extracted "${extractedName}", provided "${providedName}"`,
        !idValid && `ID mismatch: extracted "${extractedId}", provided "${providedId}"`
      ].filter(Boolean)
    };
  } catch (error) {
    console.error('OCR verification error:', error);
    return {
      success: false,
      error: error.message,
      extractedName: null,
      extractedId: null,
      nameValid: false,
      idValid: false
    };
  }
};
