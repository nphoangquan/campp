import { Link } from 'react-router-dom';

export const RESET_STEPS = ['Email', 'Code', 'New password'] as const;

export function resetSteps(current: number) {
  return RESET_STEPS.map((label, i) => ({
    label,
    state: i < current ? ('done' as const) : i === current ? ('current' as const) : ('pending' as const),
  }));
}

export const backToSignIn = (
  <Link to="/login" className="fr-link text-fg">
    Back to sign in
  </Link>
);
