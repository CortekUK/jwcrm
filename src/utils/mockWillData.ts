import type { 
  Executor, 
  Trustee, 
  Guardian, 
  InterimGuardian, 
  PermanentGuardian,
  ReceiptPerson,
  DisinheritPerson,
  Beneficiary,
  FamilyExclusion,
  LetterOfWishes
} from "@/types/will-form";
import { dataURLtoFile } from "@/utils/imageProcessing";

export const getMockPersonalData = () => ({
  full_name: "Ahmed Mohammed Al-Rashid",
  contact_number: "+971501234567",
  address: "Villa 123, Palm Jumeirah\nDubai, United Arab Emirates",
  email: "ahmed.rashid@example.com",
  date: new Date().toISOString(),
  assets_country: ["United Arab Emirates", "United Kingdom"],
  preferred_contact_methods: ["WhatsApp", "Email"],
  marital_status: "married" as const,
  religion: "Islam"
});

export const getMockBeneficiaries = (): Beneficiary[] => [
  {
    level: 1,
    name: "Fatima Al-Rashid",
    relationship: "Spouse",
    percentage: 50,
    comments: "My wife, primary beneficiary for estate distribution",
    identity_docs: []
  },
  {
    level: 1,
    name: "Khalid Ahmed Al-Rashid",
    relationship: "Child",
    percentage: 25,
    comments: "My eldest son, equal share with sister",
    identity_docs: []
  },
  {
    level: 1,
    name: "Layla Ahmed Al-Rashid",
    relationship: "Child",
    percentage: 25,
    comments: "My daughter, equal share with brother",
    identity_docs: []
  },
  {
    level: 2,
    name: "Mohammed Hassan Al-Rashid",
    relationship: "Parent",
    percentage: 50,
    comments: "My father, contingent beneficiary if primary beneficiaries are unavailable",
    identity_docs: []
  },
  {
    level: 2,
    name: "Aisha Hassan Al-Rashid",
    relationship: "Parent",
    percentage: 50,
    comments: "My mother, contingent beneficiary if primary beneficiaries are unavailable",
    identity_docs: []
  },
  {
    level: 3,
    name: "Omar Al-Rashid",
    relationship: "Sibling",
    percentage: 100,
    comments: "My brother, third level contingent beneficiary",
    identity_docs: []
  }
];

export const getMockExecutors = (): Executor[] => [
  {
    level: 1,
    name: "Fatima Al-Rashid",
    relation: "Spouse",
    email: "fatima.rashid@example.com",
    contact_number: "+971501234568"
  },
  {
    level: 2,
    name: "Omar Al-Rashid",
    relation: "Brother",
    email: "omar.rashid@example.com",
    contact_number: "+971501234569"
  },
  {
    level: 3,
    name: "Zainab Al-Mansoor",
    relation: "Sister",
    email: "zainab.mansoor@example.com",
    contact_number: "+971501234570"
  }
];

export const getMockTrustees = (): Trustee[] => [
  {
    level: 1,
    name: "Mohammed Hassan Al-Rashid",
    relation: "Father",
    email: "mohammed.rashid.sr@example.com",
    contact_number: "+971501234571"
  },
  {
    level: 2,
    name: "Youssef Al-Zahrani",
    relation: "Close Friend",
    email: "youssef.zahrani@example.com",
    contact_number: "+971501234572"
  }
];

export const getMockInterimGuardians = (): InterimGuardian[] => [
  {
    level: 1,
    name: "Omar Al-Rashid",
    relation: "Brother",
    email: "omar.rashid@example.com",
    contact_number: "+971501234569"
  },
  {
    level: 2,
    name: "Zainab Al-Mansoor",
    relation: "Sister",
    email: "zainab.mansoor@example.com",
    contact_number: "+971501234570"
  }
];

export const getMockPermanentGuardians = (): PermanentGuardian[] => [
  {
    level: 1,
    name: "Mohammed Hassan Al-Rashid",
    relation: "Father (Grandfather to children)",
    email: "mohammed.rashid.sr@example.com",
    contact_number: "+971501234571"
  },
  {
    level: 2,
    name: "Aisha Hassan Al-Rashid",
    relation: "Mother (Grandmother to children)",
    email: "aisha.rashid@example.com",
    contact_number: "+971501234573"
  }
];

export const getMockGuardians = (): Guardian[] => [
  {
    level: 1,
    name: "Omar Al-Rashid",
    relation: "Brother (Uncle to children)",
    email: "omar.rashid@example.com",
    contact_number: "+971501234569"
  },
  {
    level: 2,
    name: "Zainab Al-Mansoor",
    relation: "Sister (Aunt to children)",
    email: "zainab.mansoor@example.com",
    contact_number: "+971501234570"
  }
];

export const getMockReceiptPersons = (): ReceiptPerson[] => [
  {
    name: "Omar Al-Rashid",
    relation: "Brother",
    passport_number: "N12345678",
    contact_number: "+971501234569"
  },
  {
    name: "Youssef Al-Zahrani",
    relation: "Close Friend",
    passport_number: "N87654321",
    contact_number: "+971501234572"
  }
];

export const getMockDisinheritPersons = (): DisinheritPerson[] => [
  {
    name: "Ibrahim Al-Rashid",
    relation: "Distant Cousin",
    passport_number: "N11223344",
    contact_number: "+971501234580"
  }
];

export const getMockFamilyExclusion = (): FamilyExclusion => ({
  is_excluding: true,
  details: "I am excluding my cousin Ibrahim Al-Rashid from inheriting any part of my estate due to estrangement and lack of contact for over 15 years."
});

export const getMockLetterOfWishes = (): LetterOfWishes => ({
  acknowledged: true,
  notes: "I wish for my children's education to be prioritized. Any remaining funds should support their university education and professional development."
});

export const getMockConfirmations = () => ({
  reviewed: true,
  accuracy_confirmed: true
});

export const getMockAssets = () => [
  {
    category: "property" as const,
    description: "Primary Residence - Villa on Palm Jumeirah",
    location: "Dubai, UAE",
    estimated_value: 5500000
  },
  {
    category: "property" as const,
    description: "Investment Property - Apartment in London",
    location: "Kensington, London, UK",
    estimated_value: 1200000
  },
  {
    category: "bank" as const,
    description: "Emirates NBD - Savings Account",
    location: "Dubai, UAE",
    estimated_value: 350000
  },
  {
    category: "investments" as const,
    description: "Stock Portfolio - Dubai Financial Market",
    location: "Dubai, UAE",
    estimated_value: 750000
  },
  {
    category: "business" as const,
    description: "50% ownership in Al-Rashid Trading LLC",
    location: "Dubai, UAE",
    estimated_value: 2000000
  }
];

export const getMockSpecialRequests = () => ({
  funeral_wishes: "I wish to be buried according to Islamic traditions in the family cemetery in Dubai. I request a simple, modest funeral ceremony.",
  guardianship: "Please ensure my children continue their education in Dubai and maintain their connection to both Emirati and British culture.",
  digital_assets: "My social media accounts should be memorialized. Business digital assets and passwords are documented in a secure file with my executor.",
  other: "I request that my personal library be donated to Dubai Public Library, and my art collection be divided equally among my children."
});

// Create a tiny 1x1 pixel PNG as a data URL (red pixel for visibility)
const createMockImageDataURL = () => {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
};

export const getMockIdentityFiles = () => {
  const imageDataURL = createMockImageDataURL();

  return {
    passport: dataURLtoFile(imageDataURL, 'mock-passport.png'),
    proofOfAddress: dataURLtoFile(imageDataURL, 'mock-proof-of-address.png')
  };
};

export const getMockIdentityData = () => ({
  passport_number: "N98765432", // Mock UAE passport number
});
