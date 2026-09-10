'use client';
import {useEffect,useState} from 'react';
import {Choice} from './sheet-ui';

type Theme = 'parchment'|'amethyst'|'classic';
const themes:Array<[Theme,string]>=[['parchment','Parchment'],['amethyst','Amethyst · dark purple'],['classic','Classic 3.5 · black & white']];
const key='barrow-ledger:theme:v1';
const valid=(value:string|null):value is Theme=>themes.some(([id])=>id===value);

export function ThemePicker(){
  const [theme,setTheme]=useState<Theme>('parchment');
  function apply(value:Theme){setTheme(value);document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value==='amethyst'?'dark':'light'}
  useEffect(()=>{let saved=document.documentElement.dataset.theme||null;try{saved=localStorage.getItem(key)||saved}catch{}if(valid(saved))apply(saved);const sync=(event:StorageEvent)=>{if(event.key===key)apply(valid(event.newValue)?event.newValue:'parchment')};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
  return <div className="theme-picker"><Choice label="Page theme" value={theme} options={themes} onChange={value=>{if(!valid(value))return;apply(value);try{localStorage.setItem(key,value)}catch{/* The selected theme still works for this visit. */}}}/></div>;
}
