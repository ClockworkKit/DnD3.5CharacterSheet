/** Mechanical entries transcribed from Ultimate SRD's monk/ranger class pages. */
export type MonkStyle={name:string,skill:string,feats:[string,string,string],bonus:string,requirements:string};
export const monkStyles:MonkStyle[]=[
 {name:'Buddhist Monk',skill:'Sense Motive',feats:['Iron Will','Combat Expertise','Intuitive Attack'],bonus:'Still mind increases to +5 against enchantments.',requirements:'Lawful good; Concentration 5 ranks and Sense Motive 9 ranks at monk 6.'},
 {name:'Cobra Strike',skill:'Escape Artist',feats:['Dodge','Mobility','Spring Attack'],bonus:'Dodge grants +2 AC against the designated target.',requirements:'Balance 4 ranks and Escape Artist 9 ranks at monk 6.'},
 {name:'Denying Stance',skill:'Tumble',feats:['Improved Grapple','Combat Reflexes','Improved Disarm'],bonus:'+2 grapple and disarm checks while fighting defensively or using Combat Expertise.',requirements:'Tumble 9 ranks and Combat Expertise at monk 6.'},
 {name:'Franciscan Friar',skill:'Heal',feats:['Self-Sufficient','Vow of Chastity','Diehard'],bonus:'Cure light wounds, purify food and drink, and remove disease each once daily; caster level half monk level.',requirements:'Lawful good; Heal 4 ranks and Survival 4 ranks at monk 6.'},
 {name:'Hand and Foot',skill:'Balance',feats:['Stunning Fist','Deflect Arrows','Improved Trip'],bonus:'+2 attacks of opportunity against bull rush/trip attempts; +4 Strength or Dexterity to resist them.',requirements:'Balance 9 ranks and Tumble 4 ranks at monk 6.'},
 {name:'Invisible Eye',skill:'Listen',feats:['Combat Reflexes','Lightning Reflexes','Blind-Fight'],bonus:'+1 defensive dodge AC while unarmed and fighting defensively, using Combat Expertise, or using total defense.',requirements:'Listen 9 ranks and Agile at monk 6.'},
 {name:'Knight Hospitaller',skill:'Spot',feats:['Weapon Focus','Combat Expertise','Weapon Specialization'],bonus:'Share Combat Expertise AC with one adjacent ally who is not using Combat Expertise.',requirements:'Spot 9 ranks and Combat Reflexes at monk 6; select the weapon for both granted weapon feats.'},
 {name:'Kyokushinkai Karate',skill:'Survival',feats:['Endurance','Toughness','Weapon Focus (Unarmed strike)'],bonus:'+6 hit points.',requirements:'Concentration 9 ranks and Diehard at monk 6.'},
 {name:'Metered Style',skill:'Concentration',feats:['Defensive Metered Foot','Offensive Metered Foot','Toughness'],bonus:'Take 10 on Strength/Dexterity skills even with distractions.',requirements:'Concentration 9 ranks and Skill Focus in a Strength/Dexterity skill at monk 6.'},
 {name:'Overwhelming Attack',skill:'Intimidate',feats:['Power Attack','Improved Bull Rush','Improved Overrun'],bonus:'+4 Strength to bull rush or overrun a target you demoralized within 10 rounds.',requirements:'Intimidate 4 ranks and Perform (dance) 4 ranks at monk 6.'},
 {name:'Passive Way',skill:'Bluff',feats:['Combat Expertise','Improved Trip','Improved Feint'],bonus:'+4 Strength to trip a target denied Dexterity to AC.',requirements:'Bluff 4 ranks, Sense Motive 4 ranks, and Skill Focus (Bluff) at monk 6.'},
 {name:'Sacred Path of Heironeous',skill:'Diplomacy',feats:['Endurance','Negotiator','Weapon Specialization (Longsword)'],bonus:'Longsword becomes a special monk weapon for flurry.',requirements:'Deity alignment; Diplomacy 4 ranks and longsword proficiency at monk 6.'},
 {name:'Sacred Path of Hextor',skill:'Intimidate',feats:['Endurance','Persuasive','Weapon Specialization (Flail)'],bonus:'Flail becomes a special monk weapon for flurry.',requirements:'Deity alignment; Intimidate 4 ranks and flail proficiency at monk 6.'},
 {name:'Sacred Path of Moradin',skill:'Balance',feats:['Improved Sunder','Cleave','Diehard'],bonus:'Warhammer sunder damage increases by half monk level.',requirements:'Deity alignment; Balance 9 ranks and warhammer proficiency at monk 6.'},
 {name:'Sacred Path of St. Cuthbert',skill:'Survival',feats:['Track','Alertness','Power Attack'],bonus:'A natural 20 attack marks its target: −1 AC and saves for half monk level rounds.',requirements:'Deity alignment; Survival 4 ranks and Spot 9 ranks at monk 6.'},
 {name:'Sacred Path of Wee Jas',skill:'Use Magic Device',feats:['Improved Initiative','Skill Focus (Use Magic Device)','Blind-Fight'],bonus:'Use Magic Device bonus equal to half monk level.',requirements:'Deity alignment; Use Magic Device 4 ranks and Knowledge (religion) 9 ranks at monk 6.'},
 {name:'Sacred Path of Yondalla',skill:'Jump',feats:['Improved Initiative','Weapon Finesse','Mobility'],bonus:'+1 saves after using flurry, until the next turn.',requirements:'Deity alignment; Jump 9 ranks and Dodge at monk 6.'},
 {name:'Shinto Monk',skill:'Knowledge (nature)',feats:['Animal Affinity','Vow of Purity',"Nymph's Kiss"],bonus:'Animal companion at one-third monk level, stacking with other companion classes.',requirements:'Handle Animal 4 ranks and Knowledge (nature) 4 ranks at monk 6.'},
 {name:'Sleeping Tiger',skill:'Hide',feats:['Weapon Finesse','Improved Initiative','Improved Sunder'],bonus:'Once per round, +1d6 light melee weapon damage against a target denied Dexterity; precision immunity applies.',requirements:'Hide 9 ranks and Power Attack at monk 6.'},
 {name:'Undying Way',skill:'Concentration',feats:['Toughness','Endurance','Diehard'],bonus:'DR 2/— while fighting defensively, using Combat Expertise, or using total defense.',requirements:'Concentration 9 ranks at monk 6.'},
 {name:'Way of the Shackled Beast',skill:'Jump',feats:['Fear No Binds','Beast Strike','Disruptive Strike'],bonus:'Use flurry at the end of a successful charge.',requirements:'Shifter; Jump 9 ranks and Two-Weapon Fighting at monk 6.'},
 {name:'Wing Chun Kuen',skill:'Listen',feats:['Combat Reflexes','Cleave','Improved Critical (Unarmed strike)'],bonus:'Add positive Wisdom modifier to initiative when not surprised.',requirements:'Listen 9 ranks and Improved Initiative at monk 6.'},
 {name:'Wushu',skill:'Tumble',feats:['Improved Initiative','Power Attack','Improved Feint'],bonus:'Add half monk level to Bluff checks to feint.',requirements:'Bluff 4 ranks and Sense Motive 9 ranks at monk 6.'},
];
export const rangerStyles:Record<string,[string,string,string]>={
 'Beast-Wrestling':['Improved Unarmed Strike','Improved Grapple','Stunning Fist'],
 'Mounted Combat':['Ride-By Attack','Spirited Charge','Trample'],
 Piscator:['Exotic Weapon Proficiency (Net)','Improved Trip','Improved Critical'],
 'Strong-Arm':['Power Attack','Improved Sunder','Great Cleave'],
 Throwing:['Quick Draw','Point Blank Shot','Far Shot'],
};
export const clericPaths=['Cultist','Evangelist','Fanatic','Healer','Justicar','Mystic','Relic Hunter','Sage','Scribe','Shaman','Theologian','Wanderer','Warrior Priest','Weaponmaster'];
