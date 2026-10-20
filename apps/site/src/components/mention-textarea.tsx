'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref, type TextareaHTMLAttributes } from 'react';
import { mentionQuery } from '@/lib/mentions';

interface Suggestion { username: string; name: string; avatarId: string | null }
type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  ref?: Ref<HTMLTextAreaElement>;
};

const DELAY_MS = 150;
const cache = new Map<string, Suggestion[]>();

/** A textarea that suggests usernames while "@nick" is typed; Enter or Tab inserts the chosen one. */
export function MentionTextarea({ value, onValueChange, ref, onKeyDown, ...props }: Props) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const listId = useId();
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  // Answers keyed by query: the shown list is derived from the handle being typed, the effect only fetches.
  const [found, setFound] = useState<{ query: string; users: Suggestion[] } | null>(null);
  const [active, setActive] = useState(0);
  const query = token?.query ?? '';
  const items = !query ? [] : cache.get(query) ?? (found?.query === query ? found.users : []);

  const setRefs = (node: HTMLTextAreaElement | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  const read = () => {
    const node = own.current;
    const next = node ? mentionQuery(node.value, node.selectionStart ?? node.value.length) : null;
    if (next?.query !== token?.query) setActive(0);
    setToken(next);
  };

  useEffect(() => {
    if (!query || cache.has(query)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/mentions?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() as Promise<{ users: Suggestion[] }> : { users: [] })
        .then(({ users }) => { cache.set(query, users); setFound({ query, users }); })
        .catch(() => {});
    }, DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const open = items.length > 0;
  function choose(item: Suggestion) {
    const node = own.current;
    if (!node || !token) return;
    const caret = node.selectionStart ?? value.length;
    const insert = `@${item.username} `;
    onValueChange(value.slice(0, token.start) + insert + value.slice(caret));
    setToken(null);
    const position = token.start + insert.length;
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(position, position); });
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(index => (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && items[active]) { event.preventDefault(); choose(items[active]); return; }
      if (event.key === 'Escape') { event.preventDefault(); setToken(null); return; }
    }
    onKeyDown?.(event);
  }

  return <span className="mention-field">
    <textarea {...props} ref={setRefs} value={value}
      onChange={event => { onValueChange(event.target.value); read(); }}
      onKeyDown={handleKeyDown} onKeyUp={read} onClick={read}
      onBlur={event => { props.onBlur?.(event); setTimeout(() => setToken(null), 120); }}
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined} />
    {open && <ul className="mention-suggestions" id={listId} role="listbox" aria-label="Упомянуть участника">
      {items.map((item, index) => <li key={item.username} id={`${listId}-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => { event.preventDefault(); choose(item); }} onMouseEnter={() => setActive(index)}>
        <span className="mention-suggestion-avatar">{item.avatarId ? <Image src={`/api/profile-images/${item.avatarId}`} width={28} height={28} unoptimized alt="" /> : item.username[0]?.toUpperCase()}</span>
        <span className="mention-suggestion-name"><strong>@{item.username}</strong>{item.name && !item.name.includes('@') && item.name.toLowerCase() !== item.username && <small>{item.name}</small>}</span>
      </li>)}
    </ul>}
  </span>;
}
