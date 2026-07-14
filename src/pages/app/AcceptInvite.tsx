import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Mail, CheckCircle2, AlertCircle, Lock, User, Loader2, Eye, EyeOff, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantTheme } from "@/contexts/TenantThemeContext";
import { authService } from "@/services/auth.service";
import { useShowPasswordHints } from "@/hooks/useShowPasswordHints";
import type { Invite } from "@/types/auth";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { showHints, passwordInputProps } = useShowPasswordHints(password);
  const { acceptInvite } = useAuth();
  const { tenantName, logo } = useTenantTheme();
  const navigate = useNavigate();

  // Load invite details on mount
  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setError("Invalid invite link. Please check your invitation email.");
        setIsLoadingInvite(false);
        return;
      }

      try {
        const inviteData = await authService.getInvite(token);
        if (inviteData) {
          setInvite(inviteData);
          setEmail(inviteData.email);
          // Client invites require organisation name entry.
          // We do not prefill from inviteData.tenantName to avoid forcing company-level defaults.
          setOrganisationName("");
        } else {
          setError("Invalid or expired invite. Please contact the person who invited you.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invite details.");
      } finally {
        setIsLoadingInvite(false);
      }
    };

    loadInvite();
  }, [token]);

  const getRoleLabel = (role: Invite['role']) => {
    if (role === 'client') return 'client';
    if (role === 'partner') return 'Partner';
    if (role === 'driver') return 'driver';
    if (role === 'warehouse_technician') return 'Warehouse Technician';
    return 'admin';
  };

  const getRoleSummary = (role: Invite['role']) => {
    switch (role) {
      case 'client':
        return 'You will be able to create bookings, track collections, and view your environmental impact.';
      case 'partner':
        return 'You will be able to onboard clients and create bookings on their behalf.';
      case 'driver':
        return 'You will be able to view assigned jobs, update statuses, and upload collection evidence.';
      case 'warehouse_technician':
        return 'You will be able to receive collections from drivers and progress warehouse statuses.';
      case 'admin':
      default:
        return 'You will be able to manage clients, jobs, bookings, and platform settings.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!token) {
      setError("Invalid invite link.");
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        inviteToken: token,
        email,
        name,
        password,
      };

      if (invite?.role === 'client') {
        payload.organisationName = organisationName;
      }

      await acceptInvite({
        ...payload,
      });
      navigate("/dashboard");
    } catch (err) {
      // Extract error message, prioritizing field-specific errors (especially password)
      let errorMessage = "Failed to accept invite. Please try again.";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Check if it's an ApiError with field-specific errors
        if ('fields' in err && err.fields) {
          const fields = err.fields as Record<string, string>;
          // Prioritize password error if present
          if (fields.password) {
            errorMessage = fields.password;
          } else {
            // Use the first field error if no password error
            const firstFieldError = Object.values(fields)[0];
            if (firstFieldError) {
              errorMessage = firstFieldError;
            }
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
        <Link
          to="/"
          className="fixed top-4 left-4 inline-flex items-center justify-center rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-accent"
          aria-label="Back to homepage"
        >
          <Home className="h-5 w-5" />
        </Link>
        <Card className="border-2 shadow-xl w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no token, show a form to enter token manually
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
        <Link
          to="/"
          className="fixed top-4 left-4 inline-flex items-center justify-center rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-accent"
          aria-label="Back to homepage"
        >
          <Home className="h-5 w-5" />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-4 text-center">
              <div className="flex justify-center mb-4">
                <img 
                  src={logo || '/logo.avif'} 
                  alt={tenantName || 'Platform'}
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.className = 'flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl';
                    placeholder.textContent = (tenantName || 'R').charAt(0).toUpperCase();
                    e.currentTarget.parentNode?.appendChild(placeholder);
                  }}
                />
              </div>
              <CardTitle className="text-2xl">Accept Invitation</CardTitle>
              <CardDescription>
                Enter your invitation token or use the link from your invitation email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-info/10 border-info/20 mb-4">
                <AlertCircle className="h-4 w-4 text-info" />
                <AlertDescription className="text-sm">
                  Check your email for the invitation link. The link contains a token that will automatically load your invitation details.
                </AlertDescription>
              </Alert>
              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!invite && !error) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <Link
        to="/"
        className="fixed top-4 left-4 inline-flex items-center justify-center rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-accent"
        aria-label="Back to homepage"
      >
        <Home className="h-5 w-5" />
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-4">
              <img 
                src={logo || '/logo.avif'} 
                alt={tenantName || invite?.tenantName || 'Platform'}
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.className = 'flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl';
                  placeholder.textContent = (tenantName || invite?.tenantName || 'R').charAt(0).toUpperCase();
                  e.currentTarget.parentNode?.appendChild(placeholder);
                }}
              />
            </div>
            <CardTitle className="text-2xl">Accept Invitation</CardTitle>
            <CardDescription>
              {invite ? (
                <div className="space-y-2">
                  <p>
                    You've been invited
                    {invite.inviter?.name ? (
                      <> by <strong>{invite.inviter.name}</strong></>
                    ) : null}{' '}
                    to join <strong>{invite.tenantName}</strong> as a <strong>{getRoleLabel(invite.role)}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleSummary(invite.role)}
                  </p>
                  <p>Complete your account setup to get started.</p>
                </div>
              ) : (
                "Complete your account setup"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {invite?.role === 'client' && (
                <div className="space-y-2">
                  <Label htmlFor="organisationName">Organisation</Label>
                  <Input
                    id="organisationName"
                    type="text"
                    placeholder="Your company name"
                    value={organisationName}
                    onChange={(e) => setOrganisationName(e.target.value)}
                    className="pl-0"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading || !!invite}
                  />
                </div>
                {invite && (
                  <p className="text-xs text-muted-foreground">
                    This email is associated with your invitation.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                    minLength={8}
                    disabled={isLoading}
                    {...passwordInputProps}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {showHints && (
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character.
                </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || !token}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Accepting invite...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;

