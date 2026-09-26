import classThemes from './class-themes.json' with {type:'json'};
export const themeStorageKey='barrow-ledger:theme:v1';
export const themeCatalog=[
 {id:'parchment',label:'Parchment',mode:'light'},
 {id:'amethyst',label:'Amethyst · dark purple',mode:'dark'},
 {id:'classic',label:'Classic 3.5 · black & white',mode:'light'},
 ...classThemes,
];
export const findTheme=(id:string|null)=>themeCatalog.find(t=>t.id===id);
export const resolveTheme=(id:string|null)=>findTheme(id)||themeCatalog[0];
