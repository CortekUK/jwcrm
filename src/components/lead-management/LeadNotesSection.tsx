"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Loader2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface LeadNotesSectionProps {
  leadId: string;
  initialNotes: string | null;
  updatedAt: string;
}

export function LeadNotesSection({ leadId, initialNotes, updatedAt }: LeadNotesSectionProps) {
  const { t } = useTranslation("leadManagement");
  const [notes, setNotes] = useState(initialNotes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(updatedAt);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-save with debounce
  const saveNotes = useCallback(async (value: string) => {
    setIsSaving(true);
    try {
      // The notes endpoint identifies the caller from their access token, and
      // restricts salespeople to leads assigned to them, so it must be sent.
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`/api/lead-management/leads/${leadId}/notes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ notes: value }),
      });

      if (!response.ok) {
        // Surface the server's reason (e.g. "This lead is not assigned to
        // you") instead of a generic failure the user can't act on.
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || "Failed to save notes");
      }

      const { data } = await response.json();
      setLastSaved(data.updated_at);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("failedToSaveNotes")
      );
    } finally {
      setIsSaving(false);
    }
  }, [leadId, t]);

  // Debounced auto-save
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      saveNotes(notes);
    }, 1500);

    return () => clearTimeout(timer);
  }, [notes, hasChanges, saveNotes]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            {t("notes")}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("saving")}
              </>
            ) : hasChanges ? (
              <span>{t("unsavedChanges")}</span>
            ) : lastSaved ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                {t("lastEdited")}: {format(new Date(lastSaved), "MMM d, yyyy h:mm a")}
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder={t("addNotesPlaceholder")}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setHasChanges(true);
          }}
          rows={4}
          className="resize-y"
        />
      </CardContent>
    </Card>
  );
}
