import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';
import { useAuthStore } from '../stores/useAuthStore';
import RailShell from '../components/firstrun/RailShell';
import { ErrorLine, Field, PlateHeading, PrimaryButton, apiError } from '../components/firstrun/parts';
import { InviteStrip, inviteCodeFrom, useInvitePreview } from '../components/firstrun/InviteContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from ?? null;
  const from = fromState || '/channels';
  const invite = useInvitePreview(inviteCodeFrom(fromState));
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { accessToken, user } = await authApi.login(form);
      setAuth(user, accessToken, from);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err, "We couldn't sign you in. Check your connection and try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const register = (
    <>
      <span className="hidden sm:inline">New to Camp? </span>
      <Link to="/register" state={fromState ? { from: fromState } : undefined} className="fr-link text-fg">
        Create an account
      </Link>
    </>
  );

  return (
    <RailShell
      steps={[
        { label: 'Sign in', state: 'current' },
        { label: 'Your servers', state: 'pending' },
      ]}
      aside={register}
    >
      {invite && <InviteStrip preview={invite} />}
      <PlateHeading title="Welcome back" lede="Sign in to pick up where your servers left off." />
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Your password"
          required
          autoComplete="current-password"
          labelAside={
            <Link to="/forgot-password" className="fr-link text-sm text-fg normal-case tracking-normal">
              Forgot password?
            </Link>
          }
        />
        <div className="pt-2">
          {error && <div className="mb-4"><ErrorLine>{error}</ErrorLine></div>}
          <PrimaryButton type="submit" disabled={isLoading} busy={isLoading} busyLabel="Signing in">
            Sign in
          </PrimaryButton>
        </div>
      </form>
    </RailShell>
  );
}
