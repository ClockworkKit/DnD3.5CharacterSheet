// Small arithmetic parser. No JavaScript execution, property access, or calls outside this whitelist.
export function expression(input:string,variables:Record<string,number>={}){
 if(input.length>200)throw new Error('Keep formulas within 200 characters.');
 const compact=input.replace(/\s/g,'').replace(/−/g,'-');const tokens=compact.match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*|[()+\-*/,]/g)||[];
 if(!compact||tokens.join('')!==compact||tokens.length>100)throw new Error('Use numbers, variables, arithmetic, min, max, floor, ceil, round, or abs.');
 let at=0,depth=0;const funcs:Record<string,(...v:number[])=>number>={min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs};
 function atom():number{if(++depth>20)throw new Error('The formula is nested too deeply.');let value:number;const t=tokens[at++];if(t==='+'||t==='-')value=(t==='-'?-1:1)*atom();else if(t==='('){value=sum();if(tokens[at++]!==')')throw new Error('Close each parenthesis.');}else if(t&&/^\d/.test(t))value=Number(t);else if(t&&tokens[at]==='('){const f=Object.hasOwn(funcs,t.toLowerCase())?funcs[t.toLowerCase()]:undefined;if(!f)throw new Error('Unknown formula function: '+t);at++;const args=[sum()];while(tokens[at]===','){at++;args.push(sum());}if(tokens[at++]!==')'||args.length>12||(!['min','max'].includes(t.toLowerCase())&&args.length!==1))throw new Error('Check function arguments.');value=f(...args);}else if(t&&Object.hasOwn(variables,t.toUpperCase()))value=variables[t.toUpperCase()];else throw new Error('Unknown formula variable: '+(t||'end'));depth--;return value;}
 function product():number{let n=atom();while(tokens[at]==='*'||tokens[at]==='/'){const op=tokens[at++],d=atom();n=op==='*'?n*d:n/d;}return n;}
 function sum():number{let n=product();while(tokens[at]==='+'||tokens[at]==='-'){const op=tokens[at++],d=product();n=op==='+'?n+d:n-d;}return n;}
 const result=sum();if(at!==tokens.length||!Number.isFinite(result)||Math.abs(result)>100000)throw new Error('The formula must produce a finite number within ±100,000.');return result;
}
export function expandFormula(input:string,variables:Record<string,number>){return input.replace(/\{([^{}]+)\}/g,(_,formula:string)=>String(Math.floor(expression(formula,variables))));}
