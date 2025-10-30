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

interface Script {
  id: string;
  service_name: string;
  version: number;
  created_at: string;
  is_template: boolean;
}

interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
}

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
      setClient(clientData);

      // Load scripts for this client
      const { data: scriptsData, error: scriptsError } = await supabase
        .from("scripts")
        .select("id, service_name, version, created_at, is_template")
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
          <div>
            <h1 className="text-3xl font-bold mb-1">{client.name}</h1>
            <p className="text-muted-foreground">
              {client.service_type} {client.city && `• ${client.city}`}
            </p>
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
              <Card key={script.id} className="group hover:border-primary/50 transition-all">
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
