import { useEffect, useState } from "react";
import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb, Package, Shield, TrendingUp, Award, CheckCircle2, XCircle, AlertCircle, Video, ExternalLink, Brain, ArrowRight, RotateCcw, Check, X, Plus, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

export default function Training() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState("modules");
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TrainingQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({ question: "", answer: "" });
  const { toast } = useToast();

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadModules();
      loadQuestions();
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
        .eq("is_active", true)
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

  const loadQuestions = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("training_questions")
        .select("*")
        .eq("organization_id", organizationId)
        .is("section_id", null)
        .is("module_id", null)
        .order("display_order");

      if (error) throw error;

      // Shuffle questions for random order
      const shuffled = ((data || []) as TrainingQuestion[]).sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load training questions",
        variant: "destructive",
      });
    }
  };

  const handleNextQuestion = () => {
    setIsFlipped(false);
    setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
  };

  const handlePreviousQuestion = () => {
    setIsFlipped(false);
    setCurrentQuestionIndex((prev) => (prev - 1 + questions.length) % questions.length);
  };

  const handleRestart = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setIsFlipped(false);
  };

  const handleSaveQuestion = async () => {
    if (!organizationId) return;

    try {
      if (editingQuestion) {
        const { error } = await (supabase as any)
          .from("training_questions")
          .update(questionForm)
          .eq("id", editingQuestion.id);

        if (error) throw error;
        toast({ title: "Question updated successfully" });
      } else {
        const { error } = await (supabase as any)
          .from("training_questions")
          .insert([{ ...questionForm, organization_id: organizationId }]);

        if (error) throw error;
        toast({ title: "Question added successfully" });
      }
      
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      setQuestionForm({ question: "", answer: "" });
      loadQuestions();
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
      const { error } = await (supabase as any)
        .from("training_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;
      toast({ title: "Question deleted successfully" });
      loadQuestions();
      if (currentQuestionIndex >= questions.length - 1) {
        setCurrentQuestionIndex(0);
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      });
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      DollarSign,
      Package,
      BookOpen,
      Phone,
      Lightbulb,
      Shield,
      TrendingUp,
      Award,
    };
    return icons[iconName] || Package;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      pricing: "text-green-600",
      product: "text-blue-600",
      sales: "text-purple-600",
      tips: "text-amber-600",
    };
    return colors[category] || "text-primary";
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={socialWorksLogo} alt="Social Works" className="h-8 w-auto" />
              <div className="h-6 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-lg font-bold">Training Center</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/training-management">
                <Button variant="default" size="sm">Manage Content</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="modules" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Training Modules
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="gap-2">
              <Brain className="h-4 w-4" />
              Quiz Mode
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="mt-0">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading training content...</p>
              </div>
            ) : modules.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                    <GraduationCap className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Training Content Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                    Get started by creating your first training module
                  </p>
                  <Link to="/training-management">
                    <Button>Create Training Content</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {modules.map((module) => {
              const IconComponent = getIconComponent(module.icon_name);
              const categoryColor = getCategoryColor(module.category);

                  return (
                    <Card key={module.id} className="group hover:shadow-lg transition-all duration-200 border-border/50">
                      <CardHeader className="pb-4 bg-gradient-to-br from-muted/20 to-transparent">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-background rounded-lg shadow-sm border border-border/50">
                            <IconComponent className={`h-5 w-5 ${categoryColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-lg font-bold truncate">{module.title}</CardTitle>
                              <Badge variant="secondary" className="capitalize text-xs">
                                {module.category}
                              </Badge>
                            </div>
                            <CardDescription className="text-sm line-clamp-2">
                              {module.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {module.sections && module.sections.length > 0 ? (
                          <Accordion type="single" collapsible className="w-full">
                            {module.sections.map((section) => (
                              <AccordionItem key={section.id} value={section.id} className="border-b last:border-0">
                                <AccordionTrigger className="hover:no-underline py-3 group">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-primary/10 rounded group-hover:bg-primary/20 transition-colors">
                                      <Package className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-semibold text-sm text-left">{section.title}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4 pt-2 pb-2 px-1">
                                    {section.content && (
                                      <div className="prose prose-sm max-w-none">
                                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                          {section.content}
                                        </p>
                                      </div>
                                    )}

                                    {section.features && section.features.length > 0 && (
                                      <div className="border rounded-lg p-4 bg-gradient-to-br from-muted/20 to-muted/5">
                                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                          <DollarSign className="h-4 w-4 text-primary" />
                                          Pricing & Details
                                        </h4>
                                        <div className="space-y-2">
                                          {section.features.map((feature) => (
                                            <div
                                              key={feature.id}
                                              className="flex justify-between items-center py-2 px-3 bg-background/60 rounded border border-border/50"
                                            >
                                              <span className="text-xs font-medium text-muted-foreground">
                                                {feature.feature_name}
                                              </span>
                                              <span className="font-bold text-sm">{feature.feature_value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {section.benefits && section.benefits.length > 0 && (
                                      <div className="grid md:grid-cols-2 gap-3">
                                        {section.benefits.filter(b => b.benefit_type === "pro").length > 0 && (
                                          <div className="border border-green-500/30 rounded-lg p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="p-1 bg-green-500/20 rounded">
                                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                                              </div>
                                              <h5 className="font-bold text-sm">Benefits</h5>
                                            </div>
                                            <div className="space-y-2">
                                              {section.benefits
                                                .filter(b => b.benefit_type === "pro")
                                                .map((benefit) => (
                                                  <div key={benefit.id} className="flex items-start gap-2 text-xs">
                                                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                                                    <span className="leading-relaxed">{benefit.benefit_text}</span>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}

                                        {section.benefits.filter(b => b.benefit_type === "con").length > 0 && (
                                          <div className="border border-amber-500/30 rounded-lg p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="p-1 bg-amber-500/20 rounded">
                                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                                              </div>
                                              <h5 className="font-bold text-sm">Considerations</h5>
                                            </div>
                                            <div className="space-y-2">
                                              {section.benefits
                                                .filter(b => b.benefit_type === "con")
                                                .map((benefit) => (
                                                  <div key={benefit.id} className="flex items-start gap-2 text-xs">
                                                    <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                                                    <span className="leading-relaxed">{benefit.benefit_text}</span>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {section.videos && section.videos.length > 0 && (
                                      <div className="border rounded-lg p-4 bg-gradient-to-br from-primary/5 to-primary/10">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="p-1 bg-primary/20 rounded">
                                            <Video className="h-4 w-4 text-primary" />
                                          </div>
                                          <h5 className="font-bold text-sm">Training Videos</h5>
                                        </div>
                                        <div className="space-y-2">
                                          {section.videos.map((video) => (
                                            <a
                                              key={video.id}
                                              href={video.video_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block p-3 border rounded-lg hover:bg-background/80 hover:shadow-sm transition-all duration-200 bg-background/60 group"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <Video className="h-3 w-3 text-primary" />
                                                    <span className="font-semibold text-xs group-hover:text-primary transition-colors">{video.title}</span>
                                                  </div>
                                                  {video.description && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                      {video.description}
                                                    </p>
                                                  )}
                                                </div>
                                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                                              </div>
                                            </a>
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
                          <p className="text-muted-foreground text-xs py-4 px-3 text-center bg-muted/20 rounded">
                            No sections added yet. Go to Manage Content to add sections.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="flashcards" className="mt-0">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-1">Quiz Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Practice with flashcards to master your knowledge
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingQuestion(null);
                  setQuestionForm({ question: "", answer: "" });
                  setQuestionDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>

            {questions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                    <Brain className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Quiz Questions Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                    Get started by creating your first quiz question
                  </p>
                  <Button
                    onClick={() => {
                      setEditingQuestion(null);
                      setQuestionForm({ question: "", answer: "" });
                      setQuestionDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Question
                  </Button>
                </CardContent>
              </Card>
            ) : currentQuestion ? (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRestart}
                      className="h-8 gap-2"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Shuffle
                    </Button>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Flashcard */}
                <div className="perspective-1000">
                  <div
                    className={`relative w-full h-[400px] cursor-pointer transition-transform duration-500 transform-style-3d ${
                      isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    {/* Front of card */}
                    <div className="absolute inset-0 backface-hidden">
                      <Card className="h-full border-2 shadow-xl hover:shadow-2xl transition-shadow">
                        <CardContent className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-background to-muted/20">
                          <div className="space-y-6 text-center w-full">
                            <Badge variant="secondary" className="text-xs">
                              Question
                            </Badge>
                            <p className="text-2xl font-semibold leading-relaxed px-4">
                              {currentQuestion.question}
                            </p>
                            <div className="pt-8">
                              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <RotateCcw className="h-4 w-4" />
                                Click to reveal answer
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Back of card */}
                    <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)]">
                      <Card className="h-full border-2 border-green-500/50 shadow-xl hover:shadow-2xl transition-shadow">
                        <CardContent className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-green-500/10 via-background to-green-500/5">
                          <div className="space-y-6 text-center w-full">
                            <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                              Answer
                            </Badge>
                            <p className="text-xl leading-relaxed px-4 whitespace-pre-wrap">
                              {currentQuestion.answer}
                            </p>
                            <div className="pt-8">
                              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <RotateCcw className="h-4 w-4" />
                                Click to see question
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="flex-1 max-w-[200px]"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    {questions.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          setIsFlipped(false);
                        }}
                        className={`h-2 rounded-full transition-all ${
                          index === currentQuestionIndex
                            ? "w-8 bg-primary"
                            : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleNextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="flex-1 max-w-[200px]"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Stats & Management */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-3xl font-bold text-primary mb-1">
                        {questions.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Cards</div>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-3xl font-bold text-primary mb-1">
                        {currentQuestionIndex + 1}
                      </div>
                      <div className="text-xs text-muted-foreground">Current</div>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-3xl font-bold text-primary mb-1">
                        {questions.length - currentQuestionIndex - 1}
                      </div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Question Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Manage Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto space-y-2">
                    {questions.map((q, index) => (
                      <div key={q.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.question}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">{q.answer}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(q);
                              setQuestionForm({ question: q.question, answer: q.answer });
                              setQuestionDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Question Dialog */}
          <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "Edit" : "Add"} Quiz Question</DialogTitle>
                <DialogDescription>
                  {editingQuestion ? "Update" : "Create"} a question for the flashcard quiz
                </DialogDescription>
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
                <Button onClick={handleSaveQuestion}>
                  {editingQuestion ? "Update" : "Add"} Question
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Tabs>
      </div>
    </div>
  );
}
