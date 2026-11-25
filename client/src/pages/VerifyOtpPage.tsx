import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { authApi } from '../services/api/auth.api';
import RailShell from '../components/firstrun/RailShell';
import {
  CodeInput,
  ErrorLine,
  OTP_LENGTH,
  PlateHeading,
  PrimaryButton,
  apiError,
  useCooldown,
} from '../components/firstrun/parts';
import { backToSignIn, resetSteps } from '../components/firstrun/resetFlow';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cooldown = useCooldown(60);
  const code = digits.join('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setError('Enter all 6 digits from the email.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authApi.verifyOtp(email, code);
      navigate('/forgot-password/reset', { state: { email, code } });
    } catch (err) {
      setError(apiError(err, "That code didn't work. Check the latest email, or send a new code."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown.left > 0) return;
    setNote(null);
    try {
      await authApi.forgotPassword(email);
      cooldown.restart(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError(null);
      setNote(`New code sent to ${email}.`);
    } catch (err) {
      setError(apiError(err, "We couldn't send a new code. Try again in a minute."));
    }
  };

  if (!email) {
    return (
      <RailShell steps={resetSteps(1)} aside={backToSignIn}>
        <PlateHeading title="Start again" lede="This page needs the email you're resetting. Enter it first and we'll send a code." />
        <Link to="/forgot-password" className="fr-btn no-underline">
          <span>Enter my email</span>
          <ArrowRight aria-hidden="true" className="w-5 h-5 shrink-0" />
        </Link>
      </RailShell>
    );
  }

  return (
    <RailShell steps={resetSteps(1)} aside={backToSignIn}>
      <PlateHeading
        title="Check your email"
        lede={
          <>
            If <span className="font-semibold text-fg break-all">{email}</span> has an account, a 6-digit code is on its way.
          </>
        }
      />
      <form onSubmit={handleVerify}>
        <CodeInput
          digits={digits}
          onChange={(d) => {
            setDigits(d);
            setError(null);
          }}
          invalid={!!error}
          disabled={isLoading}
          describedBy={error ? 'reset-code-error' : undefined}
        />
        {error && <ErrorLine id="reset-code-error">{error}</ErrorLine>}
        {note && !error && (
          <p role="status" className="mt-2 flex items-center gap-2 text-[15px] text-fg">
            <span aria-hidden="true" className="block w-3 border-t-2 border-fg" />
            {note}
          </p>
        )}
        <div className="mt-8">
          <PrimaryButton type="submit" disabled={isLoading || code.length !== OTP_LENGTH} busy={isLoading} busyLabel="Checking code">
            Verify code
          </PrimaryButton>
        </div>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[15px] text-fg-3">
        <span>
          No email?{' '}
          <button type="button" className="fr-link text-fg" onClick={handleResend} disabled={cooldown.left > 0}>
            {cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
          </button>
        </span>
        <Link to="/forgot-password" className="fr-link text-fg">
          Use another email
        </Link>
      </div>
    </RailShell>
  );
}
