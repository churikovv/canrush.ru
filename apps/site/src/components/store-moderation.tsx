'use client';
import { useActionState } from 'react';
import { moderateStoreAction } from '@/app/market/stores/actions';
export function StoreModeration({id,version}:{id:string;version:string}){
 const [state,action,pending]=useActionState(moderateStoreAction.bind(null,id,version),{});
 if(state.saved)return <p role="status">Решение сохранено.</p>;
 return <form action={action} className="store-moderation"><label>Комментарий автору<textarea name="note" maxLength={500} rows={2} disabled={pending}/></label>{state.error&&<p className="field-error" role="alert">{state.error}</p>}<div className="store-card-actions"><button className="community-button" name="status" value="published" disabled={pending}>Опубликовать</button><button className="community-button community-button-secondary" name="status" value="rejected" disabled={pending}>Вернуть на исправление</button></div></form>;
}
