import { z } from 'zod';
import type { TFunction } from 'i18next';

// Create validation schemas with translation support
export const createValidationSchemas = (t: TFunction) => {
  // Phone number validation helper
  const phoneNumberSchema = z.string().trim().min(1, t('form:contactNumberRequired')).refine(
    (val) => {
      const digitsOnly = val.replace(/\D/g, '');
      return digitsOnly.length >= 7 && digitsOnly.length <= 15;
    },
    { message: t('form:phoneNumberMustBeDigits') }
  );

  const personalSchema = z.object({
    full_name: z.string().trim().min(1, t('form:fullNameRequired')).max(100),
    contact_number: phoneNumberSchema,
    address: z.string().trim().min(1, t('form:addressRequired')).max(500),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    date: z.string().min(1, t('form:dateRequired')),
    assets_country: z.array(z.string()).min(0),
    preferred_contact_methods: z
      .array(z.string())
      .min(1, t('form:selectAtLeastOneContactMethod')),
    marital_status: z.enum(['single', 'married', 'divorced', 'widowed'], {
      required_error: t('form:maritalStatusRequired'),
    }),
    religion: z.string().trim().min(1, t('form:religionRequired')).max(100),
  });

  const identitySchema = z.object({
    passport_file: z.union([z.instanceof(File), z.null(), z.undefined()]).optional().nullable(),
    passport_path: z.string().optional(),
    passport_metadata: z.any().optional(),
    passport_number: z.string().trim().optional().or(z.literal('')),
  }).refine(
    (data) => {
      const hasFile = data.passport_file instanceof File;
      const hasPath = data.passport_path && data.passport_path.length > 0;
      return hasFile || hasPath;
    },
    { message: t('form:passportRequired'), path: ['passport_file'] }
  ).refine(
    (data) => {
      if (data.passport_path && data.passport_path.length > 0) {
        return data.passport_number && data.passport_number.length > 0;
      }
      return true;
    },
    {
      message: t('form:passportNumberRequired'),
      path: ['passport_number'],
    }
  );

  const trusteeSchema = z.object({
    level: z.number().min(1).max(3),
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    contact_number: phoneNumberSchema,
    passport_path: z.string().min(1, t('form:passportDocumentRequired')),
    passport_number: z.string().trim().min(1, t('form:passportNumberFieldRequired')).max(50),
  });

  const trusteesSchema = z
    .array(trusteeSchema)
    .max(3, t('form:maximumTrusteesAllowed'))
    .optional()
    .default([]);

  const trusteesStepSchema = z.object({
    skip_trustees: z.boolean().optional().default(false),
    trustees: z.array(trusteeSchema).max(3, t('form:maximumTrusteesAllowed')).optional().default([]),
    trustee_permission_to_contact: z.boolean().optional().default(false),
  }).refine(
    (data) => {
      if (data.skip_trustees) {
        return !data.trustees || data.trustees.length === 0;
      }
      if (!data.trustees || data.trustees.length === 0) {
        return false;
      }
      return data.trustees.every(t =>
        t.name && t.relation && t.email && t.contact_number
      );
    },
    {
      message: t('form:trusteeRequiredError'),
    }
  );

  const executorSchema = z.object({
    level: z.number().min(1).max(3),
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    contact_number: phoneNumberSchema,
    passport_path: z.string().optional(),
    passport_number: z.string().trim().optional().or(z.literal('')),
    passport_metadata: z.any().optional(),
  }).refine(
    (data) => {
      return data.passport_path && data.passport_path.length > 0;
    },
    {
      message: t('form:passportRequired'),
      path: ['passport_path'],
    }
  ).refine(
    (data) => {
      if (data.passport_path && data.passport_path.length > 0) {
        return data.passport_number && data.passport_number.length > 0;
      }
      return true;
    },
    {
      message: t('form:passportNumberRequired'),
      path: ['passport_number'],
    }
  );

  const executorsSchema = z
    .array(executorSchema)
    .min(1, t('form:atLeastOneExecutorRequired'))
    .max(3, t('form:maximumExecutorsAllowed'))
    .refine((executors) => executors.some((e) => e.level === 1), {
      message: t('form:atLeastOneLevel1ExecutorRequired'),
    });

  const guardianSchema = z.object({
    level: z.number().min(1).max(4),
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    contact_number: phoneNumberSchema,
    passport_path: z.string().min(1, t('form:passportDocumentRequired')),
    passport_number: z.string().trim().min(1, t('form:passportNumberFieldRequired')).max(50),
  });

  const guardiansSchema = z
    .array(guardianSchema)
    .max(4, t('form:maximumGuardiansAllowed'))
    .optional()
    .default([]);

  const interimGuardianSchema = z.object({
    level: z.number().min(1).max(3),
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    contact_number: phoneNumberSchema,
    passport_path: z.string().min(1, t('form:passportDocumentRequired')),
    passport_number: z.string().trim().min(1, t('form:passportNumberFieldRequired')).max(50),
  });

  const interimGuardiansStepSchema = z.object({
    skip_interim_guardians: z.boolean().optional().default(false),
    interim_guardians: z.array(interimGuardianSchema).max(3).optional().default([]),
    interim_guardian_permission_to_contact: z.boolean().optional().default(false),
  }).refine(
    (data) => {
      if (data.skip_interim_guardians) {
        return !data.interim_guardians || data.interim_guardians.length === 0;
      }
      if (!data.interim_guardians || data.interim_guardians.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: t('form:addAtLeastOneInterimGuardianOrCheckSkip'),
      path: ['interim_guardians'],
    }
  );

  const permanentGuardianSchema = z.object({
    level: z.number().min(1).max(3),
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    contact_number: phoneNumberSchema,
    passport_path: z.string().min(1, t('form:passportDocumentRequired')),
    passport_number: z.string().trim().min(1, t('form:passportNumberFieldRequired')).max(50),
  });

  const permanentGuardiansStepSchema = z.object({
    skip_permanent_guardians: z.boolean().optional().default(false),
    permanent_guardians: z.array(permanentGuardianSchema).max(3).optional().default([]),
    permanent_guardian_permission_to_contact: z.boolean().optional().default(false),
  }).refine(
    (data) => {
      if (data.skip_permanent_guardians) {
        return !data.permanent_guardians || data.permanent_guardians.length === 0;
      }
      if (!data.permanent_guardians || data.permanent_guardians.length === 0) {
        return false;
      }
      return data.permanent_guardians.every(g =>
        g.name && g.relation && g.email && g.contact_number
      );
    },
    {
      message: t('form:completeAllPermanentGuardianFields'),
    }
  );

  const beneficiarySchema = z.object({
    level: z.number().min(1).max(5),
    name: z.string().trim().min(1, t('form:nameRequired')).max(200),
    relationship: z.string().trim().min(1, t('form:relationRequired')).max(100),
    contact_number: phoneNumberSchema,
    email: z.string().trim().email(t('form:invalidEmailAddress')).max(255),
    percentage: z.coerce.number().min(0.01, t('form:percentageMustBeGreaterThan0')).max(100, t('form:percentageCannotExceed100')),
    comments: z.string().trim().max(500).optional().or(z.literal('')),
    identity_docs: z.array(z.object({
      type: z.enum(['passport', 'id', 'other']),
      path: z.string(),
      name: z.string(),
      size: z.number(),
      mime: z.string(),
      uploaded_at: z.string(),
    })).optional().default([]),
    passport_path: z.string().optional(),
    passport_number: z.string().trim().optional().or(z.literal('')),
  }).refine(
    (data) => {
      return data.passport_path && data.passport_path.length > 0;
    },
    {
      message: t('form:passportRequired'),
      path: ['passport_path'],
    }
  ).refine(
    (data) => {
      if (data.passport_path && data.passport_path.length > 0) {
        return data.passport_number && data.passport_number.length > 0;
      }
      return true;
    },
    {
      message: t('form:passportNumberRequired'),
      path: ['passport_number'],
    }
  );

  const beneficiariesSchema = z
    .array(beneficiarySchema)
    .min(1, t('form:atLeastOneBeneficiaryRequired'))
    .max(50, t('form:maximumBeneficiariesReached'))
    .refine(
      (beneficiaries) => {
        const level1Beneficiaries = beneficiaries.filter((b) => b.level === 1);
        if (level1Beneficiaries.length === 0) return false;
        const level1Total = level1Beneficiaries.reduce((sum, b) => sum + (b.percentage || 0), 0);
        return Math.abs(level1Total - 100) < 0.01;
      },
      {
        message: t('form:level1PercentagesMustTotal100'),
      }
    );

  const assetDocumentSchema = z.object({
    type: z.enum(['deed', 'logbook', 'statement', 'certificate', 'other']),
    path: z.string(),
    name: z.string(),
    size: z.number(),
    mime: z.string(),
    uploaded_at: z.string(),
  });

  const assetSchemaSpecific = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(1, t('form:assetTitleRequired')).max(200),
    category: z.enum(['property', 'bank', 'investments', 'business', 'vehicle', 'crypto', 'personal'], {
      required_error: t('form:assetCategoryRequired'),
    }),
    description: z.string().trim().min(1, t('form:assetDescriptionRequired')).max(500),
    location: z.string().trim().max(200).optional(),
    estimated_value: z.number().min(0).optional(),
    beneficiary_name: z.string().trim().max(200).optional(),
    documents: z.array(assetDocumentSchema).optional(),
    photo_path: z.string().optional(),
  });

  const assetSchemaGeneral = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(1, t('form:assetTitleRequired')).max(200),
    category: z.enum(['property', 'bank', 'investments', 'business', 'vehicle', 'crypto', 'personal']).optional(),
    description: z.string().trim().min(1, t('form:assetDescriptionRequired')).max(500),
    location: z.string().trim().max(200).optional(),
    estimated_value: z.number().min(0).optional(),
    beneficiary_name: z.string().trim().max(200).optional(),
    documents: z.array(assetDocumentSchema).optional(),
    photo_path: z.string().optional(),
  });

  const assetSchema = z.object({
    id: z.string().optional(),
    title: z.string().trim().max(200).optional(),
    category: z.enum(['property', 'bank', 'investments', 'business', 'vehicle', 'crypto', 'personal']).optional(),
    description: z.string().trim().max(500).optional(),
    location: z.string().trim().max(200).optional(),
    estimated_value: z.number().min(0).optional(),
    beneficiary_name: z.string().trim().max(200).optional(),
    documents: z.array(assetDocumentSchema).optional(),
    photo_path: z.string().optional(),
  });

  const assetsSchema = z.array(assetSchema);

  const assetsStepSchema = z.object({
    will_type: z.enum(['general', 'specific'], {
      required_error: t('form:willTypeRequired'),
    }),
    assets: z.array(assetSchema).optional(),
    main_beneficiary_ids: z.array(z.string()).optional(),
  }).superRefine((data, ctx) => {
    // Check will type specific validation
    if (data.will_type === 'specific') {
      if (!data.assets || data.assets.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('form:assetRequiredForSpecificWill'),
          path: ['assets'],
        });
        return;
      }

      // Validate each asset individually for specific will
      data.assets.forEach((asset, index) => {
        const validation = assetSchemaSpecific.safeParse(asset);
        if (!validation.success) {
          validation.error.errors.forEach((err) => {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: err.message,
              path: ['assets', index, ...err.path],
            });
          });
        }
      });
    }

    // Check general will validation
    if (data.will_type === 'general') {
      if (!data.main_beneficiary_ids || data.main_beneficiary_ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('form:atLeastOneBeneficiaryMustBeSelected'),
          path: ['main_beneficiary_ids'],
        });
      }

      // For general will type, if assets are added, validate them
      if (data.assets && data.assets.length > 0) {
        data.assets.forEach((asset, index) => {
          const validation = assetSchemaGeneral.safeParse(asset);
          if (!validation.success) {
            validation.error.errors.forEach((err) => {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: err.message,
                path: ['assets', index, ...err.path],
              });
            });
          }
        });
      }
    }
  });

  const specialRequestsSchema = z.object({
    funeral_wishes: z.string().trim().max(1000).optional(),
    guardianship: z.string().trim().max(1000).optional(),
    digital_assets: z.string().trim().max(1000).optional(),
    other: z.string().trim().max(1000).optional(),
  });

  const receiptPersonSchema = z.object({
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    passport_path: z.string().optional(),
    passport_number: z.string().trim().optional().or(z.literal('')),
    contact_number: phoneNumberSchema,
  }).refine(
    (data) => {
      return data.passport_path && data.passport_path.length > 0;
    },
    {
      message: t('form:passportRequired'),
      path: ['passport_path'],
    }
  ).refine(
    (data) => {
      if (data.passport_path && data.passport_path.length > 0) {
        return data.passport_number && data.passport_number.length > 0;
      }
      return true;
    },
    {
      message: t('form:passportNumberRequired'),
      path: ['passport_number'],
    }
  );

  const disinheritPersonSchema = z.object({
    name: z.string().trim().min(1, t('form:nameRequired')).max(100),
    relation: z.string().trim().min(1, t('form:relationRequired')).max(100),
    passport_path: z.string().optional(),
    passport_number: z.string().trim().optional().or(z.literal('')),
    contact_number: phoneNumberSchema,
  }).refine(
    (data) => {
      return data.passport_path && data.passport_path.length > 0;
    },
    {
      message: t('form:passportRequired'),
      path: ['passport_path'],
    }
  ).refine(
    (data) => {
      if (data.passport_path && data.passport_path.length > 0) {
        return data.passport_number && data.passport_number.length > 0;
      }
      return true;
    },
    {
      message: t('form:passportNumberRequired'),
      path: ['passport_number'],
    }
  );

  const receiptAndDisinheritSchema = z.object({
    no_receipt_persons: z.boolean().optional().default(false),
    receipt_of_will: z.array(receiptPersonSchema).optional().default([]),
    no_disinherit_persons: z.boolean().optional().default(false),
    disinherit: z.array(disinheritPersonSchema).optional().default([]),
  }).refine(
    (data) => {
      const bothSkipped = data.no_receipt_persons && data.no_disinherit_persons;
      if (bothSkipped) {
        const receiptEmpty = !data.receipt_of_will || data.receipt_of_will.length === 0;
        const disinheritEmpty = !data.disinherit || data.disinherit.length === 0;
        return receiptEmpty && disinheritEmpty;
      }

      const hasReceiptData = !data.no_receipt_persons && data.receipt_of_will && data.receipt_of_will.length > 0;
      const hasDisinheritData = !data.no_disinherit_persons && data.disinherit && data.disinherit.length > 0;

      if (!hasReceiptData && !hasDisinheritData) {
        return false;
      }

      if (hasReceiptData) {
        const allReceiptValid = data.receipt_of_will.every(p => p.name && p.relation && p.contact_number);
        if (!allReceiptValid) return false;
      }

      if (hasDisinheritData) {
        const allDisinheritValid = data.disinherit.every(p => p.name && p.relation);
        if (!allDisinheritValid) return false;
      }

      return true;
    },
    {
      message: t('form:receiptDisinheritRequired'),
    }
  );

  // Schema for step 9 - only validates details, not signature
  const familyExclusionDetailsSchema = z.object({
    is_excluding: z.boolean(),
    details: z.string().trim().max(1000).optional(),
    signature: z.string().optional(),
    signature_date: z.string().optional(),
  }).refine(
    (data) => {
      if (data.is_excluding) {
        if (!data.details || data.details.trim().length < 10) {
          return false;
        }
        // Check if the details contain meaningful text (at least some letters)
        const letterCount = (data.details.match(/[a-zA-Z\u0600-\u06FF]/g) || []).length;
        return letterCount >= 5;
      }
      return true;
    },
    {
      message: t('form:provideDetailsAboutExclusion'),
      path: ['details'],
    }
  );

  // Full schema for step 10 - validates both details and signature
  const familyExclusionSchema = z.object({
    is_excluding: z.boolean(),
    details: z.string().trim().max(1000).optional(),
    signature: z.string().optional(),
    signature_date: z.string().optional(),
  }).refine(
    (data) => {
      if (data.is_excluding) {
        if (!data.details || data.details.trim().length < 10) {
          return false;
        }
        // Check if the details contain meaningful text (at least some letters)
        const letterCount = (data.details.match(/[a-zA-Z\u0600-\u06FF]/g) || []).length;
        return letterCount >= 5;
      }
      return true;
    },
    {
      message: t('form:provideDetailsAboutExclusion'),
      path: ['details'],
    }
  ).refine(
    (data) => {
      return data.signature && data.signature.trim().length > 0;
    },
    {
      message: t('form:clientSignatureRequired'),
      path: ['signature'],
    }
  );

  const letterOfWishesSchema = z.object({
    acknowledged: z.boolean(),
    notes: z.string().optional(),
  });

  const familyExclusionAndLetterSchema = z.object({
    family_exclusion: familyExclusionSchema,
    letter_of_wishes: letterOfWishesSchema,
  });

  const confirmationsSchema = z.object({
    reviewed: z.literal(true, {
      errorMap: () => ({ message: t('form:mustReviewAllInformation') }),
    }),
    accuracy_confirmed: z.literal(true, {
      errorMap: () => ({ message: t('form:mustConfirmAccuracy') }),
    }),
  });

  return {
    phoneNumberSchema,
    personalSchema,
    identitySchema,
    trusteeSchema,
    trusteesSchema,
    trusteesStepSchema,
    executorSchema,
    executorsSchema,
    guardianSchema,
    guardiansSchema,
    interimGuardianSchema,
    interimGuardiansStepSchema,
    permanentGuardianSchema,
    permanentGuardiansStepSchema,
    beneficiarySchema,
    beneficiariesSchema,
    assetDocumentSchema,
    assetSchema,
    assetsSchema,
    assetsStepSchema,
    specialRequestsSchema,
    receiptPersonSchema,
    disinheritPersonSchema,
    receiptAndDisinheritSchema,
    familyExclusionDetailsSchema,
    familyExclusionSchema,
    letterOfWishesSchema,
    familyExclusionAndLetterSchema,
    confirmationsSchema,
  };
};
