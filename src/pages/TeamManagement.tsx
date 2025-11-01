import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Trash2, Crown, Shield, User as UserIcon, ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  role: z.enum(["admin", "member"], { message: "Please select a role" }),
});

interface OrganizationMember {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
  expires_at: string;
  status: string;
  invited_by: string;
  inviter_profile?: {
    display_name: string | null;
  } | null;
}

interface Organization {
  id: string;
  name: string;
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteError, setInviteError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<OrganizationMember | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<PendingInvitation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member" | null>(null);

  useEffect(() => {
    loadData();

    // Set up real-time subscriptions
    const membersChannel = supabase
      .channel('org-members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_members' }, () => {
        loadData();
      })
      .subscribe();

    const invitationsChannel = supabase
      .channel('team-invitations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invitations' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(invitationsChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      // Get user's organization membership
      const { data: membershipData, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .single();

      if (membershipError || !membershipData) {
        toast({
          title: "Error",
          description: "You are not part of any organization",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Get organization details
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", membershipData.organization_id)
        .single();

      if (orgError || !orgData) {
        toast({
          title: "Error",
          description: "Could not load organization details",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setOrganization(orgData);
      setUserRole(membershipData.role);

      // Only owners and admins can manage team
      if (!["owner", "admin"].includes(membershipData.role)) {
        toast({
          title: "Access Denied",
          description: "Only owners and admins can manage team members",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Load team members
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", membershipData.organization_id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      // Load profiles separately for each member
      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("id", member.user_id)
            .single();

          return {
            ...member,
            profiles: profileData,
          };
        })
      );
      
      setMembers(membersWithProfiles as OrganizationMember[]);

      // Load pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("team_invitations")
        .select("id, email, role, created_at, expires_at, status, invited_by")
        .eq("organization_id", membershipData.organization_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!invitationsError && invitationsData) {
        // Load inviter profiles
        const invitationsWithProfiles = await Promise.all(
          invitationsData.map(async (invitation) => {
            const { data: inviterProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", invitation.invited_by)
              .single();

            return {
              ...invitation,
              inviter_profile: inviterProfile,
            };
          })
        );
        setPendingInvitations(invitationsWithProfiles as PendingInvitation[]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    // Validate input
    const result = inviteSchema.safeParse({ email: inviteEmail, role: inviteRole });
    if (!result.success) {
      setInviteError(result.error.errors[0].message);
      return;
    }

    if (!organization || !user) return;

    setInviteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      // Insert invitation record
      const { error: inviteError } = await supabase
        .from("team_invitations")
        .insert({
          organization_id: organization.id,
          email: inviteEmail.toLowerCase(),
          role: inviteRole,
          invited_by: user.id,
        });

      if (inviteError) throw inviteError;

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-team-invitation", {
        body: {
          email: inviteEmail,
          organizationId: organization.id,
          organizationName: organization.name,
          inviterName: profile?.display_name || "A team member",
          role: inviteRole,
        },
      });

      if (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "Invitation sent!",
        description: `An invitation has been sent to ${inviteEmail}`,
      });

      setInviteEmail("");
      setInviteRole("member");
      loadData(); // Reload to show new pending invitation
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      
      if (error.code === '23505') { // Unique constraint violation
        toast({
          title: "Invitation already exists",
          description: "This email already has a pending invitation",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to send invitation",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });

      loadData();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Failed to update role",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteMember = (member: OrganizationMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberToDelete.id);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Team member has been removed successfully",
      });

      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({
        title: "Failed to remove member",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  const confirmCancelInvitation = (invitation: PendingInvitation) => {
    setInvitationToCancel(invitation);
    setCancelDialogOpen(true);
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;

    try {
      const { error } = await supabase
        .from("team_invitations")
        .delete()
        .eq("id", invitationToCancel.id);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });

      setCancelDialogOpen(false);
      setInvitationToCancel(null);
      loadData();
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast({
        title: "Failed to cancel invitation",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      default:
        return <UserIcon className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">Team Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">{organization?.name}</p>
          </div>
        </div>

        {/* Invite New Member */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Send an invitation email to add a new member to your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: "admin" | "member") => setInviteRole(value)}
                    disabled={inviteLoading}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
              <Button type="submit" disabled={inviteLoading} className="w-full md:w-auto">
                {inviteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending invitation...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="shadow-medium border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">{pendingInvitations.length}</Badge>
                Pending Invitations
              </CardTitle>
              <CardDescription>
                These invitations are waiting for acceptance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[100px]">Role</TableHead>
                        <TableHead className="min-w-[120px]">Invited By</TableHead>
                        <TableHead className="min-w-[100px]">Expires</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{invitation.email}</span>
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={invitation.role === "admin" ? "secondary" : "outline"}>
                              {invitation.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                              {invitation.role === "member" && <UserIcon className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{invitation.role}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {invitation.inviter_profile?.display_name || "Unknown"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(invitation.expires_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => confirmCancelInvitation(invitation)}
                            >
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Members List */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Active Team Members ({members.length})</CardTitle>
            <CardDescription>
              Members who have accepted invitations and have access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Member</TableHead>
                      <TableHead className="min-w-[120px]">Role</TableHead>
                      <TableHead className="min-w-[100px]">Joined</TableHead>
                      <TableHead className="text-right min-w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.profiles?.display_name || "Unknown User"}
                            </span>
                            {member.profiles?.username && (
                              <span className="text-sm text-muted-foreground">
                                @{member.profiles.username}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getRoleBadgeVariant(member.role)}
                            className="flex items-center gap-1 w-fit"
                          >
                            {getRoleIcon(member.role)}
                            <span className="capitalize">{member.role}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{new Date(member.created_at).toLocaleDateString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.role !== "owner" && member.user_id !== user?.id && (
                            <div className="flex justify-end gap-2">
                              {userRole === "owner" && (
                                <Select
                                  value={member.role}
                                  onValueChange={(value: "admin" | "member") =>
                                    handleRoleChange(member.id, value)
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => confirmDeleteMember(member)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {memberToDelete?.profiles?.display_name || "this member"} from the team?
              They will lose access to all organization data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember}>
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation for{" "}
              {invitationToCancel?.email}? They will not be able to join the team using this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelInvitation}>
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
