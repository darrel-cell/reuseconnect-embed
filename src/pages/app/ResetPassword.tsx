// Reset Password Page
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, Home, Eye, EyeOff, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTenantTheme } from '@/contexts/TenantThemeContext';
import { authService } from '@/services/auth.service';
import { getAuthErrorMessage } from '@/utils/auth-errors';

const passwordChecks = (value: string) => ({
  minLength: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  lowercase: /[a-z]/.test(value),
  number: /\d/.test(value),
  special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(value),
});

const PASSWORD_REQUIREMENTS = [
  { key: 'minLength' as const, label: 'At least 8 characters' },
  { key: 'uppercase' as const, label: 'One uppercase letter' },
  { key: 'lowercase' as const, label: 'One lowercase letter' },
  { key: 'number' as const, label: 'One number' },
  { key: 'special' as const, label: 'One special character' },
];

const isPasswordStrong = (value: string) => {
  const checks = passwordChecks(value);
  return Object.values(checks).every(Boolean);
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const { tenantName, logo } = useTenantTheme();
  const navigate = useNavigate();
  const checks = passwordChecks(password);
  const unmatchedRequirements = PASSWORD_REQUIREMENTS.filter((req) => !checks[req.key]);

  useEffect(() => {
    if (showPasswordHints && isPasswordStrong(password)) {
      setShowPasswordHints(false);
    }
  }, [password, showPasswordHints]);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid reset link. Please request a new password reset.');
        setIsValidating(false);
        return;
      }

      try {
        const result = await authService.validateResetToken(token);
        setIsTokenValid(result.valid);
        if (!result.valid) {
          setError('This reset link is invalid or has expired. Please request a new one.');
        }
      } catch (err) {
        setError(getAuthErrorMessage(err, 'Failed to validate reset link.'));
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Invalid reset link.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Failed to reset password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <Link
        to="/login"
        className="fixed top-4 left-4 inline-flex items-center justify-center rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-accent"
        aria-label="Back to login"
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
                  placeholder.className =
                    'flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl';
                  placeholder.textContent = tenantName.charAt(0).toUpperCase();
                  e.currentTarget.parentNode?.appendChild(placeholder);
                }}
              />
            </div>
            <CardTitle className="text-2xl">
              {isSuccess ? 'Password Reset' : 'Set New Password'}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? 'Your password has been updated successfully'
                : 'Choose a strong password for your account'}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            {isValidating ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Validating reset link...</p>
              </div>
            ) : isSuccess ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Your password has been reset. You can now sign in with your new password.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
                  Go to Sign In
                </Button>
              </div>
            ) : !isTokenValid ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/forgot-password">Request New Reset Link</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="relative space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setShowPasswordHints(false)}
                      onBlur={() => {
                        if (password.length > 0 && !isPasswordStrong(password)) {
                          setShowPasswordHints(true);
                        }
                      }}
                      className="pl-9 pr-9"
                      required
                      disabled={isLoading}
                      autoFocus
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
                  {showPasswordHints && unmatchedRequirements.length > 0 && (
                    <Alert className="absolute left-0 right-0 top-full z-20 mt-2 border-amber-500/50 bg-amber-50/50 text-amber-950 shadow-lg backdrop-blur-md dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="space-y-1.5 text-xs">
                          {unmatchedRequirements.map((req) => (
                            <li key={req.key} className="flex items-center gap-1.5 text-muted-foreground">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>{req.label}</span>
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 pr-9"
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
