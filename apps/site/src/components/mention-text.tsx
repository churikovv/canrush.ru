import Link from '@/components/navigation-progress';
import { splitMentions } from '@/lib/mentions';

/** Comment or post text with @mentions highlighted as profile links. */
export function MentionText({ text }: { text: string }) {
  return <>{splitMentions(text).map((part, index) => 'username' in part
    ? <Link key={index} className="mention-link" href={`/profile/${part.username}`}>{part.text}</Link>
    : part.text)}</>;
}
