import { Plus, FileText, Edit2, Trash2, GripVertical, Copy, RefreshCw } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from "@/components/SortableItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface TemplateListProps {
  templates: Template[];
  serviceTypes: ServiceType[];
  loading: boolean;
  sensors: any;
  handleDragEndTemplates: (event: DragEndEvent) => void;
  handleOpenPushDialog: (template: Template) => void;
  handleDuplicate: (template: Template) => void;
  handleEdit: (template: Template) => void;
  handleDelete: (templateId: string) => void;
  updatingScripts: string | null;
  onShowCreateForm: () => void;
}

export function TemplateList({
  templates,
  serviceTypes,
  loading,
  sensors,
  handleDragEndTemplates,
  handleOpenPushDialog,
  handleDuplicate,
  handleEdit,
  handleDelete,
  updatingScripts,
  onShowCreateForm,
}: TemplateListProps) {
  if (loading) {
    return (
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
    );
  }

  if (templates.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No templates yet</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Create your first template to reuse scripts across clients
          </p>
          <Button onClick={onShowCreateForm} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group templates by service type
  const grouped = templates.reduce((acc, template) => {
    const serviceTypeId = template.service_type_id || 'uncategorized';
    if (!acc[serviceTypeId]) {
      acc[serviceTypeId] = [];
    }
    acc[serviceTypeId].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([serviceTypeId, serviceTemplates]) => {
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
                <div className="space-y-2">
                  {serviceTemplates.map((template) => (
                    <SortableItem key={template.id} id={template.id}>
                      <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                {template.image_url ? (
                                  <img src={template.image_url} alt="" className="h-full w-full object-cover rounded-md" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                                ) : (
                                  <FileText className="h-4 w-4 text-primary/70" />
                                )}
                              </div>
                              <CardTitle className="text-sm font-medium leading-tight truncate">
                                {template.service_name}
                              </CardTitle>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPushDialog(template)}
                                disabled={updatingScripts === template.id || !template.service_type_id}
                                className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                title="Push template to scripts"
                              >
                                <RefreshCw className={`h-3 w-3 ${updatingScripts === template.id ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicate(template)}
                                className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                                title="Duplicate"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(template)}
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
                                    <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the "{template.service_name}" template. This action cannot be undone.
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
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        );
      })}
    </div>
  );
}
