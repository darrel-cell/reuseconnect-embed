import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Search, Users as UsersIcon, Mail, Building2, Shield, UserCheck, UserX, Loader2, Clock, CheckCircle2, UserPlus, Trash2, Copy, XCircle, RefreshCw, Eye, EyeOff, AlertCircle, Pencil } from "lucide-react";
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
import { useUsers, useUpdateUserStatus, useApproveUser, useDeclineUser, useCreateUser, useResetUserPassword, useUpdateUser, useDeleteUser } from "@/hooks/useUsers";
import { useInvites, useCancelInvite } from "@/hooks/useInvites";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import type { UserRole } from "@/types/auth";
import type { Invite } from "@/types/auth";
import type { ExtendedUser } from "@/mocks/mock-entities";
import { ApiError } from "@/services/api-error";
import { useShowPasswordHints } from "@/hooks/useShowPasswordHints";

const roleColors: Record<UserRole, string> = {
  admin: "bg-primary/10 text-primary",
  head_of_operation: "bg-primary/15 text-primary",
  client: "bg-info/10 text-info",
  partner: "bg-accent/10 text-accent",
  driver: "bg-warning/10 text-warning",
  warehouse_technician: "bg-success/10 text-success",
};

function formatRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    head_of_operation: "Head of Operation",
    client: "Client",
    partner: "Partner",
    driver: "Driver",
    warehouse_technician: "Warehouse Technician",
  };
  return labels[role] ?? role;
}

const PASSWORD_SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getPasswordChecks = (password: string) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: PASSWORD_SPECIAL_REGEX.test(password),
});

const isPasswordStrong = (password: string) => {
  const checks = getPasswordChecks(password);
  return Object.values(checks).every(Boolean);
};

const generateStrongPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + numbers + specials;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const required = [pick(upper), pick(lower), pick(numbers), pick(specials)];
  const extraLength = 12;
  const extras = Array.from({ length: extraLength }, () => pick(all));
  const mixed = [...required, ...extras].sort(() => Math.random() - 0.5);
  return mixed.join("");
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get("role") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Update filters from URL params when component mounts or URL changes
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam && ["all", "pending", "active", "inactive", "declined"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
    const roleParam = searchParams.get("role");
    if (roleParam && ["all", "admin", "head_of_operation", "client", "partner", "driver", "warehouse_technician"].includes(roleParam)) {
      setRoleFilter(roleParam);
    }
  }, [searchParams]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>('partner');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteStatusFilter, setInviteStatusFilter] = useState<string>("all");
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [userToDecline, setUserToDecline] = useState<{ id: string; name: string } | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ email: string; password: string } | null>(null);
  const [isPasswordResultDialogOpen, setIsPasswordResultDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<{ id: string; email: string; name: string } | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [deleteUserReason, setDeleteUserReason] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [userToEdit, setUserToEdit] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
  } | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    role: "client" as UserRole,
    name: "",
    email: "",
    phone: "",
    organisationName: "",
    registrationNumber: "",
    password: "",
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const { showHints, passwordInputProps } = useShowPasswordHints(createForm.password);

  const { data: users = [], isLoading, error } = useUsers({
    role: roleFilter !== "all" ? roleFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const updateStatus = useUpdateUserStatus();
  const approveUser = useApproveUser();
  const declineUser = useDeclineUser();
  const cancelInvite = useCancelInvite();
  const createUser = useCreateUser();
  const resetUserPassword = useResetUserPassword();
  const updateUserProfile = useUpdateUser();
  const deleteUser = useDeleteUser();

  const { data: userInvites = [], isLoading: isLoadingInvites } = useInvites(
    inviteStatusFilter !== "all" ? inviteStatusFilter as 'pending' | 'accepted' | 'expired' : undefined
  );

  // Create invite mutation
  const createInvite = useMutation({
    mutationFn: async (data: { email: string; role: 'client' | 'partner' | 'driver' | 'warehouse_technician' | 'head_of_operation' }) => {
      if (!currentUser?.tenantId || !currentUser?.tenantName || !currentUser?.id) {
        throw new Error('User information not found');
      }
      return authService.createInvite(
        data.email,
        data.role,
        currentUser.id,
        currentUser.tenantId,
        currentUser.tenantName
      );
    },
    onSuccess: (invite) => {
      toast.success('Invitation sent successfully!', {
        description: `An invitation has been sent to ${invite.email} as a ${invite.role}`,
      });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole('partner');
      // Invalidate users and invites queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
      await createInvite.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole as 'client' | 'partner' | 'driver' | 'warehouse_technician' | 'head_of_operation',
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      role: "client",
      name: "",
      email: "",
      phone: "",
      organisationName: "",
      registrationNumber: "",
      password: "",
    });
    setCreateErrors({});
    setShowCreatePassword(false);
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    const requiresCompanyFields =
      createForm.role === "client" || createForm.role === "partner" || createForm.role === "admin";
    if (!createForm.name.trim() || createForm.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }
    if (!createForm.email.trim() || !EMAIL_REGEX.test(createForm.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (requiresCompanyFields && !createForm.organisationName.trim()) {
      errors.organisationName = "Organisation name is required.";
    }
    if (createForm.phone.trim().length > 30) {
      errors.phone = "Phone number must be 30 characters or fewer.";
    }
    if (requiresCompanyFields && createForm.registrationNumber.trim().length > 100) {
      errors.registrationNumber = "Registration number must be 100 characters or fewer.";
    }
    if (!createForm.password.trim()) {
      errors.password = "Password is required.";
    } else if (!isPasswordStrong(createForm.password)) {
      errors.password = "Password does not meet all requirements.";
    }
    return errors;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateCreateForm();
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await createUser.mutateAsync({
        role: createForm.role,
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim() || undefined,
        organisationName: createForm.organisationName.trim(),
        registrationNumber: createForm.registrationNumber.trim() || undefined,
        password: createForm.password,
      });

      toast.success("User created successfully", {
        description: `${createForm.role} account has been created and can login with the assigned password.`,
      });
      setPasswordResult({
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
      });
      setIsPasswordResultDialogOpen(true);
      setIsCreateDialogOpen(false);
      resetCreateForm();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setCreateErrors(error.fields);
      }
      toast.error("Failed to create user", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;

    try {
      const result = await resetUserPassword.mutateAsync({
        id: userToReset.id,
        password: resetPassword.trim() || undefined,
      });
      setPasswordResult({ email: result.email, password: result.password });
      setIsPasswordResultDialogOpen(true);
      setIsResetDialogOpen(false);
      setUserToReset(null);
      setResetPassword("");
      setShowResetPassword(false);
      toast.success("Password reset successfully");
    } catch (error) {
      toast.error("Failed to reset password", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const openEditUser = (user: ExtendedUser) => {
    setUserToEdit({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      role: user.role,
    });
    setEditErrors({});
    setIsEditDialogOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    const errs: Record<string, string> = {};
    if (!userToEdit.name.trim() || userToEdit.name.trim().length < 2) {
      errs.name = "Name must be at least 2 characters.";
    }
    if (!EMAIL_REGEX.test(userToEdit.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    try {
      await updateUserProfile.mutateAsync({
        id: userToEdit.id,
        name: userToEdit.name.trim(),
        email: userToEdit.email.trim().toLowerCase(),
        phone: userToEdit.phone.trim() ? userToEdit.phone.trim() : null,
        role: userToEdit.role,
      });
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      setUserToEdit(null);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setEditErrors(error.fields);
      }
      toast.error("Failed to update user", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.organisationName || '').toLowerCase().includes(q) ||
      user.tenantName.toLowerCase().includes(q);
    return matchesSearch;
  });

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    updateStatus.mutate(
      { id: userId, isActive: !currentStatus },
      {
        onSuccess: () => {
          toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully`);
        },
        onError: (error) => {
          toast.error("Failed to update user status", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleApproveUser = async (userId: string) => {
    approveUser.mutate(userId, {
      onSuccess: () => {
        toast.success("User approved successfully");
      },
      onError: (error) => {
        toast.error("Failed to approve user", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

  const handleDeclineUser = (userId: string, userName: string) => {
    setUserToDecline({ id: userId, name: userName });
    setIsDeclineDialogOpen(true);
  };

  const handleConfirmDecline = () => {
    if (!userToDecline) return;
    
    declineUser.mutate(userToDecline.id, {
      onSuccess: () => {
        toast.success("User signup request declined");
        setIsDeclineDialogOpen(false);
        setUserToDecline(null);
      },
      onError: (error) => {
        toast.error("Failed to decline user", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

  const handleDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete) return;
    const reason = deleteUserReason.trim();
    if (!reason) {
      toast.error("A reason is required");
      return;
    }
    try {
      await deleteUser.mutateAsync({ id: userToDelete.id, reason });
      toast.success("User deleted", {
        description: `${userToDelete.name} was soft deleted.`,
      });
      setIsDeleteUserDialogOpen(false);
      setDeleteUserReason("");
      setUserToDelete(null);
    } catch (error) {
      toast.error("Failed to delete user", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const getUserStatus = (user: typeof users[0]) => {
    return user.status || (user.isActive ? 'active' : 'inactive');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load users. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <p className="text-muted-foreground">Manage platform users and access</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Button variant="outline" onClick={() => setIsInviteDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </motion.div>

      {/* Decline User Confirmation Dialog */}
      <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline User Signup Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline {userToDecline?.name}'s signup request? This will reject their application and they will not be able to access the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeclineDialogOpen(false);
                setUserToDecline(null);
              }}
              disabled={declineUser.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={declineUser.isPending}
            >
              {declineUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Declining...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will soft delete {userToDelete?.name}. Enter a reason to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteUser}>
            <div className="space-y-2 py-2">
              <Label htmlFor="delete-user-reason">Reason</Label>
              <Input
                id="delete-user-reason"
                value={deleteUserReason}
                onChange={(e) => setDeleteUserReason(e.target.value)}
                placeholder="Reason for deleting this user"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteUserDialogOpen(false);
                  setDeleteUserReason("");
                  setUserToDelete(null);
                }}
                disabled={deleteUser.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteUser.isPending}>
                {deleteUser.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Direct Add User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add User Without Invitation</DialogTitle>
            <DialogDescription>
              Create an active account directly. The user can login immediately with the password you set here.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="createRole">Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: UserRole) => setCreateForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="createRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="head_of_operation">Head of Operation</SelectItem>
                    <SelectItem value="warehouse_technician">Warehouse Technician</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {createErrors.role && <p className="text-xs text-destructive">{createErrors.role}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="createName">Full Name</Label>
                <Input
                  id="createName"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="User full name"
                />
                {createErrors.name && <p className="text-xs text-destructive">{createErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="createEmail">Email</Label>
                <Input
                  id="createEmail"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
                {createErrors.email && <p className="text-xs text-destructive">{createErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="createPhone">Phone Number</Label>
                <Input
                  id="createPhone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+44 7123 456 789"
                />
                {createErrors.phone && <p className="text-xs text-destructive">{createErrors.phone}</p>}
              </div>

              {(createForm.role === "client" || createForm.role === "partner" || createForm.role === "admin") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="createOrganisation">Organisation Name</Label>
                    <Input
                      id="createOrganisation"
                      value={createForm.organisationName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, organisationName: e.target.value }))}
                      placeholder="Organisation / Company name"
                    />
                    {createErrors.organisationName && <p className="text-xs text-destructive">{createErrors.organisationName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="createRegistrationNumber">Registration Number (optional)</Label>
                    <Input
                      id="createRegistrationNumber"
                      value={createForm.registrationNumber}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                      placeholder="Company registration number"
                    />
                    {createErrors.registrationNumber && <p className="text-xs text-destructive">{createErrors.registrationNumber}</p>}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="createPassword">Account Password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateForm((prev) => ({ ...prev, password: generateStrongPassword() }))}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Generate Strong Password
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="createPassword"
                    type={showCreatePassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Set a secure password"
                    className="pr-10"
                    {...passwordInputProps}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowCreatePassword((prev) => !prev)}
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {createErrors.password && <p className="text-xs text-destructive">{createErrors.password}</p>}

                {showHints && (
                <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-primary mt-0.5" />
                    <p className="text-xs font-semibold text-foreground">Password Requirements</p>
                  </div>
                  {(() => {
                    const checks = getPasswordChecks(createForm.password);
                    return (
                      <div className="space-y-1.5 text-xs">
                        <p className={checks.minLength ? "text-success" : "text-muted-foreground"}>{checks.minLength ? "✓" : "•"} At least 8 characters</p>
                        <p className={checks.uppercase ? "text-success" : "text-muted-foreground"}>{checks.uppercase ? "✓" : "•"} One uppercase letter</p>
                        <p className={checks.lowercase ? "text-success" : "text-muted-foreground"}>{checks.lowercase ? "✓" : "•"} One lowercase letter</p>
                        <p className={checks.number ? "text-success" : "text-muted-foreground"}>{checks.number ? "✓" : "•"} One number</p>
                        <p className={checks.special ? "text-success" : "text-muted-foreground"}>{checks.special ? "✓" : "•"} One special character</p>
                      </div>
                    );
                  })()}
                </div>
                )}
              </div>

              <Alert className="bg-info/10 border-info/20">
                <AlertCircle className="h-4 w-4 text-info" />
                <AlertDescription className="text-sm">
                  This creates the user directly as <strong>active</strong> without invitation email. Share this password securely with the user.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetCreateForm();
                }}
                disabled={createUser.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setUserToEdit(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update name, email, phone, and role. Users receive updated permissions on their next login.
            </DialogDescription>
          </DialogHeader>
          {userToEdit && (
            <form onSubmit={handleSaveEditUser}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Full name</Label>
                  <Input
                    id="editName"
                    value={userToEdit.name}
                    onChange={(e) => setUserToEdit((p) => (p ? { ...p, name: e.target.value } : p))}
                  />
                  {editErrors.name && <p className="text-xs text-destructive">{editErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={userToEdit.email}
                    onChange={(e) => setUserToEdit((p) => (p ? { ...p, email: e.target.value } : p))}
                  />
                  {editErrors.email && <p className="text-xs text-destructive">{editErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPhone">Phone (optional)</Label>
                  <Input
                    id="editPhone"
                    value={userToEdit.phone}
                    onChange={(e) => setUserToEdit((p) => (p ? { ...p, phone: e.target.value } : p))}
                    placeholder="+44 …"
                  />
                  {editErrors.phone && <p className="text-xs text-destructive">{editErrors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRole">Role</Label>
                  <Select
                    value={userToEdit.role}
                    onValueChange={(value: UserRole) => setUserToEdit((p) => (p ? { ...p, role: value } : p))}
                    disabled={userToEdit.id === currentUser?.id}
                  >
                    <SelectTrigger id="editRole">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="head_of_operation">Head of Operation</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="warehouse_technician">Warehouse Technician</SelectItem>
                    </SelectContent>
                  </Select>
                  {userToEdit.id === currentUser?.id && (
                    <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
                  )}
                  {editErrors.role && <p className="text-xs text-destructive">{editErrors.role}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={updateUserProfile.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserProfile.isPending}>
                  {updateUserProfile.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new password for {userToReset?.name}. Leave blank to auto-generate a strong password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="resetPassword">New Password (optional)</Label>
                <div className="relative">
                  <Input
                    id="resetPassword"
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={resetUserPassword.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetUserPassword.isPending}>
                {resetUserPassword.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordResultDialogOpen} onOpenChange={setIsPasswordResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Credentials</DialogTitle>
            <DialogDescription>
              Copy and send these credentials securely to the user.
            </DialogDescription>
          </DialogHeader>
          {passwordResult && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Email</Label>
                <Input value={passwordResult.email} readOnly />
              </div>
              <div>
                <Label>Password</Label>
                <Input value={passwordResult.password} readOnly />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (!passwordResult) return;
                navigator.clipboard.writeText(`Email: ${passwordResult.email}\nPassword: ${passwordResult.password}`);
                toast.success("Credentials copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation email to onboard a new user.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendInvite}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value: UserRole) => setInviteRole(value)}
                  disabled={isSendingInvite}
                >
                  <SelectTrigger id="inviteRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="head_of_operation">Head of Operation</SelectItem>
                    <SelectItem value="warehouse_technician">Warehouse Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="partner@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSendingInvite}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The invited user will receive a secure link to accept the invitation and create their account.
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
                  setInviteRole('partner');
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
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            Users
            {filteredUsers.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredUsers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            User invitations
            {userInvites.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {userInvites.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
              <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4"
          >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or organisation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="head_of_operation">Head of Operation</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="driver">Driver</SelectItem>
            <SelectItem value="warehouse_technician">Warehouse Technician</SelectItem>
          </SelectContent>
        </Select>
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

          {/* Users List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No users found matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                    <UsersIcon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground break-words">{user.name}</p>
                        <Badge className={cn("text-xs flex-shrink-0", roleColors[user.role])}>
                        {formatRoleLabel(user.role)}
                      </Badge>
                      {getUserStatus(user) === 'pending' ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning flex-shrink-0">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : getUserStatus(user) === 'active' ? (
                          <Badge variant="secondary" className="bg-success/10 text-success flex-shrink-0">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : getUserStatus(user) === 'declined' ? (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive flex-shrink-0">
                          <XCircle className="h-3 w-3 mr-1" />
                          Declined
                        </Badge>
                      ) : (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive flex-shrink-0">
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 min-w-0">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                      </span>
                        <span className="flex items-center gap-1 min-w-0">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.organisationName || user.tenantName}</span>
                      </span>
                      {user.lastLogin && (
                        <span className="text-xs">
                          Last login: {new Date(user.lastLogin).toLocaleDateString("en-GB")}
                        </span>
                      )}
                      {user.invitedBy && (
                        <span className="text-xs">
                          {user.invitedBy}
                        </span>
                      )}
                      {user.resellerName && (
                        <span className="text-xs font-medium text-primary">
                          Referred by {user.resellerName}
                        </span>
                      )}
                    </div>
                  </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:flex-shrink-0">
                    {getUserStatus(user) === 'pending' && user.role === 'partner' ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                          disabled={approveUser.isPending || declineUser.isPending}
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeclineUser(user.id, user.name)}
                          disabled={approveUser.isPending || declineUser.isPending}
                          className="w-full sm:w-auto"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUser(user)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : getUserStatus(user) === 'pending' && user.role === 'client' ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                          disabled={approveUser.isPending || declineUser.isPending}
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeclineUser(user.id, user.name)}
                          disabled={approveUser.isPending || declineUser.isPending}
                          className="w-full sm:w-auto"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUser(user)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : getUserStatus(user) === 'declined' ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                          disabled={approveUser.isPending}
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUser(user)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant={getUserStatus(user) === 'active' ? "destructive" : "success"}
                          size="sm"
                          onClick={() => handleToggleStatus(user.id, user.isActive)}
                          disabled={
                            updateStatus.isPending || 
                            (user.id === currentUser?.id && getUserStatus(user) === 'active')
                          }
                          title={
                            user.id === currentUser?.id && getUserStatus(user) === 'active'
                              ? "You cannot deactivate your own account"
                              : undefined
                          }
                          className="w-full sm:w-auto"
                        >
                          {getUserStatus(user) === 'active' ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUser(user)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUserToReset({ id: user.id, email: user.email, name: user.name });
                            setResetPassword("");
                            setShowResetPassword(false);
                            setIsResetDialogOpen(true);
                          }}
                          className="w-full sm:w-auto"
                        >
                          Reset Password
                        </Button>
                        {currentUser?.isSuperAdmin && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setUserToDelete({ id: user.id, name: user.name });
                              setDeleteUserReason("");
                              setIsDeleteUserDialogOpen(true);
                            }}
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? "You cannot delete your own account" : undefined}
                            className="w-full sm:w-auto"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        )}
        </TabsContent>

        {/* User invitations tab */}
        <TabsContent value="invitations" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">User invitations</h3>
              <p className="text-sm text-muted-foreground">
                Manage and track user invitations
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
          ) : userInvites.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No user invitations found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {userInvites.map((invite: Invite) => {
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
      </Tabs>
    </div>
  );
};

export default Users;

