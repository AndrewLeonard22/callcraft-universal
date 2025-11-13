import { useEffect, useState, useMemo, useCallback } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { logger } from "@/utils/logger";
import type { User } from "@supabase/supabase-js";
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";
import socialWorksLogo from "@/assets/social-works-logo.png";
import { CompanyLogoSettings } from "@/components/CompanyLogoSettings";

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
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithScripts[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Optimized: Memoize loadClients to prevent unnecessary recreations
  const loadClients = useCallback(async () => {
    try {
      // Get user's organization first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
        return;
      }

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgMember?.organization_id) {
        setLoading(false);
        return;
      }

      const userOrganizationId = orgMember.organization_id;

      // Batch parallel API calls for better performance
      const [
        { data: clientsData, error: clientsError },
        { data: scriptsData, error: scriptsError },
        { data: serviceTypesData, error: serviceTypesError },
        { data: generatedImagesData, error: generatedImagesError },
        { data: logosData },
        { data: businessNamesData },
        { data: callAgentsData },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("organization_id", userOrganizationId)
          .neq("id", "00000000-0000-0000-0000-000000000001")
          .order("last_accessed_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("scripts")
          .select("id, service_name, created_at, client_id, service_type_id, image_url")
          .eq("is_template", false)
          .order("created_at", { ascending: false }),
        supabase.from("service_types").select("*"),
        supabase
          .from("generated_images")
          .select("id, client_id, image_url, features, feature_size, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("client_details")
          .select("client_id, field_value")
          .eq("field_name", "logo_url"),
        supabase
          .from("client_details")
          .select("client_id, field_name, field_value")
          .in("field_name", ["business_name", "owners_name"]),
        supabase
          .from("call_agents" as any)
          .select("id, name")
          .eq("organization_id", userOrganizationId),
      ]);

      if (clientsError) throw clientsError;
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

      // Set call agents for filtering
      setCallAgents((callAgentsData as any) || []);

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

      setClients(clientsWithScripts);
    } catch (error) {
      logger.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();

    // Optimized: Debounced real-time updates to prevent excessive reloads
    let reloadTimeout: NodeJS.Timeout;
    const debouncedReload = () => {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(loadClients, 500);
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
  }, [loadClients]);

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
      loadClients();
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

      loadClients();
    } catch (error) {
      logger.error("Error archiving/unarchiving client:", error);
      toast({
        title: "Error",
        description: "Failed to update company status. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, loadClients]);

  const handleLogout = useCallback(async () => {
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
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <img 
                src={profile?.company_logo_url || socialWorksLogo} 
                alt="Company Logo" 
                className="h-8 sm:h-10 w-auto flex-shrink-0"
              />
              <div className="h-6 sm:h-8 w-px bg-border/50 hidden sm:block" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">Companies</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {clients.length} {clients.length === 1 ? 'company' : 'companies'} total
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1.5 bg-muted/30 rounded-lg p-1">
                <Link to="/training">
                  <Button variant="ghost" size="sm" className="gap-2 h-8 px-3 text-xs font-medium hover:bg-background hover:shadow-sm transition-all">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Training
                  </Button>
                </Link>
                <Link to="/image-generator">
                  <Button variant="ghost" size="sm" className="gap-2 h-8 px-3 text-xs font-medium hover:bg-background hover:shadow-sm transition-all">
                    <Wand2 className="h-3.5 w-3.5" />
                    Generator
                  </Button>
                </Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-3 text-xs font-medium hover:bg-background hover:shadow-sm transition-all">
                      <Settings className="h-3.5 w-3.5" />
                      Manage
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 shadow-lg">
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Management</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/call-agents" className="flex items-center cursor-pointer">
                        <Phone className="mr-2 h-4 w-4" />
                        <span>Call Agents</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/team" className="flex items-center cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Team</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/service-types" className="flex items-center cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4" />
                        <span>Services</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/templates" className="flex items-center cursor-pointer">
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Templates</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="h-6 w-px bg-border/50 hidden lg:block" />
              
              {/* Mobile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm border-border/60 hover:bg-muted/50">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 shadow-lg">
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Navigation</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/training" className="flex items-center cursor-pointer">
                      <GraduationCap className="mr-2 h-4 w-4" />
                      <span>Training</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/image-generator" className="flex items-center cursor-pointer">
                      <Wand2 className="mr-2 h-4 w-4" />
                      <span>Image Generator</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/team" className="flex items-center cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Team</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/call-agents" className="flex items-center cursor-pointer">
                      <Phone className="mr-2 h-4 w-4" />
                      <span>Call Agents</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/service-types" className="flex items-center cursor-pointer">
                      <Building2 className="mr-2 h-4 w-4" />
                      <span>Services</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/templates" className="flex items-center cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      <span>Templates</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Link to="/create">
                <Button size="sm" className="gap-2 h-9 px-4 shadow-sm hover:shadow-md transition-all font-medium">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Company</span>
                </Button>
              </Link>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9 ring-2 ring-border/50 ring-offset-1 ring-offset-background transition-all hover:ring-primary/30">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.display_name || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 shadow-lg" align="end" forceMount>
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
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* View Mode Tabs */}
        {!loading && clients.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
              <Button
                variant={viewMode === 'live' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('live')}
                className="gap-2"
              >
                Live Companies
                <span className="ml-1 px-2 py-0.5 bg-background/50 rounded-full text-xs font-medium">
                  {clients.filter(c => !c.archived).length}
                </span>
              </Button>
              <Button
                variant={viewMode === 'archived' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('archived')}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Archived
                <span className="ml-1 px-2 py-0.5 bg-background/50 rounded-full text-xs font-medium">
                  {clients.filter(c => c.archived).length}
                </span>
              </Button>
            </div>
          </div>
        )}
        
        {/* Search Bar */}
        {!loading && clients.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 sm:pl-11 h-10 sm:h-12 bg-card shadow-sm border-border/50 focus:border-primary/50 transition-colors text-sm sm:text-base"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 sm:h-12 shadow-sm">
                      <Phone className="h-4 w-4 mr-2" />
                      {selectedAgent === 'all' ? 'All Agents' : selectedAgent === 'unassigned' ? 'Unassigned' : callAgents.find(a => a.id === selectedAgent)?.name || 'Agent'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                    <Button variant="outline" size="sm" className="h-10 sm:h-12 shadow-sm">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Sort
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

                <div className="flex border rounded-md shadow-sm">
                  <Button
                    variant={displayMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('grid')}
                    className="rounded-r-none h-10 sm:h-12"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={displayMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('list')}
                    className="rounded-l-none h-10 sm:h-12"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {searchQuery && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className="group relative overflow-hidden border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20 cursor-pointer"
                onClick={() => navigate(`/client/${client.id}`)}
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardHeader className="pb-4 relative z-10">
                  <div className="flex items-start gap-4">
                    <Link to={`/client/${client.id}`} className="relative" onClick={(e) => e.stopPropagation()}>
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
                          {client.city && (
                            <span className="text-muted-foreground">{client.city}</span>
                          )}
                        </span>
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => {
                          e.preventDefault();
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
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeleteDialog(client.id, client.business_name || client.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 relative z-10">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 pb-4 border-b border-border/50">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(client.created_at), "MMM d, yyyy")}</span>
                  </div>
                  
                  <div className="space-y-4">
                    {client.scripts.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                          Scripts ({client.scripts.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {client.scripts.map((script: ScriptWithType) => (
                            <Link key={script.id} to={`/script/${script.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline" 
                                size="sm" 
                                className="h-10 text-xs px-3 gap-2.5 hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm group/script"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {script.service_type?.icon_url ? (
                                  <div className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0 bg-muted/50 ring-1 ring-border/50 group-hover/script:ring-primary/30 transition-all p-0.5">
                                    <img 
                                      src={script.service_type.icon_url} 
                                      alt=""
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                ) : script.image_url ? (
                                  <div className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0 bg-muted ring-1 ring-border/50 group-hover/script:ring-primary/30 transition-all">
                                    <img 
                                      src={script.image_url} 
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate max-w-[100px] font-medium">{script.service_name}</span>
                              </Button>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                    onClick={() => navigate(`/client/${client.id}`)}
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
                      <Badge variant="secondary" className="whitespace-nowrap">{client.service_type}</Badge>
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
                                className="cursor-pointer hover:bg-accent whitespace-nowrap flex items-center gap-1.5 px-2 py-1"
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    </div>
  );
}
