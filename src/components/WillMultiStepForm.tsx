import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWillForm } from "@/hooks/useWillForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Save, Shield, FileText, Search, Mail, Users, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormStepper, type StepSaveStatus } from "./will-form/FormStepper";
import { FormNavigation } from "./will-form/FormNavigation";
import { SaveStatus } from "./will-form/SaveStatus";
import { StepPersonal } from "./will-form/StepPersonal";
import { StepIdentityUpload } from "./will-form/StepIdentityUpload";
import { StepTrustees } from "./will-form/StepTrustees";
import { StepInterimGuardians } from "./will-form/StepInterimGuardians";
import { StepPermanentGuardians } from "./will-form/StepPermanentGuardians";
import { StepExecutors } from "./will-form/StepExecutors";
import { StepBeneficiaries } from "./will-form/StepBeneficiaries";
import { StepAssets } from "./will-form/StepAssets";
import { StepReceiptAndDisinherit } from "./will-form/StepReceiptAndDisinherit";
import { StepReview } from "./will-form/StepReview";
import { StepFamilyExclusionAndLetter } from "./will-form/StepFamilyExclusionAndLetter";
import type { Answers } from "@/types/will-form";
import { INITIAL_ANSWERS } from "@/types/will-form";
import { createValidationSchemas } from "@/lib/will-form-validation";

const TOTAL_STEPS = 11;

// Export save controls (status + button) for use in PageHeader
interface SaveControlsProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  lastSavedAt: string | null;
  saveError: string | null;
  onRetry: () => void;
  onManualSave: () => void;
  isSaving: boolean;
}

export function SaveControls({ 
  saveStatus, 
  lastSavedAt, 
  saveError, 
  onRetry,
  onManualSave,
  isSaving
}: SaveControlsProps) {
  const { t } = useTranslation(['form']);
  
  return (
    <div className="flex items-center gap-3">
      <SaveStatus
        status={saveStatus}
        lastSavedAt={lastSavedAt}
        error={saveError}
        onRetry={onRetry}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={onManualSave}
        disabled={isSaving}
        className={cn(
          "gap-2 px-4 py-2 rounded-full font-medium",
          "border-accent text-accent hover:bg-accent hover:text-accent-foreground",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Save className="h-4 w-4" />
        {t('form:saveNow')}
      </Button>
    </div>
  );
}

interface WillMultiStepFormProps {
  willFormHook: ReturnType<typeof useWillForm>;
  onManualSaveReady?: (saveHandler: () => void) => void;
}

export function WillMultiStepForm({ willFormHook, onManualSaveReady }: WillMultiStepFormProps) {
  const { t, i18n } = useTranslation(['form', 'portal']);
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  // Create validation schemas with translation support
  const schemas = createValidationSchemas(t);
  const {
    willRecord,
    loading: willLoading,
    saving,
    saveStatus,
    lastSavedAt,
    saveError,
    updateAnswers,
    forceSave,
    retrySave,
    submitWill,
    updateFileMetadata,
    updateUploadFiles,
    removeFileMetadata
  } = willFormHook;
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [lastStepWithData, setLastStepWithData] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, number>>({});
  const hasLoadedRef = useRef(false); // Use ref instead of state to prevent re-renders

  // Debug: Track currentStep changes
  useEffect(() => {
    console.log('📍 currentStep changed to:', currentStep);
  }, [currentStep]);

  // Load will data from Supabase when available (only once on mount, and only if data exists on initial mount)
  useEffect(() => {
    console.log('⚡ useEffect triggered - hasLoaded:', hasLoadedRef.current, 'willLoading:', willLoading, 'willRecord exists:', !!willRecord);

    if (hasLoadedRef.current) {
      console.log('⏭️ Skipping - already loaded');
      return; // Already loaded, don't reload
    }

    // Wait for initial loading to complete
    if (willLoading) {
      console.log('⏳ Waiting for will to load...');
      return;
    }

    // If we have no will record after loading completes, mark as loaded so we don't process it when a new will is created
    if (!willRecord) {
      console.log('🔒 No existing will - marking as loaded to prevent loading when new will is created');
      hasLoadedRef.current = true;
      return;
    }

    // If we have a will record but no answers, mark as loaded
    if (!willRecord.answers || Object.keys(willRecord.answers).length === 0) {
      console.log('⏭️ Skipping - no answers to load');
      hasLoadedRef.current = true;
      console.log('🔒 Marking as loaded (empty will)');
      return; // No data to load
    }

    console.log('📥 Loading will data from database...');
    console.log('📥 RAW willRecord.answers.beneficiaries from DB:', willRecord.answers.beneficiaries);

    // Merge with INITIAL_ANSWERS to ensure all required properties exist
    const cleanedAnswers = {
      ...INITIAL_ANSWERS,
      ...willRecord.answers,
      // Ensure nested objects are properly merged
      confirmations: {
        ...INITIAL_ANSWERS.confirmations,
        ...(willRecord.answers.confirmations || {}),
        // Ensure boolean values are properly set
        reviewed: Boolean(willRecord.answers.confirmations?.reviewed),
        accuracy_confirmed: Boolean(willRecord.answers.confirmations?.accuracy_confirmed),
      }
    } as Answers;

    console.log('📥 AFTER MERGE cleanedAnswers.beneficiaries:', cleanedAnswers.beneficiaries);

    // Debug: Log loaded confirmations
    console.log('Loading will data - raw confirmations:', willRecord.answers.confirmations);
    console.log('Loading will data - cleaned confirmations:', cleanedAnswers.confirmations);

    // Safety: Filter out any invalid beneficiaries and ensure email field exists
    if (cleanedAnswers.beneficiaries) {
      console.log('📥 Loading beneficiaries from DB (BEFORE processing):', cleanedAnswers.beneficiaries.map((b: any) => ({
        name: b.name,
        email: b.email,
        contact_number: b.contact_number
      })));

      cleanedAnswers.beneficiaries = cleanedAnswers.beneficiaries
        .filter((b: any) => b.level && b.name && typeof b.percentage === 'number')
        .map((b: any) => ({
          ...b,
          email: b.email || '', // Ensure email field exists
        }));

      console.log('📥 Loading beneficiaries from DB (AFTER processing):', cleanedAnswers.beneficiaries.map((b: any) => ({
        name: b.name,
        email: b.email,
        contact_number: b.contact_number
      })));
    }

    setAnswers(cleanedAnswers);

    // Restore visited steps from metadata (if saved)
    const visitedStepsFromDB: number[] = (cleanedAnswers as any)._visited_steps || [];

    // Determine which steps have data and mark them as completed
    const stepsWithData: number[] = [];

    // Step 1: Personal details
    if (cleanedAnswers.personal?.full_name) {
      stepsWithData.push(1);
    }

    // Step 2: Identity Upload
    if (cleanedAnswers.identity?.passport_path) {
      stepsWithData.push(2);
    }

    // Step 3: Beneficiaries
    if (cleanedAnswers.beneficiaries?.length > 0) {
      stepsWithData.push(3);
    }

    // Step 4: Assets
    if (cleanedAnswers.assets?.length > 0) {
      stepsWithData.push(4);
    }

    // Step 5: Executors
    if (cleanedAnswers.executors?.length > 0) {
      stepsWithData.push(5);
    }

    // Step 6: Trustees (only if has data OR explicitly skipped)
    if (cleanedAnswers.trustees?.length > 0 || cleanedAnswers.skip_trustees === true) {
      stepsWithData.push(6);
    }

    // Step 7: Interim Guardians (only if has data OR explicitly skipped)
    if (cleanedAnswers.interim_guardians?.length > 0 || cleanedAnswers.skip_interim_guardians === true) {
      stepsWithData.push(7);
    }

    // Step 8: Permanent Guardians (only if has data OR explicitly skipped)
    if (cleanedAnswers.permanent_guardians?.length > 0 || cleanedAnswers.skip_permanent_guardians === true) {
      stepsWithData.push(8);
    }

    // Step 9: Receipt and Disinherit (only if explicitly true OR has items)
    if (cleanedAnswers.receipt_of_will?.length > 0 || cleanedAnswers.disinherit?.length > 0 ||
        cleanedAnswers.no_receipt_persons === true || cleanedAnswers.no_disinherit_persons === true) {
      stepsWithData.push(9);
    }

    // Step 10: Family Exclusion and Letter (only if explicitly true)
    if (cleanedAnswers.family_exclusion?.is_excluding === true || cleanedAnswers.letter_of_wishes?.acknowledged === true) {
      stepsWithData.push(10);
    }

    // Combine visited steps from DB with steps that have data
    const allCompletedSteps = [...new Set([...visitedStepsFromDB, ...stepsWithData])];

    // Find the furthest step with data
    const furthestStep = stepsWithData.length > 0 ? Math.max(...stepsWithData) : 0;

    console.log('📊 Draft loaded - Steps with data:', stepsWithData, 'Visited from DB:', visitedStepsFromDB, 'All completed:', allCompletedSteps);

    // Save the last step with data (this will always be highlighted)
    setLastStepWithData(furthestStep > 0 ? furthestStep : null);

    // Mark all completed steps (visited OR with data) as clickable
    setCompletedSteps(allCompletedSteps);

    // Navigate to the last step with data (or step 1 if no data)
    if (furthestStep > 0) {
      console.log('🎯 Setting initial currentStep to:', furthestStep);
      setCurrentStep(furthestStep);
    } else {
      console.log('🎯 Setting initial currentStep to: 1');
      setCurrentStep(1); // No data, start at step 1
    }

    console.log('✅ Initial load complete - marking as loaded');
    hasLoadedRef.current = true;
  }, [willRecord, willLoading]);

  // Fetch extracted name from user_identity_documents and prefill full_name
  useEffect(() => {
    const fetchExtractedName = async () => {
      if (!user?.id || !hasLoadedRef.current) return;

      // Only prefill if full_name is empty
      if (answers.personal?.full_name) return;

      try {
        const { data, error } = await supabase
          .from('user_identity_documents')
          .select('extracted_name')
          .eq('user_id', user.id)
          .eq('document_type', 'emirates_id')
          .single();

        if (error || !data?.extracted_name) {
          console.log('No extracted name found in user_identity_documents');
          return;
        }

        console.log('✅ Prefilling full_name from Emirates ID:', data.extracted_name);

        // Update the answers with the extracted name
        setAnswers(prev => ({
          ...prev,
          personal: {
            ...prev.personal,
            full_name: data.extracted_name,
          }
        }));
      } catch (err) {
        console.error('Error fetching extracted name:', err);
      }
    };

    fetchExtractedName();
  }, [user?.id, hasLoadedRef.current]);

  // Disabled auto-save - only save manually or on navigation
  // Auto-save was creating multiple will instances and running in loops
  // Users must click "Continue" or navigate to trigger save
  // useEffect(() => {
  //   if (user?.id && !willLoading && !isInitialLoad) {
  //     updateAnswers(answers);
  //   }
  // }, [answers, user?.id, willLoading, isInitialLoad]);

  // Real-time validation: Clear errors as user types (instant)
  useEffect(() => {
    // Only validate if there are errors to clear
    if (Object.keys(errors).length > 0) {
      validateStep(currentStep, true); // Silent validation (no toast)
    }
  }, [answers]); // Re-run when answers changes

  // Flush pending saves before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (willRecord?.id && user?.id) {
        // Attempt to save synchronously
        forceSave(answers);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && willRecord?.id) {
        forceSave(answers);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [answers, willRecord?.id, user?.id, forceSave]);

  // Sync beneficiary docs to upload_files array
  useEffect(() => {
    if (!willRecord?.id || !hasLoadedRef.current || willLoading) return;

    const beneficiaryFiles = (answers.beneficiaries || []).flatMap((ben, idx) => 
      (ben.identity_docs || []).map(doc => ({
        category: 'beneficiary',
        beneficiary_index: idx,
        path: doc.path,
        name: doc.name,
        size: doc.size,
        mime: doc.mime,
        uploaded_at: doc.uploaded_at,
      }))
    );

    // Only update if beneficiary files have changed
    const currentFiles = willRecord.upload_files || [];
    const currentBeneficiaryFiles = currentFiles.filter((f: any) => f.category === 'beneficiary');
    const nonBeneficiaryFiles = currentFiles.filter((f: any) => f.category !== 'beneficiary');

    // Compare if there are changes
    const hasChanges = 
      beneficiaryFiles.length !== currentBeneficiaryFiles.length ||
      beneficiaryFiles.some((newFile, idx) => {
        const existing = currentBeneficiaryFiles[idx];
        return !existing || existing.path !== newFile.path;
      });

    if (hasChanges) {
      const updatedFiles = [...nonBeneficiaryFiles, ...beneficiaryFiles];
      updateUploadFiles(updatedFiles);
    }
  }, [answers.beneficiaries, willRecord?.id, willLoading, updateUploadFiles]);

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    toast({
      title: t('toast:will.saving'),
      description: t('toast:will.changesBeingSaved'),
    });

    await forceSave(answers);

    // Show success toast after save completes
    toast({
      title: t('toast:will.saved'),
      description: t('toast:will.changesSavedSuccess'),
    });
  }, [answers, forceSave, t]);

  // Expose manual save handler to parent
  useEffect(() => {
    if (onManualSaveReady) {
      onManualSaveReady(handleManualSave);
    }
  }, [onManualSaveReady, handleManualSave]);

  const validateStep = (step: number, silent = false): boolean => {
    // Always clear errors before validating
    setErrors({});

    try {
      switch (step) {
        case 1:
          schemas.personalSchema.parse(answers.personal);
          break;
        case 2:
          schemas.identitySchema.parse(answers.identity);
          break;
        case 3:
          schemas.beneficiariesSchema.parse(answers.beneficiaries);
          break;
        case 4:
          console.log('🔍 Validating Assets Step:', {
            will_type: answers.will_type,
            assets: answers.assets,
            main_beneficiary_ids: answers.main_beneficiary_ids,
          });
          schemas.assetsStepSchema.parse({
            will_type: answers.will_type,
            assets: answers.assets,
            main_beneficiary_ids: answers.main_beneficiary_ids,
          });
          break;
        case 5:
          schemas.executorsSchema.parse(answers.executors);
          break;
        case 6:
          schemas.trusteesStepSchema.parse({
            skip_trustees: answers.skip_trustees,
            trustees: answers.trustees,
            trustee_permission_to_contact: answers.trustee_permission_to_contact,
          });
          break;
        case 7:
          schemas.interimGuardiansStepSchema.parse({
            skip_interim_guardians: answers.skip_interim_guardians,
            interim_guardians: answers.interim_guardians,
            interim_guardian_permission_to_contact: answers.interim_guardian_permission_to_contact,
          });
          break;
        case 8:
          schemas.permanentGuardiansStepSchema.parse({
            skip_permanent_guardians: answers.skip_permanent_guardians,
            permanent_guardians: answers.permanent_guardians,
            permanent_guardian_permission_to_contact: answers.permanent_guardian_permission_to_contact,
          });
          break;
        case 9: {
          const validationErrors: any[] = [];

          // Validate receipt and disinherit
          try {
            schemas.receiptAndDisinheritSchema.parse({
              no_receipt_persons: answers.no_receipt_persons,
              receipt_of_will: answers.receipt_of_will,
              no_disinherit_persons: answers.no_disinherit_persons,
              disinherit: answers.disinherit,
            });
          } catch (err: any) {
            if (err.errors) {
              validationErrors.push(...err.errors);
            }
          }

          // Also validate family exclusion in step 9 (details only, not signature)
          if (answers.family_exclusion?.is_excluding) {
            try {
              schemas.familyExclusionDetailsSchema.parse(answers.family_exclusion);
            } catch (err: any) {
              if (err.errors) {
                validationErrors.push(...err.errors);
              }
            }
          }

          // If there are any errors, throw them
          if (validationErrors.length > 0) {
            throw { errors: validationErrors };
          }
          break;
        }
        case 10:
          schemas.familyExclusionAndLetterSchema.parse({
            family_exclusion: answers.family_exclusion,
            letter_of_wishes: answers.letter_of_wishes,
          });
          break;
        case 11:
          schemas.confirmationsSchema.parse(answers.confirmations);
          break;
      }
      
      // Clear errors for this step if validation passes
      if (!silent) {
        setStepErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[step];
          return newErrors;
        });
      }
      
      return true;
    } catch (error: any) {
      // ADD DETAILED LOGGING
      console.error('❌ Validation failed for step', step);
      console.log('📦 Data being validated:', 
        step === 1 ? answers.personal : 
        step === 2 ? answers.beneficiaries : 
        step === 3 ? answers.executors : 
        step === 4 ? { skip_trustees: answers.skip_trustees, trustees: answers.trustees } :
        step === 5 ? answers.assets :
        step === 6 ? answers.special_requests :
        step === 7 ? answers.identity :
        step === 8 ? answers.confirmations : 'unknown'
      );
      
      const validationErrors: Record<string, string> = {};
      let errorCount = 0;
      
      if (error.errors) {
        console.error('🔍 Detailed validation errors:', error.errors);
        error.errors.forEach((err: any) => {
          console.error(`  ❌ Field: ${err.path.join('.')} | Message: ${err.message}`);
          const field = err.path.join('.');
          validationErrors[field] = err.message;
          errorCount++;
        });
      } else {
        console.error('🔍 General validation error:', error.message);
        validationErrors.general = error.message;
        errorCount = 1;
      }
      
      if (!silent) {
        setErrors(validationErrors);
        setStepErrors(prev => ({ ...prev, [step]: errorCount }));
      }
      
      return false;
    }
  };

  // Background validation for completed steps only to update indicators
  useEffect(() => {
    if (!willLoading && willRecord) {
      const newStepErrors: Record<number, number> = {};

      // Only validate steps that have been completed or visited
      for (let step = 1; step <= 11; step++) {
        if (completedSteps.includes(step) && !validateStep(step, true)) {
          // Count errors from silent validation
          try {
            switch (step) {
              case 1:
                schemas.personalSchema.parse(answers.personal);
                break;
              case 2:
                schemas.identitySchema.parse(answers.identity);
                break;
              case 3:
                schemas.beneficiariesSchema.parse(answers.beneficiaries);
                break;
              case 4:
                schemas.assetsStepSchema.parse({
                  will_type: answers.will_type,
                  assets: answers.assets,
                  main_beneficiary_ids: answers.main_beneficiary_ids,
                });
                break;
              case 5:
                schemas.executorsSchema.parse(answers.executors);
                break;
              case 6:
                schemas.trusteesStepSchema.parse({
                  skip_trustees: answers.skip_trustees,
                  trustees: answers.trustees,
                  trustee_permission_to_contact: answers.trustee_permission_to_contact,
                });
                break;
              case 7:
                schemas.interimGuardiansStepSchema.parse({
                  skip_interim_guardians: answers.skip_interim_guardians,
                  interim_guardians: answers.interim_guardians,
                  interim_guardian_permission_to_contact: answers.interim_guardian_permission_to_contact,
                });
                break;
              case 8:
                schemas.permanentGuardiansStepSchema.parse({
                  skip_permanent_guardians: answers.skip_permanent_guardians,
                  permanent_guardians: answers.permanent_guardians,
                  permanent_guardian_permission_to_contact: answers.permanent_guardian_permission_to_contact,
                });
                break;
              case 9: {
                const stepValidationErrors: any[] = [];

                // Validate receipt and disinherit
                try {
                  schemas.receiptAndDisinheritSchema.parse({
                    no_receipt_persons: answers.no_receipt_persons,
                    receipt_of_will: answers.receipt_of_will,
                    no_disinherit_persons: answers.no_disinherit_persons,
                    disinherit: answers.disinherit,
                  });
                } catch (err: any) {
                  if (err.errors) {
                    stepValidationErrors.push(...err.errors);
                  }
                }

                // Also validate family exclusion in step 9 (details only, not signature)
                if (answers.family_exclusion?.is_excluding) {
                  try {
                    schemas.familyExclusionDetailsSchema.parse(answers.family_exclusion);
                  } catch (err: any) {
                    if (err.errors) {
                      stepValidationErrors.push(...err.errors);
                    }
                  }
                }

                // If there are any errors, throw them
                if (stepValidationErrors.length > 0) {
                  throw { errors: stepValidationErrors };
                }
                break;
              }
              case 10:
                schemas.familyExclusionAndLetterSchema.parse({
                  family_exclusion: answers.family_exclusion,
                  letter_of_wishes: answers.letter_of_wishes,
                });
                break;
              case 11:
                schemas.confirmationsSchema.parse(answers.confirmations);
                break;
            }
          } catch (error: any) {
            if (error.errors) {
              newStepErrors[step] = error.errors.length;
            }
          }
        }
      }

      setStepErrors(newStepErrors);
    }
  }, [answers, willLoading, willRecord, completedSteps]);

  const handleNext = () => {
    console.log('🔵 handleNext called - currentStep:', currentStep);

    if (!validateStep(currentStep)) {
      toast({
        title: t('toast:validationError'),
        description: t('toast:will.pleaseFixErrors'),
        variant: "destructive",
      });
      return;
    }

    // Mark current step as visited/completed (so user can return to it)
    const updatedSteps = completedSteps.includes(currentStep)
      ? completedSteps
      : [...completedSteps, currentStep];

    setCompletedSteps(updatedSteps);

    // Save visited steps to answers metadata
    const updatedAnswers = {
      ...answers,
      _visited_steps: updatedSteps,
    };
    setAnswers(updatedAnswers);

    // Update step BEFORE saving to prevent UI jumping back
    const nextStep = currentStep + 1;
    console.log('🟢 Setting currentStep to:', nextStep);
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Force immediate save after navigation
    console.log('💾 Calling forceSave...');
    forceSave(updatedAnswers);
  };

  const handleBack = () => {
    // Mark current step as completed before going back
    const updatedSteps = completedSteps.includes(currentStep)
      ? completedSteps
      : [...completedSteps, currentStep];

    setCompletedSteps(updatedSteps);

    // Save visited steps to answers metadata
    const updatedAnswers = {
      ...answers,
      _visited_steps: updatedSteps,
    };
    setAnswers(updatedAnswers);

    // Force immediate save on step change
    forceSave(updatedAnswers);
    setCurrentStep(currentStep - 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStepClick = (step: number) => {
    // Allow navigation to completed steps, current step, or any previous step
    if (step <= currentStep || completedSteps.includes(step)) {
      // Mark current step as completed before navigating away
      const updatedSteps = completedSteps.includes(currentStep)
        ? completedSteps
        : [...completedSteps, currentStep];

      setCompletedSteps(updatedSteps);

      // Save visited steps to answers metadata
      const updatedAnswers = {
        ...answers,
        _visited_steps: updatedSteps,
      };
      setAnswers(updatedAnswers);

      setCurrentStep(step);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      toast({
        title: t('toast:validationError'),
        description: t('toast:will.completeAllConfirmations'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit will to database with awaiting_review status
      const success = await submitWill(answers);
      if (!success) {
        setIsSubmitting(false);
        return;
      }

      // Success - show confirmation
      toast({
        title: t('toast:will.submitSuccess'),
        description: t('toast:will.willSubmittedForReview'),
      });
      
      setIsConfirmed(true);

      // Clear localStorage draft
      if (user?.id && willRecord?.id) {
        const draftKey = `will_draft_${user.id}_${willRecord.id}`;
        localStorage.removeItem(draftKey);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: t('toast:error'),
        description: error.message || t('toast:will.failedToSubmitWill'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading skeleton while fetching will data
  if (willLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show confirmation screen after submission
  if (isConfirmed) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="border-[#E6E6E4] bg-white shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
          <CardContent className="pt-12 pb-8">
            {/* Gold Shield Icon */}
            <div className="text-center space-y-6">
              <div className="mx-auto w-[60px] h-[60px] bg-[#C6A03B] rounded-full flex items-center justify-center animate-scale-in shadow-[0_0_12px_rgba(198,160,59,0.2)]">
                <Shield className="w-8 h-8 text-white" />
              </div>

              {/* Heading */}
              <div className="space-y-3">
                <h2 className="text-[22px] font-serif font-bold text-[#121212] tracking-tight">
                  {t('form:submissionSuccessTitle')}
                </h2>
                <div className="space-y-3 max-w-2xl mx-auto">
                  <p className="text-[14px] text-[#333333] leading-[1.5]">
                    {t('form:submissionSuccessDesc1')}
                  </p>
                  <p className="text-[14px] text-[#333333] leading-[1.5]">
                    {t('form:submissionSuccessDesc2')}
                  </p>
                </div>
              </div>

              {/* Next Steps Timeline */}
              <div className="max-w-2xl mx-auto pt-8">
                <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className="text-center mb-6">
                    <h3 className="text-[16px] font-semibold text-[#121212] mb-2">
                      {t('form:whatHappensNext')}
                    </h3>
                    <div className="w-24 h-[1px] bg-[rgba(198,160,59,0.3)] mx-auto" />
                  </div>

                  <div className="space-y-[18px]">
                    {/* Step 1: Will Being Prepared */}
                    <div className={`flex items-start gap-4 ${isRtl ? '' : ''}`}>
                      <div className="flex-shrink-0 w-10 h-10 bg-[rgba(12,85,54,0.08)] rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#0C5536]" />
                      </div>
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <h4 className="font-semibold text-[14.5px] text-[#121212]">
                          {t('form:step1Title')}
                        </h4>
                        <p className="text-[13px] text-[#333333] mt-1 leading-relaxed">
                          {t('form:step1Desc')}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Legal Review */}
                    <div className={`flex items-start gap-4 ${isRtl ? '' : ''}`}>
                      <div className="flex-shrink-0 w-10 h-10 bg-[rgba(12,85,54,0.08)] rounded-full flex items-center justify-center">
                        <Search className="w-5 h-5 text-[#0C5536]" />
                      </div>
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <h4 className="font-semibold text-[14.5px] text-[#121212]">
                          {t('form:step2Title')}
                        </h4>
                        <p className="text-[13px] text-[#333333] mt-1 leading-relaxed">
                          {t('form:step2Desc')}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Receive Draft */}
                    <div className={`flex items-start gap-4 ${isRtl ? '' : ''}`}>
                      <div className="flex-shrink-0 w-10 h-10 bg-[rgba(12,85,54,0.08)] rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-[#0C5536]" />
                      </div>
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <h4 className="font-semibold text-[14.5px] text-[#121212]">
                          {t('form:step3Title')}
                        </h4>
                        <p className="text-[13px] text-[#333333] mt-1 leading-relaxed">
                          {t('form:step3Desc')}
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Final Consultation */}
                    <div className={`flex items-start gap-4 ${isRtl ? '' : ''}`}>
                      <div className="flex-shrink-0 w-10 h-10 bg-[rgba(12,85,54,0.08)] rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#0C5536]" />
                      </div>
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <h4 className="font-semibold text-[14.5px] text-[#121212]">
                          {t('form:step4Title')}
                        </h4>
                        <p className="text-[13px] text-[#333333] mt-1 leading-relaxed">
                          {t('form:step4Desc')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-8 max-w-md mx-auto">
                <Button
                  size="lg"
                  className="flex-1 bg-[#0C5536] hover:bg-[#0C5536]/90 text-white rounded-md px-8 shadow-[0_0_6px_rgba(198,160,59,0.35)] hover:shadow-[0_0_8px_rgba(198,160,59,0.5)] transition-all font-semibold text-[14px]"
                  onClick={() => window.location.href = '/portal/documents'}
                >
                  {t('form:goToMyDocuments')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 rounded-md px-8 border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] transition-all font-semibold text-[14px]"
                  onClick={() => window.location.href = '/portal'}
                >
                  {t('form:backToDashboard')}
                </Button>
              </div>

              {/* Security Reassurance */}
              <div className="flex items-center justify-center gap-2 pt-6">
                <Lock className="h-4 w-4 text-[#6B6B6B]" />
                <p className="text-[12.5px] text-[#6B6B6B] text-center">
                  {t('form:securityMessage')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Stepper */}
      <FormStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        lastStepWithData={lastStepWithData}
        onStepClick={handleStepClick}
        isSaving={saving}
        stepStatuses={{
          1: {
            saveStatus: stepErrors[1] ? 'error' : completedSteps.includes(1) ? 'saved' : 'idle',
            errorCount: stepErrors[1],
          },
          2: {
            saveStatus: stepErrors[2] ? 'error' : completedSteps.includes(2) ? 'saved' : 'idle',
            errorCount: stepErrors[2],
          },
          3: {
            saveStatus: stepErrors[3] ? 'error' : completedSteps.includes(3) ? 'saved' : 'idle',
            errorCount: stepErrors[3],
          },
          4: {
            saveStatus: stepErrors[4] ? 'error' : completedSteps.includes(4) ? 'saved' : 'idle',
            errorCount: stepErrors[4],
          },
          5: {
            saveStatus: stepErrors[5] ? 'error' : completedSteps.includes(5) ? 'saved' : 'idle',
            errorCount: stepErrors[5],
          },
          6: {
            saveStatus: stepErrors[6] ? 'error' : completedSteps.includes(6) ? 'saved' : 'idle',
            errorCount: stepErrors[6],
          },
          7: {
            saveStatus: stepErrors[7] ? 'error' : completedSteps.includes(7) ? 'saved' : 'idle',
            errorCount: stepErrors[7],
          },
          8: {
            saveStatus: stepErrors[8] ? 'error' : completedSteps.includes(8) ? 'saved' : 'idle',
            errorCount: stepErrors[8],
          },
          9: {
            saveStatus: stepErrors[9] ? 'error' : completedSteps.includes(9) ? 'saved' : 'idle',
            errorCount: stepErrors[9],
          },
          10: {
            saveStatus: stepErrors[10] ? 'error' : completedSteps.includes(10) ? 'saved' : 'idle',
            errorCount: stepErrors[10],
          },
          11: {
            saveStatus: stepErrors[11] ? 'error' : completedSteps.includes(11) ? 'saved' : 'idle',
            errorCount: stepErrors[11],
          },
        }}
      />

      {/* Form Content */}
      <Card className="border-border/50 bg-white shadow-[0_2px_8px_rgba(12,85,54,0.05)]">
        <CardContent className="pt-8 pb-8 px-10">
          {/* Step 1: Personal Details */}
          {currentStep === 1 && (
            <StepPersonal
              data={answers.personal}
              onChange={(personal) => setAnswers({ ...answers, personal })}
              errors={errors}
            />
          )}

          {/* Step 2: Identity Upload */}
          {currentStep === 2 && (
            <StepIdentityUpload
              data={answers.identity}
              onChange={(identity) => setAnswers({ ...answers, identity })}
              onFileMetadataUpdate={(type, metadata) => updateFileMetadata(metadata)}
              onFileMetadataRemove={(type) => removeFileMetadata(type)}
              onNameExtracted={(name) => {
                // Update Step 1 full_name field with extracted name
                setAnswers({
                  ...answers,
                  personal: {
                    ...answers.personal,
                    full_name: name,
                  },
                });
              }}
              willId={willRecord?.id}
              errors={errors}
            />
          )}

          {/* Step 3: Beneficiaries */}
          {currentStep === 3 && (
            <StepBeneficiaries
              data={answers.beneficiaries}
              onChange={(beneficiaries) => {
                console.log('🔥 WillMultiStepForm - Beneficiaries onChange:', beneficiaries.map(b => ({
                  name: b.name,
                  email: b.email,
                  passport_path: b.passport_path,
                  passport_number: b.passport_number,
                })));
                setAnswers(prev => {
                  console.log('🔥 WillMultiStepForm - Previous beneficiaries:', prev.beneficiaries.map(b => ({
                    name: b.name,
                    email: b.email,
                    passport_path: b.passport_path,
                    passport_number: b.passport_number,
                  })));
                  return { ...prev, beneficiaries };
                });
              }}
              permissionToContact={answers.beneficiary_permission_to_contact ?? true}
              onPermissionChange={(permission) => setAnswers({ ...answers, beneficiary_permission_to_contact: permission })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 4: Assets */}
          {currentStep === 4 && (
            <StepAssets
              data={answers.assets}
              onChange={(assets) => setAnswers({ ...answers, assets })}
              errors={errors}
              beneficiaries={answers.beneficiaries}
              willId={willRecord?.id}
              willType={answers.will_type}
              onWillTypeChange={(type) => setAnswers({ ...answers, will_type: type })}
              mainBeneficiaryIds={answers.main_beneficiary_ids}
              onMainBeneficiariesChange={(ids) => setAnswers({ ...answers, main_beneficiary_ids: ids })}
              generalBeneficiaries={answers.general_beneficiaries}
              onGeneralBeneficiariesChange={(beneficiaries) => setAnswers({ ...answers, general_beneficiaries: beneficiaries })}
            />
          )}

          {/* Step 5: Executors */}
          {currentStep === 5 && (
            <StepExecutors
              data={answers.executors}
              onChange={(executors) => {
                console.log('📊 Executors state updated:', executors.map(e => ({ name: e.name, emirates_id_path: e.emirates_id_path })));
                setAnswers({ ...answers, executors });
              }}
              permissionToContact={answers.executor_permission_to_contact}
              onPermissionChange={(permission) => setAnswers({ ...answers, executor_permission_to_contact: permission })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 6: Trustees */}
          {currentStep === 6 && (
            <StepTrustees
              data={answers.trustees}
              onChange={(trustees) => setAnswers({ ...answers, trustees })}
              permissionToContact={answers.trustee_permission_to_contact}
              onPermissionChange={(permission) => setAnswers({ ...answers, trustee_permission_to_contact: permission })}
              skipTrustees={answers.skip_trustees}
              onSkipChange={(skip) => setAnswers({ ...answers, skip_trustees: skip })}
              onSkipWithClear={(skip) => setAnswers({ ...answers, skip_trustees: skip, trustees: [] })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 7: Interim Guardians */}
          {currentStep === 7 && (
            <StepInterimGuardians
              data={answers.interim_guardians}
              onChange={(guardians) => setAnswers({ ...answers, interim_guardians: guardians })}
              permissionToContact={answers.interim_guardian_permission_to_contact}
              onPermissionChange={(permission) => setAnswers({ ...answers, interim_guardian_permission_to_contact: permission })}
              skipInterimGuardians={answers.skip_interim_guardians}
              onSkipChange={(skip) => setAnswers({ ...answers, skip_interim_guardians: skip })}
              onSkipWithClear={(skip) => setAnswers({ ...answers, skip_interim_guardians: skip, interim_guardians: [] })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 8: Permanent Guardians */}
          {currentStep === 8 && (
            <StepPermanentGuardians
              data={answers.permanent_guardians}
              onChange={(guardians) => setAnswers({ ...answers, permanent_guardians: guardians })}
              permissionToContact={answers.permanent_guardian_permission_to_contact}
              onPermissionChange={(permission) => setAnswers({ ...answers, permanent_guardian_permission_to_contact: permission })}
              skipPermanentGuardians={answers.skip_permanent_guardians}
              onSkipChange={(skip) => setAnswers({ ...answers, skip_permanent_guardians: skip })}
              onSkipWithClear={(skip) => setAnswers({ ...answers, skip_permanent_guardians: skip, permanent_guardians: [] })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 9: Receipt and Disinherit */}
          {currentStep === 9 && (
            <StepReceiptAndDisinherit
              familyExclusion={answers.family_exclusion}
              onFamilyExclusionChange={(data) => setAnswers({ ...answers, family_exclusion: data })}
              receiptData={answers.receipt_of_will}
              onReceiptChange={(data) => setAnswers(prev => ({ ...prev, receipt_of_will: data }))}
              noReceiptPersons={answers.no_receipt_persons}
              onNoReceiptChange={(value) => {
                console.log('Parent onNoReceiptChange called:', { value, currentState: answers.no_receipt_persons });
                setAnswers(prev => ({ ...prev, no_receipt_persons: value }));
              }}
              disinheritData={answers.disinherit}
              onDisinheritChange={(data) => setAnswers(prev => ({ ...prev, disinherit: data }))}
              noDisinheritPersons={answers.no_disinherit_persons}
              onNoDisinheritChange={(value) => {
                console.log('Parent onNoDisinheritChange called:', { value, currentState: answers.no_disinherit_persons });
                setAnswers(prev => ({ ...prev, no_disinherit_persons: value }));
              }}
              permissionToContact={answers.receipt_disinherit_permission_to_contact ?? true}
              onPermissionChange={(permission) => setAnswers({ ...answers, receipt_disinherit_permission_to_contact: permission })}
              errors={errors}
              willId={willRecord?.id}
              allAnswers={answers}
              onFileMetadataUpdate={updateFileMetadata}
            />
          )}

          {/* Step 10: Family Exclusion and Letter */}
          {currentStep === 10 && (
            <StepFamilyExclusionAndLetter
              familyExclusion={answers.family_exclusion}
              onFamilyExclusionChange={(data) => setAnswers({ ...answers, family_exclusion: data })}
              letterOfWishes={answers.letter_of_wishes}
              onLetterOfWishesChange={(data) => setAnswers({ ...answers, letter_of_wishes: data })}
              clientName={answers.personal.full_name}
              errors={errors}
            />
          )}

          {/* Step 11: Review */}
          {currentStep === 11 && (
            <StepReview
              data={answers}
              confirmations={answers.confirmations}
              onConfirmationsChange={(confirmations) => setAnswers({ ...answers, confirmations })}
              pdfLanguage={answers.pdf_language || 'english'}
              onPdfLanguageChange={(language) => setAnswers({ ...answers, pdf_language: language })}
              onEditStep={setCurrentStep}
              errors={errors}
            />
          )}

          <FormNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            isStepValid={true}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
