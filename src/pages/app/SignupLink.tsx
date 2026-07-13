import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Building2, AlertCircle, Eye, EyeOff, CheckCircle2, Shield, ClipboardCheck, UserCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useShowPasswordHints } from '@/hooks/useShowPasswordHints';
import { getReferralLogoUrl } from '@/utils/referral-logo-url';
import { ApiError } from '@/services/api-error';

export type SignupRole = 'client' | 'partner';

export type ReferralPartnerBranding = {
  name: string;
  slug: string;
  logo: string;
};

type SignupLinkProps = {
  role: SignupRole;
  referralPartner?: ReferralPartnerBranding;
  previewMode?: boolean;
  previewMessage?: string;
  hidePreviewBanner?: boolean;
  embeddedPreview?: boolean;
};

const SignupLink = ({ role, referralPartner, previewMode = false, previewMessage, hidePreviewBanner = false, embeddedPreview = false }: SignupLinkProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [error, setError] = useState('');
  const [logoBroken, setLogoBroken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showHints, passwordInputProps } = useShowPasswordHints(formData.password);
  const { signupClient, signupPartner } = useAuth();
  const navigate = useNavigate();
  const roleLabel = role === 'client' ? 'Client' : 'Partner';
  const roleDescription =
    role === 'client'
      ? 'Create a client account to book collections, track progress, and access reporting once approved.'
      : 'Create a partner account to manage partner workflows and collaborate with client operations once approved.';
  const roleBadge = role === 'client' ? 'ITAD onboarding' : 'Partner onboarding';
  const partnerLogo = getReferralLogoUrl(referralPartner?.logo);
  const primaryLogo = '/logo.avif';
  const signupLogoAlt = referralPartner?.name || 'Reuse Tech Group';
  const steps = [
    {
      title: 'Register interest',
      description: 'Complete this form with your business details so our team can review your request.',
      icon: ClipboardCheck,
      iconClass: 'text-sky-600',
      bgClass: 'from-sky-500/10 to-sky-500/5',
      borderClass: 'border-sky-500/30',
      badgeClass: 'from-sky-500 to-cyan-500',
    },
    {
      title: 'Account review',
      description: `Your ${roleLabel.toLowerCase()} account request is verified by admin before activation.`,
      icon: UserCheck,
      iconClass: 'text-violet-600',
      bgClass: 'from-violet-500/10 to-violet-500/5',
      borderClass: 'border-violet-500/30',
      badgeClass: 'from-violet-500 to-fuchsia-500',
    },
    {
      title: 'Start collections',
      description: 'Once approved, access booking, tracking, and reporting in the client portal.',
      icon: Truck,
      iconClass: 'text-emerald-600',
      bgClass: 'from-emerald-500/10 to-emerald-500/5',
      borderClass: 'border-emerald-500/30',
      badgeClass: 'from-emerald-500 to-teal-500',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) return;
    setError('');
    setIsLoading(true);

    try {
      const signupData = {
        ...formData,
        ...(referralPartner && { referralPartnerSlug: referralPartner.slug }),
      };

      if (role === 'client') {
        await signupClient(signupData);
      } else {
        await signupPartner(signupData);
      }
      navigate('/dashboard');
    } catch (err) {
      let errorMessage = 'Signup failed. Please try again.';
      if (err instanceof ApiError && err.fields) {
        const fields = err.fields;
        if (fields.password) {
          errorMessage = fields.password;
        } else {
          const firstFieldError = Object.values(fields)[0];
          if (firstFieldError) {
            errorMessage = firstFieldError;
          }
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = !isLoading && !previewMode;

  return (
    <div className={embeddedPreview ? 'relative min-h-0 overflow-hidden bg-[#f1f6f4]' : 'relative min-h-screen overflow-hidden bg-[#f1f6f4]'}>
      {previewMode && !hidePreviewBanner && (
        <div className="relative z-20 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
          {previewMessage || 'Preview mode — signup is disabled.'}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-75"
        style={{ backgroundImage: "url('/invitation_background.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/25" />
      <section className="relative">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative space-y-6 pt-1"
            >
              <div className="relative space-y-4">
                <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-100/70 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {referralPartner ? `${referralPartner.name} customer signup` : roleBadge}
                </span>
                <h1 className="max-w-2xl bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 bg-clip-text text-5xl font-semibold tracking-tight text-transparent md:text-6xl">
                  {referralPartner ? 'Create Your Reuse Connect Account' : 'Start Your Reuse Journey'}
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-slate-900">
                  {referralPartner
                    ? `You have been invited by ${referralPartner.name} to access Reuse Connect for secure IT asset collections, tracking, and reporting.`
                    : 'Secure IT asset disposal and disposition with fast collection windows, full data erasure assurance, and reporting built for compliance teams.'}
                </p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="relative max-w-xl rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-semibold text-slate-800">
                    {referralPartner ? `${referralPartner.name} referral` : `${roleLabel} account`}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  {referralPartner
                    ? `Complete this form and your account will be linked to ${referralPartner.name} automatically.`
                    : roleDescription}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-emerald-600">
                  <span>Booking</span>
                  <span>Tracking</span>
                  <span>Reporting</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
              <Card className="border border-slate-200 bg-white/90 shadow-xl backdrop-blur-md">
                <CardHeader className="space-y-4 pb-4 text-center">
                  {referralPartner ? (
                    <div className="mx-auto mb-1 flex flex-col items-center gap-2">
                      <img src="/logo.avif" alt="Reuse Connect" className="h-9 w-auto object-contain" />
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span>Referred by</span>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                          {!logoBroken && partnerLogo ? (
                            <img
                              src={partnerLogo}
                              alt={signupLogoAlt}
                              className="h-4 w-auto object-contain"
                              onError={() => setLogoBroken(true)}
                            />
                          ) : null}
                          {referralPartner.name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto mb-1 flex h-20 w-40 items-center justify-center overflow-hidden">
                      {!logoBroken ? (
                        <img
                          src={primaryLogo}
                          alt={signupLogoAlt}
                          className="max-h-20 max-w-full object-contain"
                          onError={() => setLogoBroken(true)}
                        />
                      ) : (
                        <span className="text-lg font-semibold text-slate-700">{signupLogoAlt}</span>
                      )}
                    </div>
                  )}
                  <CardTitle className="text-3xl text-slate-900">Create your account</CardTitle>
                  <CardDescription className="text-base text-slate-600">
                    {referralPartner
                      ? `Sign up as a ${referralPartner.name} referred customer. Your account will be reviewed by admin.`
                      : `Submit your details to request ${roleLabel.toLowerCase()} access. Your account will be reviewed by admin.`}
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
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="name" type="text" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-11 border-slate-200 bg-white/75 pl-9 focus-visible:ring-primary/50" required={!previewMode} disabled={!canSubmit && !previewMode} readOnly={previewMode} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="email" type="email" placeholder="you@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 border-slate-200 bg-white/75 pl-9 focus-visible:ring-primary/50" required={!previewMode} disabled={!canSubmit && !previewMode} readOnly={previewMode} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="companyName" type="text" placeholder="Your Company Ltd" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="h-11 border-slate-200 bg-white/75 pl-9 focus-visible:ring-primary/50" required={!previewMode} disabled={!canSubmit && !previewMode} readOnly={previewMode} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="h-11 border-slate-200 bg-white/75 pl-9 pr-9 focus-visible:ring-primary/50" required={!previewMode} minLength={8} disabled={!canSubmit && !previewMode} readOnly={previewMode} {...passwordInputProps} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} disabled={previewMode || !canSubmit}>
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                      {showHints && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="mb-2 flex items-start gap-2">
                            <Shield className="mt-0.5 h-3.5 w-3.5 text-primary" />
                            <p className="text-xs font-semibold text-foreground">Password Requirements</p>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5">{formData.password.length >= 8 ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}<span className={formData.password.length >= 8 ? 'text-success' : 'text-muted-foreground'}>At least 8 characters</span></div>
                            <div className="flex items-center gap-1.5">{/[A-Z]/.test(formData.password) ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}<span className={/[A-Z]/.test(formData.password) ? 'text-success' : 'text-muted-foreground'}>One uppercase letter</span></div>
                            <div className="flex items-center gap-1.5">{/[a-z]/.test(formData.password) ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}<span className={/[a-z]/.test(formData.password) ? 'text-success' : 'text-muted-foreground'}>One lowercase letter</span></div>
                            <div className="flex items-center gap-1.5">{/\d/.test(formData.password) ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}<span className={/\d/.test(formData.password) ? 'text-success' : 'text-muted-foreground'}>One number</span></div>
                            <div className="flex items-center gap-1.5">{/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(formData.password) ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}<span className={/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(formData.password) ? 'text-success' : 'text-muted-foreground'}>One special character</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button type="submit" className="h-11 w-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:from-emerald-500/90 hover:to-sky-500/90" size="lg" disabled={!canSubmit}>
                      {previewMode ? 'Signup disabled in preview' : isLoading ? 'Creating account...' : <><UserPlus className="mr-2 h-4 w-4" />Create {roleLabel} Account</>}
                    </Button>
                    {!previewMode && (
                    <div className="space-y-2 text-center text-sm text-muted-foreground">
                      <p>
                        Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
                      </p>
                    </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="relative rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
            >
              <span className={`absolute -top-5 left-5 z-10 inline-flex h-12 min-w-12 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br ${step.badgeClass} px-3 text-xl font-extrabold leading-none text-white shadow-[0_12px_25px_-12px_rgba(15,23,42,0.55)] ring-1 ring-white/35 backdrop-blur-sm`}>
                {index + 1}
              </span>
              <div className="mb-3 mt-4 flex items-center justify-between gap-3">
                <p className="text-xl font-semibold leading-tight text-slate-800">{step.title}</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80">
                  <step.icon className={`h-5 w-5 ${step.iconClass}`} />
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SignupLink;
