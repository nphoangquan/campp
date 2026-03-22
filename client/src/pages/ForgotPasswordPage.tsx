import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../services/api/auth.api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      toast.success('If an account exists with this email, you will receive a verification code shortly.');
      navigate('/forgot-password/verify', { state: { email } });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to send verification code. Please try again later.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
          <p className="text-[#80848E] mt-1">Enter your email to receive a verification code</p>
        </div>

        <div className="bg-layer-2 rounded-lg p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 text-base mt-2"
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>

          <p className="text-[#80848E] text-sm mt-6">
            <Link to="/login" className="text-accent-400 hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
