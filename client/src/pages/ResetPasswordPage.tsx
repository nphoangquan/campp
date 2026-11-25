import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { authApi } from '../services/api/auth.api';
import RailShell from '../components/firstrun/RailShell';
import { ErrorLine, Field, PlateHeading, PrimaryButton, apiError } from '../components/firstrun/parts';
import { backToSignIn, resetSteps } from '../components/firstrun/resetFlow';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, code } = (location.state as { email?: string; code?: string } | null) ?? {};
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;
    if (form.newPassword.length < 8) {
      setErrors({ newPassword: 'Passwords need at least 8 characters.' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: "These passwords don't match." });
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, code, form.newPassword);
      toast.success('Password changed. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors({ form: apiError(err, "We couldn't change your password. Your code may have expired; request a new one.") });
    } finally {
      setIsLoading(false);
    }
  };

  if (!email || !code) {
    return (
      <RailShell steps={resetSteps(2)} aside={backToSignIn}>
        <PlateHeading
          title="Start again"
          lede="This reset link has lost its code, usually after a page refresh. Request a new code to continue."
        />
        <Link to="/forgot-password" className="fr-btn no-underline">
          <span>Request a new code</span>
          <ArrowRight aria-hidden="true" className="w-5 h-5 shrink-0" />
        </Link>
      </RailShell>
    );
  }

  return (
    <RailShell steps={resetSteps(2)} aside={backToSignIn}>
      <PlateHeading title="Choose a new password" lede={<>For <span className="font-semibold text-fg break-all">{email}</span>.</>} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="New password"
          type="password"
          name="newPassword"
          value={form.newPassword}
          onChange={handleChange}
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
          error={errors.newPassword}
        />
        <Field
          label="Confirm password"
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Type it again"
          required
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
        <div className="pt-2">
          {errors.form && <div className="mb-4"><ErrorLine>{errors.form}</ErrorLine></div>}
          <PrimaryButton type="submit" disabled={isLoading} busy={isLoading} busyLabel="Saving">
            Save new password
          </PrimaryButton>
        </div>
      </form>
    </RailShell>
  );
}
