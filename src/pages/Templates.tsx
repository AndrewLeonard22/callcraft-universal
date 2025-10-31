import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
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
      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from("scripts")
          .update({
            service_name: serviceName,
            script_content: scriptContent,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template updated successfully!");
      } else {
        // Create new template
        const { error } = await supabase.from("scripts").insert({
          client_id: "00000000-0000-0000-0000-000000000001",
          service_name: serviceName,
          script_content: scriptContent,
          is_template: true,
          version: 1,
        });

        if (error) throw error;
        toast.success("Template created successfully!");
      }

      setServiceName("");
      setScriptContent("");
      setShowCreateForm(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Script Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable script templates for different services
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
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
              <div className="flex gap-3">
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? (editingTemplate ? "Updating..." : "Creating...") : (editingTemplate ? "Update Template" : "Create Template")}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCreateForm(false);
                  setEditingTemplate(null);
                  setServiceName("");
                  setScriptContent("");
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
                        <div className="h-12 w-12 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
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
      </div>
    </div>
  );
}
