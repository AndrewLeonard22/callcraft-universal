import { useEffect, useState } from "react";
import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb, Package, Shield, TrendingUp, Award, CheckCircle2, XCircle, AlertCircle, Video, ExternalLink, Brain, ArrowRight, RotateCcw, Check, X, Plus, Trash2, Edit, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface CallAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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
  const [correctAnswers, setCorrectAnswers] = useState<Set<string>>(new Set());
  const [incorrectAnswers, setIncorrectAnswers] = useState<Set<string>>(new Set());
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [callAgents, setCallAgents] = useState<CallAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadModules();
      loadQuestions();
      loadScoreboard();
      loadCallAgents();
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

  const loadCallAgents = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("call_agents")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setCallAgents(data || []);
    } catch (error) {
      console.error("Error loading call agents:", error);
    }
  };

  const loadScoreboard = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("quiz_scores")
        .select(`
          *,
          call_agents(name)
        `)
        .eq("organization_id", organizationId)
        .order("score", { ascending: false })
        .order("completed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      // Filter out entries without call agents
      const filteredData = (data || []).filter((score: any) => score.call_agents?.name);
      setScoreboard(filteredData);
    } catch (error) {
      console.error("Error loading scoreboard:", error);
    }
  };

  const handleMarkCorrect = () => {
    const currentQuestionId = questions[currentQuestionIndex]?.id;
    if (currentQuestionId) {
      setCorrectAnswers(prev => new Set([...prev, currentQuestionId]));
      setIncorrectAnswers(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentQuestionId);
        return newSet;
      });
    }
  };

  const handleMarkIncorrect = () => {
    const currentQuestionId = questions[currentQuestionIndex]?.id;
    if (currentQuestionId) {
      setIncorrectAnswers(prev => new Set([...prev, currentQuestionId]));
      setCorrectAnswers(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentQuestionId);
        return newSet;
      });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleCompleteQuiz = async () => {
    if (!selectedAgentId) {
      toast({
        title: "Agent Required",
        description: "Please select which agent is taking the quiz",
        variant: "destructive",
      });
      return;
    }

    const score = correctAnswers.size;
    const total = questions.length;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) return;

      const { error } = await (supabase as any).from("quiz_scores").insert({
        user_id: user.id,
        organization_id: organizationId,
        call_agent_id: selectedAgentId,
        score,
        total_questions: total,
      });

      if (error) throw error;

      setQuizCompleted(true);
      loadScoreboard();
      toast({
        title: "Quiz Complete!",
        description: `You scored ${score} out of ${total} (${Math.round((score / total) * 100)}%)`,
      });
    } catch (error) {
      console.error("Error saving quiz score:", error);
      toast({
        title: "Error",
        description: "Failed to save quiz score",
        variant: "destructive",
      });
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setIsFlipped(false);
    setCorrectAnswers(new Set());
    setIncorrectAnswers(new Set());
    setQuizCompleted(false);
    setSelectedAgentId("");
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
            <div className="mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-1">Quiz Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Practice with flashcards to master your knowledge
                </p>
              </div>
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
            ) : (
              <div className="space-y-6">
                {!quizCompleted ? (
                  <>
                    {/* Agent Selection */}
                    <Card className="max-w-4xl mx-auto">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <Label htmlFor="agent-select">Select Agent Taking Quiz</Label>
                          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger id="agent-select">
                              <SelectValue placeholder="Choose an agent..." />
                            </SelectTrigger>
                            <SelectContent>
                              {callAgents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!selectedAgentId && (
                            <p className="text-sm text-muted-foreground">
                              Please select an agent to track their quiz performance
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Flashcard Section */}
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
                            Restart
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
                                  <div className="pt-4 flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      onClick={handleMarkCorrect}
                                      variant={correctAnswers.has(currentQuestion.id) ? "default" : "outline"}
                                      size="sm"
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Correct
                                    </Button>
                                    <Button
                                      onClick={handleMarkIncorrect}
                                      variant={incorrectAnswers.has(currentQuestion.id) ? "destructive" : "outline"}
                                      size="sm"
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Incorrect
                                    </Button>
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

                      {/* Stats */}
                      <Card>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold">{questions.length}</div>
                              <div className="text-sm text-muted-foreground">Total</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-green-600">{correctAnswers.size}</div>
                              <div className="text-sm text-muted-foreground">Correct</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-red-600">{incorrectAnswers.size}</div>
                              <div className="text-sm text-muted-foreground">Incorrect</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">
                                {correctAnswers.size + incorrectAnswers.size > 0 
                                  ? Math.round((correctAnswers.size / (correctAnswers.size + incorrectAnswers.size)) * 100)
                                  : 0}%
                              </div>
                              <div className="text-sm text-muted-foreground">Score</div>
                            </div>
                          </div>
                          <Button onClick={handleCompleteQuiz} className="w-full mt-4">
                            Complete Quiz
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-6 max-w-2xl mx-auto">
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="text-center flex items-center justify-center gap-2">
                          <Trophy className="h-6 w-6 text-yellow-500" />
                          Quiz Complete!
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold mb-2">
                            {Math.round((correctAnswers.size / questions.length) * 100)}%
                          </div>
                          <div className="text-muted-foreground">
                            {correctAnswers.size} out of {questions.length} correct
                          </div>
                        </div>
                        <Button onClick={handleRestart} className="w-full">
                          Take Quiz Again
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Scoreboard */}
                <Card className="w-full max-w-4xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>Top performers in your organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoreboard.length > 0 ? (
                      <div className="space-y-2">
                        {scoreboard.map((score, index) => (
                          <div
                            key={score.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                index === 0 ? 'bg-yellow-500 text-white' :
                                index === 1 ? 'bg-gray-400 text-white' :
                                index === 2 ? 'bg-amber-600 text-white' :
                                'bg-muted'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-medium">
                                  {score.call_agents?.name || 'Unknown Agent'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(score.completed_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{score.score}/{score.total_questions}</div>
                              <div className="text-sm text-muted-foreground">
                                {Math.round((score.score / score.total_questions) * 100)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No scores yet. Be the first to complete a quiz!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
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
