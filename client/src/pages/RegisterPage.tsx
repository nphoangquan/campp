import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';
import { useAuthStore } from '../stores/useAuthStore';
import RailShell, { type RailStep } from '../components/firstrun/RailShell';
import {
  CodeInput,
  ErrorLine,
  Field,
  OTP_LENGTH,
  PlateHeading,
  PrimaryButton,
  apiError,
  useCooldown,
} from '../components/firstrun/parts';
import { InviteStrip, inviteCodeFrom, useInvitePreview } from '../components/firstrun/InviteContext';

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const inviteCode = inviteCodeFrom(from);
  const invite = useInvitePreview(inviteCode);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [form, setForm] = useState({ email: '', displayName: '', username: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const cooldown = useCooldown();
  const code = digits.join('');

  const update = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => ({ ...fe, [name]: undefined }));
    setFormError(null);
  };

  const validate = () => {
    const fe: typeof fieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) fe.email = 'Enter an email address like you@example.com.';
    if (!form.displayName.trim()) fe.displayName = 'Add the name people will see.';
    if (!form.username) fe.username = 'Choose a username.';
    else if (!USERNAME_RE.test(form.username)) fe.username = 'Use only letters, numbers, dots and underscores.';
    else if (form.username.length < 2) fe.username = 'Usernames need at least 2 characters.';
    if (form.password.length < 8) fe.password = 'Passwords need at least 8 characters.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setFormError(null);
    try {
      const { email: returned } = await authApi.register(form);
      setEmail(returned);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCodeError(null);
      setResendNote(null);
      cooldown.restart(60);
      setStep('verify');
    } catch (err) {
      setFormError(apiError(err, "We couldn't create your account. Check your connection and try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setCodeError('Enter all 6 digits from the email.');
      return;
    }
    setIsLoading(true);
    setCodeError(null);
    try {
      const { accessToken, user } = await authApi.verifyRegistration(email, code);
      // An invite wins: go straight to it. Otherwise pick a first server.
      const next = inviteCode ? `/invite/${inviteCode}` : '/welcome';
      setAuth(user, accessToken, next);
      navigate(next, { replace: true });
    } catch (err) {
      setCodeError(apiError(err, "That code didn't work. Check the latest email, or send a new code."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown.left > 0) return;
    setResendNote(null);
    try {
      await authApi.resendRegistrationOtp(email);
      cooldown.restart(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCodeError(null);
      setResendNote(`New code sent to ${email}.`);
    } catch (err) {
      setCodeError(apiError(err, "We couldn't send a new code. Try again in a minute."));
    }
  };

  const steps: RailStep[] = [
    { label: 'Account', state: step === 'form' ? 'current' : 'done' },
    { label: 'Email code', state: step === 'verify' ? 'current' : 'pending' },
    { label: 'First server', state: 'pending' },
  ];

  const signIn = (
    <>
      <span className="hidden sm:inline">Have an account? </span>
      <Link to="/login" state={from ? { from } : undefined} className="fr-link text-fg">
        Sign in
      </Link>
    </>
  );

  return (
    <RailShell steps={steps} aside={signIn} plateKey={step}>
      {step === 'form' ? (
        <>
          {invite && <InviteStrip preview={invite} />}
          <PlateHeading
            title="Create your account"
            lede="One account for every server, channel and voice room you join on Camp."
          />
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 sm:gap-y-5">
            <Field
              className="sm:col-span-2"
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              placeholder="you@example.com"
              required
              autoComplete="email"
              error={fieldErrors.email}
            />
            <Field
              label="Display name"
              name="displayName"
              value={form.displayName}
              onChange={update}
              placeholder="Nguyễn Minh Anh"
              required
              maxLength={32}
              autoComplete="name"
              hint="Shown to others."
              error={fieldErrors.displayName}
            />
            <Field
              label="Username"
              name="username"
              value={form.username}
              onChange={update}
              placeholder="minhanh.ng"
              required
              minLength={2}
              maxLength={32}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              hint="a–z, 0–9, dots, underscores"
              error={fieldErrors.username}
            />
            <Field
              className="sm:col-span-2"
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={update}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <div className="sm:col-span-2 pt-2">
              {formError && <div className="mb-4"><ErrorLine>{formError}</ErrorLine></div>}
              <PrimaryButton type="submit" disabled={isLoading} busy={isLoading} busyLabel="Sending your code">
                Email me a code
              </PrimaryButton>
              <p className="mt-4 text-sm text-fg-3">We send a 6-digit code to confirm the address is yours.</p>
            </div>
          </form>
        </>
      ) : (
        <>
          <PlateHeading
            title="Check your email"
            lede={
              <>
                We sent a 6-digit code to <span className="font-semibold text-fg break-all">{email}</span>.
              </>
            }
          />
          <form onSubmit={handleVerify}>
            <CodeInput
              digits={digits}
              onChange={(d) => {
                setDigits(d);
                setCodeError(null);
              }}
              invalid={!!codeError}
              disabled={isLoading}
              describedBy={codeError ? 'code-error' : undefined}
            />
            {codeError && <ErrorLine id="code-error">{codeError}</ErrorLine>}
            {resendNote && !codeError && (
              <p role="status" className="mt-2 flex items-center gap-2 text-[15px] text-fg">
                <span aria-hidden="true" className="block w-3 border-t-2 border-fg" />
                {resendNote}
              </p>
            )}
            <div className="mt-8">
              <PrimaryButton
                type="submit"
                disabled={isLoading || code.length !== OTP_LENGTH}
                busy={isLoading}
                busyLabel="Checking code"
              >
                Verify and continue
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
            <button
              type="button"
              className="fr-link text-fg"
              onClick={() => {
                setStep('form');
                setCodeError(null);
              }}
            >
              Change email
            </button>
          </div>
        </>
      )}
    </RailShell>
  );
}
