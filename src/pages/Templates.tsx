import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, Edit2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showObjectionForm, setShowObjectionForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingObjection, setEditingObjection] = useState<ObjectionTemplate | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [objectionServiceName, setObjectionServiceName] = useState("");
  const [objectionContent, setObjectionContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateImageFile, setTemplateImageFile] = useState<File | null>(null);

  useEffect(() => {
    loadTemplates();
    loadObjectionTemplates();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable script and objection handling templates
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>

        <Tabs defaultValue="scripts" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="scripts">
              <FileText className="mr-2 h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="objections">
              <MessageSquare className="mr-2 h-4 w-4" />
              Objection Handling
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
                <Label htmlFor="script-content">Script Content</Label>
                <Textarea
                  id="script-content"
                  placeholder="Enter your template script here..."
                  className="min-h-[300px] font-mono text-sm"
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
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
                          <CardDescription className="mt-1">
                            Universal template • {template.script_content.substring(0, 120)}...
                          </CardDescription>
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
                  <div>
                    <Label htmlFor="objection-content">Objection Handling Content</Label>
                    <Textarea
                      id="objection-content"
                      placeholder="Enter objection handling responses..."
                      className="min-h-[300px] font-mono text-sm"
                      value={objectionContent}
                      onChange={(e) => setObjectionContent(e.target.value)}
                    />
                  </div>
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
                            <CardDescription className="mt-1">
                              {template.content.substring(0, 120)}...
                            </CardDescription>
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
        </Tabs>
      </div>
    </div>
  );
}
