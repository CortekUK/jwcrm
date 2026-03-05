"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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

interface Note {
  id: string;
  lead_id: string;
  content: string;
  created_by: string | null;
  created_by_name: string | null;
  updated_at: string;
  created_at: string;
}

interface LeadNotesProps {
  leadId: string;
  initialNotes?: Note[];
}

export function LeadNotes({ leadId, initialNotes }: LeadNotesProps) {
  const { t } = useTranslation("leadManagement");
  const { profile } = useAuth();

  const canEdit = profile?.roles?.some(r => ["lead_management", "admin", "superadmin"].includes(r)) ?? false;

  const [notes, setNotes] = useState<Note[]>(initialNotes || []);
  const [isLoading, setIsLoading] = useState(!initialNotes);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!initialNotes) {
      fetchNotes();
    }
  }, [leadId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${leadId}/notes`);
      if (response.ok) {
        const { data } = await response.json();
        setNotes(data || []);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/lead-management/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newNoteContent,
          created_by: profile?.user_id || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to add note");

      toast.success(t("noteAdded", "Note added"));
      setNewNoteContent("");
      setShowAddForm(false);
      fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error(t("failedToAddNote", "Failed to add note"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim()) return;
    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/lead-management/leads/${leadId}/notes/${noteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editingContent }),
        }
      );

      if (!response.ok) throw new Error("Failed to update note");

      toast.success(t("noteUpdated", "Note updated"));
      setEditingNoteId(null);
      setEditingContent("");
      fetchNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error(t("failedToUpdateNote", "Failed to update note"));
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (!deletingNoteId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/lead-management/leads/${leadId}/notes/${deletingNoteId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete note");

      toast.success(t("noteDeleted", "Note deleted"));
      setDeletingNoteId(null);
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(t("failedToDeleteNote", "Failed to delete note"));
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  return (
    <>
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-[#C6A03B]" />
              <CardTitle className="text-[hsl(var(--jw-primary-green))]">
                {t("notes", "Notes")}
              </CardTitle>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="border-[#E6E6E4] hover:bg-[hsl(var(--jw-gold-accent))]/10 hover:border-[hsl(var(--jw-gold-accent))]"
              >
                <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("addNote", "Add Note")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Note Form */}
          {showAddForm && (
            <div className="space-y-3 p-4 rounded-lg border border-[#C6A03B]/30 bg-[#FFF9E6]/30">
              <Textarea
                placeholder={t("noteContentPlaceholder", "Write a note...")}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="min-h-[80px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAddForm(false); setNewNoteContent(""); }}
                  className="border-[#E6E6E4]"
                >
                  <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={isSaving || !newNoteContent.trim()}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  )}
                  {t("save", "Save")}
                </Button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && notes.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <StickyNote className="h-10 w-10 text-[#C6A03B] mb-3" />
              <p className="font-medium text-[#222222]">{t("noNotes", "No notes yet")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{t("noNotesDescription", "Add notes to keep track of important information")}</p>
            </div>
          )}

          {/* Notes list */}
          {!isLoading && notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-lg border border-[#E6E6E4] bg-white hover:border-[#E6E6E4]/80 transition-colors"
            >
              {editingNoteId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="min-h-[80px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingNoteId(null); setEditingContent(""); }}
                      className="border-[#E6E6E4]"
                    >
                      <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      {t("cancel")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={isUpdating || !editingContent.trim()}
                      className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      )}
                      {t("save", "Save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#333333] whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F0F0F0]">
                    <div className="flex items-center gap-2 text-xs text-[#999999]">
                      <User className="h-3 w-3" />
                      <span>{note.created_by_name || t("unknown", "Unknown")}</span>
                      <span>-</span>
                      <span>{format(new Date(note.created_at), "MMM d, yyyy h:mm a")}</span>
                      {note.updated_at !== note.created_at && (
                        <span className="italic">({t("edited", "edited")})</span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#999999] hover:text-[#0C5536]"
                          onClick={() => startEditing(note)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#999999] hover:text-[#C0392B]"
                          onClick={() => setDeletingNoteId(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingNoteId} onOpenChange={(open) => { if (!open) setDeletingNoteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteNote", "Delete Note")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteNoteConfirm", "Are you sure you want to delete this note? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNote}
              disabled={isDeleting}
              className="bg-[#C0392B] hover:bg-[#A93226] text-white"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
