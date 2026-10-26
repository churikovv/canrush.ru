import Link from '@/components/navigation-progress';

/**
 * In place of a composer for guests: what signing in gives here and one clear «Войти» button, instead of a grey
 * sentence with a link. `compact` sits inside a review's discussion.
 */
export function SignInPrompt({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return <div className="signin-prompt" data-compact={compact || undefined}>
    <span className="signin-prompt-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
    </span>
    <div className="signin-prompt-text">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
    <Link className="signin-prompt-button" href="/sign-in">Войти</Link>
  </div>;
}
