// Trade brand details (used on proposals / marketing communications)
export const companyDetails = {
  name: "Just Wills",
  address: "Dubai, United Arab Emirates",
  email: "support@justwills.ae",
  phone: "+971 XX XXX XXXX",
  website: "justwills.ae",

  // Legal entity details — used on TAX INVOICES (JW Legal Consultants LLC)
  legalName: "JW LEGAL CONSULTANTS LLC",
  invoiceAddressLines: [
    "OFFICE UNT-384185, CONVEX BUSINESS CENTER SERVICES,",
    "PO BOX 75671, ABU DHABI,",
    "UNITED ARAB EMIRATES",
  ],
  invoiceCity: "Abu Dhabi, United Arab Emirates",
  invoicePhone: "800 WILLS (94557)",
  invoiceEmail: "INFO@JUST-WILLS.NET",
  trn: "100547844900003", // Tax Registration Number
  vatRate: 5, // 5% VAT

  // Bank / payment details shown on the invoice
  bank: {
    name: "Emirates Islamic Bank",
    payee: "JW LEGAL CONSULTANTS LLC",
    account: "3708477481501",
    swift: "MEBLAEAD",
    iban: "AE730340003708477481501",
  },

  // Standard notarization fee note printed on the invoice
  notarizationNote: [
    "AUH - Will – AED 1500 Per person/document.",
    "POA – DXB – AED 1000 Per person/document.",
  ],
};
