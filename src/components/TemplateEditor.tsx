import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

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

interface TemplateEditorProps {
  editingTemplate: Template | null;
  serviceName: string;
  setServiceName: (v: string) => void;
  scriptContent: string;
  setScriptContent: (v: string) => void;
  selectedTemplateServiceTypeId: string;
  setSelectedTemplateServiceTypeId: (v: string) => void;
  serviceTypes: ServiceType[];
  setTemplateImageFile: (f: File | null) => void;
  handleCreate: () => void;
  saving: boolean;
  onCancel: () => void;
}

export function TemplateEditor({
  editingTemplate,
  serviceName,
  setServiceName,
  scriptContent,
  setScriptContent,
  selectedTemplateServiceTypeId,
  setSelectedTemplateServiceTypeId,
  serviceTypes,
  setTemplateImageFile,
  handleCreate,
  saving,
  onCancel,
}: TemplateEditorProps) {
  return (
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
