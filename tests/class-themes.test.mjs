import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {baseClasses} from '../lib/classes.ts';
import {themeCatalog,resolveTheme,themeStorageKey} from '../lib/themes.ts';
const bootstrap=readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');

test('every base class has exactly one unique palette and legacy themes remain available',()=>{
 const classes=themeCatalog.filter(t=>'classId' in t);
 assert.equal(classes.length,baseClasses.length);assert.equal(new Set(classes.map(t=>t.classId)).size,baseClasses.length);
 assert.equal(new Set(classes.map(t=>[t.hue,t.accent,t.mode].join(':'))).size,classes.length);
 for(const c of baseClasses)assert.ok(classes.some(t=>t.classId===c.id&&t.label.startsWith(c.name+' · ')));
 for(const id of ['parchment','amethyst','classic'])assert.equal(resolveTheme(id).id,id);
 assert.equal(resolveTheme('invalid').id,'parchment');
 execFileSync(process.execPath,['scripts/build-class-themes.mjs','--check'],{cwd:new URL('../',import.meta.url)});
});

test('every saved theme restores before paint with the right native control scheme',()=>{
 for(const theme of themeCatalog){const root={dataset:{},style:{}};runInNewContext(bootstrap,{document:{documentElement:root},localStorage:{getItem:key=>{assert.equal(key,themeStorageKey);return theme.id;}}});assert.equal(root.dataset.theme,theme.id);assert.equal(root.style.colorScheme,theme.mode);}
});

test('invalid preferences and blocked storage leave the default theme usable',()=>{
 for(const value of [null,'unknown','__proto__','constructor']){const root={dataset:{},style:{}};runInNewContext(bootstrap,{document:{documentElement:root},localStorage:{getItem:()=>value}});assert.equal(root.dataset.theme,undefined);}
 assert.doesNotThrow(()=>runInNewContext(bootstrap,{localStorage:{getItem:()=>{throw Error('blocked')}},document:{documentElement:{dataset:{},style:{}}}}));
});
