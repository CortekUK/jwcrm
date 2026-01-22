export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export type WillType = 'general' | 'specific';

export type AssetCategory = 'property' | 'bank' | 'investments' | 'business' | 'vehicle' | 'crypto' | 'personal';

export type BeneficiaryType = 'residue' | 'specific';

export interface FileMetadata {
  type: 'passport';
  category?: 'beneficiary';
  beneficiary_index?: number;
  path: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
}

export interface BeneficiaryIdentityDoc {
  type: 'passport' | 'id' | 'other';
  path: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
}

export interface AssetDocument {
  type: 'deed' | 'logbook' | 'statement' | 'certificate' | 'other';
  path: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
}

export interface UserIdentityDocument {
  id: string;
  user_id: string;
  document_type: 'passport' | 'visa' | 'emirates_id';
  document_path: string;
  document_name: string;
  document_size: number;
  document_mime: string;
  passport_number?: string;
  emirates_id_number?: string;
  uploaded_at: string;
  uploaded_by_admin_id?: string;
  updated_at: string;
}

export interface Trustee {
  level: number; // 1, 2, or 3
  name: string;
  relation: string;
  email: string;
  contact_number: string;
  passport_number: string;
  passport_path: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface Executor {
  level: number; // 1, 2, or 3
  name: string;
  relation: string;
  email: string;
  contact_number: string;
  passport_number?: string;
  passport_path?: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface Guardian {
  level: number; // 1, 2, 3, or 4
  name: string;
  relation: string;
  email: string;
  contact_number: string;
  passport_number: string;
  passport_path: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface InterimGuardian {
  level: number; // 1, 2, or 3
  name: string;
  relation: string;
  email: string;
  contact_number: string;
  passport_number: string;
  passport_path: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface PermanentGuardian {
  level: number; // 1, 2, or 3
  name: string;
  relation: string;
  email: string;
  contact_number: string;
  passport_number: string;
  passport_path: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface ReceiptPerson {
  level: number;
  name: string;
  relation: string;
  passport_number?: string;
  passport_path?: string;
  contact_number: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface DisinheritPerson {
  level: number;
  name: string;
  relation: string;
  passport_number?: string;
  passport_path?: string;
  contact_number: string;
  emirates_id_path?: string;
  emirates_id_number?: string;
}

export interface FamilyExclusion {
  is_excluding: boolean;
  details?: string;
  signature?: string; // Base64 signature data
  signature_date?: string; // ISO timestamp
}

export interface LetterOfWishes {
  acknowledged: boolean;
  notes?: string;
}

export interface Beneficiary {
  level: number; // 1-5 (Level 1 = Primary, 2-5 = Contingent)
  name: string; // Name(s) - can be multiple people
  relationship: string; // Relation
  contact_number: string; // Contact number (required)
  email: string; // Email (required)
  percentage: number; // Required for Level 1 (must total 100%), optional for others
  comments?: string; // Comments / Notes (optional)
  identity_docs?: BeneficiaryIdentityDoc[]; // optional identity documents
  passport_path?: string; // passport storage path
  passport_number?: string; // extracted passport number
  emirates_id_path?: string; // Emirates ID image path (optional)
  emirates_id_number?: string; // extracted Emirates ID number (optional)
}

export interface GeneralBeneficiary {
  id: string; // UUID for tracking
  name: string; // Beneficiary name
  relationship: string; // Relationship to testator
  asset_description: string; // Description of asset/property they will receive
  passport_path?: string; // Passport storage path (required for submission, optional during editing)
  passport_number?: string; // Extracted passport number (required for submission, optional during editing)
}

export interface Asset {
  id?: string; // For tracking
  title: string; // Asset name/title (e.g. "BMW 3 Series")
  category: AssetCategory;
  description: string;
  location?: string;
  beneficiary_name?: string; // Link to beneficiary
  documents?: AssetDocument[]; // File uploads
  photo_path?: string; // Photo upload
  estimated_value?: number; // Estimated value
}

export interface Answers {
  will_type?: WillType; // NEW: defaults to 'general'
  personal: {
    full_name: string;
    contact_number: string;
    address: string;
    email: string;
    date: string;
    assets_country: string[];
    preferred_contact_methods: string[];
    marital_status: MaritalStatus;
    religion: string;
    // Deprecated fields for backward compatibility
    dob?: string;
    nationality?: string;
    phone?: string;
  };
  identity: {
    passport_file?: File | null;
    passport_path?: string;
    passport_metadata?: FileMetadata;
    passport_number?: string;
  };
  executors: Executor[];
  executor_permission_to_contact?: boolean;
  trustees: Trustee[];
  trustee_permission_to_contact?: boolean;
  skip_trustees?: boolean;
  guardians: Guardian[];
  guardian_permission_to_contact?: boolean;
  interim_guardians: InterimGuardian[];
  interim_guardian_permission_to_contact?: boolean;
  skip_interim_guardians?: boolean;
  permanent_guardians: PermanentGuardian[];
  permanent_guardian_permission_to_contact?: boolean;
  skip_permanent_guardians?: boolean;
  receipt_of_will: ReceiptPerson[];
  no_receipt_persons?: boolean;
  disinherit: DisinheritPerson[];
  no_disinherit_persons?: boolean;
  family_exclusion: FamilyExclusion;
  letter_of_wishes: LetterOfWishes;
  beneficiaries: Beneficiary[];
  main_beneficiary_ids?: string[]; // For general will - selected beneficiary IDs
  general_beneficiaries?: GeneralBeneficiary[]; // For general will - additional beneficiaries receiving specific assets
  assets: Asset[]; // Enhanced with new fields
  special_requests: {
    funeral_wishes?: string;
    guardianship?: string;
    digital_assets?: string;
    other?: string;
  };
  confirmations: {
    reviewed: boolean;
    accuracy_confirmed: boolean;
  };
  pdf_language?: 'english' | 'arabic';
}

export const INITIAL_ANSWERS: Answers = {
  will_type: 'general', // Default to general will
  personal: {
    full_name: '',
    contact_number: '',
    address: '',
    email: '',
    date: new Date().toISOString(),
    assets_country: [],
    preferred_contact_methods: [],
    marital_status: 'single',
    religion: '',
  },
  identity: {
    passport_file: null,
  },
  executors: [],
  executor_permission_to_contact: true,
  trustees: [],
  trustee_permission_to_contact: true,
  skip_trustees: false,
  guardians: [],
  guardian_permission_to_contact: true,
  interim_guardians: [],
  interim_guardian_permission_to_contact: true,
  permanent_guardians: [],
  permanent_guardian_permission_to_contact: true,
  skip_permanent_guardians: false,
  receipt_of_will: [],
  no_receipt_persons: false,
  disinherit: [],
  no_disinherit_persons: false,
  family_exclusion: {
    is_excluding: false,
    details: '',
  },
  letter_of_wishes: {
    acknowledged: false,
    notes: 'Informational only',
  },
  beneficiaries: [],
  main_beneficiary_ids: [],
  general_beneficiaries: [],
  assets: [],
  special_requests: {
    funeral_wishes: '',
    guardianship: '',
    digital_assets: '',
    other: '',
  },
  confirmations: {
    reviewed: false,
    accuracy_confirmed: false,
  },
  pdf_language: 'english',
};
