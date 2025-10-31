import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Calendar, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";

interface ClientWithScripts {
  id: string;
  name: string;
  service_type: string;
  city: string;
  logo_url?: string;
  created_at: string;
  scripts: Array<{
    id: string;
    service_name: string;
    created_at: string;
  }>;
}

// Helper to get logo based on service type
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

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      // Get all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .neq("id", "00000000-0000-0000-0000-000000000001")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Get all non-template scripts
      const { data: scriptsData, error: scriptsError } = await supabase
        .from("scripts")
        .select("id, service_name, created_at, client_id")
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (scriptsError) throw scriptsError;

      // Get logo URLs for all clients
      const { data: logosData } = await supabase
        .from("client_details")
        .select("client_id, field_value")
        .eq("field_name", "logo_url");

      const logosMap = new Map(
        (logosData || []).map(l => [l.client_id, l.field_value])
      );

      // Group scripts by client
      const clientsWithScripts: ClientWithScripts[] = (clientsData || [])
        .map((client) => {
          const clientScripts = (scriptsData || [])
            .filter(s => s.client_id === client.id)
            .map(s => ({
              id: s.id,
              service_name: s.service_name,
              created_at: s.created_at,
            }));

          return {
            id: client.id,
            name: client.name,
            service_type: client.service_type,
            city: client.city,
            logo_url: logosMap.get(client.id),
            created_at: client.created_at,
            scripts: clientScripts,
          };
        })
        .filter(c => c.scripts.length > 0); // Only show clients with scripts

      setClients(clientsWithScripts);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter clients based on search query
  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.service_type.toLowerCase().includes(query) ||
      (client.city && client.city.toLowerCase().includes(query)) ||
      client.scripts.some(s => s.service_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">All Scripts</h1>
              <p className="text-sm text-muted-foreground">
                View and manage all client scripts
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/templates">
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Templates
                </Button>
              </Link>
              <Link to="/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Client
                </Button>
              </Link>
            </div>
          </div>
          
          {!loading && clients.length > 0 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by client, service, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'} found
                </p>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-3 bg-muted rounded w-full mb-3" />
                  <div className="h-8 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No scripts yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Create your first client and add a script to get started
              </p>
              <Link to="/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Client
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No clients found</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Try adjusting your search query
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="group hover:border-primary/50 transition-all h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                      <img 
                        src={getClientLogo(client.service_type, client.logo_url)} 
                        alt={`${client.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-1 mb-1">
                        {client.name}
                      </CardTitle>
                      <CardDescription className="text-xs capitalize">
                        {client.service_type}
                        {client.city && ` • ${client.city}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(client.created_at), "MMM d, yyyy")}</span>
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Scripts ({client.scripts.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.scripts.map((script) => (
                        <Link key={script.id} to={`/script/${script.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                            <FileText className="mr-1.5 h-3 w-3" />
                            {script.service_name}
                          </Button>
                        </Link>
                      ))}
                      <Link to={`/create-script/${client.id}`}>
                        <Button variant="secondary" size="sm" className="h-7 text-xs px-2">
                          <Plus className="mr-1.5 h-3 w-3" />
                          Add Script
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
