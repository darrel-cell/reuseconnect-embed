import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SignupLink from './SignupLink';
import { referralPartnersService } from '@/services/referral-partners.service';
import { Button } from '@/components/ui/button';

const ReferralSignup = () => {
  const { slug = '' } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['referral-partner-public', slug],
    queryFn: () => referralPartnersService.getPublic(slug),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f4]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f1f6f4] px-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Referral signup unavailable</h1>
        <p className="max-w-md text-slate-600">
          This referral page is not active yet or does not exist. Please contact your partner or Reuse Connect support.
        </p>
        <Button asChild>
          <Link to="/">Return home</Link>
        </Button>
      </div>
    );
  }

  return (
    <SignupLink
      role="client"
      referralPartner={{
        name: data.name,
        slug: data.slug,
        logo: data.logo || '',
      }}
    />
  );
};

export default ReferralSignup;
