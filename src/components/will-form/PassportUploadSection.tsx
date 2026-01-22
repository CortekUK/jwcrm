import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Camera, AlertCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { CameraModal } from "./CameraModal";
import { processImageFile, dataURLtoFile } from "@/utils/imageProcessing";
import { toast } from "@/hooks/use-toast";
import {
  isCameraSupported,
  getAvailableCameras,
  getDeviceType,
  type CameraCapabilities,
} from "@/utils/deviceDetection";
import { supabase } from "@/integrations/supabase/client";
import { createWorker } from "tesseract.js";

interface PassportUploadSectionProps {
  passportPath?: string;
  passportNumber?: string;
  onPassportPathChange: (path: string | undefined) => void;
  onPassportNumberChange: (number: string) => void;
  onPassportDataChange?: (data: { path?: string; number?: string }) => void;
  onFileMetadataUpdate?: (metadata: any) => void;
  willId?: string;
  uploadPath: string; // e.g., "beneficiary-0" or "identity"
  stepName?: string; // e.g., "Step 5: Executors"
  personName?: string; // e.g., "John Doe" (for display in uploads tab)
  personRole?: string; // e.g., "executor-1", "beneficiary-2"
  label?: string;
  error?: string; // Validation error message for passport number
  passportError?: string; // Validation error message for passport file
  disabled?: boolean; // Disable passport upload
  disabledMessage?: string; // Message to show when disabled
}

export function PassportUploadSection({
  passportPath,
  passportNumber,
  onPassportPathChange,
  onPassportNumberChange,
  onPassportDataChange,
  onFileMetadataUpdate,
  willId,
  uploadPath,
  stepName,
  personName,
  personRole,
  label = "Passport",
  error,
  passportError,
  disabled = false,
  disabledMessage,
}: PassportUploadSectionProps) {
  const { t } = useTranslation(["form"]);
  const { user } = useAuth();
  const { uploading, progress, uploadFile, deleteFile, getSignedUrl } = useFileUpload();

  const [passportUploading, setPassportUploading] = useState(false);
  const [passportPreviewUrl, setPassportPreviewUrl] = useState<string | null>(null);
  
  // Track temporary object URLs to revoke them later
  const tempObjectUrlRef = useRef<string | null>(null);
  
  // Always keep the latest data to avoid stale overwrites from async handlers
  const latestDataRef = useRef({ passportPath, passportNumber });
  
  useEffect(() => {
    latestDataRef.current = { passportPath, passportNumber };
  }, [passportPath, passportNumber]);

  // Camera capture state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilities | null>(null);

  // Refs for native camera inputs
  const passportNativeCameraRef = useRef<HTMLInputElement>(null);

  // OCR worker (reuse across extractions to avoid init lag)
  const ocrWorkerRef = useRef<any>(null);

  // Detect camera capabilities on mount
  useEffect(() => {
    
    const detectCamera = async () => {
      if (isCameraSupported()) {
        const capabilities = await getAvailableCameras();
        setCameraCapabilities(capabilities);
      } else {
        setCameraCapabilities({
          hasCamera: false,
          hasFrontCamera: false,
          hasBackCamera: false,
          cameraCount: 0,
          defaultFacingMode: "environment",
        });
      }
    };
    detectCamera();
    
    return () => {
    };
  }, [uploadPath]);

  // Generate signed URL for preview when path changes
  useEffect(() => {
    if (passportPath) {
      getSignedUrl(passportPath).then((url) => {
        if (url) setPassportPreviewUrl(url);
      });
    } else {
      setPassportPreviewUrl(null);
    }
  }, [passportPath, getSignedUrl, uploadPath]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (tempObjectUrlRef.current) {
        URL.revokeObjectURL(tempObjectUrlRef.current);
      }
    };
  }, []);

  const handleFileUpload = async (file: File, type: "passport") => {
    if (!user?.id || !willId) return;

    try {
      setPassportUploading(true);

      // Set immediate preview for instant feedback
      if (file.type.startsWith("image/")) {
        const tempUrl = URL.createObjectURL(file);
        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
        }
        tempObjectUrlRef.current = tempUrl;
        setPassportPreviewUrl(tempUrl);
      }

      // Process image if it's an image file
      let processedFile = file;
      if (file.type.startsWith("image/")) {
        try {
          const { file: optimized } = await processImageFile(file);
          processedFile = optimized;

          toast({
            title: t("form:imageProcessed"),
            description: t("form:imageOptimizedDescription"),
          });
        } catch (error: any) {
          toast({
            title: t("form:processingError"),
            description: error.message || t("form:processingErrorDescription"),
            variant: "destructive",
          });
          setPassportUploading(false);
          return;
        }
      }

      const metadata = await uploadFile(processedFile, type, user.id, willId);

      if (metadata) {
        // Get signed URL for preview
        const signedUrl = await getSignedUrl(metadata.path);

        // Update local state
        setPassportPreviewUrl(signedUrl);
        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
          tempObjectUrlRef.current = null;
        }

        onPassportPathChange(metadata.path);

        // Update upload_files array with step metadata
        if (onFileMetadataUpdate) {
          onFileMetadataUpdate({
            type: personRole ? `${personRole}-passport` : 'passport',
            path: metadata.path,
            name: file.name,
            size: file.size,
            mime: file.type,
            uploaded_at: new Date().toISOString(),
            stepName: stepName || 'Step 2: Identity Upload',
            personName: personName || '',
          });
        }

        // Extract passport number from uploaded image (run in background)
        if (file.type.startsWith("image/")) {
          extractPassportNumber(processedFile);
        }
      }
    } finally {
      setPassportUploading(false);
    }
  };

  const extractPassportNumber = async (file: File) => {
    try {
      toast({
        title: t("form:extractingPassportNumber"),
        description: t("form:extractingPassportDescription"),
      });

      // Use warm worker if available
      let worker: any = ocrWorkerRef.current;
      if (!worker) {
        worker = await createWorker("eng");
        ocrWorkerRef.current = worker;
      }

      // Perform OCR on the file
      const {
        data: { text },
      } = await worker.recognize(file);


      // Extract passport number from text
      const extractedNumber = extractPassportNumberFromText(text);

      if (extractedNumber) {
        // CRITICAL: Use batch update if available to update both fields at once
        if (onPassportDataChange && latestDataRef.current.passportPath) {
          onPassportDataChange({
            path: latestDataRef.current.passportPath,
            number: extractedNumber,
          });
        } else {
          // Fallback to individual updates
          onPassportNumberChange(extractedNumber);
        }

        // Ensure preview URL is preserved - don't let it get cleared
        if (latestDataRef.current.passportPath && !passportPreviewUrl) {
          const url = await getSignedUrl(latestDataRef.current.passportPath);
          setPassportPreviewUrl(url);
        }

        toast({
          title: t("form:passportNumberExtracted"),
          description: t("form:passportNumberDetected", {
            number: extractedNumber,
          }),
          className:
            "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
        });
      } else {
        toast({
          title: t("form:couldNotExtract"),
          description: t("form:enterPassportManually"),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("OCR error:", error);
      toast({
        title: t("form:ocrFailed"),
        description: t("form:enterPassportManuallyFallback"),
        variant: "destructive",
      });
    }
  };

  // Helper function to validate passport format - Universal for all countries
  const isValidPassportFormat = (candidate: string): boolean => {
    // Must contain at least one alphanumeric character
    if (!/[A-Z0-9]/.test(candidate)) return false;

    // Length check: worldwide passports are typically 6-15 characters
    if (candidate.length < 6 || candidate.length > 15) return false;

    // Exclude obvious non-passport patterns
    if (/^(.)\1+$/.test(candidate)) return false; // Repeated: 11111111
    if (/^\d{4}$/.test(candidate)) return false; // 4-digit year
    if (/^(19|20)\d{2}$/.test(candidate)) return false; // Years: 1990, 2024
    if (/^\d{1,2}[A-Z]{3}\d{2,4}$/i.test(candidate)) return false; // Dates: 22JAN1974

    // Exclude sequential numbers (123456, 234567, etc.)
    const isSequential = (str: string): boolean => {
      if (!/^\d+$/.test(str)) return false;
      for (let i = 0; i < str.length - 1; i++) {
        const current = parseInt(str[i]);
        const next = parseInt(str[i + 1]);
        if (next !== current + 1 && next !== current - 1) return false;
      }
      return true;
    };
    if (isSequential(candidate)) return false;

    // Exclude common test patterns (111111, 123456, AAAAAA, etc.)
    if (/^(123456|654321|111111|222222|333333|444444|555555|666666|777777|888888|999999|000000)$/.test(candidate)) return false;
    if (/^[A]{6,}$/.test(candidate)) return false; // All A's

    // Exclude common English words that look like passport numbers
    const commonWords = /^(STATES|UNITED|AMERICA|PASSPORT|SURNAME|NUMBER|ADDRESS|DOCUMENT|NATIONALITY|SIGNATURE|HOLDER|GIVEN|NAMES|DATE|BIRTH|PLACE|ISSUE|EXPIRY|AUTHORITY|VALID|UNTIL|SEX|MALE|FEMALE|TYPE|CODE|COUNTRY|REGION|HEIGHT|EYES|HAIR)$/i;
    if (commonWords.test(candidate)) return false;

    // MUST have at least one digit - passports always have numbers
    if (!/\d/.test(candidate)) return false;

    // UK passport format is VERY strict: 9 characters, format: [0-9]{9} OR [A-Z]{2}[0-9]{7}
    // Most UK passports are 9 digits or 2 letters + 7 digits
    const isUKFormat = /^([A-Z]{2}[0-9]{7}|[0-9]{9})$/.test(candidate);
    if (candidate.length === 9 && !isUKFormat) {
      // If it's 9 characters but doesn't match UK format, check if it has letters
      // UK passports with letters MUST be 2 letters + 7 digits (e.g., AB1234567)
      if (/[A-Z]/.test(candidate) && !/^[A-Z]{2}[0-9]{7}$/.test(candidate)) {
        return false; // Not a valid UK format
      }
    }

    // Universal passport patterns (covers 99% of worldwide formats)
    const validPatterns = [
      /^[0-9]{6,15}$/,                    // Numeric only (China, India, Pakistan, etc.)
      /^[A-Z]{1,4}[0-9]{5,12}$/,          // Letter(s) + numbers (UK, USA, Canada, etc.)
      /^[0-9]{1,4}[A-Z]{1,4}[0-9]{3,12}$/, // Numbers + letters + numbers (France, Benin, etc.)
      /^[A-Z0-9]{6,15}$/,                 // Mixed alphanumeric (fallback for any format)
    ];

    return validPatterns.some(pattern => pattern.test(candidate));
  };

  const extractPassportNumberFromText = (text: string): string | null => {

    // Preprocess text - handle common OCR errors
    let cleanedText = text
      .replace(/[|!]/g, 'I') // Pipe and exclamation often misread as I
      .replace(/[Oo0]/g, (match) => {
        // Context-aware O/0 correction
        const isInNumber = /\d/.test(match);
        return isInNumber ? '0' : 'O';
      })
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // First, try to find passport number with explicit labels (most reliable)
    const labelPatterns = [
      // Standard formats: "PASSPORT NO: ABC123456", "PASSEPORT N°: 21TP00077"
      /(?:PASSPORT|PASSEPORT|PASAPORTE|PASZPORT|REISEPASS|جواز السفر|N°\s*PASSPORT|N°\s*PASSEPORT)[\s:°\.]*(?:NO\.?|N°|NUMBER|NUMERO|NUM|NR|NUMER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
      // Document number field
      /(?:DOCUMENT|DOC)[\s:°\.]*(?:NO\.?|N°|NUMBER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
      // Line starting with NO/NUM: "NO: ABC123"
      /(?:^|\n)[\s]*(?:NO\.?|N°|NUM\.?|NR\.?)[\s:°\.]+([A-Z0-9]{6,15})/gim,
      // Passport/Passeport followed by number on same or next line
      /(?:PASSPORT|PASSEPORT)[\s\n]+([A-Z0-9]{6,15})/gi,
      // French format: "N° " followed by number
      /N°[\s:°\.]*([A-Z0-9]{6,15})/gi,
    ];

    for (const pattern of labelPatterns) {
      const matches = cleanedText.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && /[A-Z0-9]/.test(match[1])) {
          const candidate = match[1].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          // Exclude dates, pure letter sequences, and repeated characters
          if (
            !/^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(candidate) &&
            !/^[A-Z]{6,}$/.test(candidate) &&
            !/^(.)\1+$/.test(candidate) &&
            !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/.test(candidate) &&
            candidate.length >= 6 &&
            candidate.length <= 15 &&
            (isValidPassportFormat(candidate))
          ) {
            return candidate;
          }
        }
      }
    }

    // Machine Readable Zone (MRZ) - bottom of passport
    // MRZ second line format: PassportNumber + Country + BirthDate + Sex + ExpiryDate + Nationality + OptionalData
    // Example: 31195654USA1234567M1234567890123456<123456

    // Try to find MRZ lines directly
    const lines = cleanedText.split(/[\n\r]+/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // MRZ second line typically starts with passport number (8-9 digits/chars)
      // followed by check digit, country code (3 letters), then birth date (6-7 digits)
      const mrzSecondLineMatch = line.match(/^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/);
      if (mrzSecondLineMatch && mrzSecondLineMatch[1]) {
        const candidate = mrzSecondLineMatch[1];
        return candidate;
      }
    }

    const mrzPatterns = [
      // Second line format: 31195654USA1234567M...
      /^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/m,  // Passport# + check + Country + Birth date
      // Standard MRZ second line with check digit
      /([A-Z0-9]{9})<+[0-9]{1}[A-Z]{3}[0-9]{7}</,
      // Passport number followed by chevrons
      /([A-Z0-9]{6,9})<<<+/,
      // P< format with country code
      /P<[A-Z]{3}([A-Z0-9<]{9,})/,
      // First line P<USA... then second line starts with passport number
      /P<[A-Z]{3}[^<\n]*<+\s*([A-Z0-9]{6,9})/i,
    ];

    for (const pattern of mrzPatterns) {
      const mrzMatch = cleanedText.match(pattern);
      if (mrzMatch && mrzMatch[1]) {
        const passportNum = mrzMatch[1].replace(/<+/g, "").trim();
        if (passportNum.length >= 6 && passportNum.length <= 12 && /[A-Z0-9]/.test(passportNum)) {
          return passportNum;
        }
      }
    }

    // Universal worldwide passport number patterns (ordered by specificity)
    const numberPatterns = [
      // === NUMERIC ONLY FORMATS (6-15 digits) ===
      /\b([0-9]{15})\b/,  // 15 digits
      /\b([0-9]{14})\b/,  // 14 digits
      /\b([0-9]{13})\b/,  // 13 digits
      /\b([0-9]{12})\b/,  // 12 digits
      /\b([0-9]{11})\b/,  // 11 digits
      /\b([0-9]{10})\b/,  // 10 digits
      /\b([0-9]{9})\b/,   // 9 digits - India, Philippines, Bangladesh
      /\b([0-9]{8})\b/,   // 8 digits - China, USA, Pakistan, Thailand
      /\b([0-9]{7})\b/,   // 7 digits - Some countries
      /\b([0-9]{6})\b/,   // 6 digits - Minimum length

      // === LETTERS + NUMBERS FORMATS ===
      // 1-4 letters + 5-12 numbers
      /\b([A-Z]{1}[0-9]{12})\b/,  // A123456789012
      /\b([A-Z]{1}[0-9]{11})\b/,  // A12345678901
      /\b([A-Z]{1}[0-9]{10})\b/,  // A1234567890
      /\b([A-Z]{1}[0-9]{9})\b/,   // A123456789
      /\b([A-Z]{1}[0-9]{8})\b/,   // A12345678 - USA, Australia
      /\b([A-Z]{1}[0-9]{7})\b/,   // A1234567 - USA, South Korea
      /\b([A-Z]{1}[0-9]{6})\b/,   // A123456
      /\b([A-Z]{1}[0-9]{5})\b/,   // A12345

      /\b([A-Z]{2}[0-9]{10})\b/,  // AB1234567890
      /\b([A-Z]{2}[0-9]{9})\b/,   // AB123456789
      /\b([A-Z]{2}[0-9]{8})\b/,   // AB12345678 - UK, Ireland
      /\b([A-Z]{2}[0-9]{7})\b/,   // AB1234567 - UK, Germany, Spain
      /\b([A-Z]{2}[0-9]{6})\b/,   // AB123456 - Many European countries
      /\b([A-Z]{2}[0-9]{5})\b/,   // AB12345

      /\b([A-Z]{3}[0-9]{9})\b/,   // ABC123456789
      /\b([A-Z]{3}[0-9]{8})\b/,   // ABC12345678
      /\b([A-Z]{3}[0-9]{7})\b/,   // ABC1234567
      /\b([A-Z]{3}[0-9]{6})\b/,   // ABC123456 - Some African countries
      /\b([A-Z]{3}[0-9]{5})\b/,   // ABC12345

      /\b([A-Z]{4}[0-9]{8})\b/,   // ABCD12345678
      /\b([A-Z]{4}[0-9]{7})\b/,   // ABCD1234567
      /\b([A-Z]{4}[0-9]{6})\b/,   // ABCD123456
      /\b([A-Z]{4}[0-9]{5})\b/,   // ABCD12345

      // === NUMBERS + LETTERS + NUMBERS FORMATS ===
      /\b([0-9]{1}[A-Z]{1}[0-9]{10})\b/, // 1A1234567890
      /\b([0-9]{1}[A-Z]{1}[0-9]{9})\b/,  // 1A123456789
      /\b([0-9]{1}[A-Z]{1}[0-9]{8})\b/,  // 1A12345678
      /\b([0-9]{1}[A-Z]{1}[0-9]{7})\b/,  // 1A1234567
      /\b([0-9]{1}[A-Z]{1}[0-9]{6})\b/,  // 1A123456
      /\b([0-9]{1}[A-Z]{1}[0-9]{5})\b/,  // 1A12345

      /\b([0-9]{2}[A-Z]{1}[0-9]{9})\b/,  // 12A123456789
      /\b([0-9]{2}[A-Z]{1}[0-9]{8})\b/,  // 12A12345678
      /\b([0-9]{2}[A-Z]{1}[0-9]{7})\b/,  // 12A1234567
      /\b([0-9]{2}[A-Z]{1}[0-9]{6})\b/,  // 12A123456
      /\b([0-9]{2}[A-Z]{1}[0-9]{5})\b/,  // 12A12345

      /\b([0-9]{2}[A-Z]{2}[0-9]{8})\b/,  // 12AB12345678
      /\b([0-9]{2}[A-Z]{2}[0-9]{7})\b/,  // 12AB1234567
      /\b([0-9]{2}[A-Z]{2}[0-9]{6})\b/,  // 12AB123456
      /\b([0-9]{2}[A-Z]{2}[0-9]{5})\b/,  // 21TP00077 - Benin, Togo, Niger
      /\b([0-9]{2}[A-Z]{2}[0-9]{4})\b/,  // 12AB1234

      /\b([0-9]{2}[A-Z]{3}[0-9]{7})\b/,  // 12ABC1234567
      /\b([0-9]{2}[A-Z]{3}[0-9]{6})\b/,  // 12ABC123456
      /\b([0-9]{2}[A-Z]{3}[0-9]{5})\b/,  // 12ABC12345

      /\b([0-9]{3}[A-Z]{2}[0-9]{7})\b/,  // 123AB1234567
      /\b([0-9]{3}[A-Z]{2}[0-9]{6})\b/,  // 123AB123456
      /\b([0-9]{3}[A-Z]{2}[0-9]{5})\b/,  // 123AB12345

      /\b([0-9]{4}[A-Z]{2}[0-9]{6})\b/,  // 1234AB123456
      /\b([0-9]{4}[A-Z]{2}[0-9]{5})\b/,  // 1234AB12345

      // === GENERIC ALPHANUMERIC (Fallback for unusual formats) ===
      /\b([A-Z0-9]{15})\b/,  // Any mix 15 chars
      /\b([A-Z0-9]{14})\b/,  // Any mix 14 chars
      /\b([A-Z0-9]{13})\b/,  // Any mix 13 chars
      /\b([A-Z0-9]{12})\b/,  // Any mix 12 chars
      /\b([A-Z0-9]{11})\b/,  // Any mix 11 chars
      /\b([A-Z0-9]{10})\b/,  // Any mix 10 chars
      /\b([A-Z0-9]{9})\b/,   // Any mix 9 chars
      /\b([A-Z0-9]{8})\b/,   // Any mix 8 chars
      /\b([A-Z0-9]{7})\b/,   // Any mix 7 chars
      /\b([A-Z0-9]{6})\b/,   // Any mix 6 chars (minimum)
    ];

    const candidates: string[] = [];
    for (const pattern of numberPatterns) {
      const matches = cleanedText.matchAll(new RegExp(pattern, "gi"));
      for (const match of matches) {
        if (match[1]) {
          const candidate = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');

          // Use the universal validation function
          if (isValidPassportFormat(candidate)) {
            candidates.push(candidate);
          }
        }
      }
    }

    if (candidates.length > 0) {
      
      // Use frequency analysis to find the most common candidate
      const frequency: Record<string, number> = {};
      candidates.forEach((c) => {
        frequency[c] = (frequency[c] || 0) + 1;
      });
      const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
      
      return sorted[0][0];
    }

    return null;
  };

  const handleRemove = async () => {
    if (!passportPath) return;

    const success = await deleteFile(passportPath);
    if (success) {
      // Clear all passport-related data
      onPassportPathChange(undefined);
      onPassportNumberChange("");

      // Notify parent component of data change
      if (onPassportDataChange) {
        onPassportDataChange({ path: undefined, number: "" });
      }

      // Clear preview and revoke object URLs
      setPassportPreviewUrl(null);
      if (tempObjectUrlRef.current) {
        URL.revokeObjectURL(tempObjectUrlRef.current);
        tempObjectUrlRef.current = null;
      }

      // Show success message
      toast({
        title: t("form:fileRemoved"),
        description: t("form:passportRemovedSuccess"),
      });
    }
  };

  const handleCameraCapture = async (imageDataUrl: string) => {
    try {
      const file = dataURLtoFile(imageDataUrl, `${uploadPath}-passport-${Date.now()}.jpg`);
      await handleFileUpload(file, "passport");
    } catch (error) {
      console.error("Error processing camera capture:", error);
      toast({
        title: t("form:captureError"),
        description: t("form:captureErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const deviceType = getDeviceType();
  const isMobile = deviceType === "mobile" || deviceType === "tablet";

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[15px] font-semibold text-[#121212]">
          {label} <span className="text-black">*</span>
        </Label>
        <p className="text-[13px] text-[#6B6B6B] mt-1">
          {t("form:acceptedFormats")}
        </p>
      </div>

      {!passportPath ? (
        <div className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
          (error || passportError)
            ? "border-destructive bg-destructive/5"
            : "border-[#C6A03B] bg-white hover:border-[#0C5536] hover:shadow-[0_1px_6px_rgba(12,85,54,0.1)]"
        )}>
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-10 h-10 text-[#C6A03B]" />

            <input
              ref={passportNativeCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, "passport");
              }}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept="image/*,.pdf";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, "passport");
                };
                input.click();
              }}
              disabled={passportUploading}
              className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
            >
              {t("form:chooseFile")}
            </Button>

            {passportUploading && (
              <div className="w-full max-w-xs">
                <div className="text-sm text-center mb-2 text-[#6B6B6B]">
                  {t("form:uploading")}...
                </div>
              </div>
            )}

            <p className="text-[13px] text-[#6B6B6B] text-center mt-2">
              {t("form:fileFormatsHelperShort")}
            </p>

            <a
              href="mailto:info@just-wills.net?subject=Help with Passport Upload"
              className="text-[13px] text-[#0C5536] hover:underline"
            >
              {t("form:uploadTroubleHelpText")}
            </a>
          </div>
        </div>
      ) : (
        <div className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
          "border-[#0C5536] bg-[#F8F8F6]"
        )}>
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              {passportPreviewUrl && (
                <img
                  src={passportPreviewUrl}
                  alt="Passport preview"
                  className="w-24 h-24 object-cover rounded border"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm truncate">
                      {passportPath ? passportPath.split('/').pop() : t("form:passportUploaded")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemove}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Replace Options */}
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*,.pdf";
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "passport");
                      };
                      input.click();
                    }}
                    className="flex-1 border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
                  >
                    {t("form:replaceFile")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(error || passportError) && !passportPath && (
        <div className="flex items-start gap-2 text-destructive text-sm mt-2 p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error || passportError}</span>
        </div>
      )}

      {/* Passport Number Input */}
      {(passportPath || passportNumber) && (
        <div className="space-y-2">
          <Label className="text-[15px] font-semibold text-[#121212]">
            {t("form:passportNumberLabel")}{" "}
            {passportNumber && (
              <span className="text-[#0C5536] text-xs ml-2">
                {t("form:autoDetected")}
              </span>
            )}
          </Label>
          <p className="text-[13px] text-[#6B6B6B] -mt-1">
            {passportNumber
              ? t("form:verifyExtractedPassport")
              : t("form:enterPassportManuallyLabel")}
          </p>
          <Input
            type="text"
            value={passportNumber || ""}
            onChange={(e) => onPassportNumberChange(e.target.value.toUpperCase())}
            placeholder={t("form:passportNumberPlaceholder")}
            className={cn(
              "w-full px-4 py-2 border-2 rounded-lg text-[14px] font-mono",
              (error && !passportNumber) ? "border-destructive" : "border-[#E6E6E4]"
            )}
            style={{ letterSpacing: "0.05em" }}
          />
          {error && !passportNumber && (
            <div className="flex items-start gap-2 text-destructive text-sm mt-1">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Camera Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        title={t("form:takePassportPhoto")}
      />
    </div>
  );
}

