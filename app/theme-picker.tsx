'use client';
import {useSyncExternalStore} from 'react';
import {Choice} from './sheet-ui';

import {themeCatalog,themeStorageKey,findTheme,resolveTheme} from '@/lib/themes';
const themes:Array<[string,string]>=themeCatalog.map(t=>[t.id,t.label]);
const key=themeStorageKey;
const valid=(value:string|null):value is string=>!!findTheme(value);
const changeEvent='BarrowThemeChanged';
function apply(value:string){document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=resolveTheme(value).mode}
function snapshot():string {const value=document.documentElement.dataset.theme||null;return valid(value)?value:'parchment'}
function subscribe(notify:()=>void){
  const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null){if(event.storageArea&&event.storageArea!==localStorage)return;let value=event.newValue;if(event.key===null){try{value=localStorage.getItem(key)}catch{value=null}}apply(resolveTheme(value).id);notify()}};
  window.addEventListener('storage',sync);window.addEventListener(changeEvent,notify);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener(changeEvent,notify)};
}

export function ThemePicker(){
  const theme=useSyncExternalStore(subscribe,snapshot,()=>'parchment');
  return <div className="theme-picker"><Choice label="Page theme" value={theme} options={themes} onChange={value=>{if(!valid(value))return;apply(value);try{localStorage.setItem(key,value)}catch{/* The selected theme still works for this visit. */}window.dispatchEvent(new Event(changeEvent))}}/></div>;
}
