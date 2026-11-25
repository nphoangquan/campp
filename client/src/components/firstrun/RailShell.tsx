import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AmbientField from './AmbientField';

export type StepState = 'done' | 'current' | 'pending';

export interface RailStep {
  label: string;
  state: StepState;
}

interface Props {
  steps: RailStep[];
  /** Top-right action, e.g. a link to sign in */
  aside?: ReactNode;
  /** Changing the key replays the plate's entrance */
  plateKey?: string;
  children: ReactNode;
}

/* Spacing between ticks on the rail; the plate drops by the same amount so
   its heading lines up with the current tick. */
const TICK_GAP = 64;

const STATE_WORD: Record<StepState, string> = { done: 'Done', current: 'Now', pending: 'Next' };

export function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-3 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
      aria-label="Camp home"
    >
      <span aria-hidden="true" className="flex items-center gap-2">
        <span className="block w-px h-7 bg-fg" />
        <span className="block w-4 h-[7px] border-y-2 border-tick-now" />
      </span>
      <span className="font-pixel text-[22px] leading-none tracking-[0.06em]">CAMP</span>
    </Link>
  );
}

export default function RailShell({ steps, aside, plateKey, children }: Props) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.state === 'current'));
  const current = steps[currentIndex];

  return (
    <div className="fr-root relative overflow-x-hidden isolate">
      <AmbientField />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 pt-7">
        <Wordmark />
        {aside && <div className="text-[15px] text-fg-4 [&_a]:text-fg">{aside}</div>}
      </header>

      <p className="sr-only" aria-live="polite">
        Step {currentIndex + 1} of {steps.length}: {current?.label}
      </p>

      {/* Narrow screens: the rail lies flat across the top */}
      <nav aria-label="Progress" className="relative z-10 md:hidden px-6 mt-5">
        <ol className="flex items-end gap-3 border-b border-line-strong pb-3">
          {steps.map((s) => (
            <li key={s.label} className="flex-1 min-w-0" aria-current={s.state === 'current' ? 'step' : undefined}>
              <span className="fr-tick mb-3" data-state={s.state} data-land={currentIndex > 0 || undefined} />
              <span className={`fr-label block truncate ${s.state === 'pending' ? 'text-fg-4' : 'text-fg'}`}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <main className="relative z-10 md:grid md:grid-cols-[minmax(220px,30%)_1px_1fr] md:min-h-[calc(100dvh-64px)]">
        {/* Desktop rail: labels left, the line, ticks crossing it */}
        <nav aria-label="Progress" className="hidden md:block relative">
          {/* Minor graduations along the rail */}
          <div aria-hidden="true" className="fr-graduations absolute right-0 top-[104px] bottom-10 w-[6px]" />

          <ol className="absolute right-0 top-[120px] w-full">
            {steps.map((s, i) => (
              <li
                key={s.label}
                className="absolute right-0 flex items-start gap-4"
                style={{ top: i * TICK_GAP }}
                aria-current={s.state === 'current' ? 'step' : undefined}
              >
                <span className="text-right">
                  <span className={`fr-label block ${s.state === 'pending' ? 'text-fg-4' : 'text-fg'}`}>
                    {s.label}
                  </span>
                  <span
                    className={`block mt-1 font-pixel text-[12px] tracking-[0.1em] uppercase ${
                      s.state === 'current' ? 'text-fg' : 'text-fg-4'
                    }`}
                  >
                    {STATE_WORD[s.state]}
                  </span>
                </span>
                <span className="fr-tick w-10 mt-[5px]" data-state={s.state} data-land={currentIndex > 0 || undefined} />
              </li>
            ))}
          </ol>
        </nav>

        <div aria-hidden="true" className="hidden md:block relative">
          <span className="absolute top-0 bottom-10 left-0 w-px bg-fg" />
          <span className="absolute bottom-10 left-1/2 -translate-x-1/2 translate-y-1/2 block w-[11px] h-[11px] rounded-full border-[1.5px] border-fg bg-bg" />
        </div>

        <div className="relative px-6 md:pl-0 md:pr-10 pt-5 md:pt-[62px] pb-16">
          <div
            className="relative md:max-w-[540px] md:mt-[var(--fr-drop)]"
            style={{ ['--fr-drop' as string]: `${currentIndex * TICK_GAP}px` }}
          >
            <section key={plateKey} className="fr-plate p-7 md:p-10">
              {children}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
