import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Calendar, Search, Settings, Trash2, LogOut, User as UserIcon, Users, Wand2, Archive, ArchiveRestore, GraduationCap, Building2, List, Grid3x3, ArrowUpDown, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { logger } from "@/utils/logger";
import type { User } from "@supabase/supabase-js";
import agentIqLogo from "@/assets/agent-iq-logo.png";
import { CompanyLogoSettings } from "@/components/CompanyLogoSettings";
import { getClientLogo } from "@/utils/clientHelpers";
import { clearSessionCache } from "@/utils/sessionCache";

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

interface GeneratedImage {
  id: string;
  image_url: string;
  features: string[];
  feature_size: string;
  created_at: string;
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
  organization_id?: string;
  archived?: boolean;
  last_accessed_at?: string;
  call_agent_id?: string;
  call_agent_name?: string;
  scripts: ScriptWithType[];
  generated_images: GeneratedImage[];
}

interface CallAgent {
  id: string;
  name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; company_logo_url?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'live' | 'archived'>('live');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'service'>('name');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [callAgents, setCallAgents] = useState<CallAgent[]>([]);
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { toast } = useToast();

  // Optimized: Use useCallback to prevent re-creating function on every render
  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, company_logo_url")
        .eq("id", user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Fetch clients data using React Query for caching
  const fetchClients = useCallback(async (): Promise<{ clients: ClientWithScripts[]; agents: CallAgent[] }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!orgMember?.organization_id) {
      return { clients: [], agents: [] };
    }

    const userOrganizationId = orgMember.organization_id;
    setOrganizationId(userOrganizationId);

    // Wave 1: the org's clients (one indexed query) — every other fetch is
    // then BOUNDED to those client ids. The Lovable original pulled the whole
    // scripts / generated_images / client_details TABLES across every
    // organization and filtered in JS.
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("organization_id", userOrganizationId)
      .neq("id", "00000000-0000-0000-0000-000000000001")
      .order("last_accessed_at", { ascending: false, nullsFirst: false });
    if (clientsError) throw clientsError;
    const clientIds = (clientsData || []).map((c) => c.id);

    const [
      { data: scriptsData, error: scriptsError },
      { data: serviceTypesData, error: serviceTypesError },
      { data: generatedImagesData, error: generatedImagesError },
      { data: logosData },
      { data: businessNamesData },
      { data: callAgentsData },
    ] = await Promise.all([
      supabase
        .from("scripts")
        .select("id, service_name, created_at, client_id, service_type_id, image_url")
        .eq("is_template", false)
        .eq("organization_id", userOrganizationId)
        .order("created_at", { ascending: false }),
      // Org-bound + shared globals (org_id null = global row — same idiom as the
      // qualification_questions fetch). Was the last whole-table pull on this page.
      supabase.from("service_types").select("*").or(`organization_id.eq.${userOrganizationId},organization_id.is.null`),
      clientIds.length
        ? supabase
            .from("generated_images")
            .select("id, client_id, image_url, features, feature_size, created_at")
            .in("client_id", clientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      clientIds.length
        ? supabase
            .from("client_details")
            .select("client_id, field_value")
            .eq("field_name", "logo_url")
            .in("client_id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      clientIds.length
        ? supabase
            .from("client_details")
            .select("client_id, field_name, field_value")
            .in("field_name", ["business_name", "owners_name"])
            .in("client_id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("call_agents" as any)
        .select("id, name")
        .eq("organization_id", userOrganizationId),
    ]);

    if (scriptsError) throw scriptsError;
    if (serviceTypesError) throw serviceTypesError;
    if (generatedImagesError) throw generatedImagesError;

    // Create optimized Maps for O(1) lookups
    const serviceTypesMap = new Map(
      (serviceTypesData || []).map(st => [st.id, st])
    );

    const logosMap = new Map(
      (logosData || []).map(l => [l.client_id, l.field_value])
    );

    const callAgentsMap = new Map(
      ((callAgentsData as any) || []).map((a: any) => [a.id, a.name])
    );

    const businessNamesMap = new Map<string, string>();
    const ownersNamesMap = new Map<string, string>();
    
    (businessNamesData || []).forEach(detail => {
      if (detail.field_name === "business_name") {
        businessNamesMap.set(detail.client_id, detail.field_value);
      } else if (detail.field_name === "owners_name") {
        ownersNamesMap.set(detail.client_id, detail.field_value);
      }
    });

    // Group scripts and images by client_id for O(1) lookup instead of filtering
    const scriptsByClient = new Map<string, ScriptWithType[]>();
    (scriptsData || []).forEach(s => {
      if (!scriptsByClient.has(s.client_id)) {
        scriptsByClient.set(s.client_id, []);
      }
      scriptsByClient.get(s.client_id)!.push({
        id: s.id,
        service_name: s.service_name,
        created_at: s.created_at,
        service_type_id: s.service_type_id,
        service_type: s.service_type_id ? serviceTypesMap.get(s.service_type_id) : undefined,
        image_url: s.image_url,
      });
    });

    const imagesByClient = new Map<string, GeneratedImage[]>();
    (generatedImagesData || []).forEach(img => {
      if (!imagesByClient.has(img.client_id!)) {
        imagesByClient.set(img.client_id!, []);
      }
      imagesByClient.get(img.client_id!)!.push({
        id: img.id,
        image_url: img.image_url,
        features: img.features,
        feature_size: img.feature_size,
        created_at: img.created_at,
      });
    });

    const clientsWithScripts: ClientWithScripts[] = (clientsData || [])
      .map((client: any) => ({
        id: client.id,
        name: client.name,
        service_type: client.service_type,
        city: client.city,
        logo_url: logosMap.get(client.id),
        business_name: businessNamesMap.get(client.id),
        owners_name: ownersNamesMap.get(client.id),
        created_at: client.created_at,
        organization_id: client.organization_id,
        archived: client.archived || false,
        last_accessed_at: client.last_accessed_at,
        call_agent_id: client.call_agent_id,
        call_agent_name: client.call_agent_id ? callAgentsMap.get(client.call_agent_id) as string | undefined : undefined,
        scripts: scriptsByClient.get(client.id) || [],
        generated_images: imagesByClient.get(client.id) || [],
      }));

    return { clients: clientsWithScripts, agents: (callAgentsData as any) || [] };
  }, []);

  const { data: clientsData, isLoading: loading } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: fetchClients,
    meta: {
      onError: (error: any) => {
        logger.error("Error loading clients:", error);
        toast({
          title: "Error loading data",
          description: "There was a problem loading companies. Please refresh the page.",
          variant: "destructive",
        });
      },
    },
  });

  const clients = clientsData?.clients || [];
  
  // Update call agents when data changes
  useEffect(() => {
    if (clientsData?.agents) {
      setCallAgents(clientsData.agents);
    }
  }, [clientsData]);

  const invalidateClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient]);

  useEffect(() => {
    // Optimized: Debounced real-time updates to prevent excessive reloads
    let reloadTimeout: ReturnType<typeof setTimeout>;
    const debouncedReload = () => {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => invalidateClients(), 500);
    };

    const clientsChannel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, debouncedReload)
      .subscribe();

    const scriptsChannel = supabase
      .channel('scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, debouncedReload)
      .subscribe();

    const clientDetailsChannel = supabase
      .channel('client-details-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_details' }, debouncedReload)
      .subscribe();

    return () => {
      clearTimeout(reloadTimeout);
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(scriptsChannel);
      supabase.removeChannel(clientDetailsChannel);
    };
  }, [invalidateClients]);

  // Open-a-client used to cost 3 sequential hops before a setter saw a script:
  // /client/:id route chunk -> latest-script lookup -> redirect -> /script/:id chunk
  // -> script fetch. Hovering a card now prefetches the script id AND warms the
  // ScriptViewer chunk; click jumps STRAIGHT to /script/:id. Falls back to the
  // old /client/:id redirect when the prefetch hasn't landed (slow hover, touch).
  const prefetchedScriptIds = useRef(new Map<string, string | null>());
  const prefetchClient = useCallback((clientId: string) => {
    if (prefetchedScriptIds.current.has(clientId)) return;
    prefetchedScriptIds.current.set(clientId, null); // in-flight marker
    import("./ScriptViewer"); // warm the route chunk while the wire works
    supabase
      .from("scripts")
      .select("id")
      .eq("client_id", clientId)
      .eq("is_template", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) prefetchedScriptIds.current.set(clientId, data.id);
        else prefetchedScriptIds.current.delete(clientId); // let fallback handle no-script
      });
  }, []);
  const openClient = useCallback((clientId: string) => {
    // preserve the last_accessed_at touch ClientScripts used to do on our behalf
    supabase.from("clients").update({ last_accessed_at: new Date().toISOString() }).eq("id", clientId).then();
    const sid = prefetchedScriptIds.current.get(clientId);
    navigate(sid ? `/script/${sid}` : `/client/${clientId}`);
  }, [navigate]);

  const openDeleteDialog = (clientId: string, clientName: string) => {
    setClientToDelete({ id: clientId, name: clientName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientToDelete.id);

      if (error) throw error;

      toast({
        title: "Company deleted",
        description: `${clientToDelete.name} has been deleted successfully.`,
      });

      setDeleteDialogOpen(false);
      setClientToDelete(null);
      invalidateClients();
    } catch (error) {
      logger.error("Error deleting client:", error);
      toast({
        title: "Error",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Optimized: Memoize filtered clients to prevent re-filtering on every render
  const filteredClients = useMemo(() => {
    let filtered: ClientWithScripts[];
    
    if (!debouncedSearch) {
      // Filter by view mode (live vs archived)
      filtered = clients.filter(client => 
        viewMode === 'live' ? !client.archived : client.archived
      );
    } else {
      const query = debouncedSearch.toLowerCase();
      filtered = clients.filter((client) => {
      const matchesSearch = 
        client.name.toLowerCase().includes(query) ||
        (client.business_name && client.business_name.toLowerCase().includes(query)) ||
        client.service_type.toLowerCase().includes(query) ||
        (client.city && client.city.toLowerCase().includes(query)) ||
        client.scripts.some(s => s.service_name.toLowerCase().includes(query));
      
      const matchesViewMode = viewMode === 'live' ? !client.archived : client.archived;
      
      return matchesSearch && matchesViewMode;
      });
    }

    // Filter by call agent if one is selected
    if (selectedAgent !== 'all') {
      if (selectedAgent === 'unassigned') {
        filtered = filtered.filter(client => !client.call_agent_id);
      } else {
        filtered = filtered.filter(client => client.call_agent_id === selectedAgent);
      }
    }

    // Sort the filtered clients
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'service':
          return a.service_type.localeCompare(b.service_type);
        default:
          return 0;
      }
    });
  }, [clients, debouncedSearch, viewMode, sortBy, selectedAgent]);

  const handleArchiveToggle = useCallback(async (clientId: string, currentlyArchived: boolean) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ archived: !currentlyArchived })
        .eq("id", clientId);

      if (error) throw error;

      toast({
        title: currentlyArchived ? "Company restored" : "Company archived",
        description: currentlyArchived 
          ? "Company moved to Live companies." 
          : "Company moved to Archived.",
      });

      invalidateClients();
    } catch (error) {
      logger.error("Error archiving/unarchiving client:", error);
      toast({
        title: "Error",
        description: "Failed to update company status. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, invalidateClients]);

  const handleLogout = useCallback(async () => {
    clearSessionCache(); // next user on this browser never sees this org's cached pages
    await supabase.auth.signOut();
    navigate("/auth");
  }, [navigate]);

  const getUserInitials = useCallback(() => {
    if (profile?.display_name) {
      return profile.display_name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  }, [profile, user]);

  return (
    <AppShell
      title="Companies"
      subtitle={`${clients.length} ${clients.length === 1 ? "company" : "companies"} total`}
      actions={<>
            <Link to="/create">
              <Button size="sm" className="gap-2 h-9 px-4">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Company</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 ring-2 ring-border ring-offset-1 ring-offset-background">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.display_name || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none truncate">{profile?.display_name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLogoSettingsOpen(true)}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>Company Logo</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/team")}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Team Management</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>}
    >
      <div className="container mx-auto px-4 sm:px-6 py-5 max-w-7xl">
        {/* View Mode Tabs + Search Toolbar */}
        {!loading && clients.length > 0 && (
          <div className="mb-4 space-y-3">
            {/* Tab row with underline style */}
            <div className="flex items-end justify-between border-b border-border">
              <div className="flex items-center">
                <button
                  onClick={() => setViewMode('live')}
                  className={`relative flex items-center gap-2 px-1 pb-2.5 mr-5 text-[13px] font-medium transition-colors ${
                    viewMode === 'live' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    {viewMode === 'live' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${viewMode === 'live' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  </span>
                  Live Companies
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-xs font-semibold tabular-nums transition-colors ${
                    viewMode === 'live' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}>
                    {clients.filter(c => !c.archived).length}
                  </span>
                  {viewMode === 'live' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setViewMode('archived')}
                  className={`relative flex items-center gap-2 px-1 pb-2.5 text-[13px] font-medium transition-colors ${
                    viewMode === 'archived' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Archive className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${viewMode === 'archived' ? 'text-foreground' : 'text-muted-foreground/60'}`} />
                  Archived
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-xs font-semibold tabular-nums transition-colors ${
                    viewMode === 'archived' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}>
                    {clients.filter(c => c.archived).length}
                  </span>
                  {viewMode === 'archived' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground pb-2.5 hidden sm:block">
                {filteredClients.length} {filteredClients.length === 1 ? 'company' : 'companies'} {viewMode === 'live' ? 'active' : 'archived'}
              </p>
            </div>

            {/* Unified search + filter toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background border-border/60 focus-visible:border-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium border-border/60 text-muted-foreground hover:text-foreground px-3">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {selectedAgent === 'all' ? 'All Agents' : selectedAgent === 'unassigned' ? 'Unassigned' : callAgents.find(a => a.id === selectedAgent)?.name || 'Agent'}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setSelectedAgent('all')}>
                      All Agents {selectedAgent === 'all' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedAgent('unassigned')}>
                      Unassigned {selectedAgent === 'unassigned' && '✓'}
                    </DropdownMenuItem>
                    {callAgents.length > 0 && <DropdownMenuSeparator />}
                    {callAgents.map((agent) => (
                      <DropdownMenuItem key={agent.id} onClick={() => setSelectedAgent(agent.id)}>
                        {agent.name} {selectedAgent === agent.id && '✓'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium border-border/60 text-muted-foreground hover:text-foreground px-3">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {sortBy === 'name' ? 'Name' : sortBy === 'date' ? 'Date' : 'Service'}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy('name')}>
                      By Name {sortBy === 'name' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('date')}>
                      By Date {sortBy === 'date' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('service')}>
                      By Service {sortBy === 'service' && '✓'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center border border-border/60 rounded-md overflow-hidden h-9 flex-shrink-0">
                  <button
                    onClick={() => setDisplayMode('grid')}
                    className={`flex items-center justify-center w-9 h-full transition-colors ${
                      displayMode === 'grid'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border/60" />
                  <button
                    onClick={() => setDisplayMode('list')}
                    className={`flex items-center justify-center w-9 h-full transition-colors ${
                      displayMode === 'list'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {searchQuery && (
              <p className="text-xs text-muted-foreground">
                {filteredClients.length} {filteredClients.length === 1 ? 'result' : 'results'} for "{searchQuery}"
              </p>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 gap-0 rounded-xl border overflow-hidden divide-y divide-border bg-card">
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
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No results found" : `No ${viewMode} companies`}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : viewMode === 'archived'
                    ? "Archive companies to see them here"
                    : "All your companies are currently archived"
                }
              </p>
              {searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery("")} className="shadow-sm">
                  Clear Search
                </Button>
              ) : viewMode === 'live' && clients.some(c => c.archived) ? (
                <Button variant="outline" onClick={() => setViewMode('archived')} className="shadow-sm">
                  View Archived Companies
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : displayMode === 'grid' ? (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="group flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
                onMouseEnter={() => prefetchClient(client.id)}
                onClick={() => openClient(client.id)}
              >
                <Link to={`/client/${client.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <div className="h-10 w-10 rounded-[10px] overflow-hidden bg-muted ring-1 ring-border">
                    <img src={getClientLogo(client.service_type, client.logo_url)} alt="" className="h-full w-full object-cover" />
                  </div>
                </Link>
                <div className="min-w-0 w-56 shrink-0">
                  <div className="text-[13.5px] font-semibold text-foreground truncate">{client.business_name || client.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {client.owners_name || ""}{client.owners_name && client.city ? " · " : ""}{client.city || ""}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                  {client.scripts.slice(0, 4).map((script: ScriptWithType) => (
                    <Link key={script.id} to={`/script/${script.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border bg-background text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        {script.service_type?.icon_url || script.image_url ? (
                          <img src={script.service_type?.icon_url || script.image_url!} alt="" className="h-4 w-4 rounded-[4px] object-cover" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="truncate max-w-[110px]">{script.service_name}</span>
                      </span>
                    </Link>
                  ))}
                  {client.scripts.length > 4 && (
                    <span className="text-xs text-muted-foreground shrink-0">+{client.scripts.length - 4} more</span>
                  )}
                  {client.scripts.length === 0 && (
                    <span className="text-xs text-muted-foreground/70 italic">No scripts yet</span>
                  )}
                </div>
                <div className="hidden md:block text-xs text-muted-foreground tabular-nums shrink-0">
                  {format(new Date(client.created_at), "MMM d, yyyy")}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchiveToggle(client.id, client.archived || false); }}
                    title={client.archived ? "Restore company" : "Archive company"}>
                    {client.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteDialog(client.id, client.business_name || client.name); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Company</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Call Agent</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-[350px]">Scripts</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onMouseEnter={() => prefetchClient(client.id)}
                    onClick={() => openClient(client.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img 
                            src={getClientLogo(client.service_type, client.logo_url)} 
                            alt={`${client.name} logo`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{client.business_name || client.name}</div>
                          {client.owners_name && (
                            <div className="text-sm text-muted-foreground truncate">{client.owners_name}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // prose→chips (2026-07-06): service_type arrives as a whole
                        // sentence; one nowrap Badge made rows sprawl sideways.
                        const parts = client.service_type
                          .replace(/\(.*?\)/g, "")
                          .split(/[,;•]| - /)
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
                        const shown = parts.slice(0, 3);
                        return (
                          <div className="flex min-w-0 items-center gap-1.5" title={client.service_type}>
                            {shown.map((t) => (
                              <Badge key={t} variant="secondary" className="max-w-[180px] truncate whitespace-nowrap font-normal">{t}</Badge>
                            ))}
                            {parts.length > shown.length && (
                              <span className="whitespace-nowrap text-xs text-muted-foreground">+{parts.length - shown.length} more</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {client.call_agent_name ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {client.call_agent_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.city || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {client.scripts.length > 0 ? (
                          <>
                            {client.scripts.slice(0, 4).map((script) => (
                              <Badge 
                                key={script.id} 
                                variant="outline"
                                className="cursor-pointer hover:bg-muted/60 whitespace-nowrap flex items-center gap-1.5 px-2 py-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/script/${script.id}`);
                                }}
                              >
                                {script.service_type?.icon_url ? (
                                  <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0">
                                    <img 
                                      src={script.service_type.icon_url} 
                                      alt=""
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                ) : script.image_url ? (
                                  <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0">
                                    <img 
                                      src={script.image_url} 
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                )}
                                {script.service_name}
                              </Badge>
                            ))}
                            {client.scripts.length > 4 && (
                              <Badge variant="outline" className="whitespace-nowrap">
                                +{client.scripts.length - 4} more
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">No scripts</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveToggle(client.id, client.archived || false);
                          }}
                          title={client.archived ? "Restore company" : "Archive company"}
                        >
                          {client.archived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(client.id, client.business_name || client.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? This will permanently delete the company and all associated scripts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Company Logo Settings Dialog */}
      <CompanyLogoSettings
        open={logoSettingsOpen}
        onOpenChange={setLogoSettingsOpen}
        currentLogoUrl={profile?.company_logo_url}
        onLogoUpdated={loadUser}
      />
    </AppShell>
  );
}
