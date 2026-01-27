"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  Star,
  FileText,
  GripVertical,
  Check,
} from "lucide-react";

type TemplateSection = {
  id: string;
  title: string;
  type: "textarea" | "readonly" | "list";
  required: boolean;
  order: number;
};

type ReviewTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  sections: TemplateSection[];
  created_at: string;
};

const defaultSections: TemplateSection[] = [
  { id: "kpi_performance", title: "KPI Performance", type: "readonly", required: true, order: 1 },
  { id: "performance_summary", title: "Performance Summary", type: "textarea", required: true, order: 2 },
  { id: "strengths", title: "Strengths", type: "textarea", required: true, order: 3 },
  { id: "areas_for_improvement", title: "Areas for Improvement", type: "textarea", required: true, order: 4 },
  { id: "goals_next_quarter", title: "Goals for Next Quarter", type: "textarea", required: true, order: 5 },
  { id: "development_plan", title: "Development Plan", type: "textarea", required: false, order: 6 },
  { id: "manager_comments", title: "Manager Comments", type: "textarea", required: false, order: 7 },
];

export function ReviewTemplateManager() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();

  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReviewTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    sections: defaultSections,
  });

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("review_templates")
          .select("*")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        setTemplates((data || []).map(t => ({
          ...t,
          sections: (t.sections as TemplateSection[]) || defaultSections,
        })));
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.errorLoadingTemplates"),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [t, toast]);

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      description: "",
      is_active: true,
      sections: defaultSections,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (template: ReviewTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      is_active: template.is_active,
      sections: template.sections,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        description: t("hr:reviews.templateNameRequired"),
      });
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
        sections: formData.sections,
        updated_at: new Date().toISOString(),
      };

      if (selectedTemplate) {
        // Update existing
        const { error } = await supabase
          .from("review_templates")
          .update(templateData)
          .eq("id", selectedTemplate.id);

        if (error) throw error;

        setTemplates(prev => prev.map(t => 
          t.id === selectedTemplate.id 
            ? { ...t, ...templateData }
            : t
        ));

        toast({
          title: t("hr:reviews.templateUpdated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
      } else {
        // Create new
        const { data, error } = await supabase
          .from("review_templates")
          .insert({
            ...templateData,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;

        setTemplates(prev => [...prev, {
          ...data,
          sections: data.sections as TemplateSection[],
        }]);

        toast({
          title: t("hr:reviews.templateCreated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
      }

      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorSavingTemplate"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setDeleting(selectedTemplate.id);
    try {
      const { error } = await supabase
        .from("review_templates")
        .delete()
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== selectedTemplate.id));
      setDeleteDialogOpen(false);

      toast({
        title: t("hr:reviews.templateDeleted"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorDeletingTemplate"),
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from("review_templates")
        .update({ is_default: false })
        .neq("id", "placeholder");

      // Then set the new default
      const { error } = await supabase
        .from("review_templates")
        .update({ is_default: true })
        .eq("id", templateId);

      if (error) throw error;

      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === templateId,
      })));

      toast({
        title: t("hr:reviews.defaultTemplateSet"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error setting default template:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorSettingDefault"),
      });
    }
  };

  const toggleSectionRequired = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, required: !s.required } : s
      ),
    }));
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0C5536]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div>
              <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <FileText className="h-5 w-5 text-[#C6A03B]" />
                {t("hr:reviews.reviewTemplates")}
              </CardTitle>
              <CardDescription>
                {t("hr:reviews.manageReviewTemplates")}
              </CardDescription>
            </div>
            <Button
              onClick={handleCreate}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("hr:reviews.newTemplate")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
              <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.noTemplatesFound")}</p>
              <Button
                onClick={handleCreate}
                variant="outline"
                className="mt-4 border-[#E6E6E4]"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("hr:reviews.createFirstTemplate")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#E6E6E4] dark:border-gray-700">
                  <TableHead className={isRtl ? "text-right" : ""}>{t("hr:reviews.templateName")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : ""}>{t("common:description")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.sections")}</TableHead>
                  <TableHead className="text-center">{t("hr:reviews.status")}</TableHead>
                  <TableHead className="text-center">{t("common:actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} className="border-[#E6E6E4] dark:border-gray-700">
                    <TableCell className={isRtl ? "text-right" : ""}>
                      <div className="flex items-center gap-2">
                        {template.is_default && (
                          <Star className="h-4 w-4 text-[#C6A03B] fill-[#C6A03B]" />
                        )}
                        <span className="font-medium text-[#222222] dark:text-gray-200">
                          {template.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[#6B6B6B] dark:text-gray-400 ${isRtl ? "text-right" : ""}`}>
                      {template.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-[#E6E6E4]">
                        {template.sections.length} {t("hr:reviews.sections")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {template.is_active ? (
                        <Badge className="bg-[#E6F7F1] text-[#0C5536]">
                          {t("hr:reviews.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[#6B6B6B]">
                          {t("hr:reviews.inactive")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`flex items-center justify-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template.id)}
                            className="text-[#C6A03B] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? t("hr:reviews.editTemplate") : t("hr:reviews.createTemplate")}
            </DialogTitle>
            <DialogDescription>
              {t("hr:reviews.templateDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Template Name */}
            <div className="space-y-2">
              <Label>{t("hr:reviews.templateName")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t("hr:reviews.templateNamePlaceholder")}
                className="border-[#E6E6E4] dark:border-gray-600"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t("common:description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("hr:reviews.templateDescriptionPlaceholder")}
                className="border-[#E6E6E4] dark:border-gray-600"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#FAFAF8] dark:bg-gray-800 rounded-lg">
              <div>
                <Label>{t("hr:reviews.active")}</Label>
                <p className="text-sm text-[#6B6B6B] dark:text-gray-400">
                  {t("hr:reviews.activeDescription")}
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            {/* Sections Configuration */}
            <div className="space-y-2">
              <Label>{t("hr:reviews.templateSections")}</Label>
              <div className="space-y-2">
                {formData.sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-3 bg-[#FAFAF8] dark:bg-gray-800 rounded-lg border border-[#E6E6E4] dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-[#6B6B6B] cursor-move" />
                      <div>
                        <p className="font-medium text-[#222222] dark:text-gray-200">
                          {section.title}
                        </p>
                        <p className="text-xs text-[#6B6B6B] dark:text-gray-400">
                          {section.type === "readonly" ? t("hr:reviews.readonlySection") : t("hr:reviews.editableSection")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {section.type !== "readonly" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSectionRequired(section.id)}
                          className={section.required ? "text-[#0C5536]" : "text-[#6B6B6B]"}
                        >
                          {section.required ? (
                            <Check className="h-4 w-4" />
                          ) : null}
                          <span className="text-xs ml-1">
                            {section.required ? t("hr:reviews.required") : t("hr:reviews.optional")}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedTemplate ? t("common:save") : t("common:create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("hr:reviews.deleteTemplate")}</DialogTitle>
            <DialogDescription>
              {t("hr:reviews.deleteTemplateConfirmation", { name: selectedTemplate?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting === selectedTemplate?.id}
            >
              {deleting === selectedTemplate?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("common:delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
