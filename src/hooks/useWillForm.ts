"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { toast } from './use-toast';
import type { Answers, FileMetadata } from '@/types/will-form';
import { INITIAL_ANSWERS } from '@/types/will-form';
import type { Database } from '@/integrations/supabase/types';
import { queueOfflineSave, getQueue, removeFromQueue } from '@/utils/offline';

type WillRow = Database['public']['Tables']['wills']['Row'];

export type SaveStatusType = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface WillRecord {
  id: string;
  user_id: string;
  status: string;
  answers: Answers;
  upload_files: any[];
  pdf_path: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWillForm() {
  const { t } = useTranslation(['form', 'toast']);
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [willRecord, setWillRecord] = useState<WillRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Fetch or create will record with draft recovery
  const fetchOrCreateWill = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // IMPORTANT: Fetch the most recent UNSUBMITTED will for this user
      // We match on submitted_at = null (not on status) because:
      // - Admin can change status while user is still editing
      // - We only want to edit wills that haven't been submitted yet
      const { data: existingWill, error: fetchError } = await supabase
        .from('wills')
        .select('*')
        .eq('user_id', user.id)
        .is('submitted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingWill) {
        const serverAnswers = (existingWill.answers as unknown as Answers) || INITIAL_ANSWERS;
        
        // Sanitize file fields - ensure they're null, not empty objects
        if (serverAnswers.identity) {
          if (serverAnswers.identity.passport_file && !(serverAnswers.identity.passport_file instanceof File)) {
            serverAnswers.identity.passport_file = null;
          }
          if (serverAnswers.identity.poa_file && !(serverAnswers.identity.poa_file instanceof File)) {
            serverAnswers.identity.poa_file = null;
          }
        }

        // Data migration for old format
        if (serverAnswers.personal) {
          // Migrate phone to contact_number
          if (serverAnswers.personal.phone && !serverAnswers.personal.contact_number) {
            serverAnswers.personal.contact_number = serverAnswers.personal.phone;
          }
          
          // Set default date if not present
          if (!serverAnswers.personal.date) {
            serverAnswers.personal.date = new Date().toISOString();
          }
          
          // Initialize new arrays if not present
          if (!serverAnswers.personal.assets_country) {
            serverAnswers.personal.assets_country = [];
          }
          if (!serverAnswers.personal.preferred_contact_methods) {
            serverAnswers.personal.preferred_contact_methods = [];
          }
          if (!serverAnswers.personal.religion) {
            serverAnswers.personal.religion = '';
          }
        }

        // Migrate old executor structure to new level-based structure
        if (serverAnswers.executors && serverAnswers.executors.length > 0) {
          serverAnswers.executors = serverAnswers.executors
            .filter((e: any) => e.full_name || e.name)
            .map((e: any, index: number) => ({
              level: e.level || (e.is_backup ? 2 : 1) || (index + 1),
              name: e.name || e.full_name || '',
              relation: e.relation || e.relationship || '',
              email: e.email || '',
              contact_number: e.contact_number || '',
              passport_path: e.passport_path,
              passport_number: e.passport_number || '',
              passport_metadata: e.passport_metadata,
              poa_path: e.poa_path,
              emirates_id_path: e.emirates_id_path,
              emirates_id_number: e.emirates_id_number || '',
            }))
            .sort((a: any, b: any) => a.level - b.level)
            .slice(0, 3); // Max 3 executors
          
          console.log('📋 Loaded executors from DB:', serverAnswers.executors.map((e: any) => ({
            name: e.name,
            passport_path: e.passport_path,
            passport_number: e.passport_number,
            poa_path: e.poa_path,
            emirates_id_path: e.emirates_id_path,
            emirates_id_number: e.emirates_id_number,
          })));
        }

        // Migrate old beneficiary structure to new level-based structure
        if (serverAnswers.beneficiaries && serverAnswers.beneficiaries.length > 0) {
          const originalLength = serverAnswers.beneficiaries.length;
          
          // Filter and convert beneficiaries - only keep those with proper structure
          const validBeneficiaries = serverAnswers.beneficiaries
            .filter((b: any) => {
              // Keep only if it has a valid level and required fields
              return b.level && b.name && typeof b.percentage === 'number';
            })
            .map((b: any) => ({
              level: b.level,
              name: b.name,
              relationship: b.relationship || '',
              contact_number: b.contact_number || '',
              email: b.email || '',
              percentage: b.percentage,
              comments: b.comments || '',
              identity_docs: b.identity_docs || [],
              passport_path: b.passport_path,
              passport_number: b.passport_number || '',
              emirates_id_path: b.emirates_id_path,
              emirates_id_number: b.emirates_id_number || '',
              poa_path: b.poa_path,
            }));
          
          serverAnswers.beneficiaries = validBeneficiaries;
          
          console.log('📋 Loaded beneficiaries from DB:', validBeneficiaries.map(b => ({
            name: b.name,
            passport_path: b.passport_path,
            passport_number: b.passport_number,
            poa_path: b.poa_path,
          })));
          
          // If we cleaned up old data, save it back to database immediately
          if (validBeneficiaries.length !== originalLength) {
            console.log('🧹 Cleaned up old beneficiary data:', originalLength, '→', validBeneficiaries.length);
            (async () => {
              try {
                await supabase
                  .from('wills')
                  .update({ answers: serverAnswers as any })
                  .eq('id', existingWill.id)
                  .select();
                console.log('✅ Saved cleaned beneficiary data');
                
                // Clear localStorage draft after cleanup
                const draftKey = `will_draft_${user.id}_${existingWill.id}`;
                localStorage.removeItem(draftKey);
                console.log('🗑️ Cleared localStorage draft');
              } catch (err: any) {
                console.error('❌ Failed to save cleaned data:', err);
              }
            })();
          }
        }

        // Initialize executor permission to contact
        // Set to true if undefined OR if false but no executors added yet (old default)
        if (typeof serverAnswers.executor_permission_to_contact === 'undefined' ||
            (serverAnswers.executor_permission_to_contact === false &&
             (!serverAnswers.executors || serverAnswers.executors.length === 0))) {
          serverAnswers.executor_permission_to_contact = true;
          console.log('🔄 Migrating executor_permission_to_contact to true (new default)');
        }

        // Ensure trustees array exists
        if (!serverAnswers.trustees) {
          serverAnswers.trustees = [];
        }
        // Initialize trustee permission - migrate old false values if no trustees added
        if (typeof serverAnswers.trustee_permission_to_contact === 'undefined' ||
            (serverAnswers.trustee_permission_to_contact === false &&
             (!serverAnswers.trustees || serverAnswers.trustees.length === 0))) {
          serverAnswers.trustee_permission_to_contact = true;
          console.log('🔄 Migrating trustee_permission_to_contact to true (new default)');
        }
        if (typeof serverAnswers.skip_trustees === 'undefined') {
          serverAnswers.skip_trustees = false;
        }

        // Ensure guardians array exists
        if (!serverAnswers.guardians) {
          serverAnswers.guardians = [];
        }
        // Initialize guardian permission - migrate old false values if no guardians added
        if (typeof serverAnswers.guardian_permission_to_contact === 'undefined' ||
            (serverAnswers.guardian_permission_to_contact === false &&
             (!serverAnswers.guardians || serverAnswers.guardians.length === 0))) {
          serverAnswers.guardian_permission_to_contact = true;
          console.log('🔄 Migrating guardian_permission_to_contact to true (new default)');
        }

        // Migrate old guardians data to new split format
        if (!serverAnswers.interim_guardians || !serverAnswers.permanent_guardians) {
          // If old guardians exist, split them
          if (serverAnswers.guardians && Array.isArray(serverAnswers.guardians) && serverAnswers.guardians.length > 0) {
            // Levels 2-4 become interim guardians (re-indexed to 1-3)
            serverAnswers.interim_guardians = serverAnswers.guardians
              .filter(g => g.level >= 2 && g.level <= 4)
              .map((g, idx) => ({ ...g, level: idx + 1 }));
            
            // Level 1 becomes permanent guardian
            const permanentGuardian = serverAnswers.guardians.find(g => g.level === 1);
            serverAnswers.permanent_guardians = permanentGuardian ? [permanentGuardian] : [];
            
            console.log('🔄 Migrated guardians:', {
              old: serverAnswers.guardians.length,
              interim: serverAnswers.interim_guardians.length,
              permanent: serverAnswers.permanent_guardians.length,
            });
          } else {
            serverAnswers.interim_guardians = [];
            serverAnswers.permanent_guardians = [];
          }
        }

        // Initialize flags - migrate old false values if no guardians added
        if (typeof serverAnswers.interim_guardian_permission_to_contact === 'undefined' ||
            (serverAnswers.interim_guardian_permission_to_contact === false &&
             (!serverAnswers.interim_guardians || serverAnswers.interim_guardians.length === 0))) {
          serverAnswers.interim_guardian_permission_to_contact = true;
          console.log('🔄 Migrating interim_guardian_permission_to_contact to true (new default)');
        }
        if (typeof serverAnswers.permanent_guardian_permission_to_contact === 'undefined' ||
            (serverAnswers.permanent_guardian_permission_to_contact === false &&
             (!serverAnswers.permanent_guardians || serverAnswers.permanent_guardians.length === 0))) {
          serverAnswers.permanent_guardian_permission_to_contact = true;
          console.log('🔄 Migrating permanent_guardian_permission_to_contact to true (new default)');
        }
        if (typeof serverAnswers.skip_permanent_guardians === 'undefined') {
          serverAnswers.skip_permanent_guardians = false;
        }

        // Initialize receipt and disinherit fields
        if (!serverAnswers.receipt_of_will) {
          serverAnswers.receipt_of_will = [];
        }
        if (typeof serverAnswers.no_receipt_persons === 'undefined') {
          serverAnswers.no_receipt_persons = false;
        }
        if (!serverAnswers.disinherit) {
          serverAnswers.disinherit = [];
        }
        if (typeof serverAnswers.no_disinherit_persons === 'undefined') {
          serverAnswers.no_disinherit_persons = false;
        }

        // Initialize family exclusion and letter of wishes fields
        if (!serverAnswers.family_exclusion) {
          serverAnswers.family_exclusion = {
            is_excluding: false,
            details: '',
          };
        }
        if (!serverAnswers.letter_of_wishes) {
          serverAnswers.letter_of_wishes = {
            acknowledged: false,
            notes: 'Informational only',
          };
        }
        
        // Check localStorage for unsaved changes
        const draftKey = `will_draft_${user.id}_${existingWill.id}`;
        const localDraft = localStorage.getItem(draftKey);
        
        let mergedAnswers = serverAnswers;
        if (localDraft) {
          try {
            const parsedDraft = JSON.parse(localDraft);
            const draftTimestamp = parsedDraft._timestamp;
            const serverTimestamp = new Date(existingWill.updated_at).getTime();
            
            // Remove the _timestamp field before using as answers
            const { _timestamp, ...draftAnswers } = parsedDraft;
            
            // Sanitize draft file fields too
            if ((draftAnswers as Answers).identity) {
              if ((draftAnswers as Answers).identity.passport_file && !((draftAnswers as Answers).identity.passport_file instanceof File)) {
                (draftAnswers as Answers).identity.passport_file = null;
              }
              if ((draftAnswers as Answers).identity.poa_file && !((draftAnswers as Answers).identity.poa_file instanceof File)) {
                (draftAnswers as Answers).identity.poa_file = null;
              }
            }
            
            // Clean beneficiaries in draft too
            if ((draftAnswers as Answers).beneficiaries) {
              (draftAnswers as Answers).beneficiaries = (draftAnswers as Answers).beneficiaries
                .filter((b: any) => b.level && b.name && typeof b.percentage === 'number')
                .map((b: any) => ({
                  level: b.level,
                  name: b.name,
                  relationship: b.relationship || '',
                  contact_number: b.contact_number || '',
                  percentage: b.percentage,
                  comments: b.comments || '',
                  identity_docs: b.identity_docs || [],
                  passport_path: b.passport_path,
                  passport_number: b.passport_number || '',
                  poa_path: b.poa_path,
                }));
            }
            
            if (draftTimestamp && draftTimestamp > serverTimestamp) {
              toast({
                title: t('toast:will.draftRecovered'),
                description: t('toast:will.recoveredUnsavedChanges', { date: new Date(draftTimestamp).toLocaleString() }),
              });
              mergedAnswers = draftAnswers as Answers;
            }
          } catch (e) {
            console.error('Failed to parse local draft:', e);
          }
        }
        
        setWillRecord({
          ...existingWill,
          answers: mergedAnswers,
          upload_files: (existingWill.upload_files as any[]) || [],
        });
        setLastSavedAt(existingWill.updated_at);
        setSaveStatus('saved');
      } else {
        // Don't create will automatically - just set null record with initial answers
        // Will be created when user actually saves data for the first time
        console.log('📝 No existing will found. Will be created on first save.');
        setWillRecord(null);
      }
    } catch (error: any) {
      console.error('Error fetching/creating will:', error);
      toast({
        title: t('toast:will.errorLoadingForm'),
        description: error.message || t('toast:will.failedToLoadFormData'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrCreateWill();
  }, [fetchOrCreateWill]);

  // Process offline queue when coming back online
  useEffect(() => {
    if (isOnline && willRecord?.id) {
      const queue = getQueue();
      const pendingSave = queue.find(item => item.willId === willRecord.id);
      
      if (pendingSave) {
        console.log('Processing queued save...');
        forceSave(pendingSave.answers);
        removeFromQueue(willRecord.id);
      }
    }
  }, [isOnline, willRecord?.id]);

  // Debounced autosave function with enhanced error handling
  const updateAnswers = useCallback(
    async (answers: Answers, immediate = false) => {
      if (!user?.id) return;

      // Don't do optimistic update to prevent circular loops
      // The component maintains its own answers state

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const saveToSupabase = async () => {
        let currentWill = willRecord;

        // CRITICAL: Prevent duplicate will creation
        // ALWAYS check database for existing UNSUBMITTED will before creating new one
        // This ensures we UPDATE existing wills instead of creating duplicates
        if (!currentWill) {
          // Step 1: Check database for any unsubmitted will (submitted_at = null)
          console.log('🔍 Checking for existing unsubmitted will for user:', user.id);
          const { data: existingWill } = await supabase
            .from('wills')
            .select('*')
            .eq('user_id', user.id)
            .is('submitted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingWill) {
            console.log('✅ FOUND existing unsubmitted will - will UPDATE it:', {
              id: existingWill.id,
              status: existingWill.status,
              submitted_at: existingWill.submitted_at,
              created_at: existingWill.created_at
            });
            // IMPORTANT: Use current form answers, NOT database answers
            // We're in the middle of saving, so we want to preserve what the user just entered
            currentWill = {
              id: existingWill.id,
              user_id: existingWill.user_id,
              status: existingWill.status,
              answers: answers, // Keep current form data
              upload_files: (existingWill.upload_files as any[]) || [],
              pdf_path: existingWill.pdf_path,
              submitted_at: existingWill.submitted_at,
              created_at: existingWill.created_at,
              updated_at: existingWill.updated_at,
            };
            setWillRecord(currentWill);
            // Continue to save the current changes to this existing will
          } else {
            // Only create if NO existing unsubmitted will found
            try {
              console.log('📝 NO unsubmitted will found - creating NEW will for user:', user.id);
              const { data: newWill, error: createError } = await supabase
                .from('wills')
                .insert({
                  user_id: user.id,
                  status: 'in_progress',
                  answers: {},
                })
                .select()
                .single();

              if (createError) {
                console.error('❌ Error creating will:', createError);
                throw createError;
              }

              console.log('✅ NEW will created successfully:', newWill?.id);
              // IMPORTANT: Use current form answers, NOT initial empty answers
              currentWill = {
                ...newWill,
                answers: answers, // Keep current form data
                upload_files: [],
              };
              setWillRecord(currentWill);
              // Continue to save the current form answers to this new will
            } catch (error: any) {
              console.error('❌ Error creating will:', error);
              toast({
                title: t('toast:will.errorSaving'),
                description: error.message || t('toast:will.failedToCreateWill'),
                variant: 'destructive',
              });
              return;
            }
          }
        } else {
          console.log('✅ Using existing will from state:', willRecord.id);
        }

        // At this point, currentWill must exist (either found or created)
        if (!currentWill?.id) {
          console.error('❌ No will record available for saving');
          return;
        }

        // Check if offline
        if (!isOnline) {
          setSaveStatus('offline');
          queueOfflineSave(currentWill.id, answers);

          // Save to localStorage with timestamp
          const draftKey = `will_draft_${user.id}_${currentWill.id}`;
          localStorage.setItem(draftKey, JSON.stringify({
            ...answers,
            _timestamp: Date.now(),
          }));
          return;
        }

        try {
          setSaving(true);
          setSaveStatus('saving');
          setSaveError(null);

          // Sanitize answers before saving - remove File objects and ensure null instead of empty objects
          const sanitizedAnswers = {
            ...answers,
            identity: {
              ...answers.identity,
              passport_file: null, // Never save File objects to DB
              poa_file: null, // Never save File objects to DB
            },
            _visited_steps: (answers as any)._visited_steps || [], // Preserve visited steps metadata
          };

          console.log('💾 Updating existing will in DB:', {
            willId: currentWill.id,
            answersSize: JSON.stringify(sanitizedAnswers).length,
            executors: sanitizedAnswers.executors?.map((e: any) => ({
              name: e.name,
              passport_path: e.passport_path,
              passport_number: e.passport_number,
              emirates_id_path: e.emirates_id_path,
              emirates_id_number: e.emirates_id_number,
            })),
            beneficiaries: sanitizedAnswers.beneficiaries?.map((b: any) => ({
              name: b.name,
              passport_path: b.passport_path,
              passport_number: b.passport_number,
              emirates_id_path: b.emirates_id_path,
              emirates_id_number: b.emirates_id_number,
            })),
          });

          const { data, error } = await supabase
            .from('wills')
            .update({
              answers: sanitizedAnswers as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentWill.id)
            .select('updated_at')
            .single();

          if (error) {
            console.error('❌ Save failed:', error);
            throw error;
          }

          console.log('✅ Save successful:', data.updated_at);

          setSaving(false);
          setSaveStatus('saved');
          setLastSavedAt(data.updated_at);
          retryCountRef.current = 0;

          // Update localStorage after successful save
          const draftKey = `will_draft_${user.id}_${currentWill.id}`;
          localStorage.setItem(draftKey, JSON.stringify({
            ...answers,
            _timestamp: Date.now(),
          }));
        } catch (error: any) {
          console.error('Error saving will:', error);
          setSaving(false);
          setSaveStatus('error');
          setSaveError(error.message || t('failedToSave'));

          // Retry with exponential backoff
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const backoffDelay = Math.pow(2, retryCountRef.current) * 1000;
            console.log(`Retrying save in ${backoffDelay}ms...`);
            
            setTimeout(() => {
              saveToSupabase();
            }, backoffDelay);
          } else {
            toast({
              title: t('toast:will.saveFailed'),
              description: t('toast:will.changesStoredLocally'),
              variant: 'destructive',
            });
          }
        }
      };

      if (immediate) {
        await saveToSupabase();
      } else {
        // Debounce: save after 500ms of no changes
        saveTimeoutRef.current = setTimeout(saveToSupabase, 500);
      }
    },
    [willRecord?.id, user?.id, isOnline]
  );

  // Force immediate save (bypasses debounce)
  const forceSave = useCallback(
    async (answers: Answers) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await updateAnswers(answers, true);
    },
    [updateAnswers]
  );

  // Retry failed save
  const retrySave = useCallback(() => {
    if (willRecord?.answers) {
      retryCountRef.current = 0;
      forceSave(willRecord.answers);
    }
  }, [willRecord?.answers, forceSave]);

  // Submit will
  const submitWill = useCallback(
    async (answers: Answers) => {
      if (!willRecord?.id) return;

      try {
        setSaving(true);

        // Sanitize answers before submitting - remove File objects
        const sanitizedAnswers = {
          ...answers,
          identity: {
            ...answers.identity,
            passport_file: null,
            poa_file: null,
          },
        };

        const { error } = await supabase
          .from('wills')
          .update({
            answers: sanitizedAnswers as any,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Keep status as 'in_progress' - submitted_at is what marks it as submitted
            // Admin will change status manually (awaiting_review, under_review, etc.)
          })
          .eq('id', willRecord.id);

        if (error) throw error;

        toast({
          title: t('toast:will.willSubmitted'),
          description: t('toast:will.willSubmittedSuccess'),
        });

        return true;
      } catch (error: any) {
        console.error('Error submitting will:', error);
        toast({
          title: t('toast:will.submissionFailed'),
          description: error.message || t('toast:will.failedToSubmitWill'),
          variant: 'destructive',
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [willRecord?.id]
  );

  // Update file metadata
  const updateFileMetadata = useCallback(
    async (metadata: FileMetadata) => {
      if (!willRecord?.id) return;

      try {
        const currentFiles = willRecord.upload_files || [];
        const existingIndex = currentFiles.findIndex(
          (f: FileMetadata) => f.type === metadata.type
        );

        let updatedFiles;
        if (existingIndex >= 0) {
          updatedFiles = [...currentFiles];
          updatedFiles[existingIndex] = metadata;
        } else {
          updatedFiles = [...currentFiles, metadata];
        }

        const { error } = await supabase
          .from('wills')
          .update({
            upload_files: updatedFiles as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', willRecord.id);

        if (error) throw error;

        setWillRecord((prev) => (prev ? { ...prev, upload_files: updatedFiles } : null));
      } catch (error: any) {
        console.error('Error updating file metadata:', error);
        toast({
          title: t('toast:will.updateFailed'),
          description: t('toast:will.failedToSaveFileMetadata'),
          variant: 'destructive',
        });
      }
    },
    [willRecord?.id, willRecord?.upload_files]
  );

  // Update upload files array (used for beneficiary docs)
  const updateUploadFiles = useCallback(
    async (uploadFiles: any[]) => {
      if (!willRecord?.id) return;

      try {
        const { error } = await supabase
          .from('wills')
          .update({
            upload_files: uploadFiles as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', willRecord.id);

        if (error) throw error;

        setWillRecord((prev) => (prev ? { ...prev, upload_files: uploadFiles } : null));
      } catch (error: any) {
        console.error('Error updating upload files:', error);
        toast({
          title: t('toast:will.updateFailed'),
          description: t('toast:will.failedToUpdateUploadFiles'),
          variant: 'destructive',
        });
      }
    },
    [willRecord?.id]
  );

  // Remove file metadata
  const removeFileMetadata = useCallback(
    async (type: 'passport' | 'poa') => {
      if (!willRecord?.id) return;

      try {
        const currentFiles = willRecord.upload_files || [];
        const updatedFiles = currentFiles.filter((f: FileMetadata) => f.type !== type);

        const { error } = await supabase
          .from('wills')
          .update({
            upload_files: updatedFiles as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', willRecord.id);

        if (error) throw error;

        setWillRecord((prev) => (prev ? { ...prev, upload_files: updatedFiles } : null));
      } catch (error: any) {
        console.error('Error removing file metadata:', error);
        toast({
          title: t('toast:will.removeFailed'),
          description: t('toast:will.failedToRemoveFileMetadata'),
          variant: 'destructive',
        });
      }
    },
    [willRecord?.id, willRecord?.upload_files]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    willRecord,
    loading,
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
    removeFileMetadata,
    refetch: fetchOrCreateWill,
  };
}
