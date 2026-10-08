"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquareWarning, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_ATTACHMENT_TYPES,
  FEEDBACK_MAX_ATTACHMENT_BYTES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  type FeedbackCategory,
} from "@/lib/feedback/validateFeedback";

interface ReportIssueButtonProps {
  /**
   * sidebar  – full-width row for the dark staff sidebar footer
   * compact  – icon-only, for the collapsed sidebar (needs a TooltipProvider)
   * header   – outlined button for light top headers
   * icon     – icon-only ghost button for the mobile top bar
   */
  variant?: "sidebar" | "compact" | "header" | "icon";
  className?: string;
}

const CATEGORY_KEYS: FeedbackCategory[] = ["bug", "suggestion", "question"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ReportIssueButton({ variant = "header", className }: ReportIssueButtonProps) {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [sender, setSender] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = t("feedback.button", "Report an issue");

  // Capture the page and sender each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPageUrl(window.location.href);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setSender({
        name:
          profile?.full_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          "",
        email: user.email || "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setCategory("bug");
    setMessage("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    if (!picked) {
      setFile(null);
      return;
    }
    if (!(FEEDBACK_ATTACHMENT_TYPES as readonly string[]).includes(picked.type)) {
      toast.error(t("feedback.invalidImage", "Screenshot must be a PNG, JPEG, GIF or WebP image"));
      e.target.value = "";
      return;
    }
    if (picked.size > FEEDBACK_MAX_ATTACHMENT_BYTES) {
      toast.error(t("feedback.imageTooLarge", "Screenshot must be 3 MB or smaller"));
      e.target.value = "";
      return;
    }
    setFile(picked);
  };

  const trimmedLength = message.trim().length;
  const canSubmit =
    !sending && trimmedLength >= FEEDBACK_MESSAGE_MIN && message.length <= FEEDBACK_MESSAGE_MAX;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error(t("feedback.notSignedIn", "Your session has expired. Please sign in again."));
        return;
      }

      const attachment = file
        ? {
            content: await readFileAsBase64(file),
            filename: file.name,
            contentType: file.type,
          }
        : undefined;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, message, pageUrl, attachment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success(t("feedback.sent", "Thanks — your report has been sent to the team."));
      reset();
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(t("feedback.failed", "Could not send your report"), {
        description: msg || undefined,
      });
    } finally {
      setSending(false);
    }
  };

  const trigger = (() => {
    const icon = <MessageSquareWarning className="h-4 w-4 shrink-0" />;
    switch (variant) {
      case "compact":
        return (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                onClick={() => setOpen(true)}
                className={cn(
                  "flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
                  className
                )}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side={isRtl ? "left" : "right"}
              className="bg-sidebar text-sidebar-foreground border-sidebar-border"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        );
      case "sidebar":
        return (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
              isRtl && "flex-row-reverse",
              className
            )}
          >
            {icon}
            <span className="truncate">{label}</span>
          </button>
        );
      case "icon":
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            onClick={() => setOpen(true)}
            className={className}
          >
            <MessageSquareWarning className="h-5 w-5" />
          </Button>
        );
      default:
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className={cn("gap-2", className)}
            title={label}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </Button>
        );
    }
  })();

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!sending) setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("feedback.title", "Report an issue")}</DialogTitle>
              <DialogDescription>
                {t(
                  "feedback.description",
                  "Tell the team what isn't working or what could be better. Your report is emailed to the office."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="feedback-category">{t("feedback.category", "Category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as FeedbackCategory)}
                disabled={sending}
              >
                <SelectTrigger id="feedback-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`feedback.categories.${key}`, {
                        defaultValue:
                          key === "bug"
                            ? "Something isn't working"
                            : key === "suggestion"
                            ? "Suggestion"
                            : "Question",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">{t("feedback.message", "Message")}</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={FEEDBACK_MESSAGE_MAX}
                rows={6}
                disabled={sending}
                required
                placeholder={t(
                  "feedback.messagePlaceholder",
                  "What happened? What did you expect to happen?"
                )}
              />
              <p className="text-xs text-muted-foreground text-end">
                {message.length}/{FEEDBACK_MESSAGE_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-screenshot">
                {t("feedback.screenshot", "Screenshot")}{" "}
                <span className="text-muted-foreground font-normal">
                  ({t("optional", "Optional")})
                </span>
              </Label>
              <Input
                id="feedback-screenshot"
                ref={fileInputRef}
                type="file"
                accept={FEEDBACK_ATTACHMENT_TYPES.join(",")}
                onChange={handleFileChange}
                disabled={sending}
              />
              {file && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={t("remove", "Remove")}
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={sending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="break-all">
                <span className="font-medium">{t("feedback.from", "From")}:</span>{" "}
                {sender.name || sender.email
                  ? `${sender.name}${sender.name && sender.email ? " " : ""}${sender.email ? `<${sender.email}>` : ""}`
                  : "…"}
              </p>
              <p className="break-all">
                <span className="font-medium">{t("feedback.page", "Page")}:</span> {pageUrl}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                {t("cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? t("feedback.sending", "Sending…") : t("feedback.send", "Send report")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
