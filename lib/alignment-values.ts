export const alignments=['lawful good','neutral good','chaotic good','lawful neutral','true neutral','chaotic neutral','lawful evil','neutral evil','chaotic evil'] as const;
const abbreviations:Record<string,string>={lg:alignments[0],ng:alignments[1],cg:alignments[2],ln:alignments[3],n:alignments[4],tn:alignments[4],cn:alignments[5],le:alignments[6],ne:alignments[7],ce:alignments[8]};
export function normalizedAlignment(value:string):string|null{
 const text=value.trim().toLowerCase().replace(/[-–—]/g,' ').replace(/\s+/g,' ');
 const expanded=abbreviations[text]??(text==='neutral'?'true neutral':text);
 return alignments.includes(expanded as typeof alignments[number])?expanded:null;
}

export const alignmentCodes=['LG','NG','CG','LN','TN','CN','LE','NE','CE'] as const;
export const alignmentChoices:Array<[typeof alignmentCodes[number],string]>=alignmentCodes.map((code,i)=>[code,alignments[i].replace(/\b\w/g,c=>c.toUpperCase())]);
