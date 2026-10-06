import { expect, it } from 'vitest';
import { campaignInput, campaignUrl } from '../src/lib/campaign-fields';
const input={name:'Кампания',path:'/catalog',source:'telegram',medium:'paid_social',campaign:'осень',content:'post 1',term:''};
it('creates encoded same-site UTM links',()=>{
 const url=new URL(campaignUrl({...campaignInput(input),id:'abc'}));
 expect(url.origin).toBe('https://canrush.ru');
 expect(url.searchParams.get('utm_campaign')).toBe('осень');
 expect(url.searchParams.get('utm_content')).toBe('post 1');
 expect(url.searchParams.has('utm_term')).toBe(false);
});
it('rejects external, private and ambiguous landing URLs',()=>{
 for(const path of ['https://evil.com','//evil.com','/api/auth','/auth/confirm','/catalog?token=secret','/a/../admin','/\\evil.com','/catalog#x']) expect(()=>campaignInput({...input,path})).toThrow();
 expect(()=>campaignInput({...input,source:''})).toThrow();
 expect(()=>campaignInput({...input,name:'x'.repeat(121)})).toThrow();
});
