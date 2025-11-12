import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, Edit2, MessageSquare, HelpCircle, ClipboardCheck, GripVertical, Copy, Building2 } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompanyLogoSettings } from "@/components/CompanyLogoSettings";

const FormattedContent = ({ content }: { content: string }) => {
  // If content contains HTML tags, render it as HTML
  if (content.includes('<p>') || content.includes('<span') || content.includes('<strong>') || content.includes('<mark>')) {
    return (
      <HtmlPreviewFrame html={content} />
    );
  }
  
  // Otherwise, use the marker-based formatting (backward compatibility)
  const lines = content.split('\n');
  
  const formatLine = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;
    
    while (remaining.length > 0) {
      // Check for color markers
      const colorMatch = remaining.match(/\{(red|blue|green|yellow|purple|orange):([^}]+)\}/);
      if (colorMatch && colorMatch.index !== undefined) {
        if (colorMatch.index > 0) {
          parts.push(remaining.substring(0, colorMatch.index));
        }
        const colorMap: Record<string, string> = {
          red: 'rgb(220, 38, 38)',
          blue: 'rgb(37, 99, 235)',
          green: 'rgb(22, 163, 74)',
          yellow: 'rgb(202, 138, 4)',
          purple: 'rgb(168, 85, 247)',
          orange: 'rgb(249, 115, 22)',
        };
        parts.push(
          <span key={`color-${key++}`} style={{ color: colorMap[colorMatch[1]] }}>
            {colorMatch[2]}
          </span>
        );
        remaining = remaining.substring(colorMatch.index + colorMatch[0].length);
        continue;
      }

      // Check for font size markers
      const sizeMatch = remaining.match(/\{(small|large):([^}]+)\}/);
      if (sizeMatch && sizeMatch.index !== undefined) {
        if (sizeMatch.index > 0) {
          parts.push(remaining.substring(0, sizeMatch.index));
        }
        const sizeClass = sizeMatch[1] === 'small' ? 'text-xs' : 'text-lg';
        parts.push(
          <span key={`size-${key++}`} className={sizeClass}>
            {sizeMatch[2]}
          </span>
        );
        remaining = remaining.substring(sizeMatch.index + sizeMatch[0].length);
        continue;
      }
      
      const bracketMatch = remaining.match(/\[([^\]]+)\]/);
      if (bracketMatch && bracketMatch.index !== undefined) {
        if (bracketMatch.index > 0) {
          parts.push(remaining.substring(0, bracketMatch.index));
        }
        parts.push(
          <span key={`bracket-${key++}`} className="bg-primary/5 text-primary font-medium px-1.5 py-0.5 rounded">
            {bracketMatch[1]}
          </span>
        );
        remaining = remaining.substring(bracketMatch.index + bracketMatch[0].length);
        continue;
      }
      
      const quoteMatch = remaining.match(/"([^"]+)"/);
      if (quoteMatch && quoteMatch.index !== undefined) {
        if (quoteMatch.index > 0) {
          parts.push(remaining.substring(0, quoteMatch.index));
        }
        parts.push(
          <span key={`quote-${key++}`} className="bg-accent/5 text-accent font-medium px-1 rounded">
            {quoteMatch[1]}
          </span>
        );
        remaining = remaining.substring(quoteMatch.index + quoteMatch[0].length);
        continue;
      }
      
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(remaining.substring(0, boldMatch.index));
        }
        parts.push(
          <strong key={`bold-${key++}`} className="font-bold text-foreground">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }
      
      const italicMatch = remaining.match(/\*([^*]+)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(remaining.substring(0, italicMatch.index));
        }
        parts.push(
          <strong key={`semi-${key++}`} className="font-semibold">
            {italicMatch[1]}
          </strong>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }
      
      parts.push(remaining);
      break;
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <>
      {lines.map((line, index) => {
        if (line.match(/^\d+\.\s+[A-Z]/)) {
          return (
            <h3 key={index} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
              {line}
            </h3>
          );
        }
        
        if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
          return (
            <h3 key={index} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
              {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
            </h3>
          );
        }
        
        if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
          return (
            <h4 key={index} className="text-sm font-semibold mt-2 mb-1 text-foreground">
              {line}
            </h4>
          );
        }
        
        if (line.match(/^\*\*[^*]+\*\*/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
          return (
            <h5 key={index} className="font-semibold text-sm mt-2 mb-1 text-foreground">
              {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
            </h5>
          );
        }
        
        if (!line.trim()) {
          return <div key={index} className="h-1" />;
        }
        
        return (
          <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
            {formatLine(line)}
          </p>
        );
      })}
    </>
  );
};

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
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; company_logo_url?: string } | null>(null);
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false);

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
            <Button variant="outline" onClick={() => setLogoSettingsOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              Company Logo
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        <CompanyLogoSettings
          open={logoSettingsOpen}
          onOpenChange={setLogoSettingsOpen}
          currentLogoUrl={profile?.company_logo_url}
          onLogoUpdated={() => {}}
        />

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
          <Card className="mb-6 border-primary/20 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-lg">{editingTemplate ? "Edit Template" : "Create New Template"}</CardTitle>
              <CardDescription>
                {editingTemplate 
                  ? "Update this template to change all scripts that use it"
                  : "Create a reusable script template that can be customized for different clients"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service-name">Template Name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g., Turf Installation V1"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="service-type-select">Assign to Service Type</Label>
                <Select 
                  value={selectedTemplateServiceTypeId} 
                  onValueChange={setSelectedTemplateServiceTypeId}
                >
                  <SelectTrigger id="service-type-select">
                    <SelectValue placeholder="Select a service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  This template will only appear when creating scripts for this service type
                </p>
              </div>
              <div>
                <RichTextEditor
                  label="Script Content"
                  placeholder="Enter your template script here..."
                  value={scriptContent}
                  onChange={setScriptContent}
                  minHeight="300px"
                />
              </div>
              <div>
                <Label htmlFor="template-image">Template Image (optional)</Label>
                <input
                  id="template-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTemplateImageFile(e.target.files?.[0] || null)}
                  className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-border file:bg-background file:text-foreground hover:file:bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Used as the preview image when scripts are created from this template.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? (editingTemplate ? "Updating..." : "Creating...") : (editingTemplate ? "Update Template" : "Create Template")}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCreateForm(false);
                  setEditingTemplate(null);
                  setServiceName("");
                  setScriptContent("");
                  setTemplateImageFile(null);
                  setSelectedTemplateServiceTypeId("");
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
        ) : templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Create your first template to reuse scripts across clients
              </p>
              <Button onClick={() => setShowCreateForm(true)} size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Group templates by service type */}
            {(() => {
              const grouped = templates.reduce((acc, template) => {
                const serviceTypeId = template.service_type_id || 'uncategorized';
                if (!acc[serviceTypeId]) {
                  acc[serviceTypeId] = [];
                }
                acc[serviceTypeId].push(template);
                return acc;
              }, {} as Record<string, Template[]>);

              return Object.entries(grouped).map(([serviceTypeId, serviceTemplates]) => {
                const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
                const serviceName = serviceType?.name || 'Uncategorized';

                return (
                  <div key={serviceTypeId} className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                      {serviceType?.icon_url && (
                        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <img src={serviceType.icon_url} alt="" className="h-4 w-4 object-contain" />
                        </div>
                      )}
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {serviceName}
                        </h3>
                        <span className="text-xs text-muted-foreground font-medium">
                          {serviceTemplates.length} {serviceTemplates.length === 1 ? 'template' : 'templates'}
                        </span>
                      </div>
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndTemplates}>
                      <SortableContext items={serviceTemplates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {serviceTemplates.map((template) => (
                            <SortableItem key={template.id} id={template.id}>
                              <Card className="group h-full flex flex-col transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                                <CardHeader className="pb-3">
                                  <div className="flex items-start gap-3 mb-3">
                                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-border/60 overflow-hidden flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                                      {template.image_url ? (
                                        <img src={template.image_url} alt="Template preview" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                                      ) : (
                                        <FileText className="h-5 w-5 text-primary/70" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base leading-tight line-clamp-2">{template.service_name}</CardTitle>
                                    </div>
                                   </div>
                                   <div className="flex gap-1 justify-end pt-2 border-t border-border/60">
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                                       onClick={() => handleDuplicate(template)}
                                       title="Duplicate template"
                                     >
                                       <Copy className="h-3.5 w-3.5" />
                                     </Button>
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                                       onClick={() => handleEdit(template)}
                                       title="Edit template"
                                     >
                                       <Edit2 className="h-3.5 w-3.5" />
                                     </Button>
                                     <AlertDialog>
                                       <AlertDialogTrigger asChild>
                                         <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="h-8 w-8 text-destructive"
                                           title="Delete template"
                                         >
                                           <Trash2 className="h-3.5 w-3.5" />
                                         </Button>
                                       </AlertDialogTrigger>
                                       <AlertDialogContent>
                                         <AlertDialogHeader>
                                           <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                           <AlertDialogDescription>
                                             This will permanently delete the "{template.service_name}" template.
                                             This action cannot be undone.
                                           </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                                           <AlertDialogAction
                                             onClick={() => handleDelete(template.id)}
                                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                           >
                                             Delete
                                           </AlertDialogAction>
                                         </AlertDialogFooter>
                                       </AlertDialogContent>
                                     </AlertDialog>
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
                  <div className="space-y-4">
                    {objectionTemplates.map((template) => (
                      <SortableItem key={template.id} id={template.id}>
                        <Card>
                          <CardHeader className="p-4">
                            <div className="flex items-center gap-3 justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-10 w-10 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <CardTitle className="text-base truncate">{template.service_name}</CardTitle>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditObjection(template)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
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
                                  <Card className="hover:shadow-sm transition-shadow">
                                    <CardHeader className="p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex-shrink-0 flex items-center justify-center">
                                            <HelpCircle className="h-4 w-4 text-primary" />
                                          </div>
                                          <div className="flex-1 min-w-0 space-y-1.5">
                                            <CardTitle className="text-sm font-semibold leading-tight">
                                              {faq.question}
                                            </CardTitle>
                                            <div className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                                              <span
                                                dangerouslySetInnerHTML={{
                                                  __html: faq.answer
                                                    .substring(0, 100)
                                                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                                    .replace(/\[([^\]]+)\]/g, '<mark class="bg-yellow-200 px-1">$1</mark>')
                                                    .replace(/\{red:([^}]+)\}/g, '<span style="color: rgb(220, 38, 38)">$1</span>')
                                                    .replace(/\{blue:([^}]+)\}/g, '<span style="color: rgb(37, 99, 235)">$1</span>')
                                                    .replace(/\{green:([^}]+)\}/g, '<span style="color: rgb(22, 163, 74)">$1</span>')
                                                    .replace(/\{yellow:([^}]+)\}/g, '<span style="color: rgb(202, 138, 4)">$1</span>')
                                                    .replace(/\{purple:([^}]+)\}/g, '<span style="color: rgb(168, 85, 247)">$1</span>')
                                                    .replace(/\{orange:([^}]+)\}/g, '<span style="color: rgb(249, 115, 22)">$1</span>')
                                                    .replace(/\{small:([^}]+)\}/g, '<span style="font-size: 0.875rem">$1</span>')
                                                    .replace(/\{large:([^}]+)\}/g, '<span style="font-size: 1.25rem">$1</span>')
                                                    + '...'
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditFaq(faq)}
                                            className="h-7 px-2"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
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
                        <div className="space-y-3">
                          {qualificationQuestions.filter(q => !q.service_type_id).map((question) => (
                            <SortableItem key={question.id} id={question.id}>
                              <Card>
                                <CardHeader>
                                  <div className="flex items-start gap-4 justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                      <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                                        <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <CardTitle className="text-lg">{question.question}</CardTitle>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditQualification(question)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0">
                                            <Trash2 className="h-4 w-4" />
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
                          <div className="space-y-3">
                            {typeQuestions.map((question) => (
                              <SortableItem key={question.id} id={question.id}>
                                <Card>
                                  <CardHeader>
                                    <div className="flex items-start gap-4 justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                                          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <CardTitle className="text-lg">{question.question}</CardTitle>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEditQualification(question)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0">
                                              <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
