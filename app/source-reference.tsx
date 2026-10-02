import type {SourceReference} from '@/lib/source-references';

export function SourceReferenceDetails({reference}:{reference?:SourceReference}){
 if(!reference)return null;
 return <details className="source-reference"><summary>{reference.title}</summary><p className="fine">{reference.book} · Included in saved characters and JSON exports.</p><p className="reference-text">{reference.text}</p><a className="source-link" href={reference.url} target="_blank" rel="noreferrer">Read on Ultimate SRD</a></details>;
}
