import ultimate from './ultimate-class-data.json' with {type:'json'};
import supplemental from './supplemental-class-data.json' with {type:'json'};
import raw from './class-data.json' with {type:'json'};
import type {ClassDefinition} from './classes.ts';
/** Data-only module: rule modules can read the catalog without initialization cycles. */
export const classCatalog=[...raw,...supplemental,...ultimate] as ClassDefinition[];
