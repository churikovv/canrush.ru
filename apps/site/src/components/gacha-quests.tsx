'use client';
import { CapIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import type { QuestBoard, QuestClaim, QuestRow } from '@/lib/gacha-quests-fields';

const CHECK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const ARROW = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;

function Prize({ reward }: { reward: number }) {
  return <span className="quest-prize" aria-label={`Награда: ${reward} крышек`}><CapIcon size={18} />+{reward}</span>;
}

function Row({ row, busy, onClaim }: { row: QuestRow; busy: boolean; onClaim: (claim: QuestClaim) => void }) {
  const state = row.claimed ? 'claimed' : row.done ? 'ready' : 'open';
  // A finished task needs no hint: the narrow row goes to «Забрать».
  const text = <><strong>{row.title}</strong>{state !== 'ready' && <small>{row.goal > 1 && !row.done ? `${row.count} из ${row.goal} · ` : ''}{row.hint}</small>}</>;
  return <li className="quest" data-state={state}>
    <Prize reward={row.reward} />
    {/* The whole row leads to where the task is done, while there is something to do. */}
    {state === 'open' && row.href ? <Link className="quest-text" href={row.href}>{text}</Link> : <span className="quest-text">{text}</span>}
    {state === 'claimed' ? <span className="quest-mark" role="img" aria-label="Награда получена">{CHECK}</span>
      : state === 'ready' ? <button type="button" className="quest-claim" disabled={busy} onClick={() => onClaim(row.key)}>Забрать</button>
      : row.href ? <span className="quest-go" aria-hidden="true">{ARROW}</span> : null}
    {row.goal > 1 && <span className="quest-bar" aria-hidden="true"><span style={{ transform: `scaleX(${row.count / row.goal})` }} /></span>}
  </li>;
}

/**
 * The day's tasks in their game window: what is done is counted from real actions, a reward is taken with «Забрать»,
 * and with all of them taken the bonus opens. The server decides, this only shows the answer.
 */
export function GachaQuests({ board, busy, onClaim }: { board: QuestBoard; busy: boolean; onClaim: (claim: QuestClaim) => void }) {
  const { rows, bonus } = board;
  return <div className="quests">
    <ol className="quests-list">{rows.map(row => <Row key={row.key} row={row} busy={busy} onClaim={onClaim} />)}</ol>
    <div className="quest-bonus" data-state={bonus.claimed ? 'claimed' : bonus.ready ? 'ready' : 'open'}>
      <Prize reward={bonus.reward} />
      <span className="quest-text"><strong>Все задания дня</strong>{!(bonus.ready && !bonus.claimed) && <small>{bonus.claimed ? 'Новые задания завтра' : 'Бонус за все награды дня'}</small>}</span>
      {bonus.claimed ? <span className="quest-mark" role="img" aria-label="Бонус получен">{CHECK}</span>
        : bonus.ready ? <button type="button" className="quest-claim" disabled={busy} onClick={() => onClaim('all')}>Забрать</button> : null}
    </div>
  </div>;
}
