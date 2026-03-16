import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';

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
    const { data } = await Tesseract.recognize(
      processedPath,
      'eng',
      {
        logger: () => {} // Silent
      }
    );

    const text = data?.text || '';
    const confidence = typeof data?.confidence === 'number' ? data.confidence : null;

    // Best-effort cleanup of processed image
    try {
      await fs.unlink(processedPath);
    } catch {
      // ignore
    }

    return { text, confidence };
  } catch (error) {
    console.error('OCR error:', error);
    return { text: '', confidence: null };
  }
};

/**
 * Extract ID number from text (multiple formats)
 */
export const extractIdNumber = (text) => {
  if (!text) return null;

  // Kenya national ID is typically 8 digits. Prefer the most plausible match.
  const kenya8 = text.match(/\b\d{8}\b/);
  if (kenya8) return kenya8[0];

  // General numeric ID: 7-10 digits (avoid grabbing short numbers that are often noise)
  const kenyaGeneric = text.match(/\b\d{7,10}\b/);
  if (kenyaGeneric) return kenyaGeneric[0];

  // Passport format (1-2 letters + digits)
  const passportMatch = text.match(/[A-Z]{1,2}\d{6,7}/);
  if (passportMatch) return passportMatch[0];

  // General format: any sequence of digits
  const digitsMatch = text.match(/\b\d{5,20}\b/);
  if (digitsMatch) return digitsMatch[0];

  return null;
};

/**
 * Extract the best-matching name candidate from OCR text.
 * Kenyan IDs often contain noise; picking "last words" is very unreliable.
 */
export const extractName = (text, providedName = null) => {
  if (!text) return null;

  const stop = new Set([
    'REPUBLIC', 'OF', 'KENYA', 'IDENTITY', 'CARD', 'NATIONAL', 'SERIAL', 'NUMBER',
    'SEX', 'DATE', 'BIRTH', 'DISTRICT', 'COUNTY', 'PLACE', 'ISSUE', 'SIGNATURE',
  ]);

  const providedTokens = normalizeText(providedName || '')
    .split(' ')
    .filter(Boolean);
  const providedSet = new Set(providedTokens);

  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeText(l))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 5);

  let best = null;
  let bestScore = 0;

  for (const line of lines) {
    // Only keep alpha-ish lines that look like a name (2-4 words)
    const cleaned = line.replace(/[^A-Z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const tokens = cleaned.split(' ').filter(Boolean);
    if (tokens.length < 2 || tokens.length > 5) continue;
    if (tokens.some((t) => stop.has(t))) continue;
    if (tokens.every((t) => t.length < 3)) continue;

    // Score by token overlap with provided name (order-insensitive).
    let score = 0;
    if (providedSet.size > 0) {
      const matches = tokens.filter((t) => providedSet.has(t)).length;
      score = matches / Math.max(providedSet.size, tokens.length);
    } else {
      // If we don't have provided name, fall back to "looks like a name"
      score = 0.2 + Math.min(tokens.length, 4) * 0.1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = tokens.slice(0, 4).join(' ');
    }
  }

  // Fallback: pick first plausible alpha sequence from the whole text
  if (!best) {
    const tokens = normalizeText(text)
      .split(' ')
      .filter((t) => t.length >= 3 && /^[A-Z-]+$/.test(t) && !stop.has(t));
    if (tokens.length >= 2) best = tokens.slice(0, 4).join(' ');
  }

  return best ? best.toUpperCase() : null;
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
    const { text: extractedText, confidence } = await extractTextFromImage(imagePath);
    const extractedId = extractIdNumber(extractedText);
    const extractedName = extractName(extractedText, providedName);

    const nameValid = nameMatches(extractedName, providedName);
    const idValid = idMatches(extractedId, providedId);

    return {
      success: nameValid && idValid,
      extractedName,
      extractedId,
      nameValid,
      idValid,
      extractedText,
      confidenceScore: confidence,
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
