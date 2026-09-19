'use client';
import {useSyncExternalStore} from 'react';
import {Choice} from './sheet-ui';

type Theme = 'parchment'|'amethyst'|'classic';
const themes:Array<[Theme,string]>=[['parchment','Parchment'],['amethyst','Amethyst · dark purple'],['classic','Classic 3.5 · black & white']];
const key='barrow-ledger:theme:v1';
const valid=(value:string|null):value is Theme=>themes.some(([id])=>id===value);
const changeEvent='BarrowThemeChanged';
function apply(value:Theme){document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value==='amethyst'?'dark':'light'}
function snapshot():Theme {const value=document.documentElement.dataset.theme||null;return valid(value)?value:'parchment'}
function subscribe(notify:()=>void){
  const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null){apply(valid(event.newValue)?event.newValue:'parchment');notify()}};
  window.addEventListener('storage',sync);window.addEventListener(changeEvent,notify);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener(changeEvent,notify)};
}

export function ThemePicker(){
  const theme=useSyncExternalStore(subscribe,snapshot,()=>'parchment');
  return <div className="theme-picker"><Choice label="Page theme" value={theme} options={themes} onChange={value=>{if(!valid(value))return;apply(value);try{localStorage.setItem(key,value)}catch{/* The selected theme still works for this visit. */}window.dispatchEvent(new Event(changeEvent))}}/></div>;
}
