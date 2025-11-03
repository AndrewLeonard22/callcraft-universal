import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Trash2, Edit2, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/utils/logger";
import { getClientLogo, resolveStoragePublicUrl } from "@/utils/imageHelpers";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  price_estimate?: any;
  estimated_at?: string;
}

export default function ClientScripts() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");

  // Optimized: Combined data loading with useCallback
  const loadData = useCallback(async () => {
    try {
      // Get user's organization first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgMember?.organization_id) {
        toast.error("Organization not found");
        return;
      }

      const userOrganizationId = orgMember.organization_id;

      // Parallel API calls for better performance
      const [
        { data: clientData, error: clientError },
        { data: logoData },
        { data: scriptsData, error: scriptsError },
        { data: tmplData },
        { data: typesData },
        { data: imagesData, error: imagesError }
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase
          .from("client_details")
          .select("field_value")
          .eq("client_id", clientId)
          .eq("field_name", "logo_url")
          .maybeSingle(),
        supabase
          .from("scripts")
          .select("id, service_name, version, created_at, is_template, image_url, service_type_id")
          .eq("client_id", clientId)
          .eq("is_template", false)
          .order("created_at", { ascending: false }),
        supabase.from('scripts').select('service_name, image_url').eq('is_template', true).eq('organization_id', userOrganizationId),
        supabase.from('service_types').select('id, icon_url'),
        supabase
          .from("generated_images")
          .select("id, image_url, features, feature_size, created_at, price_estimate, estimated_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ]);

      if (clientError) throw clientError;
      if (scriptsError) throw scriptsError;
      
      // Update last_accessed_at timestamp for tracking
      supabase
        .from("clients")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", clientId)
        .then(); // Fire and forget - don't block UI
      
      setClient({
        ...clientData,
        logo_url: logoData?.field_value || undefined
      });

      // Create Maps for O(1) lookups
      const tmplMap = new Map<string, string | undefined>((tmplData || []).map(t => [t.service_name, t.image_url || undefined]));
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

      if (imagesError) {
        logger.error("Error loading generated images:", imagesError);
      } else {
        setGeneratedImages(imagesData || []);
      }
    } catch (error) {
      logger.error("Error loading data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();

    // Debounced real-time updates
    let reloadTimeout: NodeJS.Timeout;
    const debouncedReload = (payload: any) => {
      const shouldReload = 
        (payload.new && (payload.new as any).client_id === clientId) ||
        (payload.old && (payload.old as any).client_id === clientId) ||
        ((payload.new as any)?.id === clientId);
      
      if (shouldReload) {
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(loadData, 500);
      }
    };

    const scriptsChannel = supabase
      .channel('client-scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, debouncedReload)
      .subscribe();

    const clientChannel = supabase
      .channel('client-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients' }, debouncedReload)
      .subscribe();

    return () => {
      clearTimeout(reloadTimeout);
      supabase.removeChannel(scriptsChannel);
      supabase.removeChannel(clientChannel);
    };
  }, [clientId, loadData]);

  const handleDeleteScript = useCallback(async (scriptId: string) => {
    try {
      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", scriptId);

      if (error) throw error;
      
      toast.success("Script deleted successfully");
      loadData();
    } catch (error) {
      logger.error("Error deleting script:", error);
      toast.error("Failed to delete script");
    }
  }, [loadData]);

  const openEmailDialog = (image: GeneratedImage) => {
    setSelectedImage(image);
    setEmailDialogOpen(true);
  };

  const handleSendDesignEmail = async () => {
    if (!client || !selectedImage) return;

    if (!leadEmail || !leadName) {
      toast.error("Please enter both lead name and email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Get company name
    const { data: companyData } = await supabase
      .from('client_details')
      .select('field_value')
      .eq('client_id', client.id)
      .eq('field_name', 'business_name')
      .single();

    setSendingEmail(selectedImage.id);
    try {
      const { error } = await supabase.functions.invoke('send-design-email', {
        body: {
          clientName: leadName,
          clientEmail: leadEmail,
          companyName: companyData?.field_value || client.name,
          imageUrl: selectedImage.image_url,
          estimate: selectedImage.price_estimate,
          features: selectedImage.features,
        }
      });

      if (error) throw error;

      toast.success(`Design emailed to ${leadEmail}`);
      setEmailDialogOpen(false);
      setLeadEmail("");
      setLeadName("");
      setSelectedImage(null);
    } catch (error: any) {
      logger.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(null);
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

        {/* Generated Designs Section */}
        {generatedImages.length > 0 && (
          <div className="mt-12">
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
                      {image.price_estimate && (
                        <div className="pt-2 border-t">
                          <p className="text-sm font-semibold text-primary">
                            Est. ${image.price_estimate.total?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {image.price_estimate.items?.length || 0} items included
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(image.created_at).toLocaleDateString()}
                      </p>
                      {image.price_estimate && (
                        <Button
                          onClick={() => openEmailDialog(image)}
                          size="sm"
                          className="w-full mt-2"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send to Lead
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Design to Lead</DialogTitle>
              <DialogDescription>
                Enter the lead's information to send them this design and estimate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="leadName">Lead Name</Label>
                <Input
                  id="leadName"
                  placeholder="John Smith"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadEmail">Lead Email</Label>
                <Input
                  id="leadEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailDialogOpen(false);
                  setLeadEmail("");
                  setLeadName("");
                  setSelectedImage(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendDesignEmail}
                disabled={sendingEmail === selectedImage?.id}
              >
                {sendingEmail === selectedImage?.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
