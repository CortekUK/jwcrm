"use client";

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';
import type { FileMetadata, BeneficiaryIdentityDoc, UserIdentityDocument } from '@/types/will-form';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

interface UseFileUploadReturn {
  uploading: boolean;
  progress: number;
  error: string | null;
  uploadFile: (file: File, type: 'passport' | 'poa', userId: string, willId: string) => Promise<FileMetadata | null>;
  uploadBeneficiaryFile: (file: File, beneficiaryIndex: number, userId: string, willId: string) => Promise<BeneficiaryIdentityDoc | null>;
  uploadUserIdentityDocument: (file: File, userId: string, docType: 'passport' | 'visa' | 'emirates_id') => Promise<{ path: string; name: string; size: number; mime: string } | null>;
  getUserDocuments: (userId: string) => Promise<UserIdentityDocument[]>;
  deleteUserDocument: (documentId: string, path: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  getSignedUrl: (path: string, expiresIn?: number, bucket?: string) => Promise<string | null>;
}

export function useFileUpload(): UseFileUploadReturn {
  const { t } = useTranslation(['form', 'toast']);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sanitizeFilename = (filename: string): string => {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .replace(/_+/g, '_');
  };

  const uploadFile = async (
    file: File,
    type: 'passport' | 'poa',
    userId: string,
    willId: string
  ): Promise<FileMetadata | null> => {
    try {
      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        const errorMsg = t('pleaseUploadValidFile');
        setError(errorMsg);
        toast({
          title: t('toast:upload.invalidFileType'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = t('fileSizeMustBeLess');
        setError(errorMsg);
        toast({
          title: t('toast:upload.fileTooLarge'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      // Build storage path with timestamp: wills/willId/type-timestamp.ext
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const filename = `${type}-${timestamp}.${ext}`;
      const path = `wills/${willId}/${filename}`;

      // Upload to Supabase Storage
      console.log('📤 Uploading file to:', path);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wills')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false, // Create new file each time (no replacement)
        });

      if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData);
      setProgress(100);

      // Build metadata
      const metadata: FileMetadata = {
        type,
        path,
        name: file.name,
        size: file.size,
        mime: file.type,
        uploaded_at: new Date().toISOString(),
      };

      setUploading(false);
      return metadata;
    } catch (err: any) {
      console.error('Error uploading file:', err);
      const errorMsg = err.message || 'Failed to upload file';
      setError(errorMsg);
      toast({
        title: 'Upload Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      setUploading(false);
      return null;
    }
  };

  const deleteFile = async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage.from('wills').remove([path]);
      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Error deleting file:', err);
      toast({
        title: 'Delete Failed',
        description: err.message || 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getSignedUrl = async (path: string, expiresIn = 3600, bucket = 'wills'): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (err: any) {
      console.error('Error getting signed URL:', err);
      return null;
    }
  };

  const uploadBeneficiaryFile = async (
    file: File,
    beneficiaryIndex: number,
    userId: string,
    willId: string
  ): Promise<BeneficiaryIdentityDoc | null> => {
    try {
      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        const errorMsg = t('pleaseUploadValidFile');
        setError(errorMsg);
        toast({
          title: t('toast:upload.invalidFileType'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = t('fileSizeMustBeLess');
        setError(errorMsg);
        toast({
          title: t('toast:upload.fileTooLarge'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      // Build simplified storage path: wills/willId/beneficiary-X-timestamp.ext
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `beneficiary-${beneficiaryIndex}-${timestamp}.${ext}`;
      const path = `wills/${willId}/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('wills')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false, // Don't replace - use timestamp for uniqueness
        });

      if (uploadError) throw uploadError;

      setProgress(100);

      // Build metadata
      const metadata: BeneficiaryIdentityDoc = {
        type: 'passport', // Default type
        path,
        name: file.name,
        size: file.size,
        mime: file.type,
        uploaded_at: new Date().toISOString(),
      };

      setUploading(false);
      return metadata;
    } catch (err: any) {
      console.error('Error uploading beneficiary file:', err);
      const errorMsg = err.message || 'Failed to upload file';
      setError(errorMsg);
      toast({
        title: 'Upload Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      setUploading(false);
      return null;
    }
  };

  const uploadUserIdentityDocument = async (
    file: File,
    userId: string,
    docType: 'passport' | 'visa' | 'emirates_id'
  ): Promise<{ path: string; name: string; size: number; mime: string } | null> => {
    try {
      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        const errorMsg = t('pleaseUploadValidFile');
        setError(errorMsg);
        toast({
          title: t('toast:upload.invalidFileType'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = t('fileSizeMustBeLess');
        setError(errorMsg);
        toast({
          title: t('toast:upload.fileTooLarge'),
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      // Build storage path: user-documents/userId/docType-timestamp.ext
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${docType}-${timestamp}.${ext}`;
      const path = `user-documents/${userId}/${filename}`;

      console.log('📤 Uploading user document to:', path);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('wills')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        throw uploadError;
      }

      console.log('✅ User document upload successful');
      setProgress(100);
      setUploading(false);

      return {
        path,
        name: file.name,
        size: file.size,
        mime: file.type,
      };
    } catch (err: any) {
      console.error('Error uploading user document:', err);
      const errorMsg = err.message || 'Failed to upload document';
      setError(errorMsg);
      toast({
        title: 'Upload Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      setUploading(false);
      return null;
    }
  };

  const getUserDocuments = async (userId: string): Promise<UserIdentityDocument[]> => {
    try {
      const { data, error } = await supabase
        .from('user_identity_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (err: any) {
      console.error('Error fetching user documents:', err);
      return [];
    }
  };

  const deleteUserDocument = async (documentId: string, path: string): Promise<boolean> => {
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('wills')
        .remove([path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_identity_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      return true;
    } catch (err: any) {
      console.error('Error deleting user document:', err);
      toast({
        title: 'Delete Failed',
        description: err.message || 'Failed to delete document',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    uploading,
    progress,
    error,
    uploadFile,
    uploadBeneficiaryFile,
    uploadUserIdentityDocument,
    getUserDocuments,
    deleteUserDocument,
    deleteFile,
    getSignedUrl,
  };
}
