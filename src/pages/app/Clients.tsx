import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Search, Building2, Mail, Loader2, CheckCircle2, Clock, XCircle, UserPlus, AlertCircle, Trash2, Copy, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOrganisations } from "@/hooks/useClients";
import { useInvites, useCancelInvite } from "@/hooks/useInvites";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import type { Invite } from "@/types/auth";

const Clients = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  
  // Update status filter from URL params when component mounts or URL changes
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam && ["all", "pending", "active", "inactive", "declined"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteStatusFilter, setInviteStatusFilter] = useState<string>("all");
  const cancelInvite = useCancelInvite();
  const isReseller = user?.role === 'partner';
  const isAdmin = user?.role === 'admin';
  
  // Fetch client invitations only
  const { data: invites = [], isLoading: isLoadingInvites } = useInvites(
    inviteStatusFilter !== "all" ? inviteStatusFilter as 'pending' | 'accepted' | 'expired' : undefined,
    'client' // Only fetch client invitations
  );

  // Create invite mutation
  const createInvite = useMutation({
    mutationFn: async (email: string) => {
      // Use the user's actual tenantId (backend will verify and use it)
      const tenantId = user?.tenantId;
      const tenantName = user?.tenantName;
      
      if (!tenantId || !tenantName || !user?.id) {
        throw new Error('User information not found');
      }
      return authService.createInvite(
        email,
        'client',
        user.id,
        tenantId,
        tenantName
      );
    },
    onSuccess: (invite) => {
      toast.success('Invitation sent successfully!', {
        description: `An invitation has been sent to ${invite.email}`,
      });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      // Invalidate clients and invites queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (error) => {
      toast.error('Failed to send invitation', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setIsSendingInvite(true);
    try {
      await createInvite.mutateAsync(inviteEmail.trim());
    } finally {
      setIsSendingInvite(false);
    }
  };

  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const { data: organisations = [], isLoading, error } = useOrganisations(searchQuery);

  // Show error state first
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load clients. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredOrgs = organisations.filter((org) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return (org.statusSummary.active || 0) > 0;
    if (statusFilter === "pending") return (org.statusSummary.pending || 0) > 0;
    if (statusFilter === "inactive") return (org.statusSummary.inactive || 0) > 0;
    if (statusFilter === "declined") return (org.statusSummary.declined || 0) > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Client Management</h2>
          <p className="text-muted-foreground">
            {user?.role === "admin" ? "Manage all platform clients" : "Manage your clients"}
          </p>
        </div>
        {(isReseller || isAdmin) && (
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Client
          </Button>
        )}
      </motion.div>

      {/* Client Invitation Info Banner - for Resellers and Admin */}
      {(isReseller || isAdmin) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Alert className="bg-info/10 border-info/20 text-foreground">
            <AlertCircle className="h-4 w-4 text-info" />
            <AlertDescription className="flex flex-col gap-2">
              <strong className="text-info">Client Invitation Flow:</strong>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Who can invite:</strong> {isAdmin ? 'Admin and resellers can invite clients to join the platform.' : 'Only resellers can invite clients to join the platform.'}
                </p>
                <p>
                  <strong>How to invite:</strong> Click the "Invite Client" button above, enter the client's email address, and send the invitation.
                </p>
                <p>
                  <strong>What happens next:</strong> 
                </p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>The client receives an email invitation with a secure link</li>
                  <li>They click the link and are taken to the invitation acceptance page</li>
                  <li>They set up their account (name and password)</li>
                  <li>Once registered, they appear in your client list and can access the platform</li>
                </ol>
                <p className="text-xs mt-2 text-muted-foreground">
                  💡 Invitations expire after 14 days. Clients must accept the invitation within this period.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Invite Client Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Client</DialogTitle>
            <DialogDescription>
              {isAdmin 
                ? "Send an invitation to a new client. They will receive an email with instructions to join the platform."
                : "Send an invitation to a new client. They will receive an email with instructions to join your platform."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendInvite}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="client@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSendingInvite}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The client will receive an invitation email with a link to create their account.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsInviteDialogOpen(false);
                  setInviteEmail("");
                }}
                disabled={isSendingInvite}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingInvite || !inviteEmail.trim()}>
                {isSendingInvite ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tabs Interface */}
      <Tabs defaultValue="clients" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="clients">
              Clients
              {filteredOrgs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredOrgs.length}
                </Badge>
              )}
            </TabsTrigger>
            {(isReseller || isAdmin) && (
              <TabsTrigger value="invitations">
                Invitations
                {invites.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {invites.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
              <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4"
          >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by organisation, domain, or employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
          </motion.div>

          {/* Organisation List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No organisations found matching your criteria</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org, index) => {
            const hasPending = (org.statusSummary.pending || 0) > 0;
            const activeCount = org.statusSummary.active || 0;
            const pendingCount = org.statusSummary.pending || 0;
            const inactiveCount = org.statusSummary.inactive || 0;
            const declinedCount = org.statusSummary.declined || 0;
            const allInactive =
              org.employeeCount > 0 &&
              activeCount === 0 &&
              pendingCount === 0 &&
              inactiveCount + declinedCount === org.employeeCount;
            const hasMixedStatus =
              !allInactive &&
              ((inactiveCount > 0 || declinedCount > 0) && (activeCount > 0 || pendingCount > 0));
            return (
              <motion.div
                key={org.tenantId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPending ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending Users
                          </Badge>
                        ) : allInactive ? (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        ) : hasMixedStatus ? (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Mixed Status
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-success/10 text-success text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">organisation Name</div>
                        <h3 className="font-semibold text-lg">{org.tenantName}</h3>
                        {org.resellerName && (
                          <div className="mt-2">
                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                              Referred by {org.resellerName}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{org.employeeCount}</p>
                        <p className="text-xs text-muted-foreground">Employees</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{org.bookingCount}</p>
                        <p className="text-xs text-muted-foreground">Bookings</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{org.jobCount}</p>
                        <p className="text-xs text-muted-foreground">Jobs</p>
                      </div>
                    </div>
                    <div className="pt-4">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedOrg(org)}>
                        <UsersIcon className="h-4 w-4 mr-2" />
                        View employees
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
        )}
        </TabsContent>

        {/* Invitations Tab */}
        {(isReseller || isAdmin) && (
          <TabsContent value="invitations" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Client Invitations</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and track client invitations
                </p>
              </div>
              <Select value={inviteStatusFilter} onValueChange={setInviteStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invitations</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invitations found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {invites.map((invite: Invite) => {
                  const isPending = invite.status === 'pending';
                  const isAccepted = invite.status === 'accepted';
                  const isExpired = invite.status === 'expired';
                  const expiresDate = new Date(invite.expiresAt);
                  const isExpiringSoon = isPending && expiresDate.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000; // 3 days

                  return (
                    <Card key={invite.id} className={cn(
                      "transition-all",
                      isExpiringSoon && "border-warning/50 bg-warning/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium break-words">{invite.email}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "flex-shrink-0",
                                  isPending && "bg-warning/10 text-warning border-warning/20",
                                  isAccepted && "bg-success/10 text-success border-success/20",
                                  isExpired && "bg-destructive/10 text-destructive border-destructive/20"
                                )}
                              >
                                {isPending && <Clock className="h-3 w-3 mr-1" />}
                                {isAccepted && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {isExpired && <XCircle className="h-3 w-3 mr-1" />}
                                {invite.status || 'pending'}
                              </Badge>
                              {isExpiringSoon && isPending && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 flex-shrink-0">
                                  Expiring Soon
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                Role: <span className="font-medium capitalize">{invite.role}</span>
                              </p>
                              <p className="break-words">
                                Sent: {new Date(invite.invitedAt).toLocaleDateString()} at {new Date(invite.invitedAt).toLocaleTimeString()}
                              </p>
                              {isPending && (
                                <p className={cn(isExpiringSoon && "text-warning font-medium", "break-words")}>
                                  Expires: {expiresDate.toLocaleDateString()} ({Math.ceil((expiresDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days left)
                                </p>
                              )}
                              {isAccepted && invite.acceptedAt && (
                                <p className="text-success break-words">
                                  Accepted: {new Date(invite.acceptedAt).toLocaleDateString()} at {new Date(invite.acceptedAt).toLocaleTimeString()}
                                </p>
                              )}
                              {isExpired && (
                                <p className="text-destructive break-words">
                                  Expired: {expiresDate.toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                            {isPending && invite.token && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const inviteUrl = `${window.location.origin}/invite?token=${invite.token}`;
                                  navigator.clipboard.writeText(inviteUrl);
                                  toast.success('Invitation link copied to clipboard');
                                }}
                                className="w-full sm:w-auto"
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy Link
                              </Button>
                            )}
                            {isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to cancel the invitation to ${invite.email}?`)) {
                                    cancelInvite.mutate(invite.id);
                                  }
                                }}
                                disabled={cancelInvite.isPending}
                                className="w-full sm:w-auto"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.tenantName || "Employees"}</DialogTitle>
            <DialogDescription>Employees in this tenant</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {(selectedOrg?.employees || []).map((employee: any) => (
              <div key={employee.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium">{employee.name}</div>
                  <div className="text-xs text-muted-foreground">{employee.email}</div>
                  {employee.resellerName && (
                    <div className="text-xs font-medium text-primary">Referred by {employee.resellerName}</div>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {employee.status}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;

