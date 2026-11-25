import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';
import RailShell from '../components/firstrun/RailShell';
import { ErrorLine, Field, PlateHeading, PrimaryButton, apiError } from '../components/firstrun/parts';
import { backToSignIn, resetSteps } from '../components/firstrun/resetFlow';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      navigate('/forgot-password/verify', { state: { email } });
    } catch (err) {
      setError(apiError(err, "We couldn't send a code right now. Try again in a minute."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RailShell steps={resetSteps(0)} aside={backToSignIn}>
      <PlateHeading
        title="Reset your password"
        lede="Enter the email you signed up with. If it has an account, we'll send it a 6-digit code."
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <div className="pt-2">
          {error && <div className="mb-4"><ErrorLine>{error}</ErrorLine></div>}
          <PrimaryButton type="submit" disabled={isLoading} busy={isLoading} busyLabel="Sending code">
            Email me a code
          </PrimaryButton>
        </div>
      </form>
    </RailShell>
  );
}
