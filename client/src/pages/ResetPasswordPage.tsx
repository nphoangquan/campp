import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../services/api/auth.api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, code } = (location.state as { email?: string; code?: string }) ?? {};
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) {
      toast.error('Invalid session. Please start again from forgot password.');
      navigate('/forgot-password');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Confirm password does not match');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, code, form.newPassword);
      toast.success('Password reset successfully');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Password reset failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!email || !code) {
    return (
      <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4">
        <div className="bg-layer-2 rounded-lg p-8 text-center">
          <p className="text-[#B5BAC1] mb-4">Invalid session. Please start again from forgot password.</p>
          <Link to="/forgot-password" className="text-accent-400 hover:underline">
            Forgot Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-layer-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-[#80848E] mt-1">Enter your new password</p>
        </div>

        <div className="bg-layer-2 rounded-lg p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                className="input"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 text-base mt-2"
            >
              {isLoading ? 'Processing...' : 'Reset Password'}
            </button>
          </form>

          <p className="text-[#80848E] text-sm mt-6 text-center">
            <Link to="/login" className="text-accent-400 hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
