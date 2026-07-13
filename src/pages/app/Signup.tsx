// Signup Page
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Building2, AlertCircle, Eye, EyeOff, CheckCircle2, Shield, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantTheme } from '@/contexts/TenantThemeContext';
import { useShowPasswordHints } from '@/hooks/useShowPasswordHints';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    role: 'client' as 'client' | 'partner',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signup } = useAuth();
  const { tenantName, logo } = useTenantTheme();
  const navigate = useNavigate();
  const { showHints, passwordInputProps } = useShowPasswordHints(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signup(formData);
      // Show success message for pending approval
      navigate('/dashboard');
    } catch (err) {
      // Extract error message, prioritizing field-specific errors (especially password)
      let errorMessage = 'Signup failed. Please try again.';
      
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
                alt={tenantName}
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.className = 'flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl';
                  placeholder.textContent = tenantName.charAt(0).toUpperCase();
                  e.currentTarget.parentNode?.appendChild(placeholder);
                }}
              />
            </div>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Sign up and your account will be reviewed by admin. You'll be notified once approved.
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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2 mb-2">
                      <Shield className="h-3.5 w-3.5 text-primary mt-0.5" />
                      <p className="text-xs font-semibold text-foreground">Password Requirements</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        {formData.password.length >= 8 ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className={formData.password.length >= 8 ? "text-success" : "text-muted-foreground"}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[A-Z]/.test(formData.password) ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className={/[A-Z]/.test(formData.password) ? "text-success" : "text-muted-foreground"}>
                          One uppercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[a-z]/.test(formData.password) ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className={/[a-z]/.test(formData.password) ? "text-success" : "text-muted-foreground"}>
                          One lowercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/\d/.test(formData.password) ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className={/\d/.test(formData.password) ? "text-success" : "text-muted-foreground"}>
                          One number
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(formData.password) ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className={/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(formData.password) ? "text-success" : "text-muted-foreground"}>
                          One special character
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Account Type</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'client' | 'partner') =>
                    setFormData({ ...formData, role: value })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
                <Alert className="bg-info/10 border-info/20">
                  <AlertCircle className="h-4 w-4 text-info" />
                  <AlertDescription className="text-sm">
                    Your account will be created with <strong>pending</strong> status. Admin will review and approve your account. You'll be able to access all features once approved.
                  </AlertDescription>
                </Alert>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  'Creating account...'
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
                <p>
                  Received an invite?{' '}
                  <Link to="/invite" className="text-primary hover:underline font-medium">
                    Accept invite
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Signup;

