import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Phone, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CallAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization_id: string;
  created_at: string;
  client_count?: number;
}

export default function CallAgents() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agents, setAgents] = useState<CallAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CallAgent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
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
        .from('call_agents')
        .select('*')
        .eq('organization_id', orgMember.organization_id)
        .order('name');

      if (error) throw error;

      // Get client count for each agent
      const agentsWithCount = await Promise.all(
        (agentsData || []).map(async (agent) => {
          const { count } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('call_agent_id', agent.id);

          return {
            ...agent,
            client_count: count || 0,
          };
        })
      );

      setAgents(agentsWithCount);
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
          .from('call_agents')
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
          .from('call_agents')
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
        .from('call_agents')
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
                      <span className="text-sm font-medium">{agent.client_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
