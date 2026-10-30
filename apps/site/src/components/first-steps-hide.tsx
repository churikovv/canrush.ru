'use client';
import { useFormStatus } from 'react-dom';
import { hideFirstStepsAction } from '@/app/first-steps-actions';

function HideButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="first-steps-hide" disabled={pending}>{pending ? 'Скрываем…' : 'Скрыть'}</button>;
}

export function FirstStepsHide() {
  return <form action={hideFirstStepsAction}><HideButton /></form>;
}
