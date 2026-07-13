import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api-error';
import { referralPartnersService, type ReferralPartnerConfig, type ReferralPartnerInput } from '@/services/referral-partners.service';
import SignupLink, { type ReferralPartnerBranding } from './SignupLink';
import { getReferralLogoUrl } from '@/utils/referral-logo-url';
import { validateReferralLogoFile } from '@/utils/referral-logo-validation';
import {
  REFERRAL_DISPLAY_NAME_MAX_LENGTH,
  validateReferralDisplayName,
  validateReferralSlug,
} from '@/utils/referral-slug-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FormState = {
  slug: string;
  displayName: string;
  websiteUrl: string;
  partnerUserId: string;
};

const emptyForm = (): FormState => ({
  slug: '',
  displayName: '',
  websiteUrl: '',
  partnerUserId: '',
});

function toFormState(partner: ReferralPartnerConfig): FormState {
  return {
    slug: partner.slug,
    displayName: partner.displayName,
    websiteUrl: partner.websiteUrl || '',
    partnerUserId: partner.partnerUserId || '',
  };
}

function toPayload(form: FormState, isActive: boolean, clearLogo = false): ReferralPartnerInput {
  return {
    slug: form.slug,
    displayName: form.displayName,
    websiteUrl: form.websiteUrl || null,
    partnerUserId: form.partnerUserId || null,
    isActive,
    ...(clearLogo ? { clearLogo: true } : {}),
  };
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

export default function ReferralPartners() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBranding, setPreviewBranding] = useState<ReferralPartnerBranding | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [editing, setEditing] = useState<ReferralPartnerConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferralPartnerConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [previewingSlug, setPreviewingSlug] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ slug?: string; displayName?: string }>({});
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['referral-partners'],
    queryFn: () => referralPartnersService.list(),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: partnerUsers = [] } = useQuery({
    queryKey: ['referral-partner-users'],
    queryFn: () => referralPartnersService.listPartnerUsers(),
    enabled: !!user?.isSuperAdmin,
  });

  const hasLogo = !!(logoFile || (editing?.logoUrl && !logoRemoved));

  useEffect(() => {
    if (!logoFile) {
      setLogoObjectUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setLogoObjectUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile]);

  const logoPreviewSrc = logoObjectUrl
    ? logoObjectUrl
    : editing?.logoUrl && !logoRemoved
      ? getReferralLogoUrl(editing.logoUrl)
      : null;

  const validateForm = () => {
    const displayNameError = validateReferralDisplayName(form.displayName);
    const slugError = validateReferralSlug(form.slug);
    const errors = {
      displayName: displayNameError || undefined,
      slug: slugError || undefined,
    };
    setFormErrors(errors);
    return !displayNameError && !slugError;
  };

  const resetLogoState = () => {
    setLogoFile(null);
    setLogoRemoved(false);
    setLogoError('');
    setLogoObjectUrl(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const savePartner = async (publish: boolean) => {
    if (!validateForm()) {
      throw new Error('Fix the highlighted fields before saving.');
    }
    if (publish) {
      if (!hasLogo) {
        throw new Error('Upload a logo before publishing this referral page.');
      }
      if (!form.partnerUserId) {
        throw new Error('Link a partner account before publishing this referral page.');
      }
    }

    const clearLogo = logoRemoved && !logoFile;
    const activateAfterLogo = publish && !!logoFile;
    let createdId: string | null = null;

    try {
      if (editing) {
        let result = await referralPartnersService.update(
          editing.id,
          toPayload(form, activateAfterLogo ? false : publish, clearLogo),
        );
        if (logoFile) {
          result = await referralPartnersService.uploadLogo(editing.id, logoFile);
        }
        if (publish && !result.isActive) {
          result = await referralPartnersService.update(editing.id, { isActive: true });
        }
        return result;
      }

      let result = await referralPartnersService.create(toPayload(form, activateAfterLogo ? false : publish));
      createdId = result.id;
      if (logoFile) {
        result = await referralPartnersService.uploadLogo(result.id, logoFile);
      }
      if (publish && !result.isActive) {
        result = await referralPartnersService.update(result.id, { isActive: true });
      }
      return result;
    } catch (error) {
      if (createdId) {
        try {
          await referralPartnersService.delete(createdId);
        } catch {
          // Best-effort rollback if a new draft was created but a later step failed.
        }
      }
      throw error;
    }
  };

  const saveMutation = useMutation({
    mutationFn: savePartner,
    onSuccess: (_data, publish) => {
      queryClient.invalidateQueries({ queryKey: ['referral-partners'] });
      toast.success(publish ? 'Referral partner published' : editing ? 'Draft saved' : 'Referral partner created as draft');
      setDialogOpen(false);
      setEditing(null);
      resetLogoState();
      setForm(emptyForm());
      setPublishConfirmOpen(false);
      setUnpublishConfirmOpen(false);
    },
    onError: (error: Error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : error.message || 'Failed to save referral partner';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => referralPartnersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-partners'] });
      toast.success('Referral partner deleted');
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete referral partner');
    },
  });

  const previewMutation = useMutation({
    mutationFn: (slug: string) => referralPartnersService.getPreview(slug),
    onMutate: (slug) => {
      setPreviewingSlug(slug);
    },
    onSuccess: (data, slug) => {
      setPreviewBranding({
        name: data.name,
        slug: data.slug,
        logo: data.logo || '',
      });
      const readiness = data.isReady
        ? 'Ready for public signup.'
        : 'Not ready yet — link partner, upload logo, and publish.';
      setPreviewMessage(`Preview: /${slug}. ${readiness} Signup is disabled.`);
      setPreviewOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to load preview');
    },
    onSettled: () => {
      setPreviewingSlug(null);
    },
  });

  const signupBaseUrl = useMemo(() => window.location.origin, []);
  const isPublished = !!editing?.isActive;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    resetLogoState();
    setDialogOpen(true);
  };

  const openEdit = (partner: ReferralPartnerConfig) => {
    setEditing(partner);
    setForm(toFormState(partner));
    setFormErrors({});
    resetLogoState();
    setDialogOpen(true);
  };

  const copySignupUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${signupBaseUrl}/${slug}`);
      toast.success('Signup URL copied');
    } catch {
      toast.error('Could not copy URL. Check browser clipboard permissions.');
    }
  };

  const handleLogoSelect = async (file: File | null) => {
    if (!file) return;
    const validationError = await validateReferralLogoFile(file);
    if (validationError) {
      setLogoError(validationError);
      setLogoFile(null);
      setLogoRemoved(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }
    setLogoError('');
    setLogoFile(file);
    setLogoRemoved(false);
  };

  const handleDraft = () => {
    if (!validateForm()) {
      toast.error('Fix the highlighted fields before saving.');
      return;
    }
    if (editing?.isActive) {
      setUnpublishConfirmOpen(true);
      return;
    }
    saveMutation.mutate(false);
  };

  const handlePublish = () => {
    if (!validateForm()) {
      toast.error('Fix the highlighted fields before publishing.');
      return;
    }
    if (!hasLogo) {
      toast.error('Upload a logo before publishing this referral page.');
      return;
    }
    if (!form.partnerUserId) {
      toast.error('Link a partner account before publishing this referral page.');
      return;
    }
    setPublishConfirmOpen(true);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoRemoved(true);
    setLogoError('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  if (!user?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 p-6" data-main-content>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Referral Partners</h1>
          <p className="text-sm text-muted-foreground">
            Manage branded client signup pages, logos, and partner account links.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add referral partner
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading referral partners...
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left">Partner</th>
                <th className="p-3 text-left">Slug</th>
                <th className="p-3 text-left">Linked account</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {partner.logoUrl ? (
                        <img
                          src={getReferralLogoUrl(partner.logoUrl)}
                          alt={partner.displayName}
                          className="h-8 w-auto max-w-[120px] object-contain"
                        />
                      ) : (
                        <div className="flex h-8 w-20 items-center justify-center rounded border text-xs text-muted-foreground">
                          No logo
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{partner.displayName}</div>
                        {partner.websiteUrl && (
                          <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                            {partner.websiteUrl}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs">{partner.slug}</td>
                  <td className="p-3">
                    {partner.partnerUserName ? (
                      <div>
                        <div>{partner.partnerUserName}</div>
                        <div className="text-xs text-muted-foreground">{partner.partnerUserEmail}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not linked</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={partner.isActive ? 'default' : 'secondary'}>
                        {partner.isActive ? 'Published' : 'Draft'}
                      </Badge>
                      {!partner.canActivate && (
                        <Badge variant="outline">Setup incomplete</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => copySignupUrl(partner.slug)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => previewMutation.mutate(partner.slug)}
                        disabled={previewingSlug === partner.slug}
                      >
                        {previewingSlug === partner.slug ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(partner)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(partner)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No referral partners configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit referral partner' : 'Add referral partner'}</DialogTitle>
            <DialogDescription>
              Configure the branded signup page. Save as draft while setting up, then publish when ready.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="displayName">Display name</RequiredLabel>
                <Input
                  id="displayName"
                  value={form.displayName}
                  maxLength={REFERRAL_DISPLAY_NAME_MAX_LENGTH}
                  onChange={(e) => {
                    setForm({ ...form, displayName: e.target.value });
                    if (formErrors.displayName) {
                      setFormErrors({ ...formErrors, displayName: undefined });
                    }
                  }}
                  placeholder="SmartRecycler"
                  required
                />
                {formErrors.displayName && (
                  <p className="text-xs text-destructive">{formErrors.displayName}</p>
                )}
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="slug">Slug</RequiredLabel>
                <Input
                  id="slug"
                  value={form.slug}
                  disabled={isPublished}
                  onChange={(e) => {
                    setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') });
                    if (formErrors.slug) {
                      setFormErrors({ ...formErrors, slug: undefined });
                    }
                  }}
                  placeholder="smart-recycler"
                  required
                />
                {isPublished && (
                  <p className="text-xs text-muted-foreground">
                    Slug is locked while published. Save as draft to change it.
                  </p>
                )}
                {formErrors.slug && (
                  <p className="text-xs text-destructive">{formErrors.slug}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                placeholder="https://smartrecycler.co.uk/"
              />
              <p className="text-xs text-muted-foreground">
                Optional. The partner&apos;s public website, shown in the admin list for reference only.
              </p>
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="partnerUserId">Linked partner account</RequiredLabel>
              <Select
                value={form.partnerUserId || 'none'}
                onValueChange={(value) => setForm({ ...form, partnerUserId: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="partnerUserId">
                  <SelectValue placeholder="Select active partner user" />
                </SelectTrigger>
                <SelectContent className="z-[200]" position="popper" side="bottom" sideOffset={4}>
                  <SelectItem value="none">No partner linked</SelectItem>
                  {partnerUsers.map((partnerUser) => (
                    <SelectItem key={partnerUser.id} value={partnerUser.id}>
                      {partnerUser.organisationName} ({partnerUser.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Required before the referral page can go live.</p>
              {partnerUsers.length === 0 && (
                <p className="text-xs text-amber-700">No active partner accounts found. Create and activate a partner user in Users first.</p>
              )}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="logo">Logo</RequiredLabel>
              <div className="flex items-start gap-3">
                <input
                  ref={logoInputRef}
                  id="logo"
                  type="file"
                  className="hidden"
                  accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
                  onChange={(e) => void handleLogoSelect(e.target.files?.[0] || null)}
                />
                {!hasLogo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Upload logo"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remove logo"
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {logoPreviewSrc && (
                  <div className="flex min-h-10 flex-1 items-center rounded-md border p-3">
                    <img
                      src={logoPreviewSrc}
                      alt="Logo preview"
                      className="h-10 w-auto max-w-full object-contain"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                SVG, PNG, or WebP. Max 2 MB. Aspect ratio 1:1 to 6:1 (width to height).
              </p>
              {logoError && (
                <Alert variant="destructive">
                  <AlertDescription>{logoError}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleDraft} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save draft'}
              </Button>
              <Button onClick={handlePublish} disabled={saveMutation.isPending}>
                Publish
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[95vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden">
          <div className="relative shrink-0 border-b border-amber-200 bg-amber-50">
            <p className="px-4 py-2 pr-12 text-xs leading-snug text-amber-900">{previewMessage}</p>
            <DialogClose className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-sm bg-amber-50 p-1.5 text-amber-900 opacity-90 ring-offset-background transition-opacity hover:bg-amber-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {previewBranding && (
              <SignupLink
                role="client"
                referralPartner={previewBranding}
                previewMode
                hidePreviewBanner
                embeddedPreview
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish referral page?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will make the signup page publicly available at:
                </p>
                <p className="font-mono text-foreground">
                  {signupBaseUrl}/{form.slug || 'your-slug'}
                </p>
                <p>
                  New clients who sign up through this link will be linked to the selected partner account.
                  You can unpublish later by saving as draft.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                saveMutation.mutate(true);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Publishing...' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpublishConfirmOpen} onOpenChange={setUnpublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish referral page?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will take the signup page offline at:
                </p>
                <p className="font-mono text-foreground">
                  {signupBaseUrl}/{form.slug || editing?.slug}
                </p>
                <p>New visitors will not be able to sign up until you publish again.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                saveMutation.mutate(false);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save as draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete referral partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the signup page for {deleteTarget?.displayName}. Existing referred clients are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
