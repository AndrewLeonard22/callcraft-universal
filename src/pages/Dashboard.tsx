import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Calendar, Search, Settings, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface ScriptWithType {
  id: string;
  service_name: string;
  created_at: string;
  service_type_id?: string;
  service_type?: ServiceType;
  image_url?: string;
}

interface ClientWithScripts {
  id: string;
  name: string;
  service_type: string;
  city: string;
  logo_url?: string;
  business_name?: string;
  owners_name?: string;
  created_at: string;
  scripts: ScriptWithType[];
}

const getClientLogo = (serviceType: string, customLogoUrl?: string): string => {
  if (customLogoUrl) return customLogoUrl;
  
  const type = serviceType.toLowerCase();
  
  if (type.includes("pergola")) return logoPergola;
  if (type.includes("hvac") || type.includes("heating") || type.includes("cooling")) return logoHvac;
  if (type.includes("solar") || type.includes("panel")) return logoSolar;
  if (type.includes("landscape") || type.includes("lawn") || type.includes("garden")) return logoLandscaping;
  
  return logoDefault;
};

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithScripts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .neq("id", "00000000-0000-0000-0000-000000000001")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      const { data: scriptsData, error: scriptsError } = await supabase
        .from("scripts")
        .select("id, service_name, created_at, client_id, service_type_id, image_url")
        .eq("is_template", false)
        .order("created_at", { ascending: false});

      if (scriptsError) throw scriptsError;

      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from("service_types")
        .select("*");

      if (serviceTypesError) throw serviceTypesError;

      const serviceTypesMap = new Map(
        (serviceTypesData || []).map(st => [st.id, st])
      );

      const { data: logosData } = await supabase
        .from("client_details")
        .select("client_id, field_value")
        .eq("field_name", "logo_url");

      const logosMap = new Map(
        (logosData || []).map(l => [l.client_id, l.field_value])
      );

      const { data: businessNamesData } = await supabase
        .from("client_details")
        .select("client_id, field_name, field_value")
        .in("field_name", ["business_name", "owners_name"]);

      const businessNamesMap = new Map<string, string>();
      const ownersNamesMap = new Map<string, string>();
      
      (businessNamesData || []).forEach(detail => {
        if (detail.field_name === "business_name") {
          businessNamesMap.set(detail.client_id, detail.field_value);
        } else if (detail.field_name === "owners_name") {
          ownersNamesMap.set(detail.client_id, detail.field_value);
        }
      });

      const clientsWithScripts: ClientWithScripts[] = (clientsData || [])
        .map((client) => {
          const clientScripts: ScriptWithType[] = (scriptsData || [])
            .filter(s => s.client_id === client.id)
            .map(s => ({
              id: s.id,
              service_name: s.service_name,
              created_at: s.created_at,
              service_type_id: s.service_type_id,
              service_type: s.service_type_id ? serviceTypesMap.get(s.service_type_id) : undefined,
              image_url: s.image_url,
            }));

          return {
            id: client.id,
            name: client.name,
            service_type: client.service_type,
            city: client.city,
            logo_url: logosMap.get(client.id),
            business_name: businessNamesMap.get(client.id),
            owners_name: ownersNamesMap.get(client.id),
            created_at: client.created_at,
            scripts: clientScripts,
          };
        });

      setClients(clientsWithScripts);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete ${clientName}? This will also delete all associated scripts.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      toast({
        title: "Company deleted",
        description: `${clientName} has been deleted successfully.`,
      });

      loadClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast({
        title: "Error",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      (client.business_name && client.business_name.toLowerCase().includes(query)) ||
      client.service_type.toLowerCase().includes(query) ||
      (client.city && client.city.toLowerCase().includes(query)) ||
      client.scripts.some(s => s.service_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
                <p className="text-sm text-muted-foreground">
                  {clients.length} {clients.length === 1 ? 'company' : 'companies'} total
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link to="/service-types">
                <Button variant="outline" size="default" className="gap-2 shadow-sm hover:shadow transition-shadow">
                  <Settings className="h-4 w-4" />
                  Services
                </Button>
              </Link>
              <Link to="/templates">
                <Button variant="outline" size="default" className="gap-2 shadow-sm hover:shadow transition-shadow">
                  <FileText className="h-4 w-4" />
                  Templates
                </Button>
              </Link>
              <Link to="/create">
                <Button size="default" className="gap-2 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary/90">
                  <Plus className="h-4 w-4" />
                  New Company
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Search Bar */}
        {!loading && clients.length > 0 && (
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search companies, services, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-card shadow-sm border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            {searchQuery && (
              <p className="text-sm text-muted-foreground mt-3">
                Found {filteredClients.length} {filteredClients.length === 1 ? 'result' : 'results'}
              </p>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-4" />
                  <div className="flex gap-2">
                    <div className="h-9 bg-muted rounded flex-1" />
                    <div className="h-9 bg-muted rounded flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No companies yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Get started by creating your first company profile
              </p>
              <Link to="/create">
                <Button className="gap-2 shadow-md">
                  <Plus className="h-4 w-4" />
                  Create Company
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Try adjusting your search terms
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")} className="shadow-sm">
                Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className="group relative overflow-hidden border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20"
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardHeader className="pb-4 relative z-10">
                  <div className="flex items-start gap-4">
                    <Link to={`/client/${client.id}`} className="relative">
                      <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted ring-2 ring-border/50 group-hover:ring-primary/30 transition-all duration-300 shadow-sm">
                        <img 
                          src={getClientLogo(client.service_type, client.logo_url)} 
                          alt={`${client.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </Link>
                    
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold line-clamp-1 mb-1">
                        {client.business_name || client.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {client.owners_name && (
                          <span className="block mb-1 font-medium">{client.owners_name}</span>
                        )}
                        <span className="text-xs flex items-center gap-2">
                          {client.service_type && client.service_type.toLowerCase() !== "general services" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {client.service_type}
                            </span>
                          )}
                          {client.city && (
                            <span className="text-muted-foreground">{client.city}</span>
                          )}
                        </span>
                      </CardDescription>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteClient(client.id, client.business_name || client.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 relative z-10">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 pb-4 border-b border-border/50">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(client.created_at), "MMM d, yyyy")}</span>
                  </div>
                  
                  {client.scripts.length > 0 ? (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                        Scripts ({client.scripts.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {client.scripts.map((script: ScriptWithType) => (
                          <Link key={script.id} to={`/script/${script.id}`}>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-9 text-xs px-3 gap-2 hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm group/script"
                            >
                              {script.image_url ? (
                                <div className="h-5 w-5 rounded overflow-hidden flex-shrink-0 bg-muted ring-1 ring-border/50">
                                  <img 
                                    src={script.image_url} 
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : script.service_type?.icon_url ? (
                                <div className="h-5 w-5 rounded overflow-hidden flex-shrink-0 bg-muted ring-1 ring-border/50">
                                  <img 
                                    src={script.service_type.icon_url} 
                                    alt=""
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              ) : (
                                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              <span className="truncate max-w-[120px]">{script.service_name}</span>
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No scripts yet</p>
                      <Link to={`/client/${client.id}/create-script`}>
                        <Button variant="ghost" size="sm" className="mt-2 gap-2 text-xs">
                          <Plus className="h-3 w-3" />
                          Add Script
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
