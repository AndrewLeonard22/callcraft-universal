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
              <div className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-semibold tracking-tight">Team Training</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/training-management">
                <Button variant="default">
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

      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3 mb-6">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-semibold text-primary">Team Bootcamp</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">Training Center</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Master pricing, products, and sales techniques to close more deals with confidence
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading training content...</p>
          </div>
        ) : modules.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Training Content Yet</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first training module
              </p>
              <Link to="/training-management">
                <Button>
                  Create Training Content
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8">
            {modules.map((module) => {
              const IconComponent = getIconComponent(module.icon_name);
              const categoryColor = getCategoryColor(module.category);

              return (
                <Card key={module.id} className="border-2">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <IconComponent className={`h-6 w-6 ${categoryColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-2xl">{module.title}</CardTitle>
                          <Badge variant="secondary" className="capitalize">
                            {module.category}
                          </Badge>
                        </div>
                        <CardDescription className="text-base mt-1">
                          {module.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {module.sections && module.sections.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {module.sections.map((section) => (
                          <AccordionItem key={section.id} value={section.id} className="border-b">
                            <AccordionTrigger className="hover:no-underline py-5">
                              <div className="flex items-center gap-3">
                                <Package className="h-5 w-5 text-primary" />
                                <span className="font-semibold">{section.title}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-6 pt-4 pb-2">
                                {section.content && (
                                  <div className="prose prose-sm max-w-none">
                                    <p className="text-muted-foreground whitespace-pre-wrap">
                                      {section.content}
                                    </p>
                                  </div>
                                )}

                                {section.features && section.features.length > 0 && (
                                  <div className="border rounded-lg p-5 space-y-3 bg-card">
                                    <h4 className="font-semibold text-lg mb-3">Pricing & Details</h4>
                                    <div className="space-y-2.5">
                                      {section.features.map((feature) => (
                                        <div
                                          key={feature.id}
                                          className="flex justify-between items-center py-2 border-b last:border-0"
                                        >
                                          <span className="text-sm text-muted-foreground">
                                            {feature.feature_name}
                                          </span>
                                          <span className="font-semibold">{feature.feature_value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {section.benefits && section.benefits.length > 0 && (
                                  <div className="grid md:grid-cols-2 gap-4">
                                    {section.benefits.filter(b => b.benefit_type === "pro").length > 0 && (
                                      <div className="border-2 border-green-500/20 rounded-lg p-5 bg-green-500/5">
                                        <div className="flex items-center gap-2 mb-4">
                                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                                          <h5 className="font-semibold">Benefits</h5>
                                        </div>
                                        <div className="space-y-2">
                                          {section.benefits
                                            .filter(b => b.benefit_type === "pro")
                                            .map((benefit) => (
                                              <div key={benefit.id} className="flex items-start gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm">{benefit.benefit_text}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}

                                    {section.benefits.filter(b => b.benefit_type === "con").length > 0 && (
                                      <div className="border-2 border-amber-500/20 rounded-lg p-5 bg-amber-500/5">
                                        <div className="flex items-center gap-2 mb-4">
                                          <AlertCircle className="h-5 w-5 text-amber-600" />
                                          <h5 className="font-semibold">Considerations</h5>
                                        </div>
                                        <div className="space-y-2">
                                          {section.benefits
                                            .filter(b => b.benefit_type === "con")
                                            .map((benefit) => (
                                              <div key={benefit.id} className="flex items-start gap-2">
                                                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm">{benefit.benefit_text}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {section.videos && section.videos.length > 0 && (
                                  <div className="border rounded-lg p-5 bg-card">
                                    <div className="flex items-center gap-2 mb-4">
                                      <Video className="h-5 w-5 text-primary" />
                                      <h5 className="font-semibold">Training Videos</h5>
                                    </div>
                                    <div className="space-y-3">
                                      {section.videos.map((video) => (
                                        <a
                                          key={video.id}
                                          href={video.video_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <Video className="h-4 w-4 text-primary" />
                                                <span className="font-medium">{video.title}</span>
                                              </div>
                                              {video.description && (
                                                <p className="text-sm text-muted-foreground">
                                                  {video.description}
                                                </p>
                                              )}
                                            </div>
                                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                      <p className="text-sm text-muted-foreground py-4">
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
