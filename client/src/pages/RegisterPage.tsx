import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../services/api/auth.api';
import { useAuthStore } from '../stores/useAuthStore';

const OTP_LENGTH = 6;

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { email: returnedEmail } = await authApi.register(form);
      setEmail(returnedEmail);
      setStep('verify');
      setResendCooldown(60);
      startCooldown();
      toast.success('Verification code sent to your email');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) clearInterval(interval);
        return c - 1;
      });
    }, 1000);
  };

  const focusInput = (i: number) => inputRefs.current[i]?.focus();

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      const next = [...digits];
      chars.forEach((c, i) => { if (index + i < OTP_LENGTH) next[index + i] = c; });
      setDigits(next);
      focusInput(Math.min(index + chars.length, OTP_LENGTH - 1));
      return;
    }
    const char = value.replace(/\D/g, '');
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < OTP_LENGTH - 1) focusInput(index + 1);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) { toast.error('Please enter 6 digits'); return; }
    setIsLoading(true);
    try {
      const { accessToken, user } = await authApi.verifyRegistration(email, code);
      setAuth(user, accessToken);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Verification failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await authApi.resendRegistrationOtp(email);
      toast.success('Verification code resent');
      startCooldown();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to resend code';
      toast.error(message);
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-2xl mb-4">
              <span className="text-white text-2xl font-bold">C</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Verify your email</h1>
            <p className="text-[#80848E] mt-1">
              We sent a code to <span className="text-[#B5BAC1]">{email}</span>
            </p>
          </div>

          <div className="bg-layer-2 rounded-lg p-8 shadow-xl">
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <p className="text-[#B5BAC1] text-sm mb-4">
                  Didn't receive code?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-accent-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend after ${resendCooldown}s` : 'Resend code'}
                  </button>
                </p>
                <div className="flex justify-center gap-2">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="input w-12 h-12 text-center text-lg font-semibold"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length !== OTP_LENGTH}
                className="btn-primary w-full py-2.5 text-base"
              >
                {isLoading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </form>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => { setStep('form'); setDigits(Array(OTP_LENGTH).fill('')); }}
                className="text-[#80848E] text-sm hover:text-[#B5BAC1] cursor-pointer"
              >
                Back to registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create an account</h1>
          <p className="text-[#80848E] mt-1">Join Camp today</p>
        </div>

        <div className="bg-layer-2 rounded-lg p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="input" placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Display Name</label>
              <input type="text" name="displayName" value={form.displayName} onChange={handleChange} className="input" placeholder="Your name" required maxLength={32} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Username</label>
              <input type="text" name="username" value={form.username} onChange={handleChange} className="input" placeholder="your_username" required minLength={2} maxLength={32} />
              <p className="text-[#5C5F66] text-xs mt-1">Only letters, numbers, dots, and underscores</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className="input" placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-base mt-2">
              {isLoading ? 'Sending verification...' : 'Continue'}
            </button>
          </form>

          <p className="text-[#80848E] text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
