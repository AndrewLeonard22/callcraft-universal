import { useEffect, useState } from "react";
import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb, Package, Shield, TrendingUp, Award, CheckCircle2, XCircle, AlertCircle, Video, ExternalLink, Brain, ArrowRight, RotateCcw, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeTab, setActiveTab] = useState("modules");
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
      const { data, error } = await supabase
        .from("training_questions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("display_order");

      if (error) throw error;

      // Shuffle questions for random order
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
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
    setShowAnswer(false);
    setUserAnswer("");
    setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
  };

  const handleRestart = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setShowAnswer(false);
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
            {questions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                    <Brain className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Quiz Questions Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                    Add training questions in Manage Content to start practicing
                  </p>
                  <Link to="/training-management">
                    <Button>Add Questions</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : currentQuestion ? (
              <div className="max-w-3xl mx-auto space-y-4">
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRestart}
                        className="h-7 gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restart
                      </Button>
                    </div>
                    <CardTitle className="text-xl">{currentQuestion.question}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Your Answer:</label>
                      <Textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        className="min-h-[120px] resize-none"
                      />
                    </div>

                    {showAnswer && (
                      <div className="border-2 border-green-500/30 rounded-lg p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                          <h4 className="font-bold text-sm">Correct Answer:</h4>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentQuestion.answer}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {!showAnswer ? (
                        <Button
                          onClick={() => setShowAnswer(true)}
                          className="flex-1 gap-2"
                          disabled={!userAnswer.trim()}
                        >
                          <Check className="h-4 w-4" />
                          Show Answer
                        </Button>
                      ) : (
                        <Button
                          onClick={handleNextQuestion}
                          className="flex-1 gap-2"
                        >
                          Next Question
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="border">
                    <CardContent className="pt-6 text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {currentQuestionIndex + 1}
                      </div>
                      <div className="text-xs text-muted-foreground">Current</div>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="pt-6 text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {questions.length - currentQuestionIndex - 1}
                      </div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
