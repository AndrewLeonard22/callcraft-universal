import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, ArrowLeft, Video, Package, CheckCircle2, DollarSign, Lightbulb, Shield, BookOpen, HelpCircle } from "lucide-react";

// Module Type definitions with auto-scaffolding
const MODULE_TYPES = [
  { 
    id: 'pricing', 
    label: 'Pricing', 
    icon: DollarSign,
    description: 'Pricing models, tiers, and payment options',
    defaultSections: ['Overview', 'Packages & Tiers', 'Payment Options']
  },
  { 
    id: 'features_benefits', 
    label: 'Features & Benefits', 
    icon: Lightbulb,
    description: 'Product features and customer benefits',
    defaultSections: ['Key Features', 'Customer Benefits', 'Value Proposition']
  },
  { 
    id: 'objection_handling', 
    label: 'Objection Handling', 
    icon: Shield,
    description: 'Common objections and how to address them',
    defaultSections: ['Common Objections', 'Response Scripts', 'Success Stories']
  },
  { 
    id: 'sales_playbook', 
    label: 'Sales Playbook', 
    icon: BookOpen,
    description: 'Sales processes and best practices',
    defaultSections: ['Sales Process', 'Best Practices', 'Scripts & Templates']
  },
  { 
    id: 'faqs', 
    label: 'FAQs', 
    icon: HelpCircle,
    description: 'Frequently asked questions',
    defaultSections: ['General Questions', 'Technical Questions', 'Pricing Questions']
  },
  { 
    id: 'training_videos', 
    label: 'Training Videos', 
    icon: Video,
    description: 'Video tutorials and demonstrations',
    defaultSections: ['Getting Started', 'Advanced Techniques', 'Case Studies']
  },
  { 
    id: 'custom', 
    label: 'Custom', 
    icon: Package,
    description: 'Custom training content',
    defaultSections: []
  },
] as const;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import agentIqLogo from "@/assets/agent-iq-logo.png";
import QuizQuestionsAdmin from "@/components/QuizQuestionsAdmin";
import WheelSegmentsAdmin from "@/components/WheelSegmentsAdmin";
import { logger } from "@/utils/logger";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: string;
  icon_name: string;
  display_order: number;
  service_type_id?: string | null;
  sections?: TrainingSection[];
}

interface TrainingSection {
  id: string;
  module_id: string;
  title: string;
  content: string;
  display_order: number;
  benefits?: TrainingBenefit[];
  features?: TrainingFeature[];
  videos?: TrainingVideo[];
}

interface TrainingBenefit {
  id: string;
  section_id: string;
  benefit_text: string;
  benefit_type: string;
  display_order: number;
}

interface TrainingFeature {
  id: string;
  section_id: string;
  feature_name: string;
  feature_value: string;
  display_order: number;
}

interface TrainingVideo {
  id: string;
  module_id?: string;
  section_id?: string;
  title: string;
  video_url: string;
  description: string;
  display_order: number;
}

export default function TrainingManagement() {
const [modules, setModules] = useState<TrainingModule[]>([]);
const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string; icon_url?: string | null }>>([]);
const [loading, setLoading] = useState(true);
const [organizationId, setOrganizationId] = useState<string | null>(null);
const { toast } = useToast();

// Module dialog state
const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
const [moduleForm, setModuleForm] = useState({
  title: "",
  description: "",
  category: "pricing",
  icon_name: "DollarSign",
  service_type_id: "",
});

  // Section dialog state
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<TrainingSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    title: "",
    content: "",
  });

  // Benefit dialog state
  const [benefitDialogOpen, setBenefitDialogOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [benefitForm, setBenefitForm] = useState({
    benefit_text: "",
    benefit_type: "pro",
  });

  // Feature dialog state
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featureForm, setFeatureForm] = useState({
    feature_name: "",
    feature_value: "",
  });

  // Video dialog state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoForm, setVideoForm] = useState({
    title: "",
    video_url: "",
    description: "",
  });

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadModules();
      loadServiceTypes();
    }
  }, [organizationId]);

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error: any) {
      logger.error("Error loading service types:", error);
    }
  };

  const loadOrganization = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgMember) {
      setOrganizationId(orgMember.organization_id);
    }
  };

  const loadModules = async () => {
    try {
      const { data: modulesData, error: modulesError } = await supabase
        .from("training_modules")
        .select("*")
        .eq("organization_id", organizationId)
        .order("display_order");

      if (modulesError) throw modulesError;

      // Load sections for each module
      const modulesWithSections = await Promise.all(
        (modulesData || []).map(async (module) => {
          const { data: sectionsData } = await supabase
            .from("training_sections")
            .select("*")
            .eq("module_id", module.id)
            .order("display_order");

          // Load benefits, features, and videos for each section
          const sectionsWithDetails = await Promise.all(
            (sectionsData || []).map(async (section) => {
              const [benefitsRes, featuresRes, videosRes] = await Promise.all([
                supabase
                  .from("training_benefits")
                  .select("*")
                  .eq("section_id", section.id)
                  .order("display_order"),
                supabase
                  .from("training_features")
                  .select("*")
                  .eq("section_id", section.id)
                  .order("display_order"),
                supabase
                  .from("training_videos")
                  .select("*")
                  .eq("section_id", section.id)
                  .order("display_order"),
              ]);

              return {
                ...section,
                benefits: benefitsRes.data || [],
                features: featuresRes.data || [],
                videos: videosRes.data || [],
              };
            })
          );

          return {
            ...module,
            sections: sectionsWithDetails,
          };
        })
      );

      setModules(modulesWithSections);
    } catch (error) {
      logger.error("Error loading modules:", error);
      toast({
        title: "Error",
        description: "Failed to load training modules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModule = async () => {
    if (!organizationId) return;
    
    // Validate required fields
    if (!moduleForm.service_type_id) {
      toast({ 
        title: "Service required", 
        description: "Please select a service for this module",
        variant: "destructive" 
      });
      return;
    }

    if (!moduleForm.category) {
      toast({ 
        title: "Module type required", 
        description: "Please select a module type",
        variant: "destructive" 
      });
      return;
    }

    if (!moduleForm.title.trim()) {
      toast({ 
        title: "Title required", 
        description: "Please enter a module title",
        variant: "destructive" 
      });
      return;
    }

    if (moduleForm.title.length > 100) {
      toast({ 
        title: "Title too long", 
        description: "Module title must be less than 100 characters",
        variant: "destructive" 
      });
      return;
    }

    try {
      // Get icon based on module type
      const moduleType = MODULE_TYPES.find(t => t.id === moduleForm.category);
      const iconName = moduleType?.icon.name || 'Package';

      const moduleData = {
        title: moduleForm.title,
        description: moduleForm.description,
        category: moduleForm.category,
        icon_name: iconName,
        service_type_id: moduleForm.service_type_id || null,
      };

      if (editingModule) {
        const { error } = await supabase
          .from("training_modules")
          .update(moduleData)
          .eq("id", editingModule.id);

        if (error) throw error;
        toast({ title: "Module updated successfully" });
      } else {
        const { data: newModule, error } = await supabase
          .from("training_modules")
          .insert([{ ...moduleData, organization_id: organizationId }])
          .select()
          .single();

        if (error) throw error;

        // Auto-scaffold default sections if module type has them
        if (newModule && moduleType?.defaultSections && moduleType.defaultSections.length > 0) {
          const sectionsToCreate = moduleType.defaultSections.map((sectionTitle, index) => ({
            module_id: newModule.id,
            title: sectionTitle,
            content: '',
            display_order: index,
          }));

          const { error: sectionsError } = await supabase
            .from("training_sections")
            .insert(sectionsToCreate);

          if (sectionsError) {
            logger.error("Error creating default sections:", sectionsError);
          }
        }

        toast({ title: "Module created successfully" });
      }

      setModuleDialogOpen(false);
      setEditingModule(null);
      setModuleForm({ title: "", description: "", category: "", icon_name: "", service_type_id: "" });
      loadModules();
    } catch (error: any) {
      logger.error("Error saving module:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save module",
        variant: "destructive",
      });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("Are you sure? This will delete all sections, benefits, and features.")) return;

    try {
      const { error } = await supabase
        .from("training_modules")
        .delete()
        .eq("id", moduleId);

      if (error) throw error;
      toast({ title: "Module deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting module:", error);
      toast({
        title: "Error",
        description: "Failed to delete module",
        variant: "destructive",
      });
    }
  };

  const handleSaveSection = async () => {
    if (!selectedModuleId) return;

    // Validate required fields
    if (!sectionForm.title.trim()) {
      toast({ 
        title: "Title required", 
        description: "Please enter a section title",
        variant: "destructive" 
      });
      return;
    }

    if (sectionForm.title.length > 200) {
      toast({ 
        title: "Title too long", 
        description: "Section title must be less than 200 characters",
        variant: "destructive" 
      });
      return;
    }

    try {
      if (editingSection) {
        const { error } = await supabase
          .from("training_sections")
          .update(sectionForm)
          .eq("id", editingSection.id);

        if (error) throw error;
        toast({ title: "Section updated successfully" });
      } else {
        const { error } = await supabase
          .from("training_sections")
          .insert([{ ...sectionForm, module_id: selectedModuleId }]);

        if (error) throw error;
        toast({ title: "Section created successfully" });
      }

      setSectionDialogOpen(false);
      setEditingSection(null);
      setSectionForm({ title: "", content: "" });
      loadModules();
    } catch (error) {
      console.error("Error saving section:", error);
      toast({
        title: "Error",
        description: "Failed to save section",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Are you sure? This will delete all benefits and features.")) return;

    try {
      const { error } = await supabase
        .from("training_sections")
        .delete()
        .eq("id", sectionId);

      if (error) throw error;
      toast({ title: "Section deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting section:", error);
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
    }
  };

  const handleSaveBenefit = async () => {
    if (!selectedSectionId) return;

    try {
      const { error } = await supabase
        .from("training_benefits")
        .insert([{ ...benefitForm, section_id: selectedSectionId }]);

      if (error) throw error;
      toast({ title: "Benefit added successfully" });
      setBenefitDialogOpen(false);
      setBenefitForm({ benefit_text: "", benefit_type: "pro" });
      loadModules();
    } catch (error) {
      console.error("Error saving benefit:", error);
      toast({
        title: "Error",
        description: "Failed to save benefit",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBenefit = async (benefitId: string) => {
    try {
      const { error } = await supabase
        .from("training_benefits")
        .delete()
        .eq("id", benefitId);

      if (error) throw error;
      toast({ title: "Benefit deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting benefit:", error);
      toast({
        title: "Error",
        description: "Failed to delete benefit",
        variant: "destructive",
      });
    }
  };

  const handleSaveFeature = async () => {
    if (!selectedSectionId) return;

    try {
      const { error } = await supabase
        .from("training_features")
        .insert([{ ...featureForm, section_id: selectedSectionId }]);

      if (error) throw error;
      toast({ title: "Feature added successfully" });
      setFeatureDialogOpen(false);
      setFeatureForm({ feature_name: "", feature_value: "" });
      loadModules();
    } catch (error) {
      console.error("Error saving feature:", error);
      toast({
        title: "Error",
        description: "Failed to save feature",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    try {
      const { error } = await supabase
        .from("training_features")
        .delete()
        .eq("id", featureId);

      if (error) throw error;
      toast({ title: "Feature deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting feature:", error);
      toast({
        title: "Error",
        description: "Failed to delete feature",
        variant: "destructive",
      });
    }
  };

  const handleSaveVideo = async () => {
    if (!selectedSectionId) return;

    try {
      const { error } = await supabase
        .from("training_videos")
        .insert([{ ...videoForm, section_id: selectedSectionId }]);

      if (error) throw error;
      toast({ title: "Video added successfully" });
      setVideoDialogOpen(false);
      setVideoForm({ title: "", video_url: "", description: "" });
      loadModules();
    } catch (error) {
      console.error("Error saving video:", error);
      toast({
        title: "Error",
        description: "Failed to save video",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from("training_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;
      toast({ title: "Video deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={agentIqLogo} 
                alt="Agent IQ" 
                className="h-12 sm:h-14 w-auto"
              />
              <div className="h-6 sm:h-8 w-px bg-border/50" />
              <h1 className="text-2xl font-semibold tracking-tight">Training Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/training">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  View Training
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <div className="mb-12">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">Training Management</h2>
              <p className="text-muted-foreground">
                Create and manage training modules, quiz questions, and wheel games
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-12">
            {/* Quiz & Games Section */}
            <section>
              <div className="mb-6">
                <h3 className="text-2xl font-semibold mb-2">Quiz & Interactive Games</h3>
                <p className="text-sm text-muted-foreground">
                  Manage quiz questions and spin the wheel segments for gamified learning
                </p>
              </div>
              <div className="grid gap-6">
                <QuizQuestionsAdmin organizationId={organizationId} />
                <WheelSegmentsAdmin organizationId={organizationId} />
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-border"></div>

            {/* Training Modules Section */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Training Modules</h3>
                  <p className="text-sm text-muted-foreground">
                    Create structured training content with sections, benefits, features, and videos
                  </p>
                </div>
                <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: "", description: "", category: "", icon_name: "", service_type_id: "" });
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Module
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingModule ? "Edit" : "Create"} Module</DialogTitle>
                <DialogDescription>
                  {editingModule ? "Update" : "Add"} a training module for your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Step 1: Service Selection */}
                <div>
                  <Label>Select Service <span className="text-destructive">*</span></Label>
                  <Select
                    value={moduleForm.service_type_id}
                    onValueChange={(value) => setModuleForm({ ...moduleForm, service_type_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose the service this module belongs to" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Module Type Selection */}
                <div>
                  <Label>Module Type <span className="text-destructive">*</span></Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose the type of training content
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {MODULE_TYPES.map((type) => {
                      const IconComponent = type.icon;
                      const isSelected = moduleForm.category === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setModuleForm({ ...moduleForm, category: type.id, icon_name: type.icon.name })}
                          className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              isSelected ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              <IconComponent className={`h-5 w-5 ${
                                isSelected ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm mb-1">{type.label}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {type.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Module Details */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Module Title <span className="text-destructive">*</span></Label>
                    <Input
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                      placeholder="e.g., Premium Tier Pricing"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                      placeholder="Brief description of this module"
                      rows={3}
                    />
                  </div>
                  {moduleForm.category && MODULE_TYPES.find(t => t.id === moduleForm.category)?.defaultSections.length > 0 && !editingModule && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Auto-scaffolded sections:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {MODULE_TYPES.find(t => t.id === moduleForm.category)?.defaultSections.map((section, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {section}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setModuleDialogOpen(false);
                  setEditingModule(null);
                  setModuleForm({ title: "", description: "", category: "", icon_name: "", service_type_id: "" });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveModule}>
                  {editingModule ? "Update" : "Create"} Module
                </Button>
              </DialogFooter>
            </DialogContent>
              </Dialog>
              </div>

              {modules.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">No training modules yet</p>
                    <Button onClick={() => setModuleDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Module
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                {modules.map((module) => (
                  <Card key={module.id} className="border-2">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setEditingSection(null);
                          setSectionForm({ title: "", content: "" });
                          setSectionDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Section
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingModule(module);
                          setModuleForm({
                            title: module.title,
                            description: module.description,
                            category: module.category,
                            icon_name: module.icon_name,
                            service_type_id: module.service_type_id || "",
                          });
                          setModuleDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteModule(module.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {module.sections && module.sections.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                      {module.sections.map((section) => (
                        <AccordionItem key={section.id} value={section.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full mr-4">
                              <span className="font-semibold">{section.title}</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSectionId(section.id);
                                    setBenefitDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Benefit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSectionId(section.id);
                                    setFeatureDialogOpen(true);
                                  }}
                                >
                                  <Package className="h-3 w-3 mr-1" />
                                  Feature
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSectionId(section.id);
                                    setVideoDialogOpen(true);
                                  }}
                                >
                                  <Video className="h-3 w-3 mr-1" />
                                  Video
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedModuleId(module.id);
                                    setEditingSection(section);
                                    setSectionForm({
                                      title: section.title,
                                      content: section.content,
                                    });
                                    setSectionDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSection(section.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pt-4">
                              <div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {section.content}
                                </p>
                              </div>

                              {section.benefits && section.benefits.length > 0 && (
                                <div>
                                  <h5 className="font-semibold mb-2">Benefits:</h5>
                                  <div className="space-y-2">
                                    {section.benefits.map((benefit) => (
                                      <div key={benefit.id} className="flex items-start justify-between bg-muted/50 p-2 rounded">
                                        <div className="flex items-start gap-2">
                                          <CheckCircle2 className={`h-4 w-4 mt-0.5 ${
                                            benefit.benefit_type === 'pro' ? 'text-green-500' : 'text-amber-500'
                                          }`} />
                                          <span className="text-sm">{benefit.benefit_text}</span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteBenefit(benefit.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {section.features && section.features.length > 0 && (
                                <div>
                                  <h5 className="font-semibold mb-2">Features:</h5>
                                  <div className="space-y-2">
                                    {section.features.map((feature) => (
                                      <div key={feature.id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                                        <div className="flex justify-between flex-1 mr-2">
                                          <span className="text-sm font-medium">{feature.feature_name}</span>
                                          <span className="text-sm">{feature.feature_value}</span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteFeature(feature.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {section.videos && section.videos.length > 0 && (
                                <div>
                                  <h5 className="font-semibold mb-2">Videos:</h5>
                                  <div className="space-y-2">
                                    {section.videos.map((video) => (
                                      <div key={video.id} className="flex items-start justify-between bg-muted/50 p-3 rounded">
                                        <div>
                                          <div className="flex items-center gap-2 mb-1">
                                            <Video className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">{video.title}</span>
                                          </div>
                                          <a 
                                            href={video.video_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline"
                                          >
                                            {video.video_url}
                                          </a>
                                          {video.description && (
                                            <p className="text-xs text-muted-foreground mt-1">{video.description}</p>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteVideo(video.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sections yet</p>
                  )}
                </CardContent>
              </Card>
                ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Section Dialog */}
        <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSection ? "Edit" : "Create"} Section</DialogTitle>
              <DialogDescription>
                {editingSection ? "Update" : "Add"} a section to this module
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={sectionForm.title}
                  onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                  placeholder="e.g., Aluminum Pergolas"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={sectionForm.content}
                  onChange={(e) => setSectionForm({ ...sectionForm, content: e.target.value })}
                  placeholder="Detailed content for this section"
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSection}>Save Section</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Benefit Dialog */}
        <Dialog open={benefitDialogOpen} onOpenChange={setBenefitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Benefit</DialogTitle>
              <DialogDescription>Add a benefit or feature point</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Benefit Text</Label>
                <Input
                  value={benefitForm.benefit_text}
                  onChange={(e) => setBenefitForm({ ...benefitForm, benefit_text: e.target.value })}
                  placeholder="e.g., Low maintenance required"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={benefitForm.benefit_type}
                  onValueChange={(value) => setBenefitForm({ ...benefitForm, benefit_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro">Pro (Green checkmark)</SelectItem>
                    <SelectItem value="con">Con (Amber warning)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBenefitDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBenefit}>Add Benefit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Feature Dialog */}
        <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Feature</DialogTitle>
              <DialogDescription>Add a pricing or specification feature</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Feature Name</Label>
                <Input
                  value={featureForm.feature_name}
                  onChange={(e) => setFeatureForm({ ...featureForm, feature_name: e.target.value })}
                  placeholder="e.g., Price per square foot"
                />
              </div>
              <div>
                <Label>Feature Value</Label>
                <Input
                  value={featureForm.feature_value}
                  onChange={(e) => setFeatureForm({ ...featureForm, feature_value: e.target.value })}
                  placeholder="e.g., $35-45"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFeature}>Add Feature</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Video Dialog */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Training Video</DialogTitle>
              <DialogDescription>Add a video link for this section</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Video Title</Label>
                <Input
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="e.g., Product Demo"
                />
              </div>
              <div>
                <Label>Video URL</Label>
                <Input
                  value={videoForm.video_url}
                  onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={videoForm.description}
                  onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                  placeholder="Brief description of the video"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveVideo}>Add Video</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
