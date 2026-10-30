import type { ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { FirstStepsHide } from '@/components/first-steps-hide';
import { NavigationIcon } from '@/components/navigation-icon';
import { CapIcon } from '@/components/gacha-icons';
import type { FirstStep } from '@/lib/first-steps';

const ICONS: Record<FirstStep['key'], ReactNode> = {
  gacha: <CapIcon size={20} />, dating: <NavigationIcon section="dating" />, drink: <NavigationIcon section="can" />, profile: <NavigationIcon section="profile" />,
};

function Check() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>;
}

function StepBody({ step }: { step: FirstStep }) {
  return <>
    <span className="first-steps-mark" aria-hidden="true">{step.done ? <Check /> : ICONS[step.key]}</span>
    <span className="first-steps-text">
      <strong>{step.title}{step.done && <span className="sr-only"> — готово</span>}</strong>
      {!step.done && (step.reward ? <small className="first-steps-reward">{step.reward}</small> : <small>{step.hint}</small>)}
    </span>
    {!step.done && <svg className="first-steps-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>}
  </>;
}

/** The newcomer's checklist on the home page, above the feed. Each step opens its place and ticks itself from real data (`getFirstSteps`). */
export function FirstSteps({ steps }: { steps: FirstStep[] }) {
  const done = steps.filter(step => step.done).length;
  return <section className="first-steps" aria-labelledby="first-steps-title">
    <div className="first-steps-head">
      <div><h2 id="first-steps-title">Первые шаги</h2><span>{done} из {steps.length} готово</span></div>
      <FirstStepsHide />
    </div>
    <div className="first-steps-bar" aria-hidden="true"><span style={{ width: `${done / steps.length * 100}%` }} /></div>
    <ol>{steps.map(step => <li key={step.key} data-done={step.done || undefined}>
      {step.done ? <div className="first-steps-row"><StepBody step={step} /></div> : <Link className="first-steps-row" href={step.href}><StepBody step={step} /></Link>}
    </li>)}</ol>
  </section>;
}
