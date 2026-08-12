import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldOff, LinkIcon } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { embedService, EmbedError } from '@/services/embed.service';
import { useReferralLogoSrc } from '@/hooks/useReferralLogoSrc';
import { ApiError } from '@/services/api-error';

/**
 * Three outcomes, three screens.
 *
 * The distinction matters because the remedies differ completely. An
 * unavailable account needs an administrator; a stale link just needs to be
 * reopened from the partner's portal. Showing one generic error for both leaves
 * the user with no idea which applies to them.
 */
type Outcome =
  | { kind: 'loading' }
  | { kind: 'blocked' }        // the account cannot be opened — speak to an administrator
  | { kind: 'link-problem'; message: string };  // the link is missing, stale or already used

/** Partner-branded shell shared by all three screens. */
function Frame({
  title,
  logoSrc,
  children,
}: {
  title: string;
  logoSrc: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      {logoSrc ? (
        <img src={logoSrc} alt={title} className="h-10 max-w-[200px] object-contain" />
      ) : null}
      {children}
      <p className="text-xs text-slate-400">Powered by ReuseConnect</p>
    </div>
  );
}

export default function EmbedBootstrap() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { establishEmbedSession, isAuthenticated, setPartner, partner } = useAuth();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'loading' });
  const [branding, setBranding] = useState<{
    displayName: string;
    logoUrl: string | null;
  } | null>(null);
  const logoSrc = useReferralLogoSrc(branding?.logoUrl || partner?.logoUrl);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!slug) {
        setOutcome({ kind: 'link-problem', message: 'This portal link is missing its partner reference.' });
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
        // Branding is optional for bootstrap; the exchange still validates.
      }

      const token = searchParams.get('token');
      if (!token) {
        if (isAuthenticated) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setOutcome({
          kind: 'link-problem',
          message: 'Open this page from your partner portal to sign in.',
        });
        return;
      }

      try {
        await establishEmbedSession(token);
        if (cancelled) return;
        // Strip the token from the URL so it cannot be reused from history.
        navigate('/dashboard', { replace: true });
      } catch (err) {
        if (cancelled) return;

        // An unavailable account is an administrative state, not a broken link —
        // the user needs to be told to ask someone, not to try again.
        if (err instanceof EmbedError && err.isAccountUnavailable) {
          setOutcome({ kind: 'blocked' });
          return;
        }

        const message =
          err instanceof EmbedError || err instanceof ApiError || err instanceof Error
            ? err.message
            : 'We could not open your portal session.';
        setOutcome({ kind: 'link-problem', message });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const title = branding?.displayName || partner?.displayName || 'Partner portal';

  if (outcome.kind === 'blocked') {
    return (
      <Frame title={title} logoSrc={logoSrc}>
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50">
            <ShieldOff className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            This account is not available
          </h1>
          {/* Deliberately says nothing about which account state caused this, or
              whether an account exists at all. */}
          <p className="text-sm text-slate-600">
            Your access to {title} has not been set up, or is no longer active.
          </p>
          <p className="text-sm font-medium text-slate-700">
            Please contact your administrator to have it reviewed.
          </p>
          {/* No retry button: retrying cannot change the outcome, and offering one
              would invite the user to keep trying instead of asking for help. */}
        </div>
      </Frame>
    );
  }

  if (outcome.kind === 'link-problem') {
    return (
      <Frame title={title} logoSrc={logoSrc}>
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-6"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
            <LinkIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            This portal link cannot be opened
          </h1>
          <p className="text-sm text-slate-600">{outcome.message}</p>
          <p className="text-sm text-slate-500">
            Portal links can only be used once. Return to {title} and open your
            portal again.
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame title={title} logoSrc={logoSrc}>
      <div className="flex items-center gap-2 text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Opening your portal…</span>
      </div>
    </Frame>
  );
}
