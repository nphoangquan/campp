import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export function PlateHeading({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <div className="mb-6 md:mb-8">
      <h1 className="fr-display">{title}</h1>
      {lede && <p className="mt-3 text-base leading-relaxed text-fg-3 max-w-[42ch]">{lede}</p>}
    </div>
  );
}

/** Inline error line: a struck red mark plus the message, so colour is never the only signal. */
export function ErrorLine({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-2 text-[15px] leading-snug text-fg">
      <span aria-hidden="true" className="mt-[9px] block w-3 shrink-0 border-t-2 border-mention" />
      <span>{children}</span>
    </p>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  labelAside?: ReactNode;
}

export function Field({ label, hint, error, labelAside, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <label htmlFor={id} className="fr-label text-fg">
          {label}
        </label>
        {labelAside}
      </div>
      <input id={id} className="fr-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <ErrorLine id={errId}>{error}</ErrorLine>
      ) : (
        hint && (
          <p id={hintId} className="mt-2 text-sm text-fg-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  busy,
  busyLabel,
  ...rest
}: {
  children: ReactNode;
  busy?: boolean;
  busyLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="fr-btn" data-busy={busy || undefined} aria-busy={busy || undefined} {...rest}>
      <span>{busy && busyLabel ? busyLabel : children}</span>
      <ArrowRight aria-hidden="true" className="w-5 h-5 shrink-0" strokeWidth={2} />
    </button>
  );
}

export function apiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}

export const OTP_LENGTH = 6;

/**
 * Six boxes for the email code. Each digit's underline carries its state:
 * dashed while empty, solid once filled, a yellow bar under the active one,
 * red when the code was rejected.
 */
export function CodeInput({
  digits,
  onChange,
  invalid,
  disabled,
  describedBy,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[i]?.focus();

  const setAt = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = [...digits];
      clean
        .slice(0, OTP_LENGTH)
        .split('')
        .forEach((c, i) => {
          if (index + i < OTP_LENGTH) next[index + i] = c;
        });
      onChange(next);
      focus(Math.min(index + clean.length, OTP_LENGTH - 1));
      return;
    }
    const next = [...digits];
    next[index] = clean;
    onChange(next);
    if (clean && index < OTP_LENGTH - 1) focus(index + 1);
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next);
      focus(index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focus(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focus(index + 1);
    }
  };

  return (
    <div role="group" aria-label="6-digit email code" className="grid grid-cols-6 gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <div key={i} className="group relative">
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={OTP_LENGTH}
            value={d}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className="peer w-full h-16 bg-surface-2 text-fg text-center font-pixel text-[32px] tabular-nums rounded-[2px] border-0 outline-none focus:bg-fg caret-link disabled:opacity-60"
          />
          <span
            aria-hidden="true"
            className={[
              'absolute left-0 right-0 bottom-0 h-0 border-t-2 transition-colors',
              invalid ? 'border-solid border-mention' : d ? 'border-solid border-fg' : 'border-dashed border-fg-4',
              'peer-focus:border-t-[5px] peer-focus:border-solid peer-focus:border-tick-now',
            ].join(' ')}
          />
          <span aria-hidden="true" className="absolute inset-0 rounded-[2px] pointer-events-none peer-focus:ring-2 peer-focus:ring-fg" />
        </div>
      ))}
    </div>
  );
}

/** Seconds left before a code can be resent; restart() begins a new countdown. */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, restart: (seconds = 60) => setLeft(seconds) };
}
