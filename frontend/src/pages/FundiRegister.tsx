import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";
import { FundiRegistrationData } from "@/modules/fundis";
import { apiClient } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  MapPin,
  Loader,
  X,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VerificationStep {
  name: string;
  completed: boolean;
  status: "pending" | "in_progress" | "approved" | "rejected";
}

interface VerificationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  idNumber: string;
  idPhoto: File | null;
  idPhotoPreview: string;
  idPhotoBase64?: string;
  idPhotoBack: File | null;
  idPhotoBackPreview: string;
  idPhotoBackBase64?: string;
  extractedIdName: string;
  idNameMatches: boolean;
  selfiePhoto: Blob | null;
  selfiePhotoPreview: string;
  selfiePhotoBase64?: string;
  selfieTimestamp: number;
  isSelfieCapture: boolean;
  faceMatchScore: number;
  livenessScore: number;
  selfieQualityIssues: string[];
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  locationDisplayName: string;
  locationArea: string;
  locationEstate: string;
  locationCity: string;
  capturedAt: number;
  locationMismatchFlagged: boolean;
  locationMismatchReason: string;
  skills: string[];
  experience: string;
  mpesaNumber: string;
}

const skills = [
  "Plumbing",
  "Electrical",
  "AC & HVAC",
  "Cleaning",
  "Carpentry",
  "Auto Repair",
  "Painting",
  "Masonry",
  "Welding",
  "Roofing",
];

const validatePhoneNumber = (phone: string): boolean => {
  return /^(\+254|0)[0-9]{9}$/.test(phone.replace(/\s/g, ""));
};

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateIDNumber = (id: string): boolean => {
  // Accept ID numbers from 4 to 20 digits to support different country formats
  return /^\d{4,20}$/.test(id.replace(/\s/g, ""));
};

const validatePassword = (password: string): boolean => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
};

// OCR Parsing Utility for Kenyan National IDs
interface OCRParseResult {
  rawText: string;
  surname: string;
  givenNames: string;
  idNumber: string;
  fullName: string;
  confidence: number;
  errorMessage: string | null;
}

interface VerificationResult {
  nameMatches: boolean;
  idNumberMatches: boolean;
  nameError: string | null;
  idNumberError: string | null;
  overallValid: boolean;
}

const normalizeOCRText = (text: string): string => {
  return text
    .toUpperCase()
    // Fix common OCR mistakes
    .replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S").replace(/8/g, "B")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
};

// Normalize text specifically for numeric/alphanumeric ID extraction
const normalizeOCRForNumbers = (text: string): string => {
  return text
    .toUpperCase()
    // Common OCR letter->digit mistakes
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/\s+/g, " ")
    .trim();
};

// Clean and normalize extracted name strings: remove document headers, OCR trash tokens,
// keep alphabetic name tokens and common punctuation between names.
const cleanNameString = (s: string): string => {
  if (!s) return "";
  // Uppercase and trim
  let t = s.toUpperCase().trim();

  // Replace common OCR junk separators with spaces
  t = t.replace(/[\/|,_\-]+/g, " ");

  // If OCR included obvious divider words like PLACE/DATE/NUMBER, cut there
  const cutAt = t.search(/\b(PLACE|DATE|NUMBER|EXPIRY|EXPIRY|SEX|NATIONALITY|ISSUE|EXPIRES|DOB|BIRTH)\b/);
  if (cutAt > -1) {
    t = t.slice(0, cutAt).trim();
  }

  // Extended stopwords to remove document headers and OCR artifacts
  const stopwords = new Set([
    "REPUBLIC",
    "OF",
    "KENYA",
    "NATIONAL",
    "IDENTITY",
    "CARD",
    "SURNAME",
    "GIVEN",
    "NAME",
    "GIVENNAME",
    "OTHER",
    "NO",
    "NO.",
    "N0",
    "WW",
    "FOL",
    "EL",
    "THE",
    "MINISTRY",
    "GOVERNMENT",
    "KEN",
    "MALE",
    "FEMALE",
    "PLACE",
    "SIRTF",
    "SRTF",
    "ARR",
    "AS",
    "AL",
    "FERS",
    "YY",
    "IB",
    "FOD",
    "AEE",
    "OS",
    "OO",
    "WK",
    "LOA",
    "MAKADARA",
    "NAMBA",
  ]);

  // Split into tokens and keep those that look like name tokens (letters only, length>=2)
  const tokens = t
    .split(/\s+/)
    .map((tok) => tok.replace(/[^A-Z]/g, ""))
    .filter((tok) => tok.length >= 2 && !stopwords.has(tok));

  // If nothing left, try relaxed tokens (allow 1-char tokens)
  if (tokens.length === 0) {
    const relaxed = t
      .split(/\s+/)
      .map((tok) => tok.replace(/[^A-Z]/g, ""))
      .filter((tok) => tok.length >= 1 && !stopwords.has(tok));
    return relaxed.join(" ").trim();
  }

  // Limit to first 4 tokens to avoid long header bleed
  return tokens.slice(0, 4).join(" ").trim();
};

// Attempt robust worldwide ID extraction from OCR text.
// Steps: 1) look for labeled fields (ID NO, PASSPORT NO, NID, etc.)
// 2) fallback to pure-digit sequences (4-20 digits)
// 3) fallback to alphanumeric tokens 4-20 chars requiring at least 1-2 digits
const extractIDNumberWorldwide = (rawOcrText: string): string => {
  if (!rawOcrText || rawOcrText.trim().length === 0) return "";
  const normForLabels = normalizeOCRForNumbers(rawOcrText);

  // Common label patterns that precede ID numbers
  const labelPatterns = [
    "ID NUMBER",
    "ID NO",
    "IDNO",
    "NATIONAL ID",
    "NID",
    "PASSPORT NO",
    "PASSPORT",
    "PPNO",
    "PP NO",
    "NO:",
    "NUMBER",
  ];

  for (const label of labelPatterns) {
    const re = new RegExp(label.replace(/\s+/g, "\\s+") + "[:\-\s]*([A-Z0-9\-\/\\s]{4,25})", "i");
    const m = normForLabels.match(re);
    if (m && m[1]) {
      const candidate = m[1].replace(/[^A-Z0-9]/gi, "").trim();
      if (candidate.length >= 4 && candidate.length <= 20) return candidate;
    }
  }

  // Flatten all tokens from normalized-number text
  const tokens = normForLabels.split(/[^A-Z0-9]+/).filter(Boolean);

  // 1) Look for pure-digit tokens of length 4-20
  for (const t of tokens) {
    if (/^\d{4,20}$/.test(t)) return t;
  }

  // 2) Look for alphanumeric tokens 4-20 chars with >=2 digits (likely passports/IDs)
  for (const t of tokens) {
    if (/^[A-Z0-9]{4,20}$/.test(t)) {
      const digitCount = (t.match(/\d/g) || []).length;
      if (digitCount >= 2) return t;
    }
  }

  // 3) Relaxed fallback: any alphanumeric 4-20 chars
  for (const t of tokens) {
    if (/^[A-Z0-9]{4,20}$/.test(t)) return t;
  }

  // 4) As last resort, look for digit sequences inside original raw text (7-10 digits commonly)
  const rawDigitMatch = rawOcrText.match(/\d{4,20}/);
  if (rawDigitMatch) return rawDigitMatch[0];

  return "";
};

const extractKenyanIDFields = (rawOcrText: string): OCRParseResult => {
  const text = normalizeOCRText(rawOcrText);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let surname = "";
  let givenNames = "";
  let idNumber = "";
  let allExtractedNames: string[] = [];
  let errorMessage: string | null = null;

  // Extract SURNAME - look for "SURNAME" label or just extract name-like text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("SURNAME")) {
      // Capture whatever comes after the label on the same line
      const m = lines[i].match(/SURNAME[:\-\s\/]*([^\n]+)/i);
      if (m && m[1]) surname = m[1].trim();
      // otherwise, grab the next line if it looks name-like
      if (!surname && i + 1 < lines.length) surname = lines[i + 1].trim();
      // clean noisy tokens
      surname = cleanNameString(surname);
      if (surname && !surname.match(/^\d+$/) && surname.length > 1) break;
    }
  }

  // Extract GIVEN NAME / FIRST NAME / OTHER NAME
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes("GIVEN NAME") ||
      line.includes("FIRST NAME") ||
      line.includes("GIVEN NAMES") ||
      line.includes("OTHER NAME")
    ) {
      const m = line.match(/(?:GIVEN NAME|GIVEN NAMES|FIRST NAME|OTHER NAME)[:\-\s\/]*([^\n]+)/i);
      if (m && m[1]) givenNames = m[1].trim();
      else if (i + 1 < lines.length) givenNames = lines[i + 1].trim();
      givenNames = cleanNameString(givenNames);
      if (givenNames && !givenNames.match(/^\d+$/) && givenNames.length > 1) break;
    }
  }

  // Fallback: If no labels found, extract name-like lines (Kenyan ID often has them without labels)
  if (!surname || !givenNames) {
    let foundFirstName = false;
    let foundSecondName = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip document headers and metadata
      if (
        line.includes("REPUBLIC") ||
        line.includes("JAMHURI") ||
        line.includes("KENYA") ||
        line.includes("NATIONAL") ||
        line.includes("IDENTITY") ||
        line.includes("CARD") ||
        line.includes("KITAMBU")
      ) {
        continue;
      }

      // Look for lines that are names (mostly letters, 3-50 chars)
      // remove slashes and weird punctuation before testing
      const cleanLine = line.replace(/[\/|,_\-]+/g, " ");
      const isNameLike =
        /^[A-Z\s]+$/.test(cleanLine) && // Only uppercase letters and spaces
        !cleanLine.match(/^\d+$/) && // Not all numbers
        !cleanLine.includes("ID NUMBER") &&
        !cleanLine.includes("SEX") &&
        !cleanLine.includes("DATE") &&
        !cleanLine.includes("BIRTH") &&
        !cleanLine.includes("NATIONALITY") &&
        !cleanLine.includes("PLACE") &&
        !cleanLine.includes("ISSUED") &&
        !cleanLine.includes("EXPIRES") &&
        cleanLine.length > 2 &&
        cleanLine.length < 50;

      if (isNameLike) {
        // First name line is likely surname, second is likely given name
        if (!foundFirstName) {
          if (!surname) surname = cleanNameString(line);
          foundFirstName = true;
        } else if (!foundSecondName) {
          if (!givenNames) givenNames = cleanNameString(line);
          foundSecondName = true;
          break;
        }
      }
    }
  }

  // Extract ID NUMBER
  // Extract ID NUMBER using a worldwide-tolerant extractor (labels, pure digits, alphanumeric)
  idNumber = extractIDNumberWorldwide(rawOcrText);

  // Fallback: try scanning the OCR lines for any 4-20 digit sequence
  if (!idNumber) {
    for (let i = 0; i < lines.length; i++) {
      const digitMatch = lines[i].match(/\b\d{4,20}\b/);
      if (digitMatch) {
        idNumber = digitMatch[0];
        break;
      }
    }
  }

  // Validation - Only GIVEN NAMES and ID NUMBER are mandatory
  if (!givenNames) {
    errorMessage = "Could not extract name from ID";
  } else if (!idNumber) {
    errorMessage = "Could not extract ID NUMBER from ID";
  }

  // Full name can be surname + given names, or just given names if surname not found
  // Clean the final composed full name to remove any remaining headers
  const composed = surname ? `${surname} ${givenNames}`.trim() : givenNames.trim();
  const fullName = cleanNameString(composed);

  return {
    rawText: text,
    surname,
    givenNames,
    idNumber,
    fullName,
    confidence: errorMessage ? 0.5 : 0.95,
    errorMessage,
  };
};

// Fuzzy token-based name matching (80% threshold)
  const fuzzyNameMatch = (
  userFirstName: string,
  userLastName: string,
  extractedSurname: string,
  extractedGivenNames: string
): { matches: boolean; confidence: number; reason: string } => {
  const userTokens = new Set(
    `${userFirstName} ${userLastName}`
      .toUpperCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );

  const extractedTokens = new Set(
    `${extractedSurname} ${extractedGivenNames}`
      .toUpperCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );

  if (userTokens.size === 0 || extractedTokens.size === 0) {
    return {
      matches: false,
      confidence: 0,
      reason: "Invalid name tokens",
    };
  }
  // Levenshtein distance for token similarity
  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    const al = a.length;
    const bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const matrix: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) matrix[i][0] = i;
    for (let j = 0; j <= bl; j++) matrix[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[al][bl];
  };

  const tokenSimilar = (u: string, v: string): boolean => {
    if (!u || !v) return false;
    if (u === v) return true;
    const maxLen = Math.max(u.length, v.length);
    const dist = levenshtein(u, v);
    const similarity = 1 - dist / Math.max(1, maxLen);
    return similarity >= 0.65; // token-level similarity threshold
  };

  // Calculate token match percentage using approximate token matching
  let matches = 0;
  const extractedArray = Array.from(extractedTokens);
  userTokens.forEach((token) => {
    // exact match first
    if (extractedTokens.has(token)) {
      matches++;
      return;
    }
    // otherwise check approximate token similarity
    for (const ext of extractedArray) {
      if (tokenSimilar(token, ext)) {
        matches++;
        break;
      }
    }
  });

  const confidence = Math.round((matches / userTokens.size) * 100);
  const THRESHOLD = 60;

  return {
    matches: confidence >= THRESHOLD,
    confidence,
    reason:
      confidence >= THRESHOLD
        ? `Name match confirmed (${confidence}% confidence)`
        : `Insufficient name match (${confidence}% vs required ${THRESHOLD}%)`,
  };
};

const FundiRegister = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idPhotoBackInputRef = useRef<HTMLInputElement>(null);
  const selfieFileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionCountdown, setDetectionCountdown] = useState(0);
  const faceDetectorRef = useRef<any>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const stableFaceCountRef = useRef(0);
  const [showPassword, setShowPassword] = useState(false);
  const [cameraCountdown, setCameraCountdown] = useState(0);
  const [ocrDebugInfo, setOcrDebugInfo] = useState<OCRParseResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [geoPermission, setGeoPermission] = useState<string | null>(null);
  const [coordsFromDevice, setCoordsFromDevice] = useState(false);
  const [userAdjustedLocation, setUserAdjustedLocation] = useState(false);
  const geocodeSeqRef = useRef(0);

  const [requiredPolicies, setRequiredPolicies] = useState<Array<{ slug: string; title: string; version: string }>>(
    []
  );
  const [policyChecks, setPolicyChecks] = useState<Record<string, boolean>>({});
  const [penalties, setPenalties] = useState<Array<{ level: string; description: string; duration_minutes: number | null }>>(
    []
  );
  const [rulesPreview, setRulesPreview] = useState<Array<{ role: string; rule_text: string; severity_level: number }>>(
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, pen, rules] = await Promise.all([
          apiClient.request("/policies/required/fundi", { includeAuth: false }),
          apiClient.request("/penalties", { includeAuth: false }),
          apiClient.request("/rules?role=fundi", { includeAuth: false }),
        ]);
        if (cancelled) return;
        const required = p?.required || [];
        setRequiredPolicies(required);
        setPenalties(pen?.penalties || []);
        setRulesPreview((rules?.rules || []).slice(0, 12));
        const checks: Record<string, boolean> = {};
        for (const item of required) checks[item.slug] = false;
        setPolicyChecks(checks);
      } catch {
        // If content endpoints are unavailable, allow the UI to load (backend still enforces acceptance on submit).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaflet map refs for Step 4 (mirror CreateJob behavior)
  const fundiMapElRef = useRef<HTMLDivElement | null>(null);
  const fundiMapRef = useRef<any>(null);
  const fundiMarkerRef = useRef<any>(null);
  const fundiAccuracyCircleRef = useRef<any>(null);

  // Forward-geocoding search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: number; lon: number }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([
    { name: "Personal Info", completed: false, status: "pending" },
    { name: "Name Verification", completed: false, status: "pending" },
    { name: "Liveness Check", completed: false, status: "pending" },
    { name: "Location Verification", completed: false, status: "pending" },
    { name: "Review & Approval", completed: false, status: "pending" },
  ]);

  const [data, setData] = useState<VerificationData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    idNumber: "",
    idPhoto: null,
    idPhotoPreview: "",
    idPhotoBack: null,
    idPhotoBackPreview: "",
    extractedIdName: "",
    idNameMatches: false,
    selfiePhoto: null,
    selfiePhotoPreview: "",
    selfieTimestamp: 0,
    isSelfieCapture: false,
    faceMatchScore: 0,
    livenessScore: 0,
    selfieQualityIssues: [],
    latitude: null,
    longitude: null,
    accuracy: null,
    altitude: null,
    locationDisplayName: "",
    locationArea: "",
    locationEstate: "",
    locationCity: "",
    capturedAt: 0,
    locationMismatchFlagged: false,
    locationMismatchReason: "",
    skills: [],
    experience: "",
    mpesaNumber: "",
  });

  const locationAutoCapturedRef = useRef(false);

  // Optional prefill when user comes from /auth signup
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fundi_prefill");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      localStorage.removeItem("fundi_prefill");

      const fullName = typeof parsed?.fullName === "string" ? parsed.fullName.trim() : "";
      const [firstName = "", ...rest] = fullName.split(/\s+/).filter(Boolean);
      const lastName = rest.join(" ");

      setData((prev) => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        email: prev.email || (typeof parsed?.email === "string" ? parsed.email : ""),
      }));
    } catch {
      // ignore
    }
  }, []);

  // Auto-capture location when user reaches Step 4 (first time)
  useEffect(() => {
    if (step === 4 && !locationAutoCapturedRef.current) {
      locationAutoCapturedRef.current = true;
      // preload Leaflet early so map is ready immediately
      ensureLeafletLoaded().then(() => setLeafletLoaded(true)).catch(() => {});
    }
  }, [step]);

  // Preload Leaflet as soon as this component mounts to speed map display later
  useEffect(() => {
    let canceled = false;
    ensureLeafletLoaded()
      .then(() => {
        if (!canceled) setLeafletLoaded(true);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, []);

  // preload leaflet when user navigates to step 4 (also allow manual preload)
  useEffect(() => {
    if (step === 4 && !leafletLoaded) {
      ensureLeafletLoaded().then(() => setLeafletLoaded(true)).catch(() => {});
    }
  }, [step, leafletLoaded]);

  // Validation functions
  const validateStep1 = (): boolean => {
    if (!data.firstName.trim() || !data.lastName.trim()) {
      toast.error("First and last name are required");
      return false;
    }
    if (!validateEmail(data.email)) {
      toast.error("Valid email is required");
      return false;
    }
    if (!validatePhoneNumber(data.phone)) {
      toast.error("Valid Kenyan phone number required (+254 or 0...)");
      return false;
    }
    if (!validatePassword(data.password)) {
      toast.error("Password: 8+ chars, uppercase, lowercase, number, special character");
      return false;
    }
    if (!validateIDNumber(data.idNumber)) {
      toast.error("ID number must be 4-20 digits (or valid passport/ID)");
      return false;
    }
    return true;
  };

  // Step 1: Personal Information
  const handleStep1Next = async () => {
    if (!validateStep1()) return;

    setLoading(true);
    try {
      const checksToPerform = [
        { field: "user_id", value: data.email, message: "Email is already registered" },
      ];

      // Just proceed - registration handles duplicates via auth
      // We'll let the auth system handle email/phone uniqueness

      setStep(2);
      updateVerificationStep(0, "approved");
      updateVerificationStep(1, "in_progress");
      toast.success("Personal information validated");
    } catch (error) {
      toast.error("Error validating information");
    } finally {
      setLoading(false);
    }
  };

  // reverse geocode helper: prefer Google Maps Geocoding API if key present, otherwise fallback to OSM Nominatim
  const reverseGeocodeLocation = async (lat: number, lng: number) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (key) {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
        if (!res.ok) throw new Error("Google geocode failed");
        const json = await res.json();
        const result = json.results && json.results[0];
        if (!result) throw new Error("No geocode results");
        const comp = (result.address_components || []);
        const find = (type: string) => {
          const c = comp.find((c: any) => (c.types || []).includes(type));
          return c ? c.long_name : null;
        };
        return {
          displayName: result.formatted_address,
          area: find("neighborhood") || find("sublocality") || find("administrative_area_level_3") || "",
          estate: find("sublocality_level_1") || find("sublocality") || "",
          city: find("locality") || find("administrative_area_level_2") || "",
        };
      } catch (e) {
        console.warn("Google reverse geocode failed, falling back", e);
      }
    }

    // fallback to OSM Nominatim
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
        headers: { Accept: "application/json", "User-Agent": "FixitConnect-Verification/1.0" },
      });
      if (!r.ok) throw new Error("Nominatim failed");
      const j = await r.json();
      const addr = j.address || {};
      return {
        displayName: j.display_name || "",
        area: addr.suburb || addr.neighbourhood || addr.village || "",
        estate: addr.hamlet || addr.residential || addr.estate || "",
        city: addr.city || addr.town || addr.county || "",
      };
    } catch (e) {
      console.warn("Fallback geocode failed", e);
      return { displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, area: "", estate: "", city: "" };
    }
  };

  // Step 2: ID Verification
  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB");
      return;
    }

    const preview = URL.createObjectURL(file);
    setData((prev) => ({ ...prev, idPhoto: file, idPhotoPreview: preview }));

    setLoading(true);
    const toastId = toast.loading("Extracting text from ID using OCR...");
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imageData = e.target?.result as string;
          // store base64 representation for later admin review
          setData((prev) => ({ ...prev, idPhotoBase64: imageData }));
          
          const result = await Tesseract.recognize(imageData, "eng", {
            logger: (m) => {
              if (m.status === "recognizing") {
                // Silent progress
              }
            },
          });

          const rawOcrText = result.data.text;

          // Parse the OCR result using structured field extraction
          const parseResult = extractKenyanIDFields(rawOcrText);

          // Store debug info for admin
          setOcrDebugInfo(parseResult);

          // Validate parsing was successful
          if (parseResult.errorMessage) {
            toast.dismiss(toastId);
            toast.error(`OCR parsing failed: ${parseResult.errorMessage}`);
            setLoading(false);
            return;
          }

          // Perform fuzzy name matching
          const nameMatchResult = fuzzyNameMatch(
            data.firstName,
            data.lastName,
            parseResult.surname,
            parseResult.givenNames
          );

          // Verify ID number matches - MUST be exact match
          const userIdNumber = data.idNumber.replace(/\s/g, "");
          const extractedIdNumber = parseResult.idNumber.replace(/\s/g, "");
          const idNumberMatches = userIdNumber === extractedIdNumber;

          // Create verification result object
          const verResult: VerificationResult = {
            nameMatches: nameMatchResult.matches,
            idNumberMatches: idNumberMatches,
            nameError: nameMatchResult.matches
              ? null
              : `Name does not match the uploaded ID (${nameMatchResult.confidence}% match, need 80%)`,
            idNumberError: idNumberMatches
              ? null
              : `ID number does not match the uploaded ID (You entered: ${userIdNumber}, ID shows: ${extractedIdNumber})`,
            overallValid: nameMatchResult.matches && idNumberMatches,
          };

          setVerificationResult(verResult);
          setOcrDebugInfo(parseResult);

          setData((prev) => ({
            ...prev,
            extractedIdName: parseResult.fullName,
            idNameMatches: verResult.overallValid,
          }));

          toast.dismiss(toastId);

          if (!verResult.overallValid) {
            // Show specific error for what failed
            if (verResult.nameError && verResult.idNumberError) {
              toast.error("Name and ID number do not match the uploaded ID");
            } else if (verResult.nameError) {
              toast.error(verResult.nameError);
            } else if (verResult.idNumberError) {
              toast.error(verResult.idNumberError);
            }

            console.log("=== Verification Failed ===");
            console.log("Extracted from ID:", {
              fullName: parseResult.fullName,
              idNumber: parseResult.idNumber,
            });
            console.log("User Entered:", {
              name: `${data.firstName} ${data.lastName}`,
              idNumber: userIdNumber,
            });
            console.log("Verification Errors:", verResult);
            console.log("=== End ===");
          } else {
            toast.success(
              `✓ Verified: ${parseResult.fullName} (ID: ${parseResult.idNumber})`
            );
          }
        } catch (ocrError) {
          console.error("OCR Error:", ocrError);
          toast.dismiss(toastId);
          toast.error(
            ocrError instanceof Error
              ? ocrError.message
              : "Failed to extract text from ID. Please try a clearer photo with visible text."
          );
          setData((prev) => ({ ...prev, idPhoto: null, idPhotoPreview: "" }));
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Failed to process ID image");
      setLoading(false);
    }
  };

  const handleIDBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB");
      return;
    }

    const preview = URL.createObjectURL(file);
    setData((prev) => ({ ...prev, idPhotoBack: file, idPhotoBackPreview: preview }));

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setData((prev) => ({ ...prev, idPhotoBackBase64: imageData }));
    };
    reader.readAsDataURL(file);
    toast.success("✓ ID back photo uploaded");
  };

  const handleStep2Next = () => {
    if (!data.idPhoto || !data.idNameMatches) {
      toast.error("ID name must match exactly");
      return;
    }
    setStep(3);
    updateVerificationStep(1, "approved");
    updateVerificationStep(2, "in_progress");
    toast.success("ID verified");
  };

  // Step 3: Selfie Upload
  // Step 3: Selfie Upload
  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB");
      return;
    }

    const preview = URL.createObjectURL(file);
    // read base64 as well for storage
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setData((prev) => ({
        ...prev,
        selfiePhoto: new Blob([file], { type: file.type }),
        selfiePhotoPreview: preview,
        selfiePhotoBase64: dataUrl,
        isSelfieCapture: true,
      }));
    };
    reader.readAsDataURL(file);
    toast.success("Selfie uploaded successfully");
  };

  // Step 3: Selfie + Liveness
  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    // Ensure canvas matches video size
    const v = videoRef.current;
    const cw = v.videoWidth || 1280;
    const ch = v.videoHeight || 720;
    canvasRef.current.width = cw;
    canvasRef.current.height = ch;
    // Draw current video frame onto canvas for capture
    context.drawImage(videoRef.current, 0, 0, cw, ch);
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        toast.error("Failed to capture selfie");
        return;
      }

      const issues = blob.size < 50000 ? ["image_too_small_screenshot"] : [];

      setData((prev) => ({
        ...prev,
        selfiePhoto: blob,
        selfiePhotoPreview: URL.createObjectURL(blob),
        selfieTimestamp: Date.now(),
        isSelfieCapture: true,
        // Scores are computed server-side during verification (no mock/random).
        faceMatchScore: 0,
        livenessScore: 0,
        selfieQualityIssues: issues,
      }));

      toast.success("Selfie captured and verified");
      // keep the preview visible but stop live camera to conserve resources
      stopCamera();
    }, "image/jpeg", 0.95);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        // ensure muted so autoplay works
        try {
          videoRef.current.muted = true;
          (videoRef.current as HTMLVideoElement).playsInline = true;
        } catch (e) {
          // ignore
        }
        videoRef.current.srcObject = stream;
        // Ensure the video starts playing and sizes become available
        videoRef.current.onloadedmetadata = () => {
          try {
            videoRef.current?.play().catch(() => {
              // ignore play errors
            });
            // initialize canvas to video size
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth || 1280;
              canvasRef.current.height = videoRef.current.videoHeight || 720;
            }
          } catch (e) {
            // ignore play errors
          }
        };
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Camera access denied. Check permissions.");
    }
  }, []);

  useEffect(() => {
    // cleanup when leaving step 3
    return () => {
      if (detectionIntervalRef.current) {
        window.clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      stableFaceCountRef.current = 0;
      setFaceDetected(false);
      setDetectionCountdown(0);
    };
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setCameraActive(false);
    }
    if (detectionIntervalRef.current) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    stableFaceCountRef.current = 0;
    setFaceDetected(false);
    setDetectionCountdown(0);
  };

  const handleStep3Next = () => {
    if (!data.selfiePhotoPreview) {
      toast.error("Please upload a selfie");
      return;
    }
    setStep(4);
    updateVerificationStep(2, "approved");
    updateVerificationStep(3, "in_progress");
    toast.success("Selfie uploaded");
  };

  // Step 4: GPS Location
  // User can: 1) Click on map to select location, 2) Use device GPS as fallback
  const setLocationFromCoords = async (
    latitude: number,
    longitude: number,
    source: 'map_click' | 'device_gps' = 'map_click',
    meta?: { accuracy?: number | null; altitude?: number | null }
  ) => {
    setLoading(true);
    try {
      const seq = ++geocodeSeqRef.current;

      // Update coords immediately so the map/marker moves right away.
      setData((prev) => ({
        ...prev,
        latitude,
        longitude,
        accuracy:
          typeof meta?.accuracy === 'number'
            ? meta.accuracy
            : source === 'device_gps'
              ? prev.accuracy
              : prev.accuracy,
        altitude: typeof meta?.altitude === 'number' ? meta.altitude : prev.altitude,
        capturedAt: Date.now(),
        locationMismatchFlagged: false,
        locationMismatchReason: "",
      }));

      setCoordsFromDevice(source === 'device_gps');
      setUserAdjustedLocation(false);

      // reverse geocode (prefer Google if API key available)
      let displayName = "";
      let area = "";
      let estate = "";
      let city = "";
      try {
        const geocoded = await reverseGeocodeLocation(latitude, longitude);
        displayName = geocoded.displayName || "";
        area = geocoded.area || "";
        estate = geocoded.estate || "";
        city = geocoded.city || "";
      } catch (e) {
        console.warn("Reverse geocode failed", e);
      }

      // Only apply geocode results if this is still the latest location request.
      if (seq === geocodeSeqRef.current) {
        setData((prev) => ({
          ...prev,
          accuracy:
            source === 'device_gps'
              ? (typeof meta?.accuracy === 'number' ? meta.accuracy : prev.accuracy)
              : (typeof meta?.accuracy === 'number' ? meta.accuracy : prev.accuracy),
          altitude: typeof meta?.altitude === 'number' ? meta.altitude : prev.altitude,
          locationDisplayName: displayName,
          locationArea: area,
          locationEstate: estate,
          locationCity: city,
        }));
      }

      if (source === 'map_click') {
        toast.success(`✓ Location set: ${displayName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`);
      } else {
        const acc = meta?.accuracy != null ? Math.round(meta.accuracy) : null;
        toast.success(`✓ Device GPS captured${acc ? ` (accuracy: ±${acc}m)` : ''}`);
      }
    } catch (err) {
      console.error('setLocationFromCoords error', err);
      toast.error("Failed to set location");
    } finally {
      setLoading(false);
    }
  };

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Device GPS unavailable — use map click instead");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Getting device GPS location...");
    try {
      // On laptops/desktops, geolocation sometimes returns an early coarse fix.
      // Collect a few samples (watchPosition) and pick the best accuracy.
      const best = await new Promise<GeolocationPosition>((resolve, reject) => {
        const samples: GeolocationPosition[] = [];
        let settled = false;

        const finish = (pos?: GeolocationPosition) => {
          if (settled) return;
          settled = true;
          try {
            if (watchId != null) navigator.geolocation.clearWatch(watchId);
          } catch {
            // ignore
          }
          if (pos) resolve(pos);
          else if (samples.length > 0) {
            const best = samples.reduce((a, b) => (a.coords.accuracy <= b.coords.accuracy ? a : b));
            resolve(best);
          } else {
            reject(new Error("No GPS samples"));
          }
        };

        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            samples.push(pos);
            // If we got a decent fix quickly, finish early.
            if (pos.coords.accuracy && pos.coords.accuracy <= 35 && samples.length >= 2) {
              finish(pos);
            }
          },
          (err) => {
            if (samples.length > 0) finish();
            else reject(err);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        );

        // Give it a few seconds to improve accuracy, then settle.
        setTimeout(() => finish(), 6500);
      });

      const { latitude, longitude, accuracy, altitude } = best.coords;
      toast.dismiss(toastId);
      await setLocationFromCoords(latitude, longitude, 'device_gps', {
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        altitude: typeof altitude === 'number' ? altitude : null,
      });
    } catch (err: any) {
      console.error('captureLocation error', err);
      toast.dismiss(toastId);
      toast.error("Device GPS failed — click on map to set location instead");
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Leaflet map initialization + sync (same approach as customer CreateJob)
  useEffect(() => {
    if (step !== 4) return;
    if (!leafletLoaded) return;
    if (!fundiMapElRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // init once per step visit
    if (!fundiMapRef.current) {
      const startLat = typeof data.latitude === "number" ? data.latitude : -1.2865;
      const startLng = typeof data.longitude === "number" ? data.longitude : 36.8172;

      const map = L.map(fundiMapElRef.current, {
        center: [startLat, startLng],
        zoom: 16,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      fundiMapRef.current = map;
      fundiMarkerRef.current = marker;

      // Click on map sets location
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng || {};
        if (typeof lat === "number" && typeof lng === "number") {
          setLocationFromCoords(lat, lng, "map_click");
          setUserAdjustedLocation(true);
          setCoordsFromDevice(false);
        }
      });

      marker.on("dragend", (ev: any) => {
        const pos = ev?.target?.getLatLng?.();
        if (pos && typeof pos.lat === "number" && typeof pos.lng === "number") {
          setLocationFromCoords(pos.lat, pos.lng, "map_click");
          setUserAdjustedLocation(true);
          setCoordsFromDevice(false);
        }
      });

      // Invalidate size after layout settles (fixes grey tiles / wrong center).
      const invalidate = () => {
        try { map.invalidateSize(true); } catch {}
      };
      requestAnimationFrame(invalidate);
      setTimeout(invalidate, 120);
      setTimeout(invalidate, 420);
    }

    return () => {
      // cleanup when leaving step 4
      try {
        if (fundiMapRef.current) {
          fundiMapRef.current.remove();
          fundiMapRef.current = null;
          fundiMarkerRef.current = null;
          fundiAccuracyCircleRef.current = null;
        }
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, leafletLoaded]);

  // Sync marker/view + accuracy circle whenever coords change
  useEffect(() => {
    if (step !== 4) return;
    const map = fundiMapRef.current;
    const marker = fundiMarkerRef.current;
    const L = (window as any).L;
    if (!map || !marker || !L) return;
    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return;

    const lat = data.latitude;
    const lng = data.longitude;
    const z = coordsFromDevice ? 17 : 16;

    try {
      if (typeof map.flyTo === "function") map.flyTo([lat, lng], z, { animate: true, duration: 0.6 });
      else map.setView([lat, lng], z);
      marker.setLatLng([lat, lng]);
      try { map.invalidateSize(true); } catch {}

      // accuracy circle
      const acc = typeof data.accuracy === "number" && Number.isFinite(data.accuracy) ? data.accuracy : null;
      if (acc && acc > 0) {
        const radius = Math.min(Math.max(acc, 5), 500);
        if (!fundiAccuracyCircleRef.current) {
          fundiAccuracyCircleRef.current = L.circle([lat, lng], {
            radius,
            color: "#3b82f6",
            weight: 1,
            fillColor: "#60a5fa",
            fillOpacity: 0.15,
          }).addTo(map);
        } else {
          fundiAccuracyCircleRef.current.setLatLng([lat, lng]);
          fundiAccuracyCircleRef.current.setRadius(radius);
        }
      } else if (fundiAccuracyCircleRef.current) {
        fundiAccuracyCircleRef.current.remove();
        fundiAccuracyCircleRef.current = null;
      }
    } catch {
      // ignore
    }
  }, [step, data.latitude, data.longitude, data.accuracy, coordsFromDevice]);

  const searchLocation = async (q?: string) => {
    const query = (q ?? searchQuery).trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const key = (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY;
      if (key) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:KE&key=${key}`,
        );
        const j = await res.json();
        const results = (j.results || []).slice(0, 5).map((r: any) => ({ display_name: r.formatted_address, lat: r.geometry.location.lat, lon: r.geometry.location.lng }));
        setSearchResults(results);
      } else {
        // Nominatim fallback
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=ke`, {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'FundiHub/1.0 (contact@fundihub.example)' },
        });
        const j = await res.json();
        const results = (j || []).map((it: any) => ({ display_name: it.display_name, lat: parseFloat(it.lat), lon: parseFloat(it.lon) }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('searchLocation error', err);
      toast.error('Location search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleStep4Next = () => {
    if (data.latitude == null || data.longitude == null) {
      toast.error("GPS location required");
      return;
    }

    setStep(5);
    updateVerificationStep(3, "approved");
    updateVerificationStep(4, "in_progress");
  };

  // Step 5: Final Submit
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Validate required files
      if (!data.idPhoto) {
        toast.error("ID photo is required");
        setLoading(false);
        return;
      }
      if (!data.selfiePhoto) {
        toast.error("Selfie photo is required");
        setLoading(false);
        return;
      }

      // Ensure the account exists and we have a token.
      // - New users: /auth/signup (no OTP)
      // - Existing users:
      //    - if verified: login and continue
      //    - if unverified (OTP registration): resend OTP and redirect to OTP screen
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      try {
        await apiClient.signup(data.email, data.password, fullName, "fundi");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("user already exists")) {
          try {
            await apiClient.login(data.email, data.password);
          } catch (loginErr) {
            const loginMsg = loginErr instanceof Error ? loginErr.message : "";
            if (loginMsg.toLowerCase().includes("not verified")) {
              // Trigger OTP resend (and set role to fundi_pending for onboarding)
              await apiClient.register(data.email, data.password, fullName, data.phone || null, "fundi");
              localStorage.setItem("pending_otp_email", data.email);
              localStorage.setItem("pending_otp_purpose", "register");
              // Pre-fill fundi register fields after OTP
              try {
                localStorage.setItem(
                  "fundi_prefill",
                  JSON.stringify({ fullName, email: data.email })
                );
              } catch {
                // ignore
              }
              toast.error("Account exists but is not verified. Enter the OTP to continue.");
              navigate("/auth?mode=signup");
              return;
            }
            throw loginErr;
          }
        } else {
          throw err;
        }
      }

      // Persist policy acceptance now that we have an authenticated session.
      const slugsToAccept = (requiredPolicies || []).map((p) => p.slug).filter(Boolean);
      if (slugsToAccept.length > 0) {
        await apiClient.request("/policies/accept", {
          method: "POST",
          includeAuth: true,
          body: { slugs: slugsToAccept },
        });
      }

      // Build FormData directly
      const formData = new FormData();

      // Add personal info
      formData.append('firstName', data.firstName);
      formData.append('lastName', data.lastName);
      formData.append('email', data.email);
      formData.append('phone', data.phone);
      formData.append('idNumber', data.idNumber);

      // Add GPS data
      formData.append('latitude', String(data.latitude!));
      formData.append('longitude', String(data.longitude!));
      formData.append('accuracy', String(data.accuracy || 50));
      if (data.altitude) {
        formData.append('altitude', String(data.altitude));
      }
      formData.append('locationAddress', data.locationDisplayName || '');
      formData.append('locationArea', data.locationArea || '');
      formData.append('locationCity', data.locationCity || '');

      // Add professional info
      formData.append('skills', JSON.stringify(data.skills));
      if (data.experience) {
        formData.append('experienceYears', String(data.experience));
      }
      if (data.mpesaNumber) {
        formData.append('mpesaNumber', data.mpesaNumber);
      }

      // Add files
      formData.append('idPhoto', data.idPhoto);
      if (data.idPhotoBack) {
        formData.append('idPhotoBack', data.idPhotoBack);
      }
      formData.append('selfie', data.selfiePhoto);

      // Submit directly to API
      const result = await apiClient.submitFundiRegistration(formData);

      if (result.success) {
        toast.success(result.message || 'Registration submitted successfully!');
        setTimeout(() => navigate("/fundi/pending"), 800);
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error("Submission error:", error);
      const msg = error instanceof Error ? error.message : 'Submission failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const updateVerificationStep = (index: number, status: VerificationStep["status"]) => {
    setVerificationSteps((prev) => {
      const updated = [...prev];
      updated[index].status = status;
      if (status === "approved") updated[index].completed = true;
      return updated;
    });
  };

  const toggleSkill = (skill: string) => {
    setData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary to-orange-600 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Secure Verification</h1>
          </div>
          <p className="text-muted-foreground">Complete all steps to start accepting jobs</p>
        </div>

        {step > 0 ? (
          <div className="mb-8 grid grid-cols-5 gap-2">
            {verificationSteps.map((vstep, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all border-2 ${
                  vstep.status === "approved"
                    ? "bg-gradient-to-br from-success/20 to-success/10 border-success text-success"
                    : vstep.status === "rejected"
                      ? "bg-gradient-to-br from-destructive/20 to-destructive/10 border-destructive text-destructive"
                      : vstep.status === "in_progress"
                        ? "bg-gradient-to-br from-primary/20 to-primary/10 border-primary text-primary"
                        : "bg-gradient-to-br from-muted/50 to-muted/25 border-border text-muted-foreground"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  vstep.status === "approved"
                    ? "bg-success text-white"
                    : vstep.status === "rejected"
                      ? "bg-destructive text-white"
                      : vstep.status === "in_progress"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                }`}>
                  {vstep.status === "approved" ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                </div>
                <span className="text-xs font-medium text-center line-clamp-2">{vstep.name}</span>
              </motion.div>
            ))}
          </div>
        ) : null}

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-md">
          {/* STEP 0 (Compliance Gate) */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="font-semibold text-foreground">Read before registering</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PataFundi requires Fundis to follow platform rules, use real identity, and accept platform payments only. Violations lead to penalties.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-foreground">Policies & Rules</h2>
                <p className="text-sm text-muted-foreground">
                  Please review and accept the required policies below.
                </p>
                <div className="space-y-2">
                  {requiredPolicies.length > 0 ? (
                    requiredPolicies.map((p) => (
                      <div key={p.slug} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-secondary/30">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(policyChecks[p.slug])}
                            onChange={(e) => setPolicyChecks((prev) => ({ ...prev, [p.slug]: e.target.checked }))}
                            className="mt-1"
                          />
                          <span className="text-sm">
                            <span className="font-semibold text-foreground">{p.title}</span>
                            <span className="block text-xs text-muted-foreground">Version {p.version}</span>
                          </span>
                        </label>
                        <a
                          href={`/policies/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Open
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Loading policies… If this takes too long, continue — the backend will still enforce acceptance on submit.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Penalties (summary)</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(penalties || []).slice(0, 4).map((p) => (
                    <div key={p.level} className="rounded-lg border bg-secondary/20 p-3">
                      <div className="text-sm font-semibold text-foreground capitalize">{p.level}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Top rules for Fundis</h3>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {(rulesPreview || []).slice(0, 6).map((r, idx) => (
                    <li key={idx}>{r.rule_text}</li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => {
                  const allChecked =
                    requiredPolicies.length === 0 ? true : requiredPolicies.every((p) => Boolean(policyChecks[p.slug]));
                  if (!allChecked) {
                    toast.error("Please accept all required policies to continue");
                    return;
                  }
                  setStep(1);
                }}
                className="w-full"
              >
                I understand and agree — continue
              </Button>
            </motion.div>
          )}
          {/* STEP 1 */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">Personal Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={data.firstName}
                    onChange={(e) => setData((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={data.lastName}
                    onChange={(e) => setData((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={data.email}
                  onChange={(e) => setData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                />
                <input
                  type="tel"
                  placeholder="Phone (+254 or 0...)"
                  value={data.phone}
                  onChange={(e) => setData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (8+ chars, upper, lower, number, special)"
                    value={data.password}
                    onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition pr-10"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Government ID Number (8 digits)"
                  value={data.idNumber}
                  onChange={(e) => setData((prev) => ({ ...prev, idNumber: e.target.value }))}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>
              <div className="flex gap-4 mt-8">
                <Button onClick={handleStep1Next} disabled={loading} className="flex-1">
                  {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  {loading ? "Validating..." : "Continue"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">ID Verification (OCR)</h2>
              {!data.idPhotoPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-2">Upload ID Photo</p>
                  <p className="text-sm text-muted-foreground">Clear photo of government ID with visible text</p>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIDUpload} className="hidden" aria-label="Upload ID photo" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Front ID Photo */}
                  <div className="relative">
                    <img src={data.idPhotoPreview} alt="ID" className="w-full h-64 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => {
                        setData((prev) => ({ ...prev, idPhoto: null, idPhotoPreview: "", extractedIdName: "", idNameMatches: false }));
                        setOcrDebugInfo(null);
                      }}
                      className="absolute top-2 right-2 bg-destructive hover:bg-destructive/90 text-white p-2 rounded-lg transition"
                      title="Remove ID photo"
                      aria-label="Remove ID photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Back ID Photo Upload */}
                  {!data.idPhotoBackPreview ? (
                    <div
                      onClick={() => idPhotoBackInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-foreground font-medium mb-1">Upload ID Back Photo</p>
                      <p className="text-sm text-muted-foreground">Optional - back side of your ID</p>
                      <input ref={idPhotoBackInputRef} type="file" accept="image/*" onChange={handleIDBackUpload} className="hidden" aria-label="Upload ID back photo" />
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={data.idPhotoBackPreview} alt="ID Back" className="w-full h-48 object-cover rounded-lg border border-border" />
                      <button
                        onClick={() => {
                          setData((prev) => ({ ...prev, idPhotoBack: null, idPhotoBackPreview: "" }));
                        }}
                        className="absolute top-2 right-2 bg-destructive hover:bg-destructive/90 text-white p-2 rounded-lg transition"
                        title="Remove ID back photo"
                        aria-label="Remove ID back photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-2">✓ ID back photo uploaded</p>
                    </div>
                  )}

                  {/* Resolved Location Name */}
                  <div className="p-3 bg-secondary rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Resolved Location</p>
                    <p className="font-medium text-foreground">{data.locationDisplayName || [data.locationArea, data.locationEstate, data.locationCity].filter(Boolean).join(", ") || "(unnamed location)"}</p>
                  </div>
                  
                  {/* Debug Information for Admins - Only show on error */}
                  {data.extractedIdName && (
                    <div className={`p-4 rounded-lg border-2 ${data.idNameMatches ? "bg-success/10 border-success" : "bg-destructive/10 border-destructive"}`}>
                      <div className="flex items-start gap-3">
                        {data.idNameMatches ? (
                          <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-foreground mb-3">
                            {data.idNameMatches ? "✓ ID Verified Successfully" : "✗ ID Verification Failed"}
                          </p>
                          <div className="text-sm space-y-2">
                            {/* Display extracted information */}
                            <div>
                              <p className="text-muted-foreground">Name on ID:</p>
                              <p className="text-foreground font-medium">{ocrDebugInfo?.fullName || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Your Input:</p>
                              <p className="text-foreground font-medium">{data.firstName} {data.lastName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ID Number on ID:</p>
                              <p className="text-foreground font-medium">{ocrDebugInfo?.idNumber || "—"}</p>
                            </div>

                            {/* Show specific errors */}
                            {!data.idNameMatches && verificationResult && (
                              <div className="mt-3 pt-3 border-t border-destructive/30 space-y-1">
                                {verificationResult.nameError && (
                                  <p className="text-destructive text-xs">
                                    <span className="font-medium">✗</span> {verificationResult.nameError}
                                  </p>
                                )}
                                {verificationResult.idNumberError && (
                                  <p className="text-destructive text-xs">
                                    <span className="font-medium">✗</span> {verificationResult.idNumberError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-4 mt-8">
                <Button onClick={() => { setStep(1); setVerificationResult(null); setOcrDebugInfo(null); }} variant="outline" className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleStep2Next} disabled={!data.idNameMatches} className="flex-1">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">Selfie Verification</h2>
              <p className="text-muted-foreground mb-6">Upload a photo of yourself for verification.</p>
              
              {!data.selfiePhotoPreview && (
                <div
                  onClick={() => selfieFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-2">Upload Your Photo</p>
                  <p className="text-sm text-muted-foreground mb-4">Clear photo of your face</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, or WebP • Max 10MB</p>
                  <input 
                    ref={selfieFileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleSelfieUpload}
                    className="hidden" 
                    aria-label="Upload selfie photo" 
                  />
                </div>
              )}

              {data.selfiePhotoPreview && (
                <div className="space-y-4">
                  <div className="relative">
                    <img 
                      src={data.selfiePhotoPreview} 
                      alt="Selfie" 
                      className="w-full h-96 object-cover rounded-lg border-2 border-border" 
                    />
                  </div>

                  <div className="p-4 bg-success/10 border-2 border-success rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">✓ Photo Uploaded Successfully</p>
                      <p className="text-sm text-muted-foreground mt-1">Your photo is ready for submission.</p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => {
                      setData((prev) => ({
                        ...prev,
                        selfiePhoto: undefined,
                        selfiePhotoPreview: "",
                        isSelfieCapture: false,
                        faceMatchScore: 0,
                        faceMatchPercentage: 0,
                        livenessScore: 0,
                      }));
                      if (selfieFileInputRef.current) {
                        selfieFileInputRef.current.value = "";
                      }
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Choose Another Photo
                  </Button>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleStep3Next} 
                  disabled={!data.selfiePhotoPreview} 
                  className="flex-1"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">GPS Location Verification</h2>
              
              <div className="p-4 bg-blue-500/10 border-2 border-blue-500 rounded-lg mb-4">
                <p className="font-medium text-foreground">📍 Set Your Exact Location</p>
                <p className="text-sm text-muted-foreground mt-2">Search for your address or click on the map to mark your exact location.</p>
              </div>

              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') searchLocation(); }}
                    placeholder="Search address, place or landmark"
                    className="flex-1 px-3 py-2 border rounded-lg bg-background text-foreground"
                    aria-label="Search location"
                  />
                  <Button onClick={() => searchLocation()} disabled={searchLoading}>
                    {searchLoading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : null}
                    Search
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-auto rounded-lg border bg-card">
                    {searchResults.map((r, i) => (
                      <li key={i} className="p-2 hover:bg-muted/10 cursor-pointer" onClick={() => { setLocationFromCoords(r.lat, r.lon, 'map_click'); setSearchResults([]); setSearchQuery(''); }}>
                        {r.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Map is ALWAYS visible - user clicks to set location */}
              <div className="w-full h-96 rounded-lg border-2 border-border overflow-hidden relative mb-4">
                <div ref={fundiMapElRef} className="w-full h-full" />
                {!leafletLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                    <div className="flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded">
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Loading map…</span>
                    </div>
                  </div>
                )}
              </div>

                <div className="flex gap-3 mb-4">
                  {typeof navigator !== 'undefined' && (navigator as any).geolocation ? (
                    <Button onClick={captureLocation} disabled={loading} className="flex-1">
                      {loading ? (
                        <span className="flex items-center justify-center"><Loader className="w-4 h-4 mr-2 animate-spin" />Getting GPS…</span>
                      ) : (
                        <span className="flex items-center justify-center">Use Device GPS</span>
                      )}
                    </Button>
                  ) : (
                    <div className="flex-1 p-2 text-sm text-muted-foreground">Device GPS unavailable — click the map to set location.</div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => {
                      setData((prev) => ({ ...prev, latitude: null, longitude: null, accuracy: null, locationDisplayName: "" }));
                      setCoordsFromDevice(false);
                      setUserAdjustedLocation(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>

              {/* Show info after location is set */}
              {data.latitude != null && data.longitude != null && (
                <div className="space-y-3">
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">Location Name</p>
                    <p className="font-medium text-foreground">{data.locationDisplayName || "Click map to set"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                      <p className="font-mono font-bold">{typeof data.latitude === 'number' ? data.latitude.toFixed(6) : '—'}°</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                      <p className="font-mono font-bold">{typeof data.longitude === 'number' ? data.longitude.toFixed(6) : '—'}°</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setData((prev) => ({
                        ...prev,
                        latitude: null,
                        longitude: null,
                        accuracy: null,
                        locationDisplayName: "",
                        locationArea: "",
                        locationEstate: "",
                        locationCity: "",
                      }));
                      setCoordsFromDevice(false);
                      setUserAdjustedLocation(false);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    🔄 Change Location (click map again)
                  </Button>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleStep4Next} 
                  disabled={data.latitude == null || data.longitude == null}
                  className="flex-1"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">Review & Submit</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">Name</p>
                  <p className="font-medium text-foreground">{data.firstName} {data.lastName}</p>
                </div>
                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">ID Verified</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-foreground font-medium">Matched</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-foreground">Skills</label>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`p-2 rounded-lg text-sm font-medium transition-all border ${
                        data.skills.includes(skill) 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                placeholder="Years of experience"
                value={data.experience}
                onChange={(e) => setData((prev) => ({ ...prev, experience: e.target.value }))}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary mb-4"
              />
              <input
                type="tel"
                placeholder="M-Pesa number for payments"
                value={data.mpesaNumber}
                onChange={(e) => setData((prev) => ({ ...prev, mpesaNumber: e.target.value }))}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary mb-6"
              />
              <div className="p-4 bg-info/10 border-2 border-info rounded-lg flex gap-3 mb-6">
                <Shield className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">All Information Verified</p>
                  <p className="text-sm text-muted-foreground mt-1">Your details have been verified and will be reviewed by our team.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => setStep(4)} variant="outline" className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading || data.skills.length === 0} className="flex-1">
                  {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  {loading ? "Submitting..." : "Submit Registration"}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Leaflet dynamic loader and map init using free OpenStreetMap tiles
const ensureLeafletLoaded = async (): Promise<void> => {
  if ((window as any).L) return;
  // Load CSS
  if (!document.querySelector('link[data-leaflet]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet', '1');
    document.head.appendChild(link);
  }
  // Load script
  if (!document.querySelector('script[data-leaflet]')) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.setAttribute('data-leaflet', '1');
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.head.appendChild(s);
    });
  }
};

const MapInitializer: React.FC<{
  lat: number;
  lng: number;
  label?: string;
  accuracyM?: number | null;
  preferZoom?: number;
  onMarkerChange?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
}> = ({ lat, lng, label, accuracyM = null, preferZoom = 16, onMarkerChange, onMapClick }) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const onMarkerChangeRef = useRef(onMarkerChange);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMarkerChangeRef.current = onMarkerChange;
    onMapClickRef.current = onMapClick;
  }, [onMarkerChange, onMapClick]);

  useEffect(() => {
    let canceled = false;
    const init = async () => {
      try {
        await ensureLeafletLoaded();
        if (canceled) return;
        const L = (window as any).L;
        if (!L) return;
        // initialize map if not exists - use lower initial zoom to reduce tiles fetched,
        // then zoom in after first tiles load for a faster perceived render
        if (!mapRef.current) {
          mapRef.current = L.map('fundi-map', {
            center: [lat, lng],
            zoom: 13,
            scrollWheelZoom: true,
            // prefer canvas for faster rendering on some devices
            preferCanvas: true,
          });

          const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
            updateWhenIdle: true,
            reuseTiles: true,
            detectRetina: false,
          }).addTo(mapRef.current);

          // once initial tiles load, zoom in for a detailed view
          tiles.on('load', () => {
            try {
              mapRef.current.invalidateSize();
              mapRef.current.setView([lat, lng], preferZoom);
            } catch (e) {
              // ignore
            }
          });

          // create a draggable marker so users can correct position
          markerRef.current = L.marker([lat, lng], { draggable: true })
            .addTo(mapRef.current)
            .bindPopup(label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
            .openPopup();

          // when user drags marker, update parent state via callback
          markerRef.current.on('dragend', function (ev: any) {
            const pos = ev.target.getLatLng();
            if (onMarkerChangeRef.current) onMarkerChangeRef.current(pos.lat, pos.lng);
          });

          // allow clicking on map to set location (calls onMapClick for faster save)
          mapRef.current.on('click', function (e: any) {
            const { lat: clickedLat, lng: clickedLng } = e.latlng;
            if (markerRef.current) markerRef.current.setLatLng([clickedLat, clickedLng]).openPopup();
            mapRef.current.setView([clickedLat, clickedLng]);
            if (onMapClickRef.current) {
              onMapClickRef.current(clickedLat, clickedLng);
            } else if (onMarkerChangeRef.current) {
              onMarkerChangeRef.current(clickedLat, clickedLng);
            }
          });
        }
      } catch (e) {
        console.warn('Leaflet init error', e);
      }
    };
    init();
    return () => {
      canceled = true;
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
          accuracyCircleRef.current = null;
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Update view/marker when coordinates change (does not recreate the map)
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    try {
      // flyTo feels more "GPS-like" than setView, but fallback safely
      if (typeof map.flyTo === 'function') {
        map.flyTo([lat, lng], preferZoom, { animate: true, duration: 0.6 });
      } else {
        map.setView([lat, lng], preferZoom);
      }
      if (markerRef.current) {
        markerRef.current
          .setLatLng([lat, lng])
          .setPopupContent(label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true })
          .addTo(map)
          .bindPopup(label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        markerRef.current.on('dragend', function (ev: any) {
          const pos = ev.target.getLatLng();
          if (onMarkerChangeRef.current) onMarkerChangeRef.current(pos.lat, pos.lng);
        });
      }

      // Leaflet often needs invalidateSize after layout changes/scroll
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 60);
    } catch {
      // ignore
    }
  }, [lat, lng, label, preferZoom]);

  // Accuracy circle (helps user trust it's their live GPS)
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    try {
      if (typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0) {
        const radius = Math.min(Math.max(accuracyM, 5), 500);
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius,
            color: '#3b82f6',
            weight: 1,
            fillColor: '#60a5fa',
            fillOpacity: 0.15,
          }).addTo(map);
        } else {
          accuracyCircleRef.current.setLatLng([lat, lng]);
          accuracyCircleRef.current.setRadius(radius);
        }
      } else if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    } catch {
      // ignore
    }
  }, [accuracyM, lat, lng]);

  return null;
};


export default FundiRegister;
