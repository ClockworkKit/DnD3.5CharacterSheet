export const psionDisciplines=['Seer','Shaper','Kineticist','Egoist','Nomad','Telepath'] as const;
export type PsionDiscipline=typeof psionDisciplines[number];

export const psionDisciplineRules:Record<PsionDiscipline,{school:string,skills:string[]}>={
 Seer:{school:'Clairsentience',skills:['Gather Information','Listen','Spot']},
 Shaper:{school:'Metacreativity',skills:['Bluff','Disguise','Use Psionic Device']},
 Kineticist:{school:'Psychokinesis',skills:['Autohypnosis','Disable Device','Intimidate']},
 Egoist:{school:'Psychometabolism',skills:['Autohypnosis','Balance','Heal']},
 Nomad:{school:'Psychoportation',skills:['Climb','Jump','Ride','Survival','Swim']},
 Telepath:{school:'Telepathy',skills:['Bluff','Diplomacy','Gather Information','Sense Motive']},
};

export function psionListLevel(levels:Record<string,number>,discipline?:PsionDiscipline):number|undefined{
 return (discipline?levels[discipline]:undefined)??levels['Psion/Wilder'];
}
