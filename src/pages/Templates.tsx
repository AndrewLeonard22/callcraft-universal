import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, Edit2, MessageSquare, HelpCircle, ClipboardCheck } from "lucide-react";
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

const FormattedContent = ({ content }: { content: string }) => {
  // If content contains HTML tags, render it as HTML
  if (content.includes('<p>') || content.includes('<span') || content.includes('<strong>') || content.includes('<mark>')) {
    return (
      <div 
        className="html-content text-sm text-foreground/80"
        dangerouslySetInnerHTML={{ __html: content }}
      />
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
          <p key={index} className="text-sm leading-relaxed text-foreground/80">
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

  useEffect(() => {
    loadUserOrganization();
    loadTemplates();
    loadObjectionTemplates();
    loadFaqs();
    loadQualificationQuestions();
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
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .eq("is_template", true)
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
      const { data, error } = await supabase
        .from("objection_handling_templates")
        .select("*")
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
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
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
      const { data, error } = await supabase
        .from("qualification_questions")
        .select("*")
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

      if (editingTemplate) {
        // Update existing template
        const updatePayload: any = {
          service_name: serviceName,
          script_content: scriptContent,
        };
        if (uploadedImageUrl) updatePayload.image_url = uploadedImageUrl;

        const { error } = await supabase
          .from('scripts')
          .update(updatePayload)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully!');
      } else {
        // Create new template
        const insertPayload: any = {
          client_id: '00000000-0000-0000-0000-000000000001',
          service_name: serviceName,
          script_content: scriptContent,
          is_template: true,
          version: 1,
          organization_id: userOrganizationId,
        };
        if (uploadedImageUrl) insertPayload.image_url = uploadedImageUrl;

        const { error } = await supabase.from('scripts').insert(insertPayload);

        if (error) throw error;
        toast.success('Template created successfully!');
      }

      setServiceName('');
      setScriptContent('');
      setTemplateImageFile(null);
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
    setFaqServiceTypeId(faq.service_type_id || "");
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
      if (editingFaq) {
        const { error } = await supabase
          .from("faqs")
          .update({
            service_type_id: faqServiceTypeId,
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
            service_type_id: faqServiceTypeId,
            question: faqQuestion,
            answer: faqAnswer,
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
    setQualificationServiceTypeId(question.service_type_id || "");
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
      if (editingQualification) {
        const { error } = await supabase
          .from("qualification_questions")
          .update({
            service_type_id: qualificationServiceTypeId,
            question: qualificationQuestion,
          })
          .eq("id", editingQualification.id);

        if (error) throw error;
        toast.success("Question updated successfully!");
      } else {
        const { error } = await supabase
          .from("qualification_questions")
          .insert({
            service_type_id: qualificationServiceTypeId,
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
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
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
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Plus className="mr-2 h-4 w-4" />
                New Script Template
              </Button>
            </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</CardTitle>
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
                  placeholder="e.g., Standard Sales Script"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This template can be used across all services
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
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Create your first template to reuse scripts across clients
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                    <div className="flex items-start gap-4 justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="h-12 w-12 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {template.image_url ? (
                            <img src={template.image_url} alt="Template preview" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg">{template.service_name}</CardTitle>
                          <CardDescription 
                            className="mt-1 line-clamp-2 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: template.script_content
                                .substring(0, 200)
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
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
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
                    </div>
                </CardHeader>
              </Card>
            ))}
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
              <div className="space-y-4">
                {objectionTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start gap-4 justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg">{template.service_name}</CardTitle>
                            <div className="text-sm text-muted-foreground mt-1 line-clamp-3">
                              <FormattedContent content={template.content} />
                            </div>
                          </div>
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
                ))}
              </div>
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
              <div className="space-y-4">
                {faqs.map((faq) => {
                  const serviceType = faq.service_type_id ? serviceTypes.find(st => st.id === faq.service_type_id) : null;
                  return (
                    <Card key={faq.id}>
                      <CardHeader>
                        <div className="flex items-start gap-4 justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                              <HelpCircle className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">{faq.question}</CardTitle>
                              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                {serviceType ? (
                                  <span className="font-medium">{serviceType.name} • </span>
                                ) : null}
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: faq.answer
                                      .substring(0, 150)
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
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditFaq(faq)}
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
                  );
                })}
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
              <div className="space-y-4">
                {qualificationQuestions.map((question) => {
                  const serviceType = question.service_type_id ? serviceTypes.find(st => st.id === question.service_type_id) : null;
                  return (
                    <Card key={question.id}>
                      <CardHeader>
                        <div className="flex items-start gap-4 justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">{question.question}</CardTitle>
                              <CardDescription className="mt-1">
                                Service Type: {serviceType?.name || 'Unknown'}
                              </CardDescription>
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
