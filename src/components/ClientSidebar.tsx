import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, Plus, FileText, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  name: string;
  service_type: string;
  city: string;
  business_name?: string;
}

export function ClientSidebar() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .neq("id", "00000000-0000-0000-0000-000000000001") // Exclude template client
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading clients:", error);
      return;
    }

    // Get business names for all clients
    const { data: businessNamesData } = await supabase
      .from("client_details")
      .select("client_id, field_value")
      .eq("field_name", "business_name");

    const businessNamesMap = new Map(
      (businessNamesData || []).map(detail => [detail.client_id, detail.field_value])
    );

    const clientsWithBusinessNames = (data || []).map(client => ({
      ...client,
      business_name: businessNamesMap.get(client.id),
    }));

    setClients(clientsWithBusinessNames);
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.service_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-72 border-r border-border bg-card flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Script Generator
        </h1>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2">
          <Link to="/create">
            <Button className="w-full" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </Link>
          
          <Link to="/image-generator">
            <Button variant="outline" className="w-full" size="sm">
              <Wand2 className="mr-2 h-4 w-4" />
              Image Generator
            </Button>
          </Link>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "No clients found" : "No clients yet"}
            </div>
          ) : (
            filteredClients.map((client) => (
              <Link
                key={client.id}
                to={`/client/${client.id}`}
                className={`block p-3 rounded-lg mb-2 transition-all ${
                  location.pathname === `/client/${client.id}`
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-secondary"
                }`}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{client.business_name || client.name}</div>
                    <div className="text-xs opacity-80 truncate">
                      {client.service_type} {client.city && `• ${client.city}`}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}