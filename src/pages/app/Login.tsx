// Login Page
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, Shield, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantTheme } from '@/contexts/TenantThemeContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState<string | null>(null);
  const [twoFactorEmail, setTwoFactorEmail] = useState<string>('');
  const [twoFactorMessage, setTwoFactorMessage] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login, verifyTwoFactor, resendTwoFactorCode } = useAuth();
  const { tenantName, logo } = useTenantTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login({ email, password });
      
      // Check if 2FA is required
      if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setTwoFactorUserId(result.userId);
        setTwoFactorEmail(result.email);
        setTwoFactorMessage(result.message);
        setPassword(''); // Clear password for security
      } else {
        // Normal login successful
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      if (!twoFactorUserId) {
        setError('Invalid session. Please try logging in again.');
        setRequiresTwoFactor(false);
        return;
      }

      await verifyTwoFactor(twoFactorUserId, verificationCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setRequiresTwoFactor(false);
    setTwoFactorUserId(null);
    setTwoFactorEmail('');
    setTwoFactorMessage('');
    setVerificationCode('');
    setError('');
    setResendCooldown(0);
  };

  const handleResendCode = async () => {
    if (!twoFactorUserId || resendCooldown > 0 || isResending) {
      return;
    }

    setError('');
    setIsResending(true);

    try {
      const result = await resendTwoFactorCode(twoFactorUserId);
      setTwoFactorMessage(result.message || 'A new verification code has been sent to your email address.');
      
      // Set cooldown timer (30 seconds)
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Set cooldown when 2FA is required (initial 30 second cooldown)
  useEffect(() => {
    if (requiresTwoFactor && resendCooldown === 0) {
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [requiresTwoFactor]);

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
                  // Fallback to placeholder if logo fails to load
                  e.currentTarget.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.className = 'flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl';
                  placeholder.textContent = tenantName.charAt(0).toUpperCase();
                  e.currentTarget.parentNode?.appendChild(placeholder);
                }}
              />
            </div>
            <CardTitle className="text-2xl">
              {requiresTwoFactor ? 'Two-Factor Authentication' : 'Welcome to Reuse Connect'}
            </CardTitle>
            <CardDescription>
              {requiresTwoFactor 
                ? 'Enter the 6-digit verification code sent to your email'
                : 'Sign in to Reuse Connect ITAD Platform'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requiresTwoFactor ? (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {twoFactorMessage && (
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>{twoFactorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="verificationCode">Verification Code</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="verificationCode"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => {
                        // Only allow digits and limit to 6 characters
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setVerificationCode(value);
                      }}
                      className="pl-9 text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                      required
                      disabled={isVerifying || isResending}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Code sent to: {twoFactorEmail}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isVerifying || isResending || verificationCode.length !== 6}
                >
                  {isVerifying ? (
                    'Verifying...'
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Verify Code
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleResendCode}
                    disabled={isVerifying || isResending || resendCooldown > 0}
                  >
                    {isResending ? (
                      'Sending...'
                    ) : resendCooldown > 0 ? (
                      `Resend in ${resendCooldown}s`
                    ) : (
                      'Resend Code'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={handleBackToLogin}
                    disabled={isVerifying || isResending}
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
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
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
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
                      disabled={isLoading}
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
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    'Signing in...'
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground space-y-2">
                  <p>
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-primary hover:underline font-medium">
                      Sign up
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Clients must be invited by a reseller or admin.{' '}
                    <Link to="/invite" className="text-primary hover:underline font-medium">
                      Accept your invitation
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;

