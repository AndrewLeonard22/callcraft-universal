import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Phone, Mail, ArrowLeft, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization_id: string;
  created_at: string;
  client_count?: number;
}

interface Client {
  id: string;
  name: string;
  business_name: string | null;
  service_type: string;
  city: string;
}

export default function CallAgents() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agents, setAgents] = useState<CallAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CallAgent | null>(null);
  const [selectedAgentForAssignment, setSelectedAgentForAssignment] = useState<CallAgent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [assignedClients, setAssignedClients] = useState<Client[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's organization
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) return;

      // Get call agents
      const { data: agentsData, error } = await supabase
        .from('call_agents' as any)
        .select('*')
        .eq('organization_id', orgMember.organization_id)
        .order('name');

      if (error) throw error;

      // Get client count for each agent
      const agentsWithCount = await Promise.all(
        (agentsData || []).map(async (agent: any) => {
          const { count } = await supabase
            .from('clients' as any)
            .select('*', { count: 'exact', head: true })
            .eq('call_agent_id', agent.id);

          return {
            ...agent,
            client_count: count || 0,
          } as CallAgent;
        })
      );

      setAgents(agentsWithCount as CallAgent[]);
    } catch (error) {
      console.error('Error loading call agents:', error);
      toast({
        title: "Error",
        description: "Failed to load call agents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) return;

      if (editingAgent) {
        // Update existing agent
        const { error } = await supabase
          .from('call_agents' as any)
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
          })
          .eq('id', editingAgent.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Call agent updated successfully",
        });
      } else {
        // Create new agent
        const { error } = await supabase
          .from('call_agents' as any)
          .insert({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            organization_id: orgMember.organization_id,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Call agent created successfully",
        });
      }

      setDialogOpen(false);
      setEditingAgent(null);
      setFormData({ name: "", email: "", phone: "" });
      loadAgents();
    } catch (error) {
      console.error('Error saving call agent:', error);
      toast({
        title: "Error",
        description: "Failed to save call agent",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (agent: CallAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email || "",
      phone: agent.phone || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!agentToDelete) return;

    try {
      const { error } = await supabase
        .from('call_agents' as any)
        .delete()
        .eq('id', agentToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Call agent deleted successfully",
      });

      setDeleteDialogOpen(false);
      setAgentToDelete(null);
      loadAgents();
    } catch (error) {
      console.error('Error deleting call agent:', error);
      toast({
        title: "Error",
        description: "Failed to delete call agent",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (agent: CallAgent) => {
    setAgentToDelete({ id: agent.id, name: agent.name });
    setDeleteDialogOpen(true);
  };

  const openAssignDialog = async (agent: CallAgent) => {
    setSelectedAgentForAssignment(agent);
    setAssignDialogOpen(true);
    await loadAgentClients(agent.id);
  };

  const loadAgentClients = async (agentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) return;

      // Get assigned clients
      const { data: assigned } = await supabase
        .from('clients' as any)
        .select('id, name, service_type, city')
        .eq('call_agent_id', agentId)
        .eq('archived', false)
        .order('name');

      // Get business names for assigned clients
      const assignedIds = (assigned || []).map((c: any) => c.id);
      const { data: assignedDetails } = await supabase
        .from('client_details')
        .select('client_id, field_value')
        .eq('field_name', 'business_name')
        .in('client_id', assignedIds);

      const businessNamesMap = new Map(
        (assignedDetails || []).map((d: any) => [d.client_id, d.field_value])
      );

      const assignedWithNames = (assigned || []).map((c: any) => ({
        ...c,
        business_name: businessNamesMap.get(c.id) || null,
      }));

      setAssignedClients(assignedWithNames);

      // Get available (unassigned or assigned to other agents) clients
      const { data: available } = await supabase
        .from('clients' as any)
        .select('id, name, service_type, city')
        .eq('organization_id', orgMember.organization_id)
        .or(`call_agent_id.is.null,call_agent_id.neq.${agentId}`)
        .eq('archived', false)
        .order('name');

      // Get business names for available clients
      const availableIds = (available || []).map((c: any) => c.id);
      const { data: availableDetails } = await supabase
        .from('client_details')
        .select('client_id, field_value')
        .eq('field_name', 'business_name')
        .in('client_id', availableIds);

      const availableBusinessNamesMap = new Map(
        (availableDetails || []).map((d: any) => [d.client_id, d.field_value])
      );

      const availableWithNames = (available || []).map((c: any) => ({
        ...c,
        business_name: availableBusinessNamesMap.get(c.id) || null,
      }));

      setAvailableClients(availableWithNames);
    } catch (error) {
      console.error('Error loading agent clients:', error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    }
  };

  const handleAssignClient = async () => {
    if (!selectedClientId || !selectedAgentForAssignment) return;

    try {
      const { error } = await supabase
        .from('clients' as any)
        .update({ call_agent_id: selectedAgentForAssignment.id } as any)
        .eq('id', selectedClientId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company assigned successfully",
      });

      setSelectedClientId("");
      await loadAgentClients(selectedAgentForAssignment.id);
      loadAgents();
    } catch (error) {
      console.error('Error assigning client:', error);
      toast({
        title: "Error",
        description: "Failed to assign company",
        variant: "destructive",
      });
    }
  };

  const handleUnassignClient = async (clientId: string) => {
    if (!selectedAgentForAssignment) return;

    try {
      const { error } = await supabase
        .from('clients' as any)
        .update({ call_agent_id: null } as any)
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company unassigned successfully",
      });

      await loadAgentClients(selectedAgentForAssignment.id);
      loadAgents();
    } catch (error) {
      console.error('Error unassigning client:', error);
      toast({
        title: "Error",
        description: "Failed to unassign company",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Call Agents</h1>
              <p className="text-muted-foreground">Manage your sales team</p>
            </div>
          </div>
          <Button onClick={() => {
            setEditingAgent(null);
            setFormData({ name: "", email: "", phone: "" });
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>

        {/* Agents List */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 mx-auto">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No call agents yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first call agent to start assigning companies
              </p>
              <Button onClick={() => {
                setEditingAgent(null);
                setFormData({ name: "", email: "", phone: "" });
                setDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Companies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      {agent.email ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {agent.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.phone ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {agent.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="link"
                        className="text-sm font-medium"
                        onClick={() => openAssignDialog(agent)}
                      >
                        {agent.client_count}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignDialog(agent)}
                          title="Manage companies"
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(agent)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(agent)}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? 'Edit Call Agent' : 'Add Call Agent'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAgent ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{agentToDelete?.name}</strong>? 
              This will unassign them from all companies. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Companies Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Companies - {selectedAgentForAssignment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Add Company Section */}
            <div className="space-y-3">
              <Label>Assign Company</Label>
              <div className="flex gap-2">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {availableClients.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          All companies are assigned
                        </div>
                      ) : (
                        availableClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.business_name || client.name} - {client.service_type}
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAssignClient}
                  disabled={!selectedClientId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign
                </Button>
              </div>
            </div>

            {/* Assigned Companies List */}
            <div className="space-y-3">
              <Label>Assigned Companies ({assignedClients.length})</Label>
              <ScrollArea className="h-[300px] border rounded-md">
                {assignedClients.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No companies assigned yet
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {assignedClients.map((client) => (
                      <div 
                        key={client.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {client.business_name || client.name}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">
                              {client.service_type}
                            </Badge>
                            {client.city && <span>• {client.city}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignClient(client.id)}
                          className="hover:text-destructive ml-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
