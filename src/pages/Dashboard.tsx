import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Calendar, Search, Settings, Trash2, Sparkles, LogOut, User as UserIcon, Users, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { User } from "@supabase/supabase-js";
import logoDefault from "@/assets/logo-default.png";
import logoPergola from "@/assets/logo-pergola.png";
import logoHvac from "@/assets/logo-hvac.png";
import logoSolar from "@/assets/logo-solar.png";
import logoLandscaping from "@/assets/logo-landscaping.png";
import socialWorksLogo from "@/assets/social-works-logo.png";

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
  scripts: ScriptWithType[];
  generated_images: GeneratedImage[];
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Get current user and profile
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Fetch profile data
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    loadClients();

    // Set up real-time subscriptions
    const clientsChannel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        loadClients();
      })
      .subscribe();

    const scriptsChannel = supabase
      .channel('scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, () => {
        loadClients();
      })
      .subscribe();

    const clientDetailsChannel = supabase
      .channel('client-details-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_details' }, () => {
        loadClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(scriptsChannel);
      supabase.removeChannel(clientDetailsChannel);
    };
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

      // Fetch generated images for all organizations
      const { data: generatedImagesData, error: generatedImagesError } = await supabase
        .from("generated_images")
        .select("id, organization_id, image_url, features, feature_size, created_at")
        .order("created_at", { ascending: false });

      if (generatedImagesError) throw generatedImagesError;

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

          const clientGeneratedImages: GeneratedImage[] = (generatedImagesData || [])
            .filter(img => img.organization_id === client.organization_id)
            .map(img => ({
              id: img.id,
              image_url: img.image_url,
              features: img.features,
              feature_size: img.feature_size,
              created_at: img.created_at,
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
            organization_id: client.organization_id,
            scripts: clientScripts,
            generated_images: clientGeneratedImages,
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getUserInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <img 
                src={socialWorksLogo} 
                alt="Social Works" 
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
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-2">
                <Link to="/image-generator">
                  <Button variant="outline" size="default" className="gap-2 shadow-sm hover:shadow transition-shadow">
                    <Wand2 className="h-4 w-4" />
                    Image Generator
                  </Button>
                </Link>
                <Link to="/team">
                  <Button variant="outline" size="default" className="gap-2 shadow-sm hover:shadow transition-shadow">
                    <Users className="h-4 w-4" />
                    Team
                  </Button>
                </Link>
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
              </div>
              
              {/* Mobile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="icon" className="shadow-sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background">
                  <DropdownMenuItem asChild>
                    <Link to="/image-generator" className="flex items-center cursor-pointer">
                      <Wand2 className="mr-2 h-4 w-4" />
                      <span>Image Generator</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/team" className="flex items-center cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Team</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/service-types" className="flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
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
                <Button size="default" className="gap-2 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary/90">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Company</span>
                </Button>
              </Link>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.display_name || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-background" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none truncate">{profile?.display_name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/team")}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Team Management</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Search Bar */}
        {!loading && clients.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 sm:pl-11 h-10 sm:h-12 bg-card shadow-sm border-border/50 focus:border-primary/50 transition-colors text-sm sm:text-base"
              />
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
                        openDeleteDialog(client.id, client.business_name || client.name);
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
                  
                  <div className="space-y-4">
                    {client.scripts.length > 0 && (
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
                                className="h-10 text-xs px-3 gap-2.5 hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm group/script"
                              >
                                {script.image_url ? (
                                  <div className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0 bg-muted ring-1 ring-border/50 group-hover/script:ring-primary/30 transition-all">
                                    <img 
                                      src={script.image_url} 
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : script.service_type?.icon_url ? (
                                  <div className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0 bg-muted/50 ring-1 ring-border/50 group-hover/script:ring-primary/30 transition-all p-0.5">
                                    <img 
                                      src={script.service_type.icon_url} 
                                      alt=""
                                      className="h-full w-full object-contain"
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

                    {client.generated_images && client.generated_images.length > 0 && (
                      <div className={client.scripts.length > 0 ? "pt-4 border-t border-border/50" : ""}>
                        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                          <Wand2 className="h-3.5 w-3.5" />
                          Generated Designs ({client.generated_images.length})
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {client.generated_images.slice(0, 3).map((image) => (
                            <div 
                              key={image.id}
                              className="aspect-square rounded-lg overflow-hidden bg-muted ring-1 ring-border/50 hover:ring-primary/30 transition-all cursor-pointer group/image"
                            >
                              <img 
                                src={image.image_url} 
                                alt="Generated design"
                                className="h-full w-full object-cover group-hover/image:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ))}
                        </div>
                        {client.generated_images.length > 3 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            +{client.generated_images.length - 3} more
                          </p>
                        )}
                      </div>
                    )}

                    {client.scripts.length === 0 && (!client.generated_images || client.generated_images.length === 0) && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No scripts or designs yet</p>
                        <Link to={`/client/${client.id}`}>
                          <Button variant="ghost" size="sm" className="mt-2 gap-2 text-xs">
                            <Plus className="h-3 w-3" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
