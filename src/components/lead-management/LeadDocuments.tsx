"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  MoreHorizontal,
  Eye,
  Loader2,
  File,
  FileImage,
  FileSpreadsheet,
  FolderOpen,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export type DocumentCategory = "contract" | "id" | "proposal" | "invoice" | "other";

export interface LeadDocument {
  id: string;
  lead_id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: DocumentCategory;
  uploaded_by: string;
  created_at: string;
  uploader?: { user_id: string; full_name: string } | null;
}

interface LeadDocumentsProps {
  leadId: string;
  leadName?: string;
  readOnly?: boolean;
}

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: typeof FileText; color: string; bgColor: string }> = {
  contract: { label: "Contract", icon: FileText, color: "#0C5536", bgColor: "#E6F7F1" },
  id: { label: "ID Document", icon: FileImage, color: "#2563EB", bgColor: "#E6F0FF" },
  proposal: { label: "Proposal", icon: FileText, color: "#C6A03B", bgColor: "#FFF9E6" },
  invoice: { label: "Invoice", icon: FileSpreadsheet, color: "#7C3AED", bgColor: "#F3E8FF" },
  other: { label: "Other", icon: File, color: "#6B6B6B", bgColor: "#F5F5F5" },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function LeadDocuments({ leadId, leadName, readOnly = false }: LeadDocumentsProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<LeadDocument | null>(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState<DocumentCategory>("other");
  const [dragActive, setDragActive] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      // For now, we'll simulate documents since the table doesn't exist yet
      // In production, this would fetch from Supabase
      const storedDocs = localStorage.getItem(`lead_documents_${leadId}`);
      if (storedDocs) {
        setDocuments(JSON.parse(storedDocs));
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error(t("failedToFetchDocuments", "Failed to fetch documents"));
    } finally {
      setIsLoading(false);
    }
  }, [leadId, t]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("fileTooLarge", "File size exceeds 10MB limit"));
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(t("invalidFileType", "Invalid file type. Please upload PDF, images, or Office documents."));
      return;
    }

    setSelectedFile(file);
    setDocumentName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Upload document
  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      // For now, we'll store in localStorage since the bucket doesn't exist
      // In production, this would upload to Supabase Storage
      const newDocument: LeadDocument = {
        id: crypto.randomUUID(),
        lead_id: leadId,
        name: documentName || selectedFile.name,
        file_path: URL.createObjectURL(selectedFile), // Temporary URL
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        category: documentCategory,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        uploader: { user_id: user.id, full_name: user.user_metadata?.full_name || "You" },
      };

      const updatedDocs = [...documents, newDocument];
      setDocuments(updatedDocs);
      localStorage.setItem(`lead_documents_${leadId}`, JSON.stringify(updatedDocs));

      toast.success(t("documentUploaded", "Document uploaded successfully"));
      setUploadDialogOpen(false);
      resetUploadForm();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(t("failedToUploadDocument", "Failed to upload document"));
    } finally {
      setIsUploading(false);
    }
  };

  // Delete document
  const handleDelete = async () => {
    if (!selectedDocument) return;

    try {
      const updatedDocs = documents.filter(doc => doc.id !== selectedDocument.id);
      setDocuments(updatedDocs);
      localStorage.setItem(`lead_documents_${leadId}`, JSON.stringify(updatedDocs));

      toast.success(t("documentDeleted", "Document deleted successfully"));
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(t("failedToDeleteDocument", "Failed to delete document"));
    }
  };

  // Download document
  const handleDownload = (document: LeadDocument) => {
    // Create a download link
    const link = document.createElement("a");
    link.href = document.file_path;
    link.download = `${document.name}.${document.file_type.split("/")[1]}`;
    link.click();
    toast.success(t("downloadStarted", "Download started"));
  };

  // View document
  const handleView = (document: LeadDocument) => {
    window.open(document.file_path, "_blank");
  };

  // Reset upload form
  const resetUploadForm = () => {
    setSelectedFile(null);
    setDocumentName("");
    setDocumentCategory("other");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return FileImage;
    if (fileType.includes("spreadsheet") || fileType.includes("excel")) return FileSpreadsheet;
    return FileText;
  };

  if (isLoading) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("documents", "Documents")}
              </CardTitle>
            </div>
            {!readOnly && (
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t("uploadDocument", "Upload")}
              </Button>
            )}
          </div>
          <CardDescription className="text-[#777777]">
            {t("documentsDescription", "Manage documents and files for this lead")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E6E6E4] p-12 text-center">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noDocuments", "No documents")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">
                {t("noDocumentsDescription", "Upload contracts, IDs, or other files")}
              </p>
              {!readOnly && (
                <Button
                  variant="outline"
                  onClick={() => setUploadDialogOpen(true)}
                  className="mt-4 border-[#E6E6E4]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addDocument", "Add Document")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const config = CATEGORY_CONFIG[doc.category];
                const FileIcon = getFileIcon(doc.file_type);

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#E6E6E4] hover:bg-[#FAFAF8] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: config.bgColor }}
                      >
                        <FileIcon className="h-5 w-5" style={{ color: config.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#222222] truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs py-0"
                            style={{ 
                              color: config.color, 
                              borderColor: `${config.color}40`,
                              backgroundColor: config.bgColor,
                            }}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-xs text-[#999999]">
                            {formatFileSize(doc.file_size)}
                          </span>
                          <span className="text-xs text-[#999999]">
                            {format(parseISO(doc.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(doc)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {t("view", "View")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4 mr-2" />
                          {t("download", "Download")}
                        </DropdownMenuItem>
                        {!readOnly && (
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedDocument(doc);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("delete", "Delete")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("uploadDocument", "Upload Document")}
            </DialogTitle>
            <DialogDescription>
              {t("uploadDocumentDescription", "Add a document to this lead's file")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                dragActive 
                  ? "border-[#C6A03B] bg-[#FFF9E6]" 
                  : "border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]",
                selectedFile && "border-[#0C5536] bg-[#E6F7F1]"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-[#0C5536]" />
                  <div className="text-left">
                    <p className="font-medium text-[#222222]">{selectedFile.name}</p>
                    <p className="text-sm text-[#6B6B6B]">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ml-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                  <p className="text-sm text-[#555555]">
                    {t("dragAndDrop", "Drag and drop a file or")}
                  </p>
                  <Button
                    variant="link"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[hsl(var(--jw-primary-green))] p-0 h-auto"
                  >
                    {t("browseFiles", "browse files")}
                  </Button>
                  <p className="text-xs text-[#999999] mt-2">
                    {t("maxFileSize", "Max 10MB • PDF, Images, Office docs")}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_FILE_TYPES.join(",")}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>

            {/* Document name */}
            <div>
              <Label className="text-[#222222]">{t("documentName", "Document Name")}</Label>
              <Input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder={t("enterDocumentName", "Enter document name")}
                className="mt-1 border-[#E6E6E4]"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-[#222222]">{t("category", "Category")}</Label>
              <Select value={documentCategory} onValueChange={(value: DocumentCategory) => setDocumentCategory(value)}>
                <SelectTrigger className="mt-1 border-[#E6E6E4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" style={{ color: config.color }} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                resetUploadForm();
              }}
              className="border-[#E6E6E4]"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t("upload", "Upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#C0392B]">
              {t("deleteDocument", "Delete Document")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDocumentWarning", 'Are you sure you want to delete "{{name}}"? This action cannot be undone.', {
                name: selectedDocument?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E6E6E4]">{t("cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#C0392B] hover:bg-[#A33025] text-white"
            >
              {t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
