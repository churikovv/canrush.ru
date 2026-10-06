import Link from '@/components/navigation-progress';
import { campaignStats } from '@/lib/campaigns';
import { campaignUrl } from '@/lib/campaign-fields';
import { CampaignForm, CampaignCopy } from './campaign-form';
export async function AdminCampaigns({days,page}:{days:number;page:number}) {
  const data=await campaignStats(days,page);
  const href=(next:number)=>`/admin?tab=campaigns&days=${days}&page=${next}`;
  return <>
    <section className="admin-data-panel"><div className="admin-panel-heading"><h2>Новая рекламная кампания</h2></div><p>Создайте отдельную ссылку для каждого размещения, чтобы сравнить источники.</p><CampaignForm/></section>
    <section className="admin-data-panel"><div className="admin-panel-heading"><h2>Рекламные кампании · {data.total}</h2><form method="get"><input type="hidden" name="tab" value="campaigns"/><label>Период переходов <select name="days" defaultValue={days}>{[[7,'7 дней'],[30,'30 дней'],[90,'90 дней'],[0,'Всё время']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label> <button className="community-button community-button-secondary">Показать</button></form></div>
      <p className="community-muted">Визит — переход в одном браузере в фиксированном 30-минутном интервале. Уникальные — браузеры, а не люди. Регистрация относится к первой кампании за 30 дней до создания аккаунта. Конверсия — доля браузеров с регистрацией среди уникальных.</p>
      <p className="community-muted">Период отбирает переходы; регистрации и действия этих пользователей учитываются до текущего момента. Учёт начинается после согласия на аналитические cookie, в том же браузере. Старые переходы, блокировщики, удаление cookie и переход между устройствами могут уменьшать точность.</p>
      {!data.items.length?<div className="admin-empty-result">Пока нет кампаний. Создайте первую UTM-ссылку выше.</div>:data.items.map(c=><article key={c.id} className="campaign-result">
        <h3>{c.name}</h3><p className="community-muted">{c.source} / {c.medium} / {c.campaign}{c.content?` · ${c.content}`:''}</p><CampaignCopy url={campaignUrl(c)}/>
        <dl className="campaign-metrics">{[
          ['Визиты',c.visits],['Уникальные',c.visitors],['Регистрации',c.registrations],['Конверсия',`${c.visitors?(c.converted/c.visitors*100).toFixed(1):'0'}%`],['Оставили отзыв',c.reviewers],['Опубликовали тирлист',c.publishers],
        ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </article>)}
      {data.total>25&&<nav className="admin-table-pagination" aria-label="Страницы кампаний">{data.page>1&&<Link href={href(data.page-1)}>Назад</Link>}<span>{data.page} / {Math.ceil(data.total/25)}</span>{data.page*25<data.total&&<Link href={href(data.page+1)}>Далее</Link>}</nav>}
    </section>
  </>;
}
