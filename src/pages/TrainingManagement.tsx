import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, ArrowLeft, Video, Package, CheckCircle2, DollarSign, Brain } from "lucide-react";
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
import socialWorksLogo from "@/assets/social-works-logo.png";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: string;
  icon_name: string;
  display_order: number;
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
  questions?: TrainingQuestion[];
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

interface TrainingQuestion {
  id: string;
  module_id?: string;
  section_id?: string;
  question: string;
  answer: string;
  display_order: number;
}

export default function TrainingManagement() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
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

  // Question dialog state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    question: "",
    answer: "",
  });

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadModules();
    }
  }, [organizationId]);

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

          // Load benefits, features, videos, and questions for each section
          const sectionsWithDetails = await Promise.all(
            (sectionsData || []).map(async (section) => {
              const [benefitsRes, featuresRes, videosRes, questionsRes] = await Promise.all([
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
                // @ts-expect-error - training_questions table types will be auto-generated
                supabase.from("training_questions").select("*").eq("section_id", section.id).order("display_order"),
              ]);

              return {
                ...section,
                benefits: benefitsRes.data || [],
                features: featuresRes.data || [],
                videos: videosRes.data || [],
                questions: (questionsRes.data || []) as TrainingQuestion[],
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
      console.error("Error loading modules:", error);
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

    try {
      if (editingModule) {
        const { error } = await supabase
          .from("training_modules")
          .update(moduleForm)
          .eq("id", editingModule.id);

        if (error) throw error;
        toast({ title: "Module updated successfully" });
      } else {
        const { error } = await supabase
          .from("training_modules")
          .insert([{ ...moduleForm, organization_id: organizationId }]);

        if (error) throw error;
        toast({ title: "Module created successfully" });
      }

      setModuleDialogOpen(false);
      setEditingModule(null);
      setModuleForm({ title: "", description: "", category: "pricing", icon_name: "DollarSign" });
      loadModules();
    } catch (error) {
      console.error("Error saving module:", error);
      toast({
        title: "Error",
        description: "Failed to save module",
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

  const handleSaveQuestion = async () => {
    if (!selectedSectionId || !organizationId) return;

    try {
      // @ts-expect-error - training_questions table types will be auto-generated
      const { error } = await supabase.from("training_questions").insert([{ ...questionForm, section_id: selectedSectionId, organization_id: organizationId }]);

      if (error) throw error;
      toast({ title: "Question added successfully" });
      setQuestionDialogOpen(false);
      setQuestionForm({ question: "", answer: "" });
      loadModules();
    } catch (error) {
      console.error("Error saving question:", error);
      toast({
        title: "Error",
        description: "Failed to save question",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      // @ts-expect-error - training_questions table types will be auto-generated
      const { error } = await supabase.from("training_questions").delete().eq("id", questionId);

      if (error) throw error;
      toast({ title: "Question deleted successfully" });
      loadModules();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast({
        title: "Error",
        description: "Failed to delete question",
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
                src={socialWorksLogo} 
                alt="Social Works" 
                className="h-8 sm:h-10 w-auto"
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Manage Training Content</h2>
            <p className="text-muted-foreground">
              Add and edit training modules, sections, benefits, features, and videos
            </p>
          </div>
          <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingModule(null);
                setModuleForm({ title: "", description: "", category: "pricing", icon_name: "DollarSign" });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                New Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingModule ? "Edit" : "Create"} Module</DialogTitle>
                <DialogDescription>
                  {editingModule ? "Update" : "Add"} a training module for your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    placeholder="e.g., Pricing Guidelines"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                    placeholder="Brief description of this module"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={moduleForm.category}
                    onValueChange={(value) => setModuleForm({ ...moduleForm, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pricing">Pricing</SelectItem>
                      <SelectItem value="product">Product Knowledge</SelectItem>
                      <SelectItem value="sales">Sales Techniques</SelectItem>
                      <SelectItem value="tips">Quick Tips</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Icon Name</Label>
                  <Input
                    value={moduleForm.icon_name}
                    onChange={(e) => setModuleForm({ ...moduleForm, icon_name: e.target.value })}
                    placeholder="Lucide icon name (e.g., DollarSign)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveModule}>Save Module</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : modules.length === 0 ? (
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
          <div className="space-y-6">
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
                                    setSelectedSectionId(section.id);
                                    setQuestionDialogOpen(true);
                                  }}
                                >
                                  <Brain className="h-3 w-3 mr-1" />
                                  Question
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

                              {section.questions && section.questions.length > 0 && (
                                <div>
                                  <h5 className="font-semibold mb-2">Quiz Questions:</h5>
                                  <div className="space-y-2">
                                    {section.questions.map((question) => (
                                      <div key={question.id} className="flex items-start justify-between bg-muted/50 p-3 rounded">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Brain className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">{question.question}</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground pl-6">{question.answer}</p>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteQuestion(question.id)}
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

        {/* Question Dialog */}
        <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Quiz Question</DialogTitle>
              <DialogDescription>Add a question for the flashcard quiz</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Question</Label>
                <Textarea
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  placeholder="e.g., What are the key benefits of aluminum pergolas?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Answer</Label>
                <Textarea
                  value={questionForm.answer}
                  onChange={(e) => setQuestionForm({ ...questionForm, answer: e.target.value })}
                  placeholder="The correct answer to the question..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveQuestion}>Add Question</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
