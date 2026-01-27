"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  FinanceTransaction,
  TransactionType,
  TransactionCategory,
  EARNING_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editTransaction?: FinanceTransaction | null;
  defaultType?: TransactionType;
}

const transactionFormSchema = z.object({
  type: z.enum(["earning", "expense"]),
  category: z.string().min(1, "Please select a category"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(1, "Please select a currency"),
  description: z.string().optional(),
  reference_number: z.string().optional(),
  transaction_date: z.string().min(1, "Please select a date"),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR"];
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  editTransaction,
  defaultType = "earning",
}: AddTransactionDialogProps) {
  const { t } = useTranslation("finance");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: defaultType,
      category: "",
      amount: 0,
      currency: "AED",
      description: "",
      reference_number: "",
      transaction_date: new Date().toISOString().split("T")[0],
    },
  });

  const watchType = form.watch("type");
  const categories = watchType === "earning" ? EARNING_CATEGORIES : EXPENSE_CATEGORIES;

  // Reset form when dialog opens/closes or editTransaction changes
  useEffect(() => {
    if (open) {
      if (editTransaction) {
        form.reset({
          type: editTransaction.type,
          category: editTransaction.category,
          amount: editTransaction.amount,
          currency: editTransaction.currency,
          description: editTransaction.description || "",
          reference_number: editTransaction.reference_number || "",
          transaction_date: editTransaction.transaction_date,
        });
        setExistingReceiptPath(editTransaction.receipt_path);
      } else {
        form.reset({
          type: defaultType,
          category: "",
          amount: 0,
          currency: "AED",
          description: "",
          reference_number: "",
          transaction_date: new Date().toISOString().split("T")[0],
        });
        setExistingReceiptPath(null);
      }
      setReceiptFile(null);
    }
  }, [open, editTransaction, defaultType, form]);

  // Reset category when type changes
  useEffect(() => {
    const currentCategory = form.getValues("category") as TransactionCategory;
    if (currentCategory && !categories.includes(currentCategory)) {
      form.setValue("category", "");
    }
  }, [watchType, categories, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(t("invalidFileType"));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("fileTooLarge"));
      return;
    }

    setReceiptFile(file);
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeExistingReceipt = () => {
    setExistingReceiptPath(null);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("finance-receipts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error("Error uploading receipt:", error);
      toast.error(t("failedToUploadReceipt"));
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("finance-receipts")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error getting receipt URL:", error);
      toast.error(t("failedToOpenReceipt"));
    }
  };

  const handleSubmit = async (data: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
      let receiptPath = existingReceiptPath;

      // Upload new receipt if selected
      if (receiptFile) {
        const uploadedPath = await uploadReceipt(receiptFile);
        if (uploadedPath) {
          receiptPath = uploadedPath;
        }
      }

      const url = editTransaction
        ? `/api/finance/transactions/${editTransaction.id}`
        : "/api/finance/transactions";

      const response = await fetch(url, {
        method: editTransaction ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          category: data.category,
          amount: data.amount,
          currency: data.currency,
          description: data.description || null,
          reference_number: data.reference_number || null,
          receipt_path: receiptPath,
          transaction_date: data.transaction_date,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save transaction");
      }

      toast.success(
        editTransaction ? t("transactionUpdated") : t("transactionAdded")
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error(
        error instanceof Error ? error.message : t("failedToSaveTransaction")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editTransaction ? t("editTransaction") : t("addTransaction")}
          </DialogTitle>
          <DialogDescription>
            {editTransaction
              ? t("editTransactionDescription")
              : t("addTransactionDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("type")} *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editTransaction}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="earning">{t("earning")}</SelectItem>
                        <SelectItem value="expense">{t("expense")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("category")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {t(`categories.${category}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("amount")} *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currency")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCurrency")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="transaction_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("transactionDate")} *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("referenceNumber")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("referenceNumberPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receipt Upload Field */}
            <div className="space-y-2">
              <FormLabel>{t("receipt")}</FormLabel>

              {/* Show existing receipt if present */}
              {existingReceiptPath && !receiptFile && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {t("existingReceipt")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openReceipt(existingReceiptPath)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={removeExistingReceipt}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Show selected file */}
              {receiptFile && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-sm text-blue-700 flex-1 truncate">
                    {receiptFile.name}
                  </span>
                  <span className="text-xs text-blue-500">
                    ({(receiptFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={removeReceipt}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* File input */}
              {!receiptFile && (
                <div className="relative">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {t("uploadReceipt")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("receiptFileTypes")}
                  </p>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isUploading}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && (
                  <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                )}
                {editTransaction ? t("saveChanges") : t("addTransaction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
