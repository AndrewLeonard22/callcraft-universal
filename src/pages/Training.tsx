import { useEffect, useState } from "react";
import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb, Package, Shield, TrendingUp, Award, CheckCircle2, XCircle, AlertCircle, Video, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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

export default function Training() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={socialWorksLogo} 
                alt="Social Works" 
                className="h-8 sm:h-10 w-auto"
              />
              <div className="h-6 sm:h-8 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Team Training</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/training-management">
                <Button variant="default" className="shadow-sm">
                  Manage Content
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 rounded-full px-6 py-3 mb-6 shadow-sm border border-primary/20">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">Team Bootcamp</span>
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">Training Center</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Master pricing, products, and sales techniques to close more deals with confidence
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground text-lg">Loading training content...</p>
          </div>
        ) : modules.length === 0 ? (
          <Card className="border shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-6">
                <GraduationCap className="h-16 w-16 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-3">No Training Content Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Get started by creating your first training module
              </p>
              <Link to="/training-management">
                <Button size="lg" className="shadow-md">
                  Create Training Content
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {modules.map((module) => {
              const IconComponent = getIconComponent(module.icon_name);
              const categoryColor = getCategoryColor(module.category);

              return (
                <Card key={module.id} className="border shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                  <CardHeader className="pb-6 bg-gradient-to-br from-muted/30 to-transparent">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-background rounded-xl shadow-sm border">
                        <IconComponent className={`h-7 w-7 ${categoryColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-2xl font-bold">{module.title}</CardTitle>
                          <Badge variant="secondary" className="capitalize font-medium">
                            {module.category}
                          </Badge>
                        </div>
                        <CardDescription className="text-base leading-relaxed">
                          {module.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {module.sections && module.sections.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {module.sections.map((section) => (
                          <AccordionItem key={section.id} value={section.id} className="border-b last:border-0">
                            <AccordionTrigger className="hover:no-underline py-5 group">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                  <Package className="h-5 w-5 text-primary" />
                                </div>
                                <span className="font-semibold text-left">{section.title}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-6 pt-4 pb-4 px-1">
                                {section.content && (
                                  <div className="prose prose-sm max-w-none">
                                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                      {section.content}
                                    </p>
                                  </div>
                                )}

                                {section.features && section.features.length > 0 && (
                                  <div className="border rounded-xl p-6 bg-gradient-to-br from-muted/30 to-muted/10 shadow-sm">
                                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                                      <DollarSign className="h-5 w-5 text-primary" />
                                      Pricing & Details
                                    </h4>
                                    <div className="space-y-3">
                                      {section.features.map((feature) => (
                                        <div
                                          key={feature.id}
                                          className="flex justify-between items-center py-3 px-4 bg-background/60 rounded-lg border border-border/50"
                                        >
                                          <span className="text-sm font-medium text-muted-foreground">
                                            {feature.feature_name}
                                          </span>
                                          <span className="font-bold text-foreground">{feature.feature_value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {section.benefits && section.benefits.length > 0 && (
                                  <div className="grid md:grid-cols-2 gap-4">
                                    {section.benefits.filter(b => b.benefit_type === "pro").length > 0 && (
                                      <div className="border-2 border-green-500/30 rounded-xl p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="p-1.5 bg-green-500/20 rounded-lg">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                                          </div>
                                          <h5 className="font-bold text-lg">Benefits</h5>
                                        </div>
                                        <div className="space-y-3">
                                          {section.benefits
                                            .filter(b => b.benefit_type === "pro")
                                            .map((benefit) => (
                                              <div key={benefit.id} className="flex items-start gap-3 text-sm">
                                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                                                <span className="leading-relaxed">{benefit.benefit_text}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}

                                    {section.benefits.filter(b => b.benefit_type === "con").length > 0 && (
                                      <div className="border-2 border-amber-500/30 rounded-xl p-6 bg-gradient-to-br from-amber-500/10 to-amber-500/5 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="p-1.5 bg-amber-500/20 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                                          </div>
                                          <h5 className="font-bold text-lg">Considerations</h5>
                                        </div>
                                        <div className="space-y-3">
                                          {section.benefits
                                            .filter(b => b.benefit_type === "con")
                                            .map((benefit) => (
                                              <div key={benefit.id} className="flex items-start gap-3 text-sm">
                                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                                                <span className="leading-relaxed">{benefit.benefit_text}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {section.videos && section.videos.length > 0 && (
                                  <div className="border rounded-xl p-6 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
                                    <div className="flex items-center gap-2 mb-5">
                                      <div className="p-1.5 bg-primary/20 rounded-lg">
                                        <Video className="h-5 w-5 text-primary" />
                                      </div>
                                      <h5 className="font-bold text-lg">Training Videos</h5>
                                    </div>
                                    <div className="space-y-3">
                                      {section.videos.map((video) => (
                                        <a
                                          key={video.id}
                                          href={video.video_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block p-4 border rounded-xl hover:bg-background/80 hover:shadow-md transition-all duration-200 bg-background/60 group"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                <Video className="h-4 w-4 text-primary" />
                                                <span className="font-semibold group-hover:text-primary transition-colors">{video.title}</span>
                                              </div>
                                              {video.description && (
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                  {video.description}
                                                </p>
                                              )}
                                            </div>
                                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
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
                      <p className="text-muted-foreground py-6 px-4 text-center bg-muted/30 rounded-lg">
                        No sections added yet. Go to Manage Content to add sections.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
