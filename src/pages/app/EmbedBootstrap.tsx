import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { embedService } from '@/services/embed.service';
import { useReferralLogoSrc } from '@/hooks/useReferralLogoSrc';
import { ApiError } from '@/services/api-error';

export default function EmbedBootstrap() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { establishEmbedSession, isAuthenticated, setPartner, partner } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<{
    displayName: string;
    logoUrl: string | null;
  } | null>(null);
  const logoSrc = useReferralLogoSrc(branding?.logoUrl || partner?.logoUrl);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!slug) {
        setError('Missing partner slug');
        return;
      }

      try {
        const publicPartner = await embedService.getPartner(slug);
        if (cancelled) return;
        setBranding({
          displayName: publicPartner.displayName,
          logoUrl: publicPartner.logoUrl,
        });
        setPartner({
          slug: publicPartner.slug,
          displayName: publicPartner.displayName,
          logoUrl: publicPartner.logoUrl,
        });
      } catch {
        // Branding is optional for bootstrap; exchange will still validate
      }

      const token = searchParams.get('token');
      if (!token) {
        if (isAuthenticated) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setError('Missing embed token. Open this page from your partner portal.');
        return;
      }

      try {
        await establishEmbedSession(token);
        if (cancelled) return;
        // Strip token from URL so it cannot be reused from history
        navigate('/dashboard', { replace: true });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to start embed session';
        setError(message);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const title = branding?.displayName || partner?.displayName || 'Partner portal';

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        {logoSrc ? (
          <img src={logoSrc} alt={title} className="h-10 max-w-[200px] object-contain" />
        ) : null}
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 max-w-md">{error}</p>
        <p className="text-xs text-slate-400">Powered by ReuseConnect</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6">
      {logoSrc ? (
        <img src={logoSrc} alt={title} className="h-10 max-w-[200px] object-contain" />
      ) : null}
      <div className="flex items-center gap-2 text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Opening your portal…</span>
      </div>
      <p className="text-xs text-slate-400">Powered by ReuseConnect</p>
    </div>
  );
}
