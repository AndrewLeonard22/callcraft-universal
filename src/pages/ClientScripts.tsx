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
}

interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
  logo_url?: string;
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

export default function ClientScripts() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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
        .select("id, service_name, version, created_at, is_template, image_url")
        .eq("client_id", clientId)
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (scriptsError) throw scriptsError;
      setScripts(scriptsData || []);
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
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border shadow-sm">
              <img 
                src={getClientLogo(client.service_type, client.logo_url)} 
                alt={`${client.name} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">{client.name}</h1>
              <p className="text-muted-foreground">
                {client.service_type} {client.city && `• ${client.city}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/edit/${clientId}`}>
              <Button variant="outline">
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Client
              </Button>
            </Link>
            <Link to={`/create-script/${clientId}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Script
              </Button>
            </Link>
          </div>
        </div>

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scripts.map((script) => (
              <Card key={script.id} className="group hover:border-primary/50 transition-all overflow-hidden">
                <div className="w-full h-40 bg-muted/20 overflow-hidden border-b border-border/50 relative">
                  {script.image_url ? (
                    <img 
                      src={script.image_url} 
                      alt={script.service_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
