import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, Edit2, MessageSquare, HelpCircle, ClipboardCheck, GripVertical, Copy, RefreshCw } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from "@/components/SortableItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormattedContent } from "@/components/FormattedContent";
import { TemplateEditor } from "@/components/TemplateEditor";
import { TemplateList } from "@/components/TemplateList";

// FormattedContent extracted to src/components/FormattedContent.tsx

interface Template {
  id: string;
  service_name: string;
  script_content: string;
  created_at: string;
  image_url?: string;
  service_type_id?: string;
  objection_handling?: string;
  client_id: string;
}

interface ObjectionTemplate {
  id: string;
  service_name: string;
  content: string;
  created_at: string;
}

interface FAQ {
  id: string;
  service_type_id: string | null;
  question: string;
  answer: string;
  created_at: string;
}

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface QualificationQuestion {
  id: string;
  service_type_id: string | null;
  question: string;
  display_order: number;
  created_at: string;
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [qualificationQuestions, setQualificationQuestions] = useState<QualificationQuestion[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showObjectionForm, setShowObjectionForm] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [showQualificationForm, setShowQualificationForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingObjection, setEditingObjection] = useState<ObjectionTemplate | null>(null);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [editingQualification, setEditingQualification] = useState<QualificationQuestion | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [objectionServiceName, setObjectionServiceName] = useState("");
  const [objectionContent, setObjectionContent] = useState("");
  const [faqServiceTypeId, setFaqServiceTypeId] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [qualificationServiceTypeId, setQualificationServiceTypeId] = useState("");
  const [qualificationQuestion, setQualificationQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateImageFile, setTemplateImageFile] = useState<File | null>(null);
  const [userOrganizationId, setUserOrganizationId] = useState<string | null>(null);
  const [selectedTemplateServiceTypeId, setSelectedTemplateServiceTypeId] = useState<string>("");
  const [updatingScripts, setUpdatingScripts] = useState<string | null>(null);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushTemplate, setPushTemplate] = useState<Template | null>(null);
  const [availableClients, setAvailableClients] = useState<Array<{ id: string; name: string; script_id: string }>>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  useEffect(() => {
    loadUserOrganization();
    loadFaqs();
    loadServiceTypes();

    // Set up real-time subscriptions
    const templatesChannel = supabase
      .channel('templates-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, () => {
        loadTemplates();
      })
      .subscribe();

    const objectionChannel = supabase
      .channel('objection-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objection_handling_templates' }, () => {
        loadObjectionTemplates();
      })
      .subscribe();

    const faqsChannel = supabase
      .channel('faqs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, () => {
        loadFaqs();
      })
      .subscribe();

    const serviceTypesChannel = supabase
      .channel('service-types-tmpl-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_types' }, () => {
        loadServiceTypes();
      })
      .subscribe();

    const qualificationQuestionsChannel = supabase
      .channel('qualification-questions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qualification_questions' }, () => {
        loadQualificationQuestions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(templatesChannel);
      supabase.removeChannel(objectionChannel);
      supabase.removeChannel(faqsChannel);
      supabase.removeChannel(serviceTypesChannel);
      supabase.removeChannel(qualificationQuestionsChannel);
    };
  }, []);

  useEffect(() => {
    if (userOrganizationId) {
      loadTemplates();
      loadObjectionTemplates();
      loadQualificationQuestions();
      loadFaqs();
      loadServiceTypes();
    }
  }, [userOrganizationId]);

  const loadUserOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserOrganizationId(data?.organization_id || null);
    } catch (error) {
      console.error('Error loading user organization:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      if (!userOrganizationId) return;
      
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .eq("is_template", true)
        .eq("organization_id", userOrganizationId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const loadObjectionTemplates = async () => {
    try {
      if (!userOrganizationId) return;
      
      const { data, error } = await supabase
        .from("objection_handling_templates")
        .select("*")
        .eq("organization_id", userOrganizationId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setObjectionTemplates(data || []);
    } catch (error) {
      console.error("Error loading objection templates:", error);
      toast.error("Failed to load objection handling templates");
    }
  };

  const loadFaqs = async () => {
    try {
      if (!userOrganizationId) return;
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq("organization_id", userOrganizationId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error("Error loading FAQs:", error);
      toast.error("Failed to load FAQs");
    }
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error("Error loading service types:", error);
      toast.error("Failed to load service types");
    }
  };

  const loadQualificationQuestions = async () => {
    try {
      if (!userOrganizationId) return;
      
      const { data, error } = await supabase
        .from("qualification_questions")
        .select("*")
        .eq("organization_id", userOrganizationId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setQualificationQuestions(data || []);
    } catch (error) {
      console.error("Error loading qualification questions:", error);
      toast.error("Failed to load qualification questions");
    }
  };


  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setServiceName(template.service_name);
    setScriptContent(template.script_content);
    setSelectedTemplateServiceTypeId(template.service_type_id || "");
    setShowCreateForm(true);
  };

  const handleCreate = async () => {
    if (!serviceName.trim() || !scriptContent.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrl: string | null = null;

      // If a new image was selected, upload it first
      if (templateImageFile) {
        const ext = templateImageFile.name.split('.').pop() || 'png';
        const safeName = serviceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const filePath = `${safeName}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('template-images')
          .upload(filePath, templateImageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('template-images').getPublicUrl(filePath);
        uploadedImageUrl = data.publicUrl;
      }

      if (editingTemplate?.id) {
        // Update existing template
        const updatePayload: any = {
          service_name: serviceName,
          script_content: scriptContent,
          service_type_id: selectedTemplateServiceTypeId || null,
        };
        if (uploadedImageUrl) updatePayload.image_url = uploadedImageUrl;

        const { error } = await supabase
          .from('scripts')
          .update(updatePayload)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully!');
      } else {
        // Create new template - require service type selection
        if (!selectedTemplateServiceTypeId || selectedTemplateServiceTypeId.trim() === '') {
          toast.error('Please select a service type for this template');
          setSaving(false);
          return;
        }

        const insertPayload: any = {
          client_id: '00000000-0000-0000-0000-000000000001',
          service_name: serviceName,
          script_content: scriptContent,
          is_template: true,
          version: 1,
          organization_id: userOrganizationId,
          service_type_id: selectedTemplateServiceTypeId,
        };
        if (uploadedImageUrl) insertPayload.image_url = uploadedImageUrl;

        const { error } = await supabase.from('scripts').insert(insertPayload);

        if (error) throw error;
        toast.success('Template created successfully!');
      }

      setServiceName('');
      setScriptContent('');
      setTemplateImageFile(null);
      setSelectedTemplateServiceTypeId('');
      setShowCreateForm(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Template deleted successfully!");
      loadTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error(error.message || "Failed to delete template");
    }
  };

  const handleOpenPushDialog = async (template: Template) => {
    if (!template.service_type_id) {
      toast.error("This template doesn't have a service type assigned");
      return;
    }

    setPushTemplate(template);
    
    try {
      // Fetch all clients with scripts of this service type
      const { data: scriptsData, error: scriptsError } = await supabase
        .from("scripts")
        .select("id, client_id, clients(name)")
        .eq("service_type_id", template.service_type_id)
        .eq("is_template", false);

      if (scriptsError) throw scriptsError;

      // Map to client list with unique clients
      const clientsMap = new Map<string, { id: string; name: string; script_id: string }>();
      scriptsData?.forEach((script: any) => {
        if (script.clients && !clientsMap.has(script.client_id)) {
          clientsMap.set(script.client_id, {
            id: script.client_id,
            name: script.clients.name,
            script_id: script.id,
          });
        }
      });

      setAvailableClients(Array.from(clientsMap.values()));
      setSelectedClientIds([]);
      setShowPushDialog(true);
    } catch (error: any) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    }
  };

  const handleUpdateAllScripts = async (clientIds?: string[]) => {
    if (!pushTemplate?.service_type_id) {
      toast.error("This template doesn't have a service type assigned");
      return;
    }

    setUpdatingScripts(pushTemplate.id);
    setShowPushDialog(false);
    
    try {
      // Find all non-template scripts with matching service type
      let query = supabase
        .from("scripts")
        .select("id, client_id, service_name, service_type_id")
        .eq("service_type_id", pushTemplate.service_type_id)
        .eq("is_template", false);

      // Filter by specific clients if provided
      if (clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }

      const { data: scriptsToUpdate, error: scriptsError } = await query;

      if (scriptsError) throw scriptsError;

      if (!scriptsToUpdate || scriptsToUpdate.length === 0) {
        toast.info("No scripts found to update");
        return;
      }

      toast.info(`Updating ${scriptsToUpdate.length} script(s)...`);

      let successCount = 0;
      let failCount = 0;

      // Update each script
      for (const script of scriptsToUpdate) {
        try {
          // Get client details for this script
          const { data: clientDetails, error: detailsError } = await supabase
            .from("client_details")
            .select("*")
            .eq("client_id", script.client_id);

          if (detailsError) throw detailsError;

          // Build service details object from client_details
          const serviceDetails: Record<string, any> = {};
          clientDetails?.forEach((detail) => {
            // Prioritize script-specific fields
            if (detail.field_name.startsWith(`script_${script.id}_`)) {
              const cleanFieldName = detail.field_name.replace(`script_${script.id}_`, '');
              serviceDetails[cleanFieldName] = detail.field_value;
            } else if (!serviceDetails[detail.field_name]) {
              serviceDetails[detail.field_name] = detail.field_value;
            }
          });

          // Call extract-client-data to regenerate script with updated template
          // CRITICAL: Pass service_name and service_type_id to preserve original script info
          const { data: result, error: extractError } = await supabase.functions.invoke(
            "extract-client-data",
            {
              body: {
                client_id: script.client_id,
                script_id: script.id,
                service_name: script.service_name, // Preserve original service name
                service_type_id: script.service_type_id, // Preserve original service type
                use_template: true,
                template_script: pushTemplate.script_content,
                service_details: serviceDetails,
              },
            }
          );

          if (extractError) throw extractError;

          successCount++;
        } catch (error: any) {
          console.error(`Error updating script ${script.id}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully updated ${successCount} script(s)!`);
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} script(s)`);
      }

    } catch (error: any) {
      console.error("Error updating scripts:", error);
      toast.error(error.message || "Failed to update scripts");
    } finally {
      setUpdatingScripts(null);
      setPushTemplate(null);
    }
  };

  const handleToggleClient = (clientId: string) => {
    setSelectedClientIds(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAllClients = () => {
    if (selectedClientIds.length === availableClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(availableClients.map(c => c.id));
    }
  };

  const handleDuplicate = async (template: Template) => {
    if (!userOrganizationId) {
      toast.error("Organization not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("scripts")
        .insert({
          service_name: `${template.service_name} (Copy)`,
          script_content: template.script_content,
          objection_handling: template.objection_handling,
          is_template: true,
          client_id: template.client_id,
          organization_id: userOrganizationId,
          service_type_id: template.service_type_id,
          image_url: template.image_url,
        });

      if (error) throw error;

      toast.success("Template duplicated successfully!");
      loadTemplates();
    } catch (error: any) {
      console.error("Error duplicating template:", error);
      toast.error(error.message || "Failed to duplicate template");
    }
  };

  const handleEditObjection = (template: ObjectionTemplate) => {
    setEditingObjection(template);
    setObjectionServiceName(template.service_name);
    setObjectionContent(template.content);
    setShowObjectionForm(true);
  };

  const handleCreateObjection = async () => {
    if (!objectionServiceName.trim() || !objectionContent.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!userOrganizationId) {
      toast.error("Organization not found");
      return;
    }

    setSaving(true);
    try {
      if (editingObjection) {
        const { error } = await supabase
          .from("objection_handling_templates")
          .update({
            service_name: objectionServiceName,
            content: objectionContent,
          })
          .eq("id", editingObjection.id);

        if (error) throw error;
        toast.success("Objection template updated successfully!");
      } else {
        const { error } = await supabase
          .from("objection_handling_templates")
          .insert({
            service_name: objectionServiceName,
            content: objectionContent,
            organization_id: userOrganizationId,
          });

        if (error) throw error;
        toast.success("Objection template created successfully!");
      }

      setObjectionServiceName("");
      setObjectionContent("");
      setShowObjectionForm(false);
      setEditingObjection(null);
      loadObjectionTemplates();
    } catch (error: any) {
      console.error("Error saving objection template:", error);
      toast.error(error.message || "Failed to save objection template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteObjection = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from("objection_handling_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Objection template deleted successfully!");
      loadObjectionTemplates();
    } catch (error: any) {
      console.error("Error deleting objection template:", error);
      toast.error(error.message || "Failed to delete objection template");
    }
  };

  const handleEditFaq = (faq: FAQ) => {
    setEditingFaq(faq);
    setFaqServiceTypeId(faq.service_type_id || "universal");
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setShowFaqForm(true);
  };

  const handleCreateFaq = async () => {
    if (!faqServiceTypeId || !faqQuestion.trim() || !faqAnswer.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const serviceTypeValue = faqServiceTypeId === "universal" ? null : faqServiceTypeId;
      
      if (editingFaq) {
        const { error } = await supabase
          .from("faqs")
          .update({
            service_type_id: serviceTypeValue,
            question: faqQuestion,
            answer: faqAnswer,
          })
          .eq("id", editingFaq.id);

        if (error) throw error;
        toast.success("FAQ updated successfully!");
      } else {
        const { error } = await supabase
          .from("faqs")
          .insert({
            service_type_id: serviceTypeValue,
            question: faqQuestion,
            answer: faqAnswer,
            organization_id: userOrganizationId,
          });

        if (error) throw error;
        toast.success("FAQ created successfully!");
      }

      setFaqServiceTypeId("");
      setFaqQuestion("");
      setFaqAnswer("");
      setShowFaqForm(false);
      setEditingFaq(null);
      loadFaqs();
    } catch (error: any) {
      console.error("Error saving FAQ:", error);
      toast.error(error.message || "Failed to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    try {
      const { error } = await supabase
        .from("faqs")
        .delete()
        .eq("id", faqId);

      if (error) throw error;

      toast.success("FAQ deleted successfully!");
      loadFaqs();
    } catch (error: any) {
      console.error("Error deleting FAQ:", error);
      toast.error(error.message || "Failed to delete FAQ");
    }
  };

  const handleEditQualification = (question: QualificationQuestion) => {
    setEditingQualification(question);
    setQualificationServiceTypeId(question.service_type_id || "universal");
    setQualificationQuestion(question.question);
    setShowQualificationForm(true);
  };

  const handleCreateQualification = async () => {
    if (!qualificationServiceTypeId || !qualificationQuestion.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const serviceTypeValue = qualificationServiceTypeId === "universal" ? null : qualificationServiceTypeId;
      
      if (editingQualification) {
        const { error } = await supabase
          .from("qualification_questions")
          .update({
            service_type_id: serviceTypeValue,
            question: qualificationQuestion,
          })
          .eq("id", editingQualification.id);

        if (error) throw error;
        toast.success("Question updated successfully!");
      } else {
        const { error } = await supabase
          .from("qualification_questions")
          .insert({
            service_type_id: serviceTypeValue,
            question: qualificationQuestion,
            display_order: qualificationQuestions.length,
            organization_id: userOrganizationId,
          });

        if (error) throw error;
        toast.success("Question created successfully!");
      }

      setQualificationServiceTypeId("");
      setQualificationQuestion("");
      setShowQualificationForm(false);
      setEditingQualification(null);
      loadQualificationQuestions();
    } catch (error: any) {
      console.error("Error saving qualification question:", error);
      toast.error(error.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQualification = async (questionId: string) => {
    try {
      const { error } = await supabase
        .from("qualification_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      toast.success("Question deleted successfully!");
      loadQualificationQuestions();
    } catch (error: any) {
      console.error("Error deleting qualification question:", error);
      toast.error(error.message || "Failed to delete question");
    }
  };

  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEndTemplates = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex(t => t.id === active.id);
    const newIndex = templates.findIndex(t => t.id === over.id);
    
    const reordered = arrayMove(templates, oldIndex, newIndex);
    setTemplates(reordered);

    try {
      const updates = reordered.map((item, index) => 
        supabase.from('scripts').update({ display_order: index }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating template order:', error);
      toast.error('Failed to update order');
      loadTemplates();
    }
  };

  const handleDragEndObjections = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = objectionTemplates.findIndex(t => t.id === active.id);
    const newIndex = objectionTemplates.findIndex(t => t.id === over.id);
    
    const reordered = arrayMove(objectionTemplates, oldIndex, newIndex);
    setObjectionTemplates(reordered);

    try {
      const updates = reordered.map((item, index) => 
        supabase.from('objection_handling_templates').update({ display_order: index }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating objection order:', error);
      toast.error('Failed to update order');
      loadObjectionTemplates();
    }
  };

  const handleDragEndFaqs = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = faqs.findIndex(t => t.id === active.id);
    const newIndex = faqs.findIndex(t => t.id === over.id);
    
    const reordered = arrayMove(faqs, oldIndex, newIndex);
    setFaqs(reordered);

    try {
      const updates = reordered.map((item, index) => 
        supabase.from('faqs').update({ display_order: index }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating FAQ order:', error);
      toast.error('Failed to update order');
      loadFaqs();
    }
  };

  const handleDragEndQualifications = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = qualificationQuestions.findIndex(t => t.id === active.id);
    const newIndex = qualificationQuestions.findIndex(t => t.id === over.id);
    
    const reordered = arrayMove(qualificationQuestions, oldIndex, newIndex);
    setQualificationQuestions(reordered);

    try {
      const updates = reordered.map((item, index) => 
        supabase.from('qualification_questions').update({ display_order: index }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating question order:', error);
      toast.error('Failed to update order');
      loadQualificationQuestions();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable scripts, objection handling, and FAQs
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        <Tabs defaultValue="scripts" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
            <TabsTrigger value="scripts">
              <FileText className="mr-2 h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="objections">
              <MessageSquare className="mr-2 h-4 w-4" />
              Objections
            </TabsTrigger>
            <TabsTrigger value="faqs">
              <HelpCircle className="mr-2 h-4 w-4" />
              FAQs
            </TabsTrigger>
            <TabsTrigger value="qualification">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Qualification
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scripts" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => {
                setShowCreateForm(!showCreateForm);
                if (!showCreateForm) {
                  setEditingTemplate(null);
                  setServiceName("");
                  setScriptContent("");
                  setSelectedTemplateServiceTypeId("");
                }
              }}>
                <Plus className="mr-2 h-4 w-4" />
                New Script Template
              </Button>
            </div>

            {showCreateForm && (
              <TemplateEditor
                editingTemplate={editingTemplate}
                serviceName={serviceName}
                setServiceName={setServiceName}
                scriptContent={scriptContent}
                setScriptContent={setScriptContent}
                selectedTemplateServiceTypeId={selectedTemplateServiceTypeId}
                setSelectedTemplateServiceTypeId={setSelectedTemplateServiceTypeId}
                serviceTypes={serviceTypes}
                setTemplateImageFile={setTemplateImageFile}
                handleCreate={handleCreate}
                saving={saving}
                onCancel={() => {
                  setShowCreateForm(false);
                  setEditingTemplate(null);
                  setServiceName("");
                  setScriptContent("");
                  setTemplateImageFile(null);
                  setSelectedTemplateServiceTypeId("");
                }}
              />
            )}

            <TemplateList
              templates={templates}
              serviceTypes={serviceTypes}
              loading={loading}
              sensors={sensors}
              handleDragEndTemplates={handleDragEndTemplates}
              handleOpenPushDialog={handleOpenPushDialog}
              handleDuplicate={handleDuplicate}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
              updatingScripts={updatingScripts}
              onShowCreateForm={() => setShowCreateForm(true)}
            />
          </TabsContent>

          <TabsContent value="objections" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowObjectionForm(!showObjectionForm)}>
                <Plus className="mr-2 h-4 w-4" />
                New Objection Template
              </Button>
            </div>

            {showObjectionForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingObjection ? "Edit Objection Template" : "Create Objection Template"}</CardTitle>
                  <CardDescription>
                    {editingObjection 
                      ? "Update this objection handling template"
                      : "Create a reusable objection handling script"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="objection-name">Template Name</Label>
                    <Input
                      id="objection-name"
                      placeholder="e.g., Price Objections"
                      value={objectionServiceName}
                      onChange={(e) => setObjectionServiceName(e.target.value)}
                    />
                  </div>
                  <RichTextEditor
                    label="Objection Handling Content"
                    value={objectionContent}
                    onChange={setObjectionContent}
                    placeholder="Enter objection handling responses..."
                    minHeight="200px"
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleCreateObjection} disabled={saving}>
                      {saving ? (editingObjection ? "Updating..." : "Creating...") : (editingObjection ? "Update Template" : "Create Template")}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowObjectionForm(false);
                      setEditingObjection(null);
                      setObjectionServiceName("");
                      setObjectionContent("");
                    }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : objectionTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">No objection templates yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Create objection handling templates to help overcome common customer concerns
                  </p>
                  <Button onClick={() => setShowObjectionForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Objection Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndObjections}>
                <SortableContext items={objectionTemplates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {objectionTemplates.map((template) => (
                      <SortableItem key={template.id} id={template.id}>
                        <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="h-4 w-4 text-primary/70" />
                                </div>
                                <CardTitle className="text-sm font-medium leading-tight truncate">{template.service_name}</CardTitle>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditObjection(template)}
                                  className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Objection Template?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the "{template.service_name}" objection template.
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteObjection(template.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="faqs" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowFaqForm(!showFaqForm)}>
                <Plus className="mr-2 h-4 w-4" />
                New FAQ
              </Button>
            </div>

            {showFaqForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingFaq ? "Edit FAQ" : "Create FAQ"}</CardTitle>
                  <CardDescription>
                    {editingFaq 
                      ? "Update this frequently asked question"
                      : "Create a FAQ for a specific service type"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="faq-service-type">Service Type</Label>
                    <Select value={faqServiceTypeId} onValueChange={setFaqServiceTypeId}>
                      <SelectTrigger id="faq-service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="universal">Universal (All Services)</SelectItem>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="faq-question">Question</Label>
                    <Input
                      id="faq-question"
                      placeholder="e.g., How long does installation take?"
                      value={faqQuestion}
                      onChange={(e) => setFaqQuestion(e.target.value)}
                    />
                  </div>
                  <RichTextEditor
                    label="Answer"
                    value={faqAnswer}
                    onChange={setFaqAnswer}
                    placeholder="Enter the answer..."
                    minHeight="150px"
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleCreateFaq} disabled={saving}>
                      {saving ? (editingFaq ? "Updating..." : "Creating...") : (editingFaq ? "Update FAQ" : "Create FAQ")}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowFaqForm(false);
                      setEditingFaq(null);
                      setFaqServiceTypeId("");
                      setFaqQuestion("");
                      setFaqAnswer("");
                    }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : faqs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">No FAQs yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Create FAQs for your service types to help answer common questions
                  </p>
                  <Button onClick={() => setShowFaqForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create FAQ
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {/* Group FAQs by service type */}
                {(() => {
                  // Group FAQs by service type
                  const faqsByService = faqs.reduce((acc, faq) => {
                    const serviceTypeId = faq.service_type_id || 'universal';
                    if (!acc[serviceTypeId]) {
                      acc[serviceTypeId] = [];
                    }
                    acc[serviceTypeId].push(faq);
                    return acc;
                  }, {} as Record<string, typeof faqs>);

                  // Sort entries to show universal first
                  const sortedEntries = Object.entries(faqsByService).sort(([a], [b]) => {
                    if (a === 'universal') return -1;
                    if (b === 'universal') return 1;
                    return 0;
                  });

                  return sortedEntries.map(([serviceTypeId, serviceFaqs]) => {
                    const serviceType = serviceTypeId !== 'universal' 
                      ? serviceTypes.find(st => st.id === serviceTypeId)
                      : null;
                    
                    return (
                      <div key={serviceTypeId} className="space-y-3">
                        {/* Service Type Header */}
                        <div className="flex items-center gap-3 pb-2 border-b">
                          <h3 className="text-lg font-semibold">
                            {serviceType ? serviceType.name : 'Universal (All Services)'}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {serviceFaqs.length} {serviceFaqs.length === 1 ? 'FAQ' : 'FAQs'}
                          </span>
                        </div>

                        {/* FAQs for this service */}
                         <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndFaqs}>
                          <SortableContext items={serviceFaqs.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {serviceFaqs.map((faq) => (
                                <SortableItem key={faq.id} id={faq.id}>
                                  <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                                    <CardHeader className="py-3 px-4">
                                       <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                            <HelpCircle className="h-4 w-4 text-primary/70" />
                                          </div>
                                          <CardTitle className="text-sm font-medium leading-tight truncate">
                                            {faq.question}
                                          </CardTitle>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditFaq(faq)}
                                            className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                            title="Edit"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Delete"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will permanently delete this FAQ.
                                                  This action cannot be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeleteFaq(faq.id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </div>
                                    </CardHeader>
                                  </Card>
                                </SortableItem>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="qualification" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowQualificationForm(!showQualificationForm)}>
                <Plus className="mr-2 h-4 w-4" />
                New Question
              </Button>
            </div>

            {showQualificationForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingQualification ? "Edit Question" : "Create Qualification Question"}</CardTitle>
                  <CardDescription>
                    {editingQualification 
                      ? "Update this qualification question"
                      : "Create a discovery question to qualify prospects"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="qualification-service-type">Service Type</Label>
                    <Select value={qualificationServiceTypeId} onValueChange={setQualificationServiceTypeId}>
                      <SelectTrigger id="qualification-service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="universal">Universal (All Services)</SelectItem>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qualification-question">Question</Label>
                    <Textarea
                      id="qualification-question"
                      placeholder="e.g., What is the main goal for this project?"
                      value={qualificationQuestion}
                      onChange={(e) => setQualificationQuestion(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleCreateQualification} disabled={saving}>
                      {saving ? (editingQualification ? "Updating..." : "Creating...") : (editingQualification ? "Update Question" : "Create Question")}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowQualificationForm(false);
                      setEditingQualification(null);
                      setQualificationServiceTypeId("");
                      setQualificationQuestion("");
                    }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : qualificationQuestions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">No Qualification Questions yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Create discovery questions to help qualify prospects during sales calls
                  </p>
                  <Button onClick={() => setShowQualificationForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Question
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Universal Questions Section */}
                {qualificationQuestions.filter(q => !q.service_type_id).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-foreground">Universal Questions (All Services)</h3>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndQualifications}>
                      <SortableContext items={qualificationQuestions.filter(q => !q.service_type_id).map(q => q.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {qualificationQuestions.filter(q => !q.service_type_id).map((question) => (
                            <SortableItem key={question.id} id={question.id}>
                              <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                                <CardHeader className="py-3 px-4">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                      <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                        <ClipboardCheck className="h-4 w-4 text-primary/70" />
                                      </div>
                                      <CardTitle className="text-sm font-medium leading-tight truncate">{question.question}</CardTitle>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditQualification(question)}
                                        className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will permanently delete this qualification question.
                                              This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteQualification(question.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                </CardHeader>
                              </Card>
                            </SortableItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* Service-Specific Questions Sections */}
                {serviceTypes.map((serviceType) => {
                  const typeQuestions = qualificationQuestions.filter(q => q.service_type_id === serviceType.id);
                  if (typeQuestions.length === 0) return null;
                  
                  return (
                    <div key={serviceType.id}>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">{serviceType.name} Questions</h3>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndQualifications}>
                        <SortableContext items={typeQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {typeQuestions.map((question) => (
                              <SortableItem key={question.id} id={question.id}>
                                <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                                  <CardHeader className="py-3 px-4">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                          <ClipboardCheck className="h-4 w-4 text-primary/70" />
                                        </div>
                                        <CardTitle className="text-sm font-medium leading-tight truncate">{question.question}</CardTitle>
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditQualification(question)}
                                          className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                          title="Edit"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              title="Delete"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Question?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete this qualification question.
                                                This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => handleDeleteQualification(question.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </CardHeader>
                                </Card>
                              </SortableItem>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Push to Scripts Dialog */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Push Template to Scripts</DialogTitle>
            <DialogDescription>
              Choose which {pushTemplate?.service_name || 'service'} scripts to update with this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No client scripts found for this service type.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedClientIds.length === availableClients.length}
                      onCheckedChange={handleSelectAllClients}
                    />
                    <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All ({availableClients.length} clients)
                    </Label>
                  </div>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {availableClients.map((client) => (
                      <div 
                        key={client.id} 
                        className="flex items-center gap-2 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
                      >
                        <Checkbox
                          id={client.id}
                          checked={selectedClientIds.includes(client.id)}
                          onCheckedChange={() => handleToggleClient(client.id)}
                        />
                        <Label 
                          htmlFor={client.id} 
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {client.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPushDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleUpdateAllScripts()}
              disabled={availableClients.length === 0}
            >
              Push to All ({availableClients.length})
            </Button>
            <Button
              onClick={() => handleUpdateAllScripts(selectedClientIds)}
              disabled={selectedClientIds.length === 0}
            >
              Push to Selected ({selectedClientIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
