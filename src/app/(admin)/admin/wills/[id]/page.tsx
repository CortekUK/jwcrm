"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusTimeline";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  Upload,
  FileCheck,
  Activity,
  RefreshCw,
  Calendar,
  Mail,
  Phone,
  User,
  MapPin,
  Users,
  Gift,
  Building2,
  Eye,
  Printer,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  XCircle,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { WillStatusHistory } from "@/components/admin/WillStatusHistory";
import { ImageThumbnail } from "@/components/admin/ImageThumbnail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { textAlign } from "@/lib/rtl-utils";

type WillStatus = Database["public"]["Enums"]["will_status"];

const ASSET_TYPES = [
  { value: 'property', label: 'Property' },
  { value: 'bank', label: 'Bank Account' },
  { value: 'investments', label: 'Investments' },
  { value: 'business', label: 'Business' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'personal', label: 'Personal Items' },
];

// Component to display client approval image with authenticated URL
function ClientApprovalImage({ imagePath }: { imagePath: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadImage() {
      try {
        const { data, error: fetchError } = await supabase.storage
          .from('change-requests')
          .download(imagePath);

        if (fetchError) throw fetchError;

        const url = URL.createObjectURL(data);
        setImageUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        setLoading(false);
      }
    }

    loadImage();

    // Cleanup
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imagePath]);

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-md border border-[#E6E6E4]">
        <p className="text-xs font-semibold text-[#777777] mb-2 uppercase tracking-wide">Attached Image:</p>
        <div className="flex items-center justify-center h-32 bg-gray-50 rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="p-4 bg-white rounded-md border border-[#E6E6E4]">
        <p className="text-xs font-semibold text-[#777777] mb-2 uppercase tracking-wide">Attached Image:</p>
        <div className="flex items-center justify-center h-32 bg-gray-50 rounded-md border border-dashed border-gray-300">
          <p className="text-sm text-gray-400">Image not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-md border border-[#E6E6E4]">
      <p className="text-xs font-semibold text-[#777777] mb-2 uppercase tracking-wide">Attached Image:</p>
      <img
        src={imageUrl}
        alt="Client change request"
        className="w-full max-w-2xl h-auto max-h-[300px] object-contain rounded-md border border-[#E6E6E4]"
      />
    </div>
  );
}

// Component to display asset photo with public URL
function AssetPhotoDisplay({
  photoPath,
  title,
  className
}: {
  photoPath: string;
  title?: string;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadImage() {
      try {
        // Try to get public URL first
        const { data: { publicUrl } } = supabase.storage
          .from('will-documents')
          .getPublicUrl(photoPath);

        // Test if the image is accessible
        const img = new Image();
        img.onload = () => {
          setImageUrl(publicUrl);
          setLoading(false);
        };
        img.onerror = () => {
          // If public URL fails, try downloading with authentication
          downloadImage();
        };
        img.src = publicUrl;
      } catch (err) {
        console.error('Error loading asset photo:', err);
        setError(true);
        setLoading(false);
      }
    }

    async function downloadImage() {
      try {
        const { data, error: fetchError } = await supabase.storage
          .from('will-documents')
          .download(photoPath);

        if (fetchError) throw fetchError;

        const url = URL.createObjectURL(data);
        setImageUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error downloading asset photo:', err);
        setError(true);
        setLoading(false);
      }
    }

    loadImage();

    // Cleanup
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [photoPath]);

  if (loading) {
    return (
      <div className={className || "flex-shrink-0 flex items-center justify-center w-24 h-24 bg-gray-50 rounded-lg border border-[hsl(var(--jw-gold-accent))]/20"}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={className || "flex-shrink-0 flex items-center justify-center w-24 h-24 bg-gray-50 rounded-lg border border-[hsl(var(--jw-gold-accent))]/20"}>
        <p className="text-xs text-gray-400">Failed to load</p>
      </div>
    );
  }

  return (
    <div className={className || "flex-shrink-0"}>
      <img
        src={imageUrl}
        alt={title || 'Asset photo'}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export default function AdminWillDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation(["admin", "common"]);
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';
  const [newStatus, setNewStatus] = useState<WillStatus | "">("");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [notes, setNotes] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [regeneratingPdf, setRegeneratingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [sendingExecutorEmails, setSendingExecutorEmails] = useState(false);
  const [sendingBeneficiaryEmails, setSendingBeneficiaryEmails] = useState(false);
  const [sendingTrusteeEmails, setSendingTrusteeEmails] = useState(false);
  const [sendingInterimGuardianEmails, setSendingInterimGuardianEmails] = useState(false);
  const [sendingPermanentGuardianEmails, setSendingPermanentGuardianEmails] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string | null | undefined): string => {
    if (!str) return "N/A";
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Edit states for each card
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingExecutors, setEditingExecutors] = useState(false);
  const [editingTrustees, setEditingTrustees] = useState(false);
  const [editingInterimGuardians, setEditingInterimGuardians] = useState(false);
  const [editingPermanentGuardians, setEditingPermanentGuardians] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [editingDisinherit, setEditingDisinherit] = useState(false);
  const [editingBeneficiaries, setEditingBeneficiaries] = useState(false);
  const [editingGeneralBeneficiaries, setEditingGeneralBeneficiaries] = useState(false);
  const [editingAssets, setEditingAssets] = useState(false);
  const [editingSpecialRequests, setEditingSpecialRequests] = useState(false);

  // Edit form data
  const [editedPersonal, setEditedPersonal] = useState<any>(null);
  const [editedExecutors, setEditedExecutors] = useState<any>(null);
  const [editedTrustees, setEditedTrustees] = useState<any>(null);
  const [editedInterimGuardians, setEditedInterimGuardians] = useState<any>(null);
  const [editedPermanentGuardians, setEditedPermanentGuardians] = useState<any>(null);
  const [editedReceipt, setEditedReceipt] = useState<any>(null);
  const [editedDisinherit, setEditedDisinherit] = useState<any>(null);
  const [editedBeneficiaries, setEditedBeneficiaries] = useState<any>(null);
  const [editedGeneralBeneficiaries, setEditedGeneralBeneficiaries] = useState<any>(null);
  const [editedAssets, setEditedAssets] = useState<any>(null);
  const [editedSpecialRequests, setEditedSpecialRequests] = useState<any>(null);

  const { data: will, isLoading } = useQuery({
    queryKey: ["admin-will-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No will ID provided");

      const { data: willData, error } = await supabase
        .from("wills")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch profile separately
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, locale")
        .eq("user_id", willData.user_id)
        .single();

      return {
        ...willData,
        profile: profileData,
        client_approval_status: willData.client_approval_status as "approved" | "disapproved" | null,
        client_approval_at: willData.client_approval_at,
        client_approval_comments: willData.client_approval_comments,
      };
    },
  });

  // Amendment history: every draft PDF uploaded for this will
  const { data: docVersions } = useQuery({
    queryKey: ["will-doc-versions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("will_document_versions")
        .select("*")
        .eq("will_id", id)
        .order("version_number", { ascending: false });
      return (data || []) as Array<{
        id: string;
        version_number: number;
        pdf_path: string;
        created_at: string;
      }>;
    },
  });

  const openVersionPdf = async (pdfPath: string) => {
    const { data } = await supabase.storage
      .from("wills")
      .createSignedUrl(pdfPath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleSendExecutorEmails = async () => {
    if (!will || !id) return;

    const answers = will.answers as any;
    if (!answers.executors || answers.executors.length === 0) {
      toast({
        title: t('toast:admin.noExecutorsFound'),
        description: t('toast:admin.noExecutorsToContact'),
        variant: "destructive",
      });
      return;
    }

    setSendingExecutorEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      // Call edge function to send emails to executors
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/notify-executors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            willId: id,
            clientName: will.profile?.full_name || 'Client',
            executors: answers.executors,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      const result = await response.json();
      console.log('Executor notification emails sent:', result);

      toast({
        title: t('toast:admin.emailSentSuccessfully'),
        description: t('toast:admin.notificationEmailSent'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      console.error('Error sending executor emails:', error);
      toast({
        title: t('toast:admin.failedToSendEmails'),
        description: error.message || t('toast:admin.couldNotSendNotificationEmails'),
        variant: "destructive",
      });
    } finally {
      setSendingExecutorEmails(false);
    }
  };

  const handleSendTrusteeEmails = async () => {
    if (!will || !id) return;

    const answers = will.answers as any;
    if (!answers.trustees || answers.trustees.length === 0) {
      toast({
        title: "No Trustees Found",
        description: "There are no trustees to contact.",
        variant: "destructive",
      });
      return;
    }

    setSendingTrusteeEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/notify-executors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            willId: id,
            clientName: will.profile?.full_name || 'Client',
            persons: answers.trustees,
            role: 'trustee',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      const result = await response.json();
      console.log('Trustee notification emails sent:', result);

      toast({
        title: t('toast:admin.emailSentSuccessfully'),
        description: t('toast:admin.notificationEmailSent'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      console.error('Error sending trustee emails:', error);
      toast({
        title: t('toast:admin.failedToSendEmails'),
        description: error.message || t('toast:admin.couldNotSendNotificationEmails'),
        variant: "destructive",
      });
    } finally {
      setSendingTrusteeEmails(false);
    }
  };

  const handleSendInterimGuardianEmails = async () => {
    if (!will || !id) return;

    const answers = will.answers as any;
    if (!answers.interim_guardians || answers.interim_guardians.length === 0) {
      toast({
        title: "No Interim Guardians Found",
        description: "There are no interim guardians to contact.",
        variant: "destructive",
      });
      return;
    }

    setSendingInterimGuardianEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/notify-executors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            willId: id,
            clientName: will.profile?.full_name || 'Client',
            persons: answers.interim_guardians,
            role: 'interim_guardian',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      const result = await response.json();
      console.log('Interim guardian notification emails sent:', result);

      toast({
        title: t('toast:admin.emailSentSuccessfully'),
        description: t('toast:admin.notificationEmailSent'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      console.error('Error sending interim guardian emails:', error);
      toast({
        title: t('toast:admin.failedToSendEmails'),
        description: error.message || t('toast:admin.couldNotSendNotificationEmails'),
        variant: "destructive",
      });
    } finally {
      setSendingInterimGuardianEmails(false);
    }
  };

  const handleSendPermanentGuardianEmails = async () => {
    if (!will || !id) return;

    const answers = will.answers as any;
    if (!answers.permanent_guardians || answers.permanent_guardians.length === 0) {
      toast({
        title: "No Permanent Guardians Found",
        description: "There are no permanent guardians to contact.",
        variant: "destructive",
      });
      return;
    }

    setSendingPermanentGuardianEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyikimtqsasryewwawgs.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/notify-executors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            willId: id,
            clientName: will.profile?.full_name || 'Client',
            persons: answers.permanent_guardians,
            role: 'permanent_guardian',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      const result = await response.json();
      console.log('Permanent guardian notification emails sent:', result);

      toast({
        title: t('toast:admin.emailSentSuccessfully'),
        description: t('toast:admin.notificationEmailSent'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      console.error('Error sending permanent guardian emails:', error);
      toast({
        title: t('toast:admin.failedToSendEmails'),
        description: error.message || t('toast:admin.couldNotSendNotificationEmails'),
        variant: "destructive",
      });
    } finally {
      setSendingPermanentGuardianEmails(false);
    }
  };

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      if (!id || !user || !will) throw new Error("Missing required data");

      if (!noteText.trim()) {
        throw new Error("Note cannot be empty");
      }

      // Insert note as a status event (same status, just a note)
      const { error: eventError } = await supabase
        .from("will_status_events")
        .insert({
          will_id: id,
          previous_status: will.status,
          new_status: will.status, // Same status
          actor_user_id: user.id,
          notes: noteText.trim(),
        });

      if (eventError) throw eventError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-will-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["will-status-history", id] });
      toast({
        title: t('toast:admin.noteAdded'),
        description: t('toast:admin.noteAddedSuccessfully'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
      setActivityNotes("");
    },
    onError: (error) => {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToAddNote', { error: error.message }),
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      notes,
    }: {
      status: WillStatus;
      notes: string;
    }) => {
      if (!id || !user) throw new Error("Missing required data");

      // Validation: When moving to draft_released, check PDF exists (regardless of current status)
      if (status === 'draft_released') {
        if (!will?.pdf_path) {
          throw new Error("Cannot release draft: No PDF uploaded. Please upload a PDF first.");
        }
        // Reviewer gate: a draft must be reviewed (marked Draft Ready) before it
        // can be released to the client.
        const reviewed = Boolean((will as any)?.reviewed_at) || will?.status === 'draft_ready';
        if (!reviewed) {
          throw new Error("Cannot release draft: it must be reviewed and marked 'Draft Ready' first.");
        }
      }

      // Validation: a will can be finalized once a draft document exists.
      if (status === 'finalized') {
        if (!will?.pdf_path) {
          throw new Error("Cannot finalize: No document exists yet. Generate or upload a draft PDF first.");
        }
      }

      // Insert status change event
      const { error: eventError } = await supabase
        .from("will_status_events")
        .insert({
          will_id: id,
          previous_status: will?.status || null,
          new_status: status,
          actor_user_id: user.id,
          notes: notes || null,
        });

      if (eventError) throw eventError;

      // Prepare update object
      const updateData: any = { status };

      // Reviewer gate: when a draft is approved as ready, record who reviewed it,
      // when, and any reviewer notes. This is the "Freya checks the drafter's will"
      // checkpoint that must happen before it can be released to the client.
      if (status === 'draft_ready') {
        updateData.reviewer_user_id = user.id;
        updateData.reviewed_at = new Date().toISOString();
        if (notes) updateData.reviewer_notes = notes;
      }

      // Auto-set visible_to_client + stamp release time when moving to draft_released
      if (status === 'draft_released' && will?.pdf_path) {
        updateData.visible_to_client = true;
        updateData.released_at = new Date().toISOString();
      }

      // Clear client approval when moving away from draft_released
      // This resets the review cycle, including when finalizing
      if (will?.status === 'draft_released' && status !== 'draft_released') {
        updateData.client_approval_status = null;
        updateData.client_approval_at = null;
        updateData.client_approval_comments = null;
      }

      // Update will status
      const { error: updateError } = await supabase
        .from("wills")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-will-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["will-status-history", id] });
      toast({
        title: t('toast:admin.statusUpdatedSuccess'),
        description: t('toast:admin.willStatusUpdatedSuccessfully'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
      setNotes("");
    },
    onError: (error) => {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToUpdateStatus', { error: error.message }),
        variant: "destructive",
      });
    },
  });

  // Mutation to update will answers
  const updateAnswersMutation = useMutation({
    mutationFn: async (updatedAnswers: any) => {
      if (!id) throw new Error("No will ID");

      const { error } = await supabase
        .from("wills")
        .update({
          answers: updatedAnswers,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-will-detail", id] });
      toast({
        title: t('toast:admin.updatedSuccessfully'),
        description: t('toast:admin.changesSaved'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    },
    onError: (error) => {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToUpdate', { error: error.message }),
        variant: "destructive",
      });
    },
  });

  const downloadFile = async (filePath: string, fileName: string, bucket: string = "wills") => {
    setDownloadingFile(filePath);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 600);

      if (error) throw error;
      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = fileName;
        link.click();
      }
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToDownloadFile', { error: error.message }),
        variant: "destructive",
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const viewFile = async (filePath: string, bucket: string = "wills") => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToOpenFile', { error: error.message }),
        variant: "destructive",
      });
    }
  };

  const loadPdfUrl = async () => {
    if (!will?.pdf_path) return;

    try {
      const { data, error } = await supabase.storage
        .from("wills")
        .createSignedUrl(will.pdf_path, 600);

      if (error) throw error;
      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToLoadPdf', { error: error.message }),
        variant: "destructive",
      });
    }
  };

  const regeneratePdf = async () => {
    if (!id) return;

    setRegeneratingPdf(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No session");

      const response = await fetch(
        "https://gyikimtqsasryewwawgs.supabase.co/functions/v1/pdf-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ will_id: id }),
        }
      );

      if (!response.ok) throw new Error("Failed to regenerate PDF");

      toast({
        title: t('toast:admin.pdfGenerationStarted'),
        description: t('toast:admin.generatingPdf'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });

      // Clear current PDF URL
      setPdfUrl(null);

      // Poll for the updated PDF (check every 2 seconds, max 10 times)
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 2000;

      const checkPdfReady = async () => {
        attempts++;

        const { data: updatedWill } = await supabase
          .from("wills")
          .select("pdf_path, pdf_generated_at")
          .eq("id", id)
          .single();

        if (
          updatedWill?.pdf_path &&
          updatedWill.pdf_generated_at !== will?.pdf_generated_at
        ) {
          // New PDF is ready
          await queryClient.invalidateQueries({
            queryKey: ["admin-will-detail", id],
          });

          // Load the new PDF URL
          const { data: urlData } = await supabase.storage
            .from("wills")
            .createSignedUrl(updatedWill.pdf_path, 600);

          if (urlData?.signedUrl) {
            setPdfUrl(urlData.signedUrl);
          }

          toast({
            title: t('toast:admin.pdfGeneratedSuccess'),
            description: t('toast:admin.newPdfReady'),
            className:
              "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
          });

          setRegeneratingPdf(false);
          return true;
        }

        if (attempts < maxAttempts) {
          // Continue polling
          setTimeout(checkPdfReady, pollInterval);
          return false;
        } else {
          // Max attempts reached
          toast({
            title: t('toast:admin.pdfGenerationInProgress'),
            description: t('toast:admin.pleaseWait'),
            className: "bg-[hsl(var(--jw-gold-accent))] text-white",
          });
          setRegeneratingPdf(false);
          return false;
        }
      };

      // Start polling after a short delay
      setTimeout(checkPdfReady, pollInterval);
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToRegeneratePdf', { error: error.message }),
        variant: "destructive",
      });
      setRegeneratingPdf(false);
    }
  };

  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [genJurisdiction, setGenJurisdiction] = useState<"abu_dhabi" | "dubai">(
    ((will as any)?.answers?.jurisdiction as "abu_dhabi" | "dubai") || "abu_dhabi"
  );

  const handleGenerateFromTemplate = async () => {
    if (!id) return;
    setGeneratingDraft(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch(`/api/wills/${id}/generate-draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ jurisdiction: genJurisdiction }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate draft");
      }
      setPdfUrl(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-will-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["will-doc-versions", id] });
      toast({
        title: t('toast:admin.pdfUploadedSuccessfully'),
        description: t('admin:draftGeneratedFromTemplate', 'Draft generated from template'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handlePdfUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !id || !will) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.pleaseUploadPdf'),
        variant: "destructive",
      });
      return;
    }

    setUploadingPdf(true);
    try {
      // If status is not finalized, add watermark before uploading
      let fileToUpload = file;

      if (will.status !== 'finalized') {
        console.log('📝 Adding JUST WILLS watermark to PDF (status:', will.status, ')');

        try {
          // Dynamically import pdf-lib
          const { PDFDocument, rgb, degrees } = await import('pdf-lib');

          // Read the file as array buffer
          const arrayBuffer = await file.arrayBuffer();

          // Load the PDF
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPages();

          // Add watermark to each page
          for (const page of pages) {
            const { width, height } = page.getSize();

            // Draw diagonal "JUST WILLS" watermark with gold color (bottom-left to top-right)
            page.drawText('JUST WILLS', {
              x: width / 2 - 200,
              y: height / 2 - 100,
              size: 120,
              color: rgb(0.776, 0.627, 0.231), // #C6A03B gold color
              opacity: 0.08, // Match CSS watermark opacity
              rotate: degrees(45),
            });
          }

          // Save the modified PDF
          const watermarkedPdfBytes = await pdfDoc.save();
          const watermarkedBlob = new Blob([watermarkedPdfBytes], { type: 'application/pdf' });
          fileToUpload = new File([watermarkedBlob], file.name, { type: 'application/pdf' });

          console.log('✅ Watermark added successfully');
        } catch (watermarkError) {
          console.error('⚠️ Error adding watermark:', watermarkError);
          // Continue with original file if watermark fails
          toast({
            title: t('toast:admin.watermarkWarning'),
            description: t('toast:admin.watermarkCouldNotBeAdded'),
            variant: "default",
          });
        }
      }

      // Upload PDF to storage using user_id as folder (to match storage policy)
      const fileName = `${will.user_id}/draft_${Date.now()}.pdf`;
      console.log('📤 Uploading PDF to:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("wills")
        .upload(fileName, fileToUpload, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ PDF uploaded successfully:', uploadData);

      // Update will record with PDF path and make it visible to client
      console.log('💾 Updating database with pdf_path:', fileName);

      const { error: updateError } = await supabase
        .from("wills")
        .update({
          pdf_path: fileName,
          pdf_generated_at: new Date().toISOString(),
          visible_to_client: true,
        })
        .eq("id", id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Database updated successfully');

      // Record this upload as a new document version (amendment history).
      // Old PDFs keep their unique storage path, so every draft stays downloadable.
      try {
        const { data: lastVersion } = await (supabase as any)
          .from("will_document_versions")
          .select("version_number")
          .eq("will_id", id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (lastVersion?.version_number ?? 0) + 1;
        await (supabase as any).from("will_document_versions").insert({
          will_id: id,
          version_number: nextVersion,
          pdf_path: fileName,
          uploaded_by: user?.id ?? null,
        });
      } catch (versionErr) {
        console.error('Could not record document version:', versionErr);
      }

      toast({
        title: t('toast:admin.pdfUploadedSuccessfully'),
        description: t('toast:admin.draftPdfAvailable'),
        className:
          "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });

      // Clear current PDF URL to force reload
      setPdfUrl(null);

      // Invalidate and refetch
      await queryClient.invalidateQueries({
        queryKey: ["admin-will-detail", id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["will-doc-versions", id],
      });

      // Load the new PDF URL
      const { data: urlData } = await supabase.storage
        .from("wills")
        .createSignedUrl(fileName, 600);

      if (urlData?.signedUrl) {
        setPdfUrl(urlData.signedUrl);
      }

      // Reset file input
      event.target.value = "";
    } catch (error: any) {
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToUploadPdf', { error: error.message }),
        variant: "destructive",
      });
    } finally {
      setUploadingPdf(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
    {}
  );

  const isImageFile = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (isImageFile(fileName)) {
      return null; // Will show actual thumbnail
    } else if (ext === "pdf") {
      return (
        <FileText className="h-12 w-12 text-[hsl(var(--jw-gold-accent))]" />
      );
    }
    return <FileText className="h-12 w-12 text-[hsl(var(--jw-muted-green))]" />;
  };

  const loadThumbnail = async (filePath: string) => {
    if (thumbnailUrls[filePath]) return thumbnailUrls[filePath];

    try {
      const { data, error } = await supabase.storage
        .from("wills")
        .createSignedUrl(filePath, 600);

      if (error) throw error;
      if (data?.signedUrl) {
        setThumbnailUrls((prev) => ({ ...prev, [filePath]: data.signedUrl }));
        return data.signedUrl;
      }
    } catch (error) {
      console.error("Failed to load thumbnail:", error);
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
    );
  }

  if (!will) {
    return (
      <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Will Not Found</h2>
            <Button onClick={() => router.push("/admin/wills")} className="mt-4">
              <ArrowLeft className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              {t('admin:backToWills')}
            </Button>
          </div>
    );
  }

  const answers = (will.answers as any) || {};
  let uploadFiles = (will.upload_files as any[]) || [];

  // Add asset photos to upload files
  if (answers.assets && Array.isArray(answers.assets)) {
    const assetPhotos = answers.assets
      .filter((asset: any) => asset.photo_path)
      .map((asset: any, index: number) => {
        // Extract file extension from photo_path
        const pathParts = asset.photo_path.split('.');
        const extension = pathParts[pathParts.length - 1] || 'jpg';
        const fileName = asset.title
          ? `${asset.title} - Photo.${extension}`
          : `Asset ${index + 1} - Photo.${extension}`;

        return {
          type: 'asset-photo',
          path: asset.photo_path,
          name: fileName,
          size: 0, // Size not stored in answers
          mime: `image/${extension}`,
          uploaded_at: new Date().toISOString(),
          stepName: 'Step 7: Assets',
          personName: asset.title || `Asset ${index + 1}`,
          bucket: 'will-documents', // Specify the correct bucket
        };
      });
    uploadFiles = [...uploadFiles, ...assetPhotos];
  }

  return (
    <>
        {/* Hero Header */}
        <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 mb-6 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8 animate-fade-in sticky top-0 z-20 backdrop-blur-sm bg-white/90">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/admin/wills")}
                  className="hover:bg-[hsl(var(--jw-primary-green))]/10"
                >
                  <ArrowLeft className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
                </Button>
                <FileText className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
                <h1
                  className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {t('admin:willDetails')}
                </h1>
              </div>
              <p className={`text-sm text-[#777777] ltr:ml-12 rtl:mr-12 ${textAlign(isRtl)}`}>
                {t('admin:reviewAndManageClient')}
              </p>
            </div>
            <StatusBadge status={will.status} className="text-sm px-4 py-1.5" />
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <StatusTimeline currentStatus={will.status} view="admin" />
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Client Card */}
          <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] hover:shadow-[0_4px_12px_rgba(12,85,54,0.12)] transition-all duration-200">
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-medium text-[#777777] flex items-center gap-2 ${textAlign(isRtl)}`}>
                <User className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                {t('admin:client')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-[hsl(var(--jw-gold-accent))]">
                  <AvatarFallback className="bg-[hsl(var(--jw-primary-green))]/10 text-[hsl(var(--jw-primary-green))] font-semibold">
                    {getInitials(will.profile?.full_name || "U")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p
                    className="font-medium text-[hsl(var(--jw-primary-green))]"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {will.profile?.full_name || "N/A"}
                  </p>
                  <p className="text-sm text-[#555555] flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {answers.personal?.email || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps Card */}
          <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] hover:shadow-[0_4px_12px_rgba(12,85,54,0.12)] transition-all duration-200">
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-medium text-[#777777] flex items-center gap-2 ${textAlign(isRtl)}`}>
                <Calendar className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                {t('admin:timestamps')}
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-2 text-sm ${textAlign(isRtl)}`}>
              <div className="flex justify-between pb-2 border-b border-[hsl(var(--jw-gold-accent))]/10">
                <span className="text-[#777777]">{t('admin:created')}:</span>
                <span className="font-medium text-[#222222]">
                  {format(new Date(will.created_at), "MMM d, yyyy")}
                </span>
              </div>
              {will.submitted_at && (
                <div className="flex justify-between pb-2 border-b border-[hsl(var(--jw-gold-accent))]/10">
                  <span className="text-[#777777]">{t('admin:submitted')}:</span>
                  <span className="font-medium text-[#222222]">
                    {format(new Date(will.submitted_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {will.pdf_generated_at && (
                <div className="flex justify-between">
                  <span className="text-[#777777]">PDF Generated:</span>
                  <span className="font-medium text-[#222222]">
                    {format(new Date(will.pdf_generated_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] hover:shadow-[0_4px_12px_rgba(12,85,54,0.12)] transition-all duration-200">
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-medium text-[#777777] ${textAlign(isRtl)}`}>
                {t('admin:quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={will.status}
                onValueChange={(value) => {
                  if (value !== will.status) {
                    updateStatusMutation.mutate({
                      status: value as WillStatus,
                      notes: "",
                    }, {
                      onSuccess: () => {
                        // Switch to overview tab after status change
                        setActiveTab('overview');
                      }
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-full h-[42px] border-[#E6E6E4] focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-2">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="in_progress">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#9E9E9E]" />
                      {t('admin:in_progress')}
                    </span>
                  </SelectItem>
                  <SelectItem value="awaiting_review">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#C6A03B]" />
                      {t('admin:awaiting_review')}
                    </span>
                  </SelectItem>
                  <SelectItem value="under_review">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#557A95]" />
                      {t('admin:under_review')}
                    </span>
                  </SelectItem>
                  <SelectItem value="draft_ready">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0C5536]" />
                      {t('admin:draft_ready')}
                    </span>
                  </SelectItem>
                  <SelectItem value="draft_released" disabled={!will.pdf_path}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#128277]" />
                      {t('admin:draft_released')}
                    </span>
                  </SelectItem>
                  <SelectItem
                    value="finalized"
                    disabled={!will.pdf_path}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#083D29]" />
                      {t('admin:finalized')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full h-[42px] bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))] transition-all duration-150 font-medium"
                style={{ boxShadow: "none" }}
                onClick={() => router.push(`/admin/wills/${id}/print`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 8px rgba(198,160,59,0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <Printer className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                {t('admin:generatePdf')}
              </Button>

              {/* Generate the will draft from the JW legal template */}
              <div className="mt-3 rounded-md border border-[#EAEAE8] bg-white p-3">
                <p className="text-xs font-semibold text-[hsl(var(--jw-primary-green))] mb-2">
                  {t('admin:generateFromTemplate', 'Generate Draft from Template')}
                </p>
                <Select
                  value={genJurisdiction}
                  onValueChange={(v) => setGenJurisdiction(v as "abu_dhabi" | "dubai")}
                >
                  <SelectTrigger className="h-9 text-sm mb-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abu_dhabi">{t('admin:abuDhabiTemplate', 'Abu Dhabi template')}</SelectItem>
                    <SelectItem value="dubai">{t('admin:dubaiTemplate', 'Dubai template')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="w-full h-9 border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[rgba(12,85,54,0.06)]"
                  disabled={generatingDraft}
                  onClick={handleGenerateFromTemplate}
                >
                  {generatingDraft ? (
                    <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                  )}
                  {t('admin:generateDraft', 'Generate Draft')}
                </Button>
              </div>

              {/* Reviewer checkpoint info (Freya's review before release) */}
              {(will as any)?.reviewed_at && (
                <div className="mt-3 rounded-md border border-[#EAEAE8] bg-[#FAFAF8] p-3 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-[hsl(var(--jw-primary-green))]">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('admin:reviewedBy', 'Reviewed')}
                  </div>
                  <p className="mt-1 text-[#777777]">
                    {format(new Date((will as any).reviewed_at), "PPP 'at' h:mm a")}
                  </p>
                  {(will as any)?.reviewer_notes && (
                    <p className="mt-1 text-[#444444] whitespace-pre-wrap">
                      {(will as any).reviewer_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Amendment history: previous draft versions */}
              {docVersions && docVersions.length > 0 && (
                <div className="mt-3 rounded-md border border-[#EAEAE8] bg-white p-3 text-xs">
                  <div className="font-semibold text-[hsl(var(--jw-primary-green))] mb-2">
                    {t('admin:versionHistory', 'Draft Version History')}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {docVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => openVersionPdf(v.pdf_path)}
                        className="flex items-center justify-between gap-2 text-left hover:text-[hsl(var(--jw-primary-green))]"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          {t('admin:versionLabel', { defaultValue: 'v{{n}}', n: v.version_number })}
                        </span>
                        <span className="text-[#999999]">
                          {format(new Date(v.created_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Review Card - Shown only if client has reviewed */}
        {will.client_approval_status && (
          <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] mb-6">
            <CardContent className={`p-6 rounded-lg border-2 ${
              will.client_approval_status === 'approved'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${
                  will.client_approval_status === 'approved'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}>
                  {will.client_approval_status === 'approved' ? (
                    <ThumbsUp className="h-7 w-7 text-green-600" />
                  ) : (
                    <ThumbsDown className="h-7 w-7 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold mb-2 ${
                    will.client_approval_status === 'approved'
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}>
                    {will.client_approval_status === 'approved'
                      ? t('clientApproval.clientHasApproved')
                      : t('clientApproval.clientHasRequestedChanges')}
                  </h3>
                  <p className="text-sm text-[#555555] mb-4">
                    {t('clientApproval.reviewedOn')} {will.client_approval_at
                      ? format(new Date(will.client_approval_at), "MMMM d, yyyy 'at' h:mm a")
                      : "N/A"}
                  </p>

                  {/* Client Comments or View Details Button */}
                  {will.client_approval_status === 'approved' ? (
                    // Show comments for approved
                    will.client_approval_comments && (
                      <div className="mt-3 p-4 bg-white rounded-md border border-[#E6E6E4]">
                        <p className="text-xs font-semibold text-[#777777] mb-2 uppercase tracking-wide">Client Comments:</p>
                        <p className="text-sm text-[#222222] leading-relaxed">{will.client_approval_comments}</p>
                      </div>
                    )
                  ) : (
                    // Show "View Details" button for disapproved
                    <Button
                      variant="outline"
                      onClick={() => setShowChangeRequestDialog(true)}
                      className="mt-3 border-red-200 hover:bg-red-50"
                    >
                      <FileText className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t('clientApproval.viewChangeRequestDetails')}
                    </Button>
                  )}

                  {/* Client Info and Action Button */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-6 text-sm text-[#777777]">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                        <span className="font-medium">{will.profile?.full_name || "Client"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                        <span>
                          {will.client_approval_at
                            ? format(new Date(will.client_approval_at), "PPP 'at' h:mm a")
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons - Only show if NOT approved */}
                    {will.client_approval_status !== 'approved' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 hover:bg-white/50"
                          onClick={() => {
                            // Change status to under_review first
                            updateStatusMutation.mutate({
                              status: 'under_review',
                              notes: 'Admin editing will based on client feedback',
                            }, {
                              onSuccess: () => {
                                // Switch to overview tab after status change
                                setActiveTab('overview');
                              }
                            });
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#777777]" />
                          ) : (
                            <Pencil className="h-4 w-4 text-[#777777]" />
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            updateStatusMutation.mutate({
                              status: 'under_review',
                              notes: 'Status changed to Under Review based on client feedback',
                            }, {
                              onSuccess: () => {
                                // Switch to overview tab after status change
                                setActiveTab('overview');
                              }
                            });
                          }}
                          disabled={updateStatusMutation.isPending || will.status === 'under_review'}
                          className="bg-[#557A95] hover:bg-[#557A95]/90 text-white h-9 px-4 text-sm font-medium"
                        >
                          {updateStatusMutation.isPending ? (
                            <>
                              <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                              {t('clientApproval.updating')}
                            </>
                          ) : (
                            <>
                              <RefreshCw className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                              {t('clientApproval.moveToUnderReview')}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="sticky top-[145px] z-10 bg-white/95 backdrop-blur-sm -mx-6 lg:-mx-8 border-b border-[hsl(var(--jw-gold-accent))]/25 shadow-sm">
            <TabsList className="grid w-full grid-cols-4 bg-transparent border-none rounded-none h-auto p-0 gap-0 px-6 lg:px-8">
              <TabsTrigger
                value="overview"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--jw-primary-green))] data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--jw-gold-accent))] data-[state=active]:font-bold rounded-none text-[#777777] hover:text-[hsl(var(--jw-primary-green))] transition-all duration-200 py-4 px-4 mx-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "14px" }}
              >
                <FileText className="h-4 w-4" />
                {t('admin:overview')}
              </TabsTrigger>
              <TabsTrigger
                value="uploads"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--jw-primary-green))] data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--jw-gold-accent))] data-[state=active]:font-bold rounded-none text-[#777777] hover:text-[hsl(var(--jw-primary-green))] transition-all duration-200 py-4 px-4 mx-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "14px" }}
              >
                <Upload className="h-4 w-4" />
                {t('admin:uploads')}
              </TabsTrigger>
              <TabsTrigger
                value="pdf"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--jw-primary-green))] data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--jw-gold-accent))] data-[state=active]:font-bold rounded-none text-[#777777] hover:text-[hsl(var(--jw-primary-green))] transition-all duration-200 py-4 px-4 mx-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "14px" }}
              >
                <FileCheck className="h-4 w-4" />
                {will?.status === 'finalized' ? t('admin:finalPdf') : t('admin:draftPdf')}
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--jw-primary-green))] data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--jw-gold-accent))] data-[state=active]:font-bold rounded-none text-[#777777] hover:text-[hsl(var(--jw-primary-green))] transition-all duration-200 py-4 px-4 mx-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "14px" }}
              >
                <Activity className="h-4 w-4" />
                {t('admin:activity')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Personal Details */}
              {answers.personal && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:personalDetails')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingPersonal) {
                            setEditedPersonal(answers.personal);
                          }
                          setEditingPersonal(!editingPersonal);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 pb-5">
                    {!editingPersonal ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                        <div>
                          <p className={`text-[#777777] text-[12px] mb-0.5 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            {t('admin:fullName')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] ${textAlign(isRtl)}`}>
                            {capitalizeWords(answers.personal.full_name)}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[#777777] text-[12px] mb-0.5 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            {t('admin:religion')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] ${textAlign(isRtl)}`}>
                            {capitalizeWords(answers.personal.religion)}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[#777777] text-[12px] mb-0.5 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            {t('admin:maritalStatus')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] ${textAlign(isRtl)}`}>
                            {capitalizeWords(answers.personal.marital_status)}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[#777777] text-[12px] mb-0.5 flex items-center gap-1 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            <Mail className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                            {t('admin:email')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] truncate ${textAlign(isRtl)}`} title={answers.personal.email}>
                            {answers.personal.email || t('admin:notAvailable')}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[#777777] text-[12px] mb-0.5 flex items-center gap-1 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            <Phone className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                            {t('admin:phone')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] ${textAlign(isRtl)}`}>
                            {answers.personal.contact_number || t('admin:notAvailable')}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className={`text-[#777777] text-[12px] mb-0.5 flex items-center gap-1 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                            <MapPin className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                            {t('admin:address')}
                          </p>
                          <p className={`font-medium text-[#222222] text-[14px] leading-snug ${textAlign(isRtl)}`}>
                            {answers.personal.address || t('admin:notAvailable')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="full_name" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:fullName')}</Label>
                            <input
                              id="full_name"
                              type="text"
                              value={editedPersonal?.full_name || ""}
                              onChange={(e) => setEditedPersonal({...editedPersonal, full_name: e.target.value})}
                              className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                          </div>
                          <div>
                            <Label htmlFor="religion" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:religion')}</Label>
                            <input
                              id="religion"
                              type="text"
                              value={editedPersonal?.religion || ""}
                              onChange={(e) => setEditedPersonal({...editedPersonal, religion: e.target.value})}
                              className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                          </div>
                          <div>
                            <Label htmlFor="marital_status" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:maritalStatus')}</Label>
                            <input
                              id="marital_status"
                              type="text"
                              value={editedPersonal?.marital_status || ""}
                              onChange={(e) => setEditedPersonal({...editedPersonal, marital_status: e.target.value})}
                              className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                          </div>
                          <div>
                            <Label htmlFor="email" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:email')}</Label>
                            <input
                              id="email"
                              type="email"
                              value={editedPersonal?.email || ""}
                              onChange={(e) => setEditedPersonal({...editedPersonal, email: e.target.value})}
                              className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_number" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:phone')}</Label>
                            <input
                              id="contact_number"
                              type="tel"
                              value={editedPersonal?.contact_number || ""}
                              onChange={(e) => setEditedPersonal({...editedPersonal, contact_number: e.target.value})}
                              className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="address" className={`text-[13px] text-[#777777] ${textAlign(isRtl)}`}>{t('admin:address')}</Label>
                          <Textarea
                            id="address"
                            value={editedPersonal?.address || ""}
                            onChange={(e) => setEditedPersonal({...editedPersonal, address: e.target.value})}
                            rows={3}
                            className={`w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20 focus:border-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`}
                            dir={isRtl ? 'rtl' : 'ltr'}
                          />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPersonal(false);
                              setEditedPersonal(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777] hover:bg-gray-50"
                          >
                            {t('admin:cancel')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, personal: editedPersonal};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingPersonal(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 ltr:mr-2 rtl:ml-2 animate-spin" />
                                {t('admin:saving')}
                              </>
                            ) : (
                              t('admin:saveChanges')
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* PDF Language Preference */}
              {answers.pdf_language && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b py-[30px] border-[hsl(var(--jw-gold-accent))]/10">
                    <CardTitle
                      className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                      style={{
                        fontFamily: "Playfair Display, serif",
                        fontSize: "17px",
                        fontWeight: 600,
                      }}
                    >
                      <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                      {t('admin:pdfLanguagePreference')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 pb-5">
                    <div className={`text-sm ${textAlign(isRtl)}`}>
                      <p className={`text-[#777777] text-[12px] mb-0.5 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                        {t('admin:preferredLanguage')}
                      </p>
                      <p className={`font-medium text-[#222222] text-[14px] ${textAlign(isRtl)}`}>
                        {answers.pdf_language === 'english' ? t('admin:english') : t('admin:arabic')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Executors */}
              {answers.executors && answers.executors.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:executors')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingExecutors) {
                            setEditedExecutors([...answers.executors]);
                          }
                          setEditingExecutors(!editingExecutors);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingExecutors ? (
                      <>
                        {answers.executors.map((executor: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                      >
                        <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                            {capitalizeWords(executor.name)}
                          </p>
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {t('admin:level')} {executor.level}
                          </Badge>
                        </div>
                        <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                          <p>{t('admin:relation')}: {capitalizeWords(executor.relation)}</p>
                          <p className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                            {executor.email || t('admin:notAvailable')}
                          </p>
                          <p className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                            {executor.contact_number || t('admin:notAvailable')}
                          </p>
                          {executor.passport_number && (
                            <p>{t('admin:passport')}: {executor.passport_number}</p>
                          )}
                          {executor.emirates_id_number && (
                            <p>{t('admin:emiratesId')}: {executor.emirates_id_number}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Executor Contact Permission & Email Section */}
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {answers.executor_permission_to_contact ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 mb-2 ${textAlign(isRtl)}`}>
                                <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                                <h4 className="font-semibold text-[#0C5536] text-sm">
                                  {t('admin:permissionGrantedToContact')}
                                </h4>
                              </div>
                              <p className={`text-[13px] text-[#555555] mb-3 ${textAlign(isRtl)}`}>
                                {t('admin:clientAuthorizedContact')}
                              </p>
                              <Button
                                onClick={handleSendExecutorEmails}
                                disabled={sendingExecutorEmails}
                                size="sm"
                                className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white"
                              >
                                {sendingExecutorEmails ? (
                                  <>
                                    <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                                    {t('admin:sending')}
                                  </>
                                ) : (
                                  <>
                                    <Mail className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                    {t('admin:sendNotificationEmails')}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FFF9E6] p-4 rounded-lg border border-[#C6A03B]/20">
                          <div className={`flex items-start gap-2 ${textAlign(isRtl)}`}>
                            <XCircle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className={`font-semibold text-[#C6A03B] text-sm mb-1 ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContact')}
                              </h4>
                              <p className={`text-[13px] text-[#6B6B6B] ${textAlign(isRtl)}`}>
                                {t('admin:clientNoPermission')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </>
                    ) : (
                      <div className="space-y-4">
                        {editedExecutors?.map((executor: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px] text-[#777777]">Name</Label>
                                <input
                                  type="text"
                                  value={executor.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].name = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Relation</Label>
                                <input
                                  type="text"
                                  value={executor.relation || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].relation = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Email</Label>
                                <input
                                  type="email"
                                  value={executor.email || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].email = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Phone</Label>
                                <input
                                  type="tel"
                                  value={executor.contact_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].contact_number = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={executor.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].passport_number = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Emirates ID Number</Label>
                                <input
                                  type="text"
                                  value={executor.emirates_id_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedExecutors];
                                    updated[index].emirates_id_number = e.target.value;
                                    setEditedExecutors(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingExecutors(false);
                              setEditedExecutors(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, executors: editedExecutors};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingExecutors(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              "Save Changes"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Trustees */}
              {answers.trustees && answers.trustees.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:trustees')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingTrustees) {
                            setEditedTrustees([...answers.trustees]);
                          }
                          setEditingTrustees(!editingTrustees);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingTrustees ? (
                      <>
                    {answers.trustees.map((trustee: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                      >
                        <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                            {capitalizeWords(trustee.name)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {t('admin:level')} {trustee.level}
                          </Badge>
                        </div>
                        <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                          <p>{t('admin:relationship')}: {capitalizeWords(trustee.relation)}</p>
                          <p>{t('admin:email')}: {trustee.email}</p>
                          {trustee.contact_number && (
                            <p>{t('admin:contactNumber')}: {trustee.contact_number}</p>
                          )}
                          {trustee.passport_number && (
                            <p>{t('admin:passport')}: {trustee.passport_number}</p>
                          )}
                          {trustee.emirates_id_number && (
                            <p>{t('admin:emiratesId')}: {trustee.emirates_id_number}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    </>
                    ) : (
                      <div className="space-y-4">
                        {editedTrustees?.map((trustee: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px] text-[#777777]">Name</Label>
                                <input
                                  type="text"
                                  value={trustee.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].name = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Relation</Label>
                                <input
                                  type="text"
                                  value={trustee.relation || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].relation = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Email</Label>
                                <input
                                  type="email"
                                  value={trustee.email || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].email = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Phone</Label>
                                <input
                                  type="tel"
                                  value={trustee.contact_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].contact_number = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={trustee.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].passport_number = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Emirates ID Number</Label>
                                <input
                                  type="text"
                                  value={trustee.emirates_id_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedTrustees];
                                    updated[index].emirates_id_number = e.target.value;
                                    setEditedTrustees(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTrustees(false);
                              setEditedTrustees(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, trustees: editedTrustees};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingTrustees(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Trustee Contact Permission Section */}
                    {!editingTrustees && (
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {(answers.trustee_permission_to_contact ?? true) ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 mb-2 ${textAlign(isRtl)}`}>
                                <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                                <h4 className="font-semibold text-[#0C5536] text-sm">
                                  {t('admin:permissionGrantedToContact')}
                                </h4>
                              </div>
                              <p className={`text-[13px] text-[#555555] ${answers.trustees?.some((t: any) => t.email) ? 'mb-3' : ''} ${textAlign(isRtl)}`}>
                                {t('admin:permissionGrantedToContactTrustees')}
                              </p>
                              {answers.trustees?.some((t: any) => t.email) && (
                                <Button
                                  onClick={handleSendTrusteeEmails}
                                  disabled={sendingTrusteeEmails}
                                  size="sm"
                                  className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white"
                                >
                                  {sendingTrusteeEmails ? (
                                    <>
                                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                                      {t('admin:sending')}
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                      {t('admin:sendNotificationEmails')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FFF9E6] p-4 rounded-lg border border-[#C6A03B]/20">
                          <div className={`flex items-start gap-2 ${textAlign(isRtl)}`}>
                            <XCircle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className={`font-semibold text-[#C6A03B] text-sm mb-1 ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContact')}
                              </h4>
                              <p className={`text-[13px] text-[#6B6B6B] ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContactTrustees')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Beneficiaries */}
              {answers.beneficiaries && answers.beneficiaries.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Gift className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:beneficiaries')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingBeneficiaries) {
                            setEditedBeneficiaries([...answers.beneficiaries]);
                          }
                          setEditingBeneficiaries(!editingBeneficiaries);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingBeneficiaries ? (
                      answers.beneficiaries.map(
                        (beneficiary: any, index: number) => (
                          <div
                            key={index}
                            className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                          >
                            <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                                {capitalizeWords(beneficiary.name)}
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                {t('admin:level')} {beneficiary.level}
                              </Badge>
                            </div>
                            <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                              <p>{t('admin:relationship')}: {capitalizeWords(beneficiary.relationship)}</p>
                              {beneficiary.percentage > 0 && (
                                <p className="font-medium text-[hsl(var(--jw-primary-green))]">
                                  {beneficiary.percentage}% {t('admin:distribution')}
                                </p>
                              )}
                              {beneficiary.contact_number && (
                                <p>{t('admin:contactNumber')}: {beneficiary.contact_number}</p>
                              )}
                              {beneficiary.passport_number && (
                                <p>{t('admin:passport')}: {beneficiary.passport_number}</p>
                              )}
                              {beneficiary.emirates_id_number && (
                                <p>{t('admin:emiratesId')}: {beneficiary.emirates_id_number}</p>
                              )}
                              {beneficiary.comments && (
                                <p className="italic text-[#777777]">
                                  "{capitalizeWords(beneficiary.comments)}"
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      )
                    ) : (
                      <div className="space-y-4">
                        {editedBeneficiaries?.map((beneficiary: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px]">Name</Label>
                                <input
                                  type="text"
                                  value={beneficiary.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].name = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Relationship</Label>
                                <input
                                  type="text"
                                  value={beneficiary.relationship || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].relationship = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Percentage</Label>
                                <input
                                  type="number"
                                  value={beneficiary.percentage || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].percentage = parseInt(e.target.value);
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={beneficiary.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].passport_number = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Emirates ID Number</Label>
                                <input
                                  type="text"
                                  value={beneficiary.emirates_id_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].emirates_id_number = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Email</Label>
                                <input
                                  type="email"
                                  value={beneficiary.email || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].email = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px]">Contact Number</Label>
                                <input
                                  type="tel"
                                  value={beneficiary.contact_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].contact_number = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[12px]">Comments</Label>
                                <Textarea
                                  value={beneficiary.comments || ""}
                                  onChange={(e) => {
                                    const updated = [...editedBeneficiaries];
                                    updated[index].comments = e.target.value;
                                    setEditedBeneficiaries(updated);
                                  }}
                                  rows={2}
                                  className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setEditingBeneficiaries(false); setEditedBeneficiaries(null); }}>{t('admin:cancel')}</Button>
                          <Button size="sm" onClick={() => { updateAnswersMutation.mutate({...answers, beneficiaries: editedBeneficiaries}); setEditingBeneficiaries(false); }} disabled={updateAnswersMutation.isPending} className="bg-[hsl(var(--jw-primary-green))]">
                            {updateAnswersMutation.isPending ? <><Loader2 className="h-3 w-3 ltr:mr-2 rtl:ml-2 animate-spin" />{t('admin:saving')}</> : t('admin:saveChanges')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Beneficiary Contact Permission Section */}
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {(answers.beneficiary_permission_to_contact ?? true) ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                            <h4 className="font-semibold text-[#0C5536] text-sm">
                              {t('admin:permissionGrantedToContact')}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#555555]">
                            {t('admin:permissionGrantedToContactBeneficiaries')}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-[#FFF4E6] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-[#C68A3B]" />
                            <h4 className="font-semibold text-[#C68A3B] text-sm">
                              {t('admin:noPermissionToContact')}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#555555]">
                            {t('admin:noPermissionToContactBeneficiaries')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* General Beneficiaries (Specific Assets) */}
              {answers.general_beneficiaries && answers.general_beneficiaries.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Gift className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:generalBeneficiaries')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingGeneralBeneficiaries) {
                            setEditedGeneralBeneficiaries([...answers.general_beneficiaries]);
                          }
                          setEditingGeneralBeneficiaries(!editingGeneralBeneficiaries);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingGeneralBeneficiaries ? (
                      <>
                    {answers.general_beneficiaries.map((beneficiary: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                      >
                        <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                            {capitalizeWords(beneficiary.name)}
                          </p>
                        </div>
                        <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                          <p>{t('admin:relationship')}: {capitalizeWords(beneficiary.relationship)}</p>
                          {beneficiary.asset_description && (
                            <p className="mt-2">
                              <span className="font-medium text-[#222222]">{t('admin:assetDescription')}:</span>{" "}
                              {beneficiary.asset_description}
                            </p>
                          )}
                          {beneficiary.passport_number && (
                            <p>{t('admin:passport')}: {beneficiary.passport_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    </>
                    ) : (
                      <div className="space-y-4">
                        {editedGeneralBeneficiaries?.map((beneficiary: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px] text-[#777777]">Name</Label>
                                <input
                                  type="text"
                                  value={beneficiary.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedGeneralBeneficiaries];
                                    updated[index].name = e.target.value;
                                    setEditedGeneralBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Relationship</Label>
                                <input
                                  type="text"
                                  value={beneficiary.relationship || ""}
                                  onChange={(e) => {
                                    const updated = [...editedGeneralBeneficiaries];
                                    updated[index].relationship = e.target.value;
                                    setEditedGeneralBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[12px] text-[#777777]">Asset Description</Label>
                                <Textarea
                                  value={beneficiary.asset_description || ""}
                                  onChange={(e) => {
                                    const updated = [...editedGeneralBeneficiaries];
                                    updated[index].asset_description = e.target.value;
                                    setEditedGeneralBeneficiaries(updated);
                                  }}
                                  rows={3}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={beneficiary.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedGeneralBeneficiaries];
                                    updated[index].passport_number = e.target.value;
                                    setEditedGeneralBeneficiaries(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingGeneralBeneficiaries(false);
                              setEditedGeneralBeneficiaries(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, general_beneficiaries: editedGeneralBeneficiaries};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingGeneralBeneficiaries(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Assets */}
              {(answers.will_type || (answers.assets && answers.assets.length > 0)) && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Building2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:assets')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                        onClick={() => {
                          if (!editingAssets) {
                            setEditedAssets([...answers.assets]);
                          }
                          setEditingAssets(!editingAssets);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingAssets ? (
                      <>
                        {/* Will Type Display */}
                        {answers.will_type && (
                          <div className="p-4 bg-[#E6F7F1] rounded-lg border border-[hsl(var(--jw-primary-green))]/20 mb-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="capitalize text-sm border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] font-semibold"
                              >
                                {answers.will_type === 'general' ? '📋 General Will' : '📝 Specific Will'}
                              </Badge>
                            </div>
                            <p className={`text-[13px] text-[#555555] mt-2 ${textAlign(isRtl)}`}>
                              {answers.will_type === 'general'
                                ? 'Everything left to beneficiaries without individual asset listing'
                                : 'Individual assets listed and assigned to specific beneficiaries'}
                            </p>
                          </div>
                        )}

                        {/* Assets List */}
                        {answers.assets && answers.assets.map((asset: any, index: number) => (
                        <div
                          key={index}
                          className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                        >
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <Badge
                                  variant="outline"
                                  className="capitalize text-xs border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))]"
                                >
                                  {asset.category === "property" && "🏠 "}
                                  {asset.category === "bank" && "🏦 "}
                                  {asset.category === "investments" && "📈 "}
                                  {asset.category === "business" && "💼 "}
                                  {asset.category === "vehicle" && "🚗 "}
                                  {asset.category === "crypto" && "₿ "}
                                  {asset.category === "personal" && "📦 "}
                                  {ASSET_TYPES.find(t => t.value === asset.category)?.label || asset.category}
                                </Badge>
                                {asset.location && (
                                  <span className="text-xs text-[#777777] flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-[hsl(var(--jw-gold-accent))]" />
                                    {capitalizeWords(asset.location)}
                                  </span>
                                )}
                              </div>
                              {asset.title && (
                                <p className="text-sm font-semibold text-[#222222] mb-1">
                                  {capitalizeWords(asset.title)}
                                </p>
                              )}
                              <p className="text-sm text-[#222222]">
                                {capitalizeWords(asset.description)}
                              </p>
                              {asset.estimated_value && (
                                <p className={`text-xs text-[#777777] mt-2 font-medium ${textAlign(isRtl)}`}>
                                  {t('admin:estimatedValue')}:{" "}
                                  <span className="text-[hsl(var(--jw-primary-green))]">
                                    AED {asset.estimated_value.toLocaleString()}
                                  </span>
                                </p>
                              )}
                          </div>
                        </div>
                      ))}
                      </>
                    ) : (
                      <div className="space-y-4">
                        {editedAssets?.map((asset: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className={`text-[12px] ${textAlign(isRtl)}`}>{t('admin:assetType')}</Label>
                                <Select value={asset.category} onValueChange={(v) => { const updated = [...editedAssets]; updated[index].category = v; setEditedAssets(updated); }}>
                                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('admin:assetType')} /></SelectTrigger>
                                  <SelectContent>
                                    {ASSET_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className={`text-[12px] ${textAlign(isRtl)}`}>{t('admin:location')}</Label>
                                <input type="text" value={asset.location || ""} onChange={(e) => { const updated = [...editedAssets]; updated[index].location = e.target.value; setEditedAssets(updated); }} className={`w-full mt-1 px-3 py-2 border rounded-md text-[14px] ${textAlign(isRtl)}`} dir={isRtl ? 'rtl' : 'ltr'} />
                              </div>
                              <div className="col-span-2">
                                <Label className={`text-[12px] ${textAlign(isRtl)}`}>{t('admin:description')}</Label>
                                <Textarea value={asset.description || ""} onChange={(e) => { const updated = [...editedAssets]; updated[index].description = e.target.value; setEditedAssets(updated); }} rows={2} className="w-full mt-1" />
                              </div>
                              <div>
                                <Label className="text-[12px]">Estimated Value (AED)</Label>
                                <input type="number" value={asset.estimated_value || ""} onChange={(e) => { const updated = [...editedAssets]; updated[index].estimated_value = parseInt(e.target.value); setEditedAssets(updated); }} className="w-full mt-1 px-3 py-2 border rounded-md text-[14px]" />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setEditingAssets(false); setEditedAssets(null); }}>Cancel</Button>
                          <Button size="sm" onClick={() => { updateAnswersMutation.mutate({...answers, assets: editedAssets}); setEditingAssets(false); }} disabled={updateAnswersMutation.isPending} className="bg-[hsl(var(--jw-primary-green))]">
                            {updateAnswersMutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Saving...</> : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {answers.special_requests &&
                Object.values(answers.special_requests).some((v) => v) && (
                  <Card className="lg:col-span-2 border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                    <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                      <div className="flex items-center justify-between">
                        <CardTitle
                          className="text-[hsl(var(--jw-primary-green))]"
                          style={{
                            fontFamily: "Playfair Display, serif",
                            fontSize: "17px",
                            fontWeight: 600,
                          }}
                        >
                          {t('admin:specialRequests')}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                          onClick={() => {
                            if (!editingSpecialRequests) {
                              setEditedSpecialRequests({...answers.special_requests});
                            }
                            setEditingSpecialRequests(!editingSpecialRequests);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      {!editingSpecialRequests ? (
                        <>
                          {answers.special_requests.funeral_wishes && (
                            <div className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10">
                              <p className="font-medium text-sm mb-2 text-[#222222]">
                                Funeral Wishes
                              </p>
                              <p className="text-sm text-[#555555] italic">
                                "{answers.special_requests.funeral_wishes}"
                              </p>
                            </div>
                          )}
                          {answers.special_requests.guardianship && (
                            <div className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10">
                              <p className="font-medium text-sm mb-2 text-[#222222]">
                                Guardianship
                              </p>
                              <p className="text-sm text-[#555555] italic">
                                "{answers.special_requests.guardianship}"
                              </p>
                            </div>
                          )}
                          {answers.special_requests.digital_assets && (
                            <div className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10">
                              <p className={`font-medium text-sm mb-2 text-[#222222] ${textAlign(isRtl)}`}>
                                {t('admin:digitalAssets')}
                              </p>
                              <p className="text-sm text-[#555555] italic">
                                "{answers.special_requests.digital_assets}"
                              </p>
                            </div>
                          )}
                          {answers.special_requests.other && (
                            <div className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10">
                              <p className="font-medium text-sm mb-2 text-[#222222]">
                                Other Requests
                              </p>
                              <p className="text-sm text-[#555555] italic">
                                "{answers.special_requests.other}"
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-[13px] text-[#777777]">Funeral Wishes</Label>
                            <Textarea value={editedSpecialRequests?.funeral_wishes || ""} onChange={(e) => setEditedSpecialRequests({...editedSpecialRequests, funeral_wishes: e.target.value})} rows={3} className="w-full mt-1" />
                          </div>
                          <div>
                            <Label className="text-[13px] text-[#777777]">Guardianship</Label>
                            <Textarea value={editedSpecialRequests?.guardianship || ""} onChange={(e) => setEditedSpecialRequests({...editedSpecialRequests, guardianship: e.target.value})} rows={3} className="w-full mt-1" />
                          </div>
                          <div>
                            <Label className="text-[13px] text-[#777777]">Digital Assets</Label>
                            <Textarea value={editedSpecialRequests?.digital_assets || ""} onChange={(e) => setEditedSpecialRequests({...editedSpecialRequests, digital_assets: e.target.value})} rows={3} className="w-full mt-1" />
                          </div>
                          <div>
                            <Label className="text-[13px] text-[#777777]">Other Requests</Label>
                            <Textarea value={editedSpecialRequests?.other || ""} onChange={(e) => setEditedSpecialRequests({...editedSpecialRequests, other: e.target.value})} rows={3} className="w-full mt-1" />
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" size="sm" onClick={() => { setEditingSpecialRequests(false); setEditedSpecialRequests(null); }}>Cancel</Button>
                            <Button size="sm" onClick={() => { updateAnswersMutation.mutate({...answers, special_requests: editedSpecialRequests}); setEditingSpecialRequests(false); }} disabled={updateAnswersMutation.isPending} className="bg-[hsl(var(--jw-primary-green))]">
                              {updateAnswersMutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Saving...</> : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              {/* Interim Guardians */}
              {answers.interim_guardians && answers.interim_guardians.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                      <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                      {t('admin:interimGuardians')}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                      onClick={() => {
                        if (!editingInterimGuardians) {
                          setEditedInterimGuardians([...answers.interim_guardians]);
                        }
                        setEditingInterimGuardians(!editingInterimGuardians);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                    </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingInterimGuardians ? (
                      <>
                    {answers.interim_guardians.map((guardian: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                      >
                        <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                            {capitalizeWords(guardian.name)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {t('admin:level')} {guardian.level}
                          </Badge>
                        </div>
                        <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                          <p>{t('admin:relationship')}: {capitalizeWords(guardian.relation)}</p>
                          {guardian.email && <p>{t('admin:email')}: {guardian.email}</p>}
                          {guardian.contact_number && (
                            <p>{t('admin:contactNumber')}: {guardian.contact_number}</p>
                          )}
                          {guardian.passport_number && (
                            <p>{t('admin:passport')}: {guardian.passport_number}</p>
                          )}
                          {guardian.emirates_id_number && (
                            <p>{t('admin:emiratesId')}: {guardian.emirates_id_number}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    </>
                    ) : (
                      <div className="space-y-4">
                        {editedInterimGuardians?.map((guardian: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px] text-[#777777]">Name</Label>
                                <input
                                  type="text"
                                  value={guardian.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].name = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Relation</Label>
                                <input
                                  type="text"
                                  value={guardian.relation || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].relation = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Email</Label>
                                <input
                                  type="email"
                                  value={guardian.email || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].email = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Phone</Label>
                                <input
                                  type="tel"
                                  value={guardian.contact_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].contact_number = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={guardian.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].passport_number = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Emirates ID Number</Label>
                                <input
                                  type="text"
                                  value={guardian.emirates_id_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedInterimGuardians];
                                    updated[index].emirates_id_number = e.target.value;
                                    setEditedInterimGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingInterimGuardians(false);
                              setEditedInterimGuardians(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, interim_guardians: editedInterimGuardians};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingInterimGuardians(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Interim Guardian Permission Section */}
                    {!editingInterimGuardians && (
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {(answers.interim_guardian_permission_to_contact ?? true) ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 mb-2 ${textAlign(isRtl)}`}>
                                <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                                <h4 className="font-semibold text-[#0C5536] text-sm">
                                  {t('admin:permissionGrantedToContact')}
                                </h4>
                              </div>
                              <p className={`text-[13px] text-[#555555] ${answers.interim_guardians?.some((g: any) => g.email) ? 'mb-3' : ''} ${textAlign(isRtl)}`}>
                                {t('admin:permissionGrantedToContactInterimGuardians')}
                              </p>
                              {answers.interim_guardians?.some((g: any) => g.email) && (
                                <Button
                                  onClick={handleSendInterimGuardianEmails}
                                  disabled={sendingInterimGuardianEmails}
                                  size="sm"
                                  className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white"
                                >
                                  {sendingInterimGuardianEmails ? (
                                    <>
                                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                                      {t('admin:sending')}
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                      {t('admin:sendNotificationEmails')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FFF9E6] p-4 rounded-lg border border-[#C6A03B]/20">
                          <div className={`flex items-start gap-2 ${textAlign(isRtl)}`}>
                            <XCircle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className={`font-semibold text-[#C6A03B] text-sm mb-1 ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContact')}
                              </h4>
                              <p className={`text-[13px] text-[#6B6B6B] ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContactInterimGuardians')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Permanent Guardians */}
              {answers.permanent_guardians && answers.permanent_guardians.length > 0 && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                        style={{
                          fontFamily: "Playfair Display, serif",
                          fontSize: "17px",
                          fontWeight: 600,
                        }}
                      >
                        <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {t('admin:permanentGuardians')}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-[hsl(var(--jw-primary-green))]/10"
                      onClick={() => {
                        if (!editingPermanentGuardians) {
                          setEditedPermanentGuardians([...answers.permanent_guardians]);
                        }
                        setEditingPermanentGuardians(!editingPermanentGuardians);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-[#777777] hover:text-[hsl(var(--jw-primary-green))]" />
                    </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {!editingPermanentGuardians ? (
                      <>
                    {answers.permanent_guardians.map((guardian: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                      >
                        <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <p className={`font-semibold text-[#222222] ${textAlign(isRtl)}`}>
                            {capitalizeWords(guardian.name)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {t('admin:level')} {guardian.level}
                          </Badge>
                        </div>
                        <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                          <p>{t('admin:relationship')}: {capitalizeWords(guardian.relation)}</p>
                          {guardian.email && <p>{t('admin:email')}: {guardian.email}</p>}
                          {guardian.contact_number && (
                            <p>{t('admin:contactNumber')}: {guardian.contact_number}</p>
                          )}
                          {guardian.passport_number && (
                            <p>{t('admin:passport')}: {guardian.passport_number}</p>
                          )}
                          {guardian.emirates_id_number && (
                            <p>{t('admin:emiratesId')}: {guardian.emirates_id_number}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    </>
                    ) : (
                      <div className="space-y-4">
                        {editedPermanentGuardians?.map((guardian: any, index: number) => (
                          <div key={index} className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-[12px] text-[#777777]">Name</Label>
                                <input
                                  type="text"
                                  value={guardian.name || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].name = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Relation</Label>
                                <input
                                  type="text"
                                  value={guardian.relation || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].relation = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Email</Label>
                                <input
                                  type="email"
                                  value={guardian.email || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].email = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Phone</Label>
                                <input
                                  type="tel"
                                  value={guardian.contact_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].contact_number = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Passport Number</Label>
                                <input
                                  type="text"
                                  value={guardian.passport_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].passport_number = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                              <div>
                                <Label className="text-[12px] text-[#777777]">Emirates ID Number</Label>
                                <input
                                  type="text"
                                  value={guardian.emirates_id_number || ""}
                                  onChange={(e) => {
                                    const updated = [...editedPermanentGuardians];
                                    updated[index].emirates_id_number = e.target.value;
                                    setEditedPermanentGuardians(updated);
                                  }}
                                  className="w-full mt-1 px-3 py-2 border border-[#E6E6E4] rounded-md text-[14px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-primary-green))]/20"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPermanentGuardians(false);
                              setEditedPermanentGuardians(null);
                            }}
                            className="border-[#E6E6E4] text-[#777777]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const updatedAnswers = {...answers, permanent_guardians: editedPermanentGuardians};
                              updateAnswersMutation.mutate(updatedAnswers);
                              setEditingPermanentGuardians(false);
                            }}
                            disabled={updateAnswersMutation.isPending}
                            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
                          >
                            {updateAnswersMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Permanent Guardian Permission Section */}
                    {!editingPermanentGuardians && (
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {(answers.permanent_guardian_permission_to_contact ?? true) ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 mb-2 ${textAlign(isRtl)}`}>
                                <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                                <h4 className="font-semibold text-[#0C5536] text-sm">
                                  {t('admin:permissionGrantedToContact')}
                                </h4>
                              </div>
                              <p className={`text-[13px] text-[#555555] ${answers.permanent_guardians?.some((g: any) => g.email) ? 'mb-3' : ''} ${textAlign(isRtl)}`}>
                                {t('admin:permissionGrantedToContactPermanentGuardians')}
                              </p>
                              {answers.permanent_guardians?.some((g: any) => g.email) && (
                                <Button
                                  onClick={handleSendPermanentGuardianEmails}
                                  disabled={sendingPermanentGuardianEmails}
                                  size="sm"
                                  className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white"
                                >
                                  {sendingPermanentGuardianEmails ? (
                                    <>
                                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                                      {t('admin:sending')}
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                      {t('admin:sendNotificationEmails')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FFF9E6] p-4 rounded-lg border border-[#C6A03B]/20">
                          <div className={`flex items-start gap-2 ${textAlign(isRtl)}`}>
                            <XCircle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className={`font-semibold text-[#C6A03B] text-sm mb-1 ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContact')}
                              </h4>
                              <p className={`text-[13px] text-[#6B6B6B] ${textAlign(isRtl)}`}>
                                {t('admin:noPermissionToContactPermanentGuardians')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Receipt & Disinherit */}
              {((answers.receipt_of_will && answers.receipt_of_will.length > 0) ||
                (answers.disinherit && answers.disinherit.length > 0) ||
                (answers.family_exclusion && (
                  answers.family_exclusion.exclude_father ||
                  answers.family_exclusion.exclude_mother ||
                  answers.family_exclusion.exclude_sons ||
                  answers.family_exclusion.exclude_daughters ||
                  answers.family_exclusion.exclude_brothers ||
                  answers.family_exclusion.exclude_sisters ||
                  answers.family_exclusion.exclude_grandparents ||
                  answers.family_exclusion.exclude_spouse
                ))) && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                    <CardTitle
                      className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                      style={{
                        fontFamily: "Playfair Display, serif",
                        fontSize: "17px",
                        fontWeight: 600,
                      }}
                    >
                      <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                      {t('admin:receiptAndDisinherit')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Receipt Persons */}
                    {answers.receipt_of_will && answers.receipt_of_will.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-[#222222] text-sm mb-3">
                          {t('admin:receiptPersons')}
                        </h4>
                        <div className="space-y-3">
                          {answers.receipt_of_will.map((person: any, index: number) => (
                            <div
                              key={index}
                              className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                            >
                              <p className={`font-semibold text-[#222222] mb-2 ${textAlign(isRtl)}`}>
                                {capitalizeWords(person.name)}
                              </p>
                              <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                                <p>{t('admin:relationship')}: {capitalizeWords(person.relation)}</p>
                                {person.contact_number && (
                                  <p>{t('admin:contactNumber')}: {person.contact_number}</p>
                                )}
                                {person.passport_number && (
                                  <p>{t('admin:passport')}: {person.passport_number}</p>
                                )}
                                {person.emirates_id_number && (
                                  <p>{t('admin:emiratesId')}: {person.emirates_id_number}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Family Exclusion */}
                    {answers.family_exclusion && (
                      answers.family_exclusion.exclude_father ||
                      answers.family_exclusion.exclude_mother ||
                      answers.family_exclusion.exclude_sons ||
                      answers.family_exclusion.exclude_daughters ||
                      answers.family_exclusion.exclude_brothers ||
                      answers.family_exclusion.exclude_sisters ||
                      answers.family_exclusion.exclude_grandparents ||
                      answers.family_exclusion.exclude_spouse
                    ) && (
                      <div>
                        <h4 className="font-semibold text-[#222222] text-sm mb-3">
                          {t('admin:familyExclusion')}
                        </h4>
                        <div className="p-4 bg-[#FFF4E6] rounded-lg border border-[#C68A3B]/20">
                          <div className="space-y-1 text-sm text-[#555555]">
                            {answers.family_exclusion.exclude_father && <p>• Father</p>}
                            {answers.family_exclusion.exclude_mother && <p>• Mother</p>}
                            {answers.family_exclusion.exclude_sons && <p>• Sons</p>}
                            {answers.family_exclusion.exclude_daughters && <p>• Daughters</p>}
                            {answers.family_exclusion.exclude_brothers && <p>• Brothers</p>}
                            {answers.family_exclusion.exclude_sisters && <p>• Sisters</p>}
                            {answers.family_exclusion.exclude_grandparents && <p>• Grandparents</p>}
                            {answers.family_exclusion.exclude_spouse && <p>• Spouse</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Disinherit Persons */}
                    {answers.disinherit && answers.disinherit.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-[#222222] text-sm mb-3">
                          {t('admin:disinheritPersons')}
                        </h4>
                        <div className="space-y-3">
                          {answers.disinherit.map((person: any, index: number) => (
                            <div
                              key={index}
                              className="p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10"
                            >
                              <p className={`font-semibold text-[#222222] mb-2 ${textAlign(isRtl)}`}>
                                {capitalizeWords(person.name)}
                              </p>
                              <div className={`space-y-1 text-sm text-[#555555] ${textAlign(isRtl)}`}>
                                <p>{t('admin:relationship')}: {capitalizeWords(person.relation)}</p>
                                {person.contact_number && (
                                  <p>{t('admin:contactNumber')}: {person.contact_number}</p>
                                )}
                                {person.passport_number && (
                                  <p>{t('admin:passport')}: {person.passport_number}</p>
                                )}
                                {person.emirates_id_number && (
                                  <p>{t('admin:emiratesId')}: {person.emirates_id_number}</p>
                                )}
                                {person.reason && (
                                  <p className="italic text-[#777777]">
                                    "{capitalizeWords(person.reason)}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Receipt & Disinherit Permission Section */}
                    <div className="mt-4 pt-4 border-t border-[#E6E6E4]">
                      {(answers.receipt_disinherit_permission_to_contact ?? true) ? (
                        <div className="bg-[#E6F7F1] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                            <h4 className="font-semibold text-[#0C5536] text-sm">
                              {t('admin:permissionGrantedToContact')}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#555555]">
                            {t('admin:permissionGrantedToContactReceiptDisinherit')}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-[#FFF4E6] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-[#C68A3B]" />
                            <h4 className="font-semibold text-[#C68A3B] text-sm">
                              {t('admin:noPermissionToContact')}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#555555]">
                            {t('admin:noPermissionToContactReceiptDisinherit')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Family Exclusion & Signature */}
              {answers.family_exclusion && answers.family_exclusion.signature && (
                <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                  <CardHeader className="border-b py-[30px] border-[hsl(var(--jw-gold-accent))]/10">
                    <CardTitle
                      className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]"
                      style={{
                        fontFamily: "Playfair Display, serif",
                        fontSize: "17px",
                        fontWeight: 600,
                      }}
                    >
                      <Pencil className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                      {t('admin:clientSignature')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Signature Image */}
                      <div>
                        <p className={`text-[#777777] text-[12px] mb-2 ${textAlign(isRtl)}`} style={{ fontFamily: "Inter, sans-serif" }}>
                          {t('admin:digitalSignature')}
                        </p>
                        <div className="border-2 border-[#E6E6E4] rounded-lg p-4 bg-white">
                          <img
                            src={answers.family_exclusion.signature}
                            alt="Client Signature"
                            className="max-w-full h-auto max-h-32"
                          />
                        </div>
                      </div>

                      {/* Signature Date */}
                      {answers.family_exclusion.signature_date && (
                        <div>
                          <p className="text-[#777777] text-[12px] mb-1" style={{ fontFamily: "Inter, sans-serif" }}>
                            Signed On
                          </p>
                          <p className="font-medium text-[#222222] text-[14px]">
                            {format(new Date(answers.family_exclusion.signature_date), "PPP 'at' h:mm a")}
                          </p>
                        </div>
                      )}

                      {/* Include in PDF Toggle */}
                      <div className="pt-4 border-t border-[#E6E6E4]">
                        <div className={`flex items-center gap-6 p-4 bg-[#FDFBF4] rounded-lg border border-[hsl(var(--jw-gold-accent))]/10 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-[#222222] text-[14px] mb-1 ${textAlign(isRtl)}`}>
                              {t('admin:includeSignatureInPdf')}
                            </p>
                            <p className={`text-xs text-[#777777] ${textAlign(isRtl)}`}>
                              {t('admin:controlSignatureAppears')}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={answers.family_exclusion?.include_signature_in_pdf ?? true}
                              onChange={async (e) => {
                                const newValue = e.target.checked;
                                try {
                                  const updatedAnswers = {
                                    ...answers,
                                    family_exclusion: {
                                      ...answers.family_exclusion,
                                      include_signature_in_pdf: newValue
                                    }
                                  };

                                  const { error } = await supabase
                                    .from("wills")
                                    .update({ answers: updatedAnswers })
                                    .eq("id", id);

                                  if (error) throw error;

                                  queryClient.invalidateQueries({ queryKey: ["admin-will-detail", id] });
                                  toast({
                                    title: t('toast:admin.settingUpdated'),
                                    description: newValue ? t('toast:admin.signatureIncluded') : t('toast:admin.signatureExcluded'),
                                    className: "bg-[hsl(var(--jw-primary-green))] text-white",
                                  });
                                } catch (error: any) {
                                  toast({
                                    title: t('toast:error'),
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[hsl(var(--jw-primary-green))]/20 rounded-full peer after:content-[''] after:absolute after:top-[2px] ${isRtl ? 'after:right-[2px]' : 'after:left-[2px]'} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-200 peer-checked:after:border-white ${isRtl ? 'peer-checked:after:-translate-x-full' : 'peer-checked:after:translate-x-full'} peer-checked:bg-[hsl(var(--jw-primary-green))]`}></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Uploads Tab */}
          <TabsContent value="uploads">
            {uploadFiles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploadFiles.map((file: any, index: number) => {
                  const isImage = isImageFile(file.name);

                  return (
                    <Card
                      key={index}
                      className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] hover:shadow-[0_4px_12px_rgba(12,85,54,0.12)] transition-all duration-200"
                    >
                      <CardContent className="p-0">
                        {/* Thumbnail/Icon Section */}
                        <div className="relative w-full h-48 bg-[#FAFAF8] border-b border-[#E6E6E4] flex items-center justify-center overflow-hidden">
                          {isImage ? (
                            file.type === 'asset-photo' ? (
                              <AssetPhotoDisplay
                                photoPath={file.path}
                                title={file.personName}
                                className="w-full h-full flex items-center justify-center"
                              />
                            ) : (
                              <ImageThumbnail
                                filePath={file.path}
                                fileName={file.name}
                                onLoad={() => loadThumbnail(file.path)}
                              />
                            )
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              {getFileIcon(file.name)}
                            </div>
                          )}
                        </div>

                        {/* File Info Section */}
                        <div className="p-4">
                          {file.personName && (
                            <p className="text-xs font-medium text-[hsl(var(--jw-primary-green))] mb-1">
                              {file.personName}
                            </p>
                          )}
                          <p className="font-medium text-sm truncate text-[#222222] mb-1">
                            {file.name}
                          </p>
                          <p className="text-xs text-[#777777] mb-1">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                          {file.uploaded_at && (
                            <p className={`text-xs text-[#777777] mb-3 ${textAlign(isRtl)}`}>
                              {t('admin:uploadedOn')}{" "}
                              {format(
                                new Date(file.uploaded_at),
                                "MMM d, yyyy"
                              )}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewFile(file.path, file.bucket || 'wills')}
                              className="flex-1 border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))] hover:text-white transition-all duration-150"
                            >
                              <Eye className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                              {t('admin:view')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => downloadFile(file.path, file.name, file.bucket || 'wills')}
                              disabled={downloadingFile === file.path}
                              className="flex-1 bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
                            >
                              {downloadingFile === file.path ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-[#E6E6E4]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="h-16 w-16 rounded-lg bg-[#FDFBF4] border border-[hsl(var(--jw-gold-accent))]/20 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-[hsl(var(--jw-gold-accent))]" />
                  </div>
                  <h3 className={`font-semibold mb-2 text-[#222222] ${textAlign(isRtl)}`}>
                    {t('admin:noUploadsYet')}
                  </h3>
                  <p className={`text-sm text-[#555555] ${textAlign(isRtl)}`}>
                    {t('admin:clientHasntUploaded')}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Draft PDF Tab */}
          <TabsContent value="pdf">
            {/* Client Approval Status - Only show for draft_released */}
            {will.status === 'draft_released' && will.client_approval_status && (
              <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)] mb-6">
                <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                  <CardTitle className="text-[hsl(var(--jw-primary-green))] flex items-center gap-2">
                    {will.client_approval_status === 'approved' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    {will.client_approval_status === 'approved' ? t('admin:clientApprovedDraft') : t('admin:clientDisapprovedDraft')}
                  </CardTitle>
                  <CardDescription className={`text-[#777777] mt-1 ${textAlign(isRtl)}`}>
                    {will.client_approval_status === 'approved' ? t('admin:clientApproved') : t('admin:clientDisapproved')} {t('admin:on')}{" "}
                    {will.client_approval_at
                      ? format(new Date(will.client_approval_at), "PPP 'at' h:mm a")
                      : "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className={`p-4 rounded-lg border-2 ${
                    will.client_approval_status === 'approved' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                        will.client_approval_status === 'approved' 
                          ? 'bg-green-100' 
                          : 'bg-red-100'
                      }`}>
                        {will.client_approval_status === 'approved' ? (
                          <ThumbsUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <ThumbsDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm mb-2 ${
                          will.client_approval_status === 'approved' 
                            ? 'text-green-700' 
                            : 'text-red-700'
                        }`}>
                          {will.client_approval_status === 'approved'
                            ? t('admin:clientHasApprovedDraft')
                            : t('admin:clientHasRequestedChangesDraft')}
                        </p>
                        {will.client_approval_comments && (
                          <div className="mt-3 p-3 bg-white rounded-md border border-[#E6E6E4]">
                            <p className={`text-xs font-medium text-[#777777] mb-1 ${textAlign(isRtl)}`}>{t('admin:clientComments')}</p>
                            <p className="text-sm text-[#222222]">{will.client_approval_comments}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {will.pdf_path ? (
              <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                  <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div>
                      <CardTitle className={`text-[hsl(var(--jw-primary-green))] flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <FileCheck className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                        {will.status === 'finalized' ? t('admin:finalPdf') : t('admin:draftWillDocument')}
                      </CardTitle>
                      <CardDescription className={`text-[#777777] mt-1 ${textAlign(isRtl)}`}>
                        {t('admin:generatedOn')}{" "}
                        {will.pdf_generated_at
                          ? format(
                              new Date(will.pdf_generated_at),
                              "PPP 'at' h:mm a"
                            )
                          : "N/A"}
                      </CardDescription>
                    </div>
                    <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="relative">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                          disabled={uploadingPdf || regeneratingPdf}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          id="pdf-replace-input"
                        />
                        <Button
                          variant="outline"
                          disabled={uploadingPdf || regeneratingPdf}
                          className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))] hover:text-white transition-all duration-150"
                          asChild
                        >
                          <label
                            htmlFor="pdf-replace-input"
                            className="cursor-pointer"
                          >
                            {uploadingPdf ? (
                              <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            )}
                            {t('admin:uploadNew')}
                          </label>
                        </Button>
                      </div>
                      <Button
                        onClick={() =>
                          downloadFile(will.pdf_path!, "will-draft.pdf")
                        }
                        className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
                      >
                        <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {t('admin:download')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {!pdfUrl && (
                    <div className="flex justify-center">
                      <Button
                        onClick={loadPdfUrl}
                        variant="outline"
                        className=" mb-4 border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))] hover:text-white h-12"
                      >
                        <FileText className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
                        {t('admin:loadPdfPreview')}
                      </Button>
                    </div>
                  )}
                  {pdfUrl && (
                    <div className="border rounded-lg overflow-hidden border-[#E6E6E4] shadow-sm">
                      <iframe
                        src={pdfUrl}
                        className="w-full h-[800px]"
                        title="Will PDF Preview"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#E6E6E4]">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="h-24 w-24 rounded-xl bg-[#FDFBF4] border-2 border-dashed border-[hsl(var(--jw-gold-accent))]/40 flex items-center justify-center mb-6 hover:border-[hsl(var(--jw-gold-accent))] transition-all duration-200 cursor-pointer group">
                    <FileText className="h-12 w-12 text-[hsl(var(--jw-gold-accent))] group-hover:scale-110 transition-transform duration-200" />
                  </div>
                  <h3 className={`font-semibold mb-2 text-[#222222] text-lg ${textAlign(isRtl)}`}>
                    {t('admin:noDraftUploadedYet')}
                  </h3>
                  <p className={`text-sm text-[#555555] mb-6 text-center max-w-md ${textAlign(isRtl)}`}>
                    {t('admin:uploadCustomPdf')}
                  </p>
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      disabled={uploadingPdf || regeneratingPdf}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      id="pdf-upload-input"
                    />
                    <Button
                      variant="outline"
                      disabled={uploadingPdf || regeneratingPdf}
                      className="border-[hsl(var(--jw-gold-accent))] text-[hsl(var(--jw-gold-accent))] hover:bg-[hsl(var(--jw-gold-accent))] hover:text-white transition-all duration-150"
                      asChild
                    >
                      <label
                        htmlFor="pdf-upload-input"
                        className="cursor-pointer"
                      >
                        {uploadingPdf ? (
                          <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        )}
                        {t('admin:uploadPdf')}
                      </label>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <WillStatusHistory willId={id!} />
              </div>
              <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
                <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
                  <CardTitle
                    className="text-[hsl(var(--jw-primary-green))]"
                    style={{
                      fontFamily: "Playfair Display, serif",
                      fontSize: "17px",
                      fontWeight: 600,
                    }}
                  >
                    {t('admin:addActivityNote')}
                  </CardTitle>
                  <CardDescription className={`text-[#777777] ${textAlign(isRtl)}`}>
                    {t('admin:addNotesToActivityLog')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label className={`text-[#555555] font-medium ${textAlign(isRtl)}`}>
                      {t('admin:note')}
                    </Label>
                    <Textarea
                      value={activityNotes}
                      onChange={(e) => setActivityNotes(e.target.value)}
                      placeholder={t('admin:addNoteToActivityLog')}
                      rows={4}
                      className={`border-[#E6E6E4] focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-2 resize-none ${textAlign(isRtl)}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (activityNotes.trim()) {
                        addNoteMutation.mutate(activityNotes);
                      }
                    }}
                    disabled={
                      !activityNotes.trim() ||
                      addNoteMutation.isPending
                    }
                    className="w-full bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] h-11 font-medium transition-all duration-150"
                    style={{ boxShadow: "none" }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.boxShadow =
                          "0 0 12px rgba(198,160,59,0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {addNoteMutation.isPending ? (
                      <>
                        <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                        {t('admin:saving')}
                      </>
                    ) : (
                      t('admin:addNote')
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Change Request Details Dialog */}
        <Dialog open={showChangeRequestDialog} onOpenChange={setShowChangeRequestDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <ThumbsDown className="h-5 w-5" />
                {t('clientApproval.changeRequestDetailsTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('clientApproval.clientSubmittedOn')} {will?.client_approval_at
                  ? format(new Date(will.client_approval_at), "MMMM d, yyyy 'at' h:mm a")
                  : "N/A"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Subject */}
              {will?.client_approval_subject && (
                <div>
                  <Label className="text-xs font-semibold text-[#777777] uppercase tracking-wide">{t('clientApproval.subject')}</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-[#222222] font-medium">{will.client_approval_subject}</p>
                  </div>
                </div>
              )}

              {/* Message */}
              {will?.client_approval_message && (
                <div>
                  <Label className="text-xs font-semibold text-[#777777] uppercase tracking-wide">{t('clientApproval.message')}</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-[#222222] leading-relaxed whitespace-pre-wrap">
                      {will.client_approval_message}
                    </p>
                  </div>
                </div>
              )}

              {/* Attached Image */}
              {will?.client_approval_image_path && (
                <div>
                  <Label className="text-xs font-semibold text-[#777777] uppercase tracking-wide">{t('clientApproval.attachedImage')}</Label>
                  <div className="mt-2">
                    <ClientApprovalImage imagePath={will.client_approval_image_path} />
                  </div>
                </div>
              )}

              {/* Client Info */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4 text-sm text-[#777777]">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                    <span className="font-medium">{will?.profile?.full_name || "Client"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                    <span>
                      {will?.client_approval_at
                        ? format(new Date(will.client_approval_at), "PPP")
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </>
    );
}
