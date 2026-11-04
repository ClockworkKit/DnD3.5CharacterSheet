'use client';
import type {Character} from '@/lib/model';
import {characterGestaltRows} from '@/lib/gestalt-progression';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

/** Display the authoritative pairs, never reconstruct them from summed class levels. */
export function GestaltHistory({c}:{c:Character}){
 const rows=characterGestaltRows(c);
 if(!rows)return null;
 return <details>
  <summary>Paired advancement history ({rows.length} character levels)</summary>
  <p className="fine">Each row grants one character level. Class levels count each class's own advances, even when it changes sides. Saved pairs and their order stay intact; use paired level-up above the sheet when enough XP is recorded. Historical Intelligence, HP rolls and skill purchases remain editable in Calculations and Skills.</p>
  <Table className="class-table"><caption>Saved gestalt levels</caption>
   <TableHeader><TableRow><TableHead>Character level</TableHead><TableHead>Left class</TableHead><TableHead>Right class</TableHead><TableHead>Hit Die</TableHead></TableRow></TableHeader>
   <TableBody>{rows.map((row,index)=><TableRow key={row.key}>
    <TableHead scope="row">{index+1}</TableHead>
    <TableCell>{row.left.name} {row.left.classLevel}</TableCell>
    <TableCell>{row.right.name} {row.right.classLevel}</TableCell>
    <TableCell>d{row.die}</TableCell>
   </TableRow>)}</TableBody>
  </Table>
 </details>;
}
