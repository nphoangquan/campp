import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../services/api/auth.api';

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? '';
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      const next = [...digits];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
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
    if (!email) {
      toast.error('Missing email. Please start from forgot password.');
      navigate('/forgot-password');
      return;
    }
    if (code.length !== OTP_LENGTH) {
      toast.error('Please enter 6 digits');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.verifyOtp(email, code);
      toast.success('Code is valid');
      navigate('/forgot-password/reset', { state: { email, code } });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Code is invalid or expired';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (!email?.trim()) {
      toast.error('Missing email. Please start from forgot password.');
      navigate('/forgot-password');
      return;
    }
    try {
      await authApi.forgotPassword(email);
      toast.success('Verification code resent');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) clearInterval(interval);
          return c - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to resend code';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Verification Code</h1>
          <p className="text-[#80848E] mt-1">
            Verification code has been sent to your email.
          </p>
        </div>

        <div className="bg-layer-2 rounded-lg p-8 shadow-xl">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <p className="text-[#B5BAC1] text-sm mb-4">
                Not received code?{' '}
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
                    onChange={(e) => handleChange(i, e.target.value)}
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
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <div className="mt-6 flex justify-center">
            <Link to="/login" className="btn-danger py-2 px-4 text-sm">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
