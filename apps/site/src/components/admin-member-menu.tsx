'use client';
import type { MouseEvent, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { blockUserAction, deleteUserAction, freezeUserAction, purgeUserCommentsAction, purgeUserTierListsAction, unblockUserAction, unfreezeUserAction } from '@/app/admin/actions';
import { TrashIcon } from '@/components/action-icons';
import { MoreActions } from '@/components/more-actions';

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const Snow = () => <svg {...icon}><path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" /></svg>;
const Ban = () => <svg {...icon}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>;
const Layers = () => <svg {...icon}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
const Bubble = () => <svg {...icon}><path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" /></svg>;
const Person = () => <svg {...icon}><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></svg>;

function Item({ children, confirm, danger, disabled }: { children: ReactNode; confirm?: string; danger?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const ask = (event: MouseEvent) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); };
  return <button className={`more-actions-item${danger ? ' is-danger' : ''}`} type="submit" role="menuitem" disabled={disabled || pending} onClick={ask}>{children}</button>;
}

/**
 * «⋯» of a member in «Участники»: clean up their tier lists or comments, freeze posting for a day, week or month, block,
 * and — administrators only — delete the account. Each item is a form for the admin actions (they redirect back with a
 * notice); the menu panel stays mounted while hidden, so the forms submit. Team members get no menu (protected).
 */
export function AdminMemberMenu({ member, context, canDelete }: {
  member: { id: string; label: string; username: string | null; blocked: boolean; frozen: boolean; tierLists: number; comments: number };
  context: { query: string; tab: string; page: number };
  canDelete: boolean;
}) {
  const hidden = <><input type="hidden" name="query" value={context.query} /><input type="hidden" name="tab" value={context.tab} /><input type="hidden" name="page" value={context.page} /><input type="hidden" name="userId" value={member.id} /></>;
  return <MoreActions label={`Действия с участником ${member.label}`}>
    {member.username && <a className="more-actions-item" role="menuitem" href={`/profile/${member.username}`} target="_blank" rel="noreferrer"><Person /><span>Открыть профиль</span></a>}
    <form action={purgeUserTierListsAction}>{hidden}<Item danger disabled={!member.tierLists} confirm={`Удалить все тирлисты ${member.label} (${member.tierLists}), включая черновики? Это нельзя отменить.`}><Layers /><span>Удалить все тирлисты{member.tierLists ? ` · ${member.tierLists}` : ''}</span></Item></form>
    <form action={purgeUserCommentsAction}>{hidden}<Item danger disabled={!member.comments} confirm={`Удалить все комментарии и записи стены ${member.label} (${member.comments})? Это нельзя отменить.`}><Bubble /><span>Удалить все комментарии{member.comments ? ` · ${member.comments}` : ''}</span></Item></form>
    {member.frozen
      ? <form action={unfreezeUserAction}>{hidden}<Item><Snow /><span>Разморозить</span></Item></form>
      : ([[1, 'на сутки'], [7, 'на неделю'], [30, 'на месяц']] as const).map(([days, label]) => <form key={days} action={freezeUserAction}>{hidden}<input type="hidden" name="days" value={days} />
        <Item confirm={`Заморозить ${member.label} ${label}? Писать, комментировать и публиковать он не сможет, профиль останется виден.`}><Snow /><span>Заморозить {label}</span></Item></form>)}
    <form action={member.blocked ? unblockUserAction : blockUserAction}>{hidden}<Item danger={!member.blocked} confirm={member.blocked ? undefined : `Заблокировать ${member.label}? Его записи и отзывы скроются, писать он не сможет.`}><Ban /><span>{member.blocked ? 'Разблокировать' : 'Заблокировать'}</span></Item></form>
    {canDelete && <form action={deleteUserAction}>{hidden}<Item danger confirm={`Удалить аккаунт ${member.label} со всеми отзывами, записями и опытом? Это нельзя отменить.`}><TrashIcon /><span>Удалить аккаунт</span></Item></form>}
  </MoreActions>;
}
