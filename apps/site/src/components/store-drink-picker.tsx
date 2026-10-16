'use client';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { searchMatches } from '@/lib/search-match';
import type { StoreDrinkOption } from '@/lib/store-catalog';

const LIMIT = 40;
/** Combobox over catalog drinks; the last option adds the typed text as the author's own drink. */
export function StoreDrinkPicker({id,options,taken,disabled,onAdd}:{id:string;options:StoreDrinkOption[];taken:Set<string>;disabled?:boolean;onAdd:(drink:{name:string;brand?:string;flavor?:string})=>void}){
  const [query,setQuery]=useState('');const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);
  const input=useRef<HTMLInputElement>(null);
  const trimmed=query.trim();
  const matches=useMemo(()=>{
    const free=options.filter(option=>!taken.has(JSON.stringify([option.brand,option.flavor])));
    return (trimmed?free.filter(option=>searchMatches(option.label,trimmed)):free).slice(0,LIMIT);
  },[options,taken,trimmed]);
  const custom=trimmed.length>0&&trimmed.length<=150&&!matches.some(option=>option.label.toLocaleLowerCase('ru-RU')===trimmed.toLocaleLowerCase('ru-RU'));
  const count=matches.length+(custom?1:0);
  function choose(index:number){
    const option=matches[index];
    if(option)onAdd({name:option.label,brand:option.brand,flavor:option.flavor});
    else if(custom)onAdd({name:trimmed});
    else return;
    setQuery('');setActive(-1);input.current?.focus();
  }
  return <div className="price-filter-input store-drink-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
    <input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} disabled={disabled} maxLength={150}
      aria-activedescendant={open&&active>=0&&active<count?`${id}-option-${active}`:undefined}
      placeholder="Найдите энергетик или впишите свой" value={query}
      onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)}
      onChange={event=>{setQuery(event.target.value);setActive(-1);setOpen(true);}}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();setOpen(false);setActive(-1);}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);if(count)setActive(index=>index<0?(event.key==='ArrowDown'?0:count-1):(index+(event.key==='ArrowDown'?1:-1)+count)%count);}
        if(event.key==='Enter'){event.preventDefault();if(active>=0)choose(active);else if(matches.length===1)choose(0);else if(custom&&!matches.length)choose(0);}
      }}/>
    {open&&<div className="price-filter-popover store-drink-popover">
      <ul id={`${id}-options`} role="listbox" aria-label="Энергетики каталога">
        {matches.map((option,index)=><li key={option.label+option.flavor} id={`${id}-option-${index}`} role="option" aria-selected={false} className={index===active?'is-active':undefined}
          ref={element=>{if(index===active)element?.scrollIntoView({block:'nearest'});}} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}>
          <span className="price-filter-option-label">{option.cover?<Image src={option.cover} width={32} height={32} alt="" className="store-drink-cover"/>:<span className="store-drink-cover store-drink-cover-empty" aria-hidden="true"/>}{option.label}</span>
        </li>)}
        {custom&&<li id={`${id}-option-${matches.length}`} role="option" aria-selected={false} className={`store-drink-custom${active===matches.length?' is-active':''}`}
          onMouseDown={event=>event.preventDefault()} onClick={()=>choose(matches.length)}>
          <span className="price-filter-option-label"><span className="store-drink-cover store-drink-cover-add" aria-hidden="true">+</span>Добавить свой напиток «{trimmed}»</span>
        </li>}
      </ul>
      {!count&&<p role="status">{trimmed?'Ничего не найдено':'Начните вводить название'}</p>}
    </div>}
  </div>;
}
