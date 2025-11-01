import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";

interface Script {
  id: string;
  service_name: string;
  version: number;
  created_at: string;
  is_template: boolean;
  image_url?: string;
  service_type_id?: string;
}

interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
  logo_url?: string;
}

interface GeneratedImage {
  id: string;
  image_url: string;
  features: string[];
  feature_size: string;
  created_at: string;
}

// Helper to get logo based on service type
const getClientLogo = (serviceType: string, customLogoUrl?: string): string => {
  // If custom logo exists, use it
  if (customLogoUrl) return customLogoUrl;
  
  // Otherwise fall back to default logos based on service type
  const type = serviceType.toLowerCase();
  
  if (type.includes("pergola")) return logoPergola;
  if (type.includes("hvac") || type.includes("heating") || type.includes("cooling")) return logoHvac;
  if (type.includes("solar") || type.includes("panel")) return logoSolar;
  if (type.includes("landscape") || type.includes("lawn") || type.includes("garden")) return logoLandscaping;
  
  return logoDefault;
};

// Resolve storage path to a public URL for script images
const resolveStoragePublicUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const parts = url.split("/");
  if (parts.length > 1) {
    const bucket = parts[0];
    const path = parts.slice(1).join("/");
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } else {
    // Assume default bucket for template images
    const { data } = supabase.storage.from("template-images").getPublicUrl(url);
    return data.publicUrl;
  }
};

export default function ClientScripts() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Set up real-time subscriptions
    const scriptsChannel = supabase
      .channel('client-scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, (payload) => {
        if (payload.new && (payload.new as any).client_id === clientId) {
          loadData();
        } else if (payload.old && (payload.old as any).client_id === clientId) {
          loadData();
        }
      })
      .subscribe();

    const clientChannel = supabase
      .channel('client-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients' }, (payload) => {
        if ((payload.new as any).id === clientId) {
          loadData();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(scriptsChannel);
      supabase.removeChannel(clientChannel);
    };
  }, [clientId]);

  const loadData = async () => {
    try {
      // Load client data
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;
      
      // Load logo URL from client_details
      const { data: logoData } = await supabase
        .from("client_details")
        .select("field_value")
        .eq("client_id", clientId)
        .eq("field_name", "logo_url")
        .maybeSingle();
      
      setClient({
        ...clientData,
        logo_url: logoData?.field_value || undefined
      });

      // Load scripts for this client
      const { data: scriptsData, error: scriptsError } = await supabase
        .from("scripts")
        .select("id, service_name, version, created_at, is_template, image_url, service_type_id")
        .eq("client_id", clientId)
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (scriptsError) throw scriptsError;

      // Load template images for fallback
      const { data: tmplData } = await supabase
        .from('scripts')
        .select('service_name, image_url')
        .eq('is_template', true);
      const tmplMap = new Map<string, string | undefined>((tmplData || []).map(t => [t.service_name, t.image_url || undefined]));

      // Load service type icons for fallback
      const { data: typesData } = await supabase
        .from('service_types')
        .select('id, icon_url');
      const typeMap = new Map<string, string | undefined>((typesData || []).map(t => [t.id, t.icon_url || undefined]));

      const mapped = (scriptsData || []).map((s) => {
        const tmplFallback = tmplMap.get(s.service_name);
        const typeFallback = s.service_type_id ? typeMap.get(s.service_type_id) : undefined;
        const resolved =
          resolveStoragePublicUrl(s.image_url) ||
          resolveStoragePublicUrl(tmplFallback) ||
          resolveStoragePublicUrl(typeFallback) ||
          s.image_url ||
          tmplFallback ||
          typeFallback;
        return { ...s, image_url: resolved };
      });
      setScripts(mapped);

      // Load generated images for this client
      const { data: imagesData, error: imagesError } = await supabase
        .from("generated_images")
        .select("id, image_url, features, feature_size, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (imagesError) {
        console.error("Error loading generated images:", imagesError);
      } else {
        setGeneratedImages(imagesData || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    try {
      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", scriptId);

      if (error) throw error;
      
      toast.success("Script deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting script:", error);
      toast.error("Failed to delete script");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Client not found</h2>
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4 sm:mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>

        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border shadow-sm">
              <img 
                src={getClientLogo(client.service_type, client.logo_url)} 
                alt={`${client.name} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 break-words">{client.name}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {client.service_type} {client.city && `• ${client.city}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link to={`/edit/${clientId}`} className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto">
                <Edit2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Edit Client</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            </Link>
            <Link to={`/create-script/${clientId}`} className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Script</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Generated Designs Section */}
        {generatedImages.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Generated Designs</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {generatedImages.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="w-full h-40 bg-muted/20 overflow-hidden">
                    <img 
                      src={image.image_url} 
                      alt="Generated design"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {image.features.slice(0, 3).map((feature, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {feature}
                          </span>
                        ))}
                        {image.features.length > 3 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            +{image.features.length - 3} more
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(image.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Scripts Section */}
        <h2 className="text-xl font-semibold mb-4">Scripts</h2>
        {scripts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No scripts yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Create your first script for this client
              </p>
              <Link to={`/create-script/${clientId}`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Script
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {scripts.map((script) => (
              <Card key={script.id} className="group hover:border-primary/50 transition-all overflow-hidden">
                <div className="w-full h-40 bg-muted/20 overflow-hidden border-b border-border/50 relative">
                  {script.image_url ? (
                    <img 
                      src={script.image_url} 
                      alt={script.service_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <FileText className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base mb-1 line-clamp-1">
                        {script.service_name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        v{script.version} • {new Date(script.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Script</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteScript(script.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link to={`/script/${script.id}`}>
                    <Button className="w-full" size="sm">
                      View Script
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
