'use client';
import { useActionState, useState } from 'react';
import { createCampaignAction } from '@/app/admin/campaign-actions';
export function CampaignForm() {
  const [state,action,pending]=useActionState(createCampaignAction,{});
  return <form action={action} className="campaign-form">
    {[
      ['name','Название для админки','Посев в Telegram — октябрь'],
      ['path','Страница перехода','/catalog'],
      ['source','Источник · utm_source','telegram'],
      ['medium','Канал · utm_medium','paid_social'],
      ['campaign','Кампания · utm_campaign','october_launch'],
      ['content','Объявление · utm_content (необязательно)','post_1'],
      ['term','Ключевое слово · utm_term (необязательно)',''],
    ].map(([key,label,placeholder])=><label key={key}>{label}<input name={key} required={key!=='content'&&key!=='term'} maxLength={key==='path'?500:120} placeholder={placeholder} defaultValue={key==='path'?'/catalog':undefined} disabled={pending}/></label>)}
    <div className="campaign-form-footer"><button className="community-button" disabled={pending}>{pending?'Создаём…':'Создать UTM-ссылку'}</button>{state.error&&<p role="alert" className="field-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</div>
  </form>;
}
export function CampaignCopy({url}:{url:string}) {
  const [message,setMessage]=useState('');
  return <div className="campaign-copy"><input aria-label="UTM-ссылка кампании" value={url} readOnly onFocus={event=>event.target.select()}/><button className="community-button community-button-secondary" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('Ссылка скопирована');}catch{setMessage('Выделите ссылку и скопируйте вручную');}}}>Копировать</button><span role="status">{message}</span></div>;
}
