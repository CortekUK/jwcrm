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

  // Default point of contact shown on client-facing emails when no account
  // manager is assigned to the lead.
  defaultContactName: "Katelyn",

  // "What to Expect" process timeline shown at the end of the proposal email.
  processTimeline: [
    {
      title: "Drafting",
      detail:
        "Begins once we receive your form(s) and supporting documents. We will work with you until you're completely satisfied with the draft.",
    },
    {
      title: "Arabic Translation",
      detail:
        "Once the English draft is approved, we prepare the Arabic version. (Takes 3–5 working days)",
    },
    {
      title: "Legalization",
      detail:
        "We submit the documents for legalization. (This takes approximately 7 working days)",
    },
    {
      title: "Signatures",
      detail: "You will be invited to sign your finalized Will(s).",
    },
    {
      title: "Court Approval",
      detail:
        "Once signed, we submit your documents to court for approval. (Typically 7 working days)",
    },
    {
      title: "Notary Appointment",
      detail:
        "A final appointment with the judge will be scheduled based on the judge's availability. Please note this can be quite far in advance as the courts are extremely busy.",
    },
  ],
};
