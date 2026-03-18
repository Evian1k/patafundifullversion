import sharp from 'sharp';

async function readGrayPixels(imagePath, size = 32) {
  const { data, info } = await sharp(imagePath)
    .resize(size, size, { fit: 'cover' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

function averageHash(pixels, width, height, hashSize = 16) {
  // pixels are already grayscale and sized to width/height; downsample to hashSize if needed.
  // If width/height already equals hashSize, reuse.
  const size = hashSize;
  const out = new Uint8Array(size * size);
  if (width === size && height === size) {
    out.set(pixels);
  } else {
    // nearest neighbor downsample
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = Math.floor((x / size) * width);
        const sy = Math.floor((y / size) * height);
        out[y * size + x] = pixels[sy * width + sx];
      }
    }
  }

  let sum = 0;
  for (const v of out) sum += v;
  const mean = sum / out.length;

  // bitstring as Uint8Array of 0/1
  const bits = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bits[i] = out[i] >= mean ? 1 : 0;
  return bits;
}

function hammingDistance(aBits, bBits) {
  const n = Math.min(aBits.length, bBits.length);
  let d = 0;
  for (let i = 0; i < n; i++) if (aBits[i] !== bBits[i]) d++;
  return d + Math.abs(aBits.length - bBits.length);
}

export async function computeImageSimilarityScore(pathA, pathB) {
  const a = await readGrayPixels(pathA, 32);
  const b = await readGrayPixels(pathB, 32);
  const aHash = averageHash(a.pixels, a.width, a.height, 16);
  const bHash = averageHash(b.pixels, b.width, b.height, 16);
  const dist = hammingDistance(aHash, bHash);
  const max = aHash.length;
  const similarity = Math.max(0, 1 - dist / max);
  return Math.round(similarity * 100);
}

export async function analyzeSelfieQuality(imagePath) {
  const { pixels, width, height } = await readGrayPixels(imagePath, 64);

  // Brightness
  let sum = 0;
  for (const v of pixels) sum += v;
  const mean = sum / pixels.length; // 0..255

  // Sharpness proxy: average absolute difference of neighboring pixels
  let diffSum = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = pixels[idx];
      if (x + 1 < width) {
        diffSum += Math.abs(v - pixels[idx + 1]);
        count++;
      }
      if (y + 1 < height) {
        diffSum += Math.abs(v - pixels[idx + width]);
        count++;
      }
    }
  }
  const sharpness = count ? diffSum / count : 0; // 0..255-ish

  const issues = [];
  if (mean < 55) issues.push('too_dark');
  if (mean > 215) issues.push('too_bright');
  if (sharpness < 8) issues.push('blurry');

  return {
    brightnessMean: Math.round(mean),
    sharpnessScore: Math.round((sharpness / 255) * 100),
    issues,
  };
}

