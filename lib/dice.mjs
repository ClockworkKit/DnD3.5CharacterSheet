export const ABILITIES = [
  {key: "STR", name: "Strength", score: 16},
  {key: "DEX", name: "Dexterity", score: 12},
  {key: "CON", name: "Constitution", score: 14},
  {key: "INT", name: "Intelligence", score: 10},
  {key: "WIS", name: "Wisdom", score: 10},
  {key: "CHA", name: "Charisma", score: 8}
];
export const SAVES = [
  {key: "fort", name: "Fortitude", ability: "CON", base: 3},
  {key: "ref", name: "Reflex", ability: "DEX", base: 1},
  {key: "will", name: "Will", ability: "WIS", base: 1}
];
export const modifier = score => Math.floor((score - 10) / 2);
export const signed = value => value >= 0 ? `+${value}` : String(value);
export const withBonus = (dice, bonus) => `${dice}${bonus ? signed(bonus) : ""}`;

export function totals(state) {
  const mods = Object.fromEntries(ABILITIES.map(a => [a.key, modifier(state.scores[a.key])]));
  return {
    mods,
    attack: state.bab + mods.STR + state.size + state.attackExtra + state.situational,
    damage: mods.STR + state.damageExtra,
    initiative: mods.DEX + state.situational,
    saves: Object.fromEntries(SAVES.map(s => [s.key, state.saves[s.key].base + mods[s.ability] + state.saves[s.key].extra + state.situational])),
    skill: Math.floor(state.skill.ranks) + mods[state.skill.ability] + state.skill.extra + state.situational
  };
}

export function makeRoll(kind, state) {
  const t = totals(state);
  let roll;
  if (kind.startsWith("ability:")) {
    const a = ABILITIES.find(a => a.key === kind.split(":")[1]);
    if (!a) throw new Error("Choose a valid ability.");
    roll = {title: `${a.name} check`, formula: withBonus("1d20", t.mods[a.key] + state.situational), details: `${a.key} ${signed(t.mods[a.key])}; situational ${signed(state.situational)}`};
  } else if (kind.startsWith("save:")) {
    const s = SAVES.find(s => s.key === kind.split(":")[1]);
    if (!s) throw new Error("Choose a valid saving throw.");
    roll = {title: `${s.name} save`, formula: withBonus("1d20", t.saves[s.key]), details: `Base ${signed(state.saves[s.key].base)}; ${s.ability} ${signed(t.mods[s.ability])}; extra ${signed(state.saves[s.key].extra)}; situational ${signed(state.situational)}`};
  } else if (kind === "attack" || kind === "confirm") {
    roll = {title: `${state.weaponName || "Weapon"} · ${kind === "confirm" ? "confirmation" : "attack"}`, formula: withBonus("1d20", t.attack), details: `BAB ${signed(state.bab)}; STR ${signed(t.mods.STR)}; size ${signed(state.size)}; extra ${signed(state.attackExtra)}; situational ${signed(state.situational)}`};
  } else if (kind === "damage") {
    roll = {title: `${state.weaponName || "Weapon"} · damage`, formula: withBonus(parseDiceFormula(state.weaponDice).formula, t.damage), details: `Normal one-handed damage; STR ${signed(t.mods.STR)}; extra ${signed(state.damageExtra)}`};
  } else if (kind === "initiative") {
    roll = {title: "Initiative", formula: withBonus("1d20", t.initiative), details: `DEX ${signed(t.mods.DEX)}; situational ${signed(state.situational)}; chat only`};
  } else if (kind === "skill") {
    roll = {title: `${state.skill.name || "Skill"} check`, formula: withBonus("1d20", t.skill), details: `Whole ranks ${Math.floor(state.skill.ranks)}; ${state.skill.ability} ${signed(t.mods[state.skill.ability])}; extra ${signed(state.skill.extra)}; situational ${signed(state.situational)}`};
  } else if (kind === "custom") {
    roll = {title: "Loose dice", formula: state.customFormula, details: "Custom formula; no additional bonuses"};
  } else if (kind === "test") {
    roll = {title: "Connection test", formula: "1d20", details: "Barrow Ledger to Roll20; no modifiers"};
  } else throw new Error("Choose a roll on the sheet.");
  roll.formula = parseDiceFormula(roll.formula).formula;
  return roll;
}

// A deliberately small arithmetic grammar: never execute user-entered code.
export function parseDiceFormula(input) {
  const compact = String(input).toLowerCase().replace(/−/g, "-").replace(/\s+/g, "");
  if (!compact || compact.length > 80 || !/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(compact)) {
    throw new Error("Use a formula such as 1d20+5 or 2d6+3. Only dice, numbers, + and − are supported.");
  }
  const tokens = compact.match(/[+-]?[^+-]+/g);
  if (tokens.length > 30) throw new Error("Use no more than 30 terms in a roll.");
  let diceCount = 0;
  const terms = tokens.map(token => {
    const sign = token.startsWith("-") ? -1 : 1;
    const term = token.replace(/^[+-]/, "");
    if (term.includes("d")) {
      const [countText, sideText] = term.split("d");
      const count = Number(countText || 1), sides = Number(sideText);
      if (!Number.isSafeInteger(count) || !Number.isSafeInteger(sides) || count < 1 || sides < 2 || sides > 1000) throw new Error("Use at least one die, with 2 to 1,000 sides.");
      diceCount += count;
      return {kind: "dice", sign, count, sides};
    }
    const value = Number(term);
    if (!Number.isSafeInteger(value) || value > 100000) throw new Error("Keep flat modifiers at 100,000 or less.");
    return {kind: "constant", sign, value};
  });
  if (diceCount > 100) throw new Error("Roll no more than 100 dice at a time.");
  const formula = terms.map((t, i) => `${t.sign < 0 ? "-" : i ? "+" : ""}${t.kind === "dice" ? `${t.count}d${t.sides}` : t.value}`).join("");
  return {terms, formula};
}

export function secureDie(sides) {
  const values = new Uint32Array(1);
  const limit = Math.floor(4294967296 / sides) * sides;
  do { globalThis.crypto.getRandomValues(values); } while (values[0] >= limit);
  return (values[0] % sides) + 1;
}

export function rollFormula(formula, die = secureDie) {
  const parsed = parseDiceFormula(formula);
  let total = 0;
  const results = parsed.terms.map(t => {
    if (t.kind === "constant") { total += t.sign * t.value; return {...t}; }
    const values = Array.from({length: t.count}, () => die(t.sides));
    if (values.some(v => !Number.isInteger(v) || v < 1 || v > t.sides)) throw new Error("The dice source returned an invalid value.");
    total += t.sign * values.reduce((a, b) => a + b, 0);
    return {...t, values};
  });
  const detail = results.map((t, i) => `${t.sign < 0 ? "− " : i ? "+ " : ""}${t.kind === "dice" ? `${t.count}d${t.sides} (${t.values.join(", ")})` : t.value}`).join(" ");
  return {total, detail, results, formula: parsed.formula};
}

// User labels must never introduce Roll20 commands, template fields or inline rolls.
export function macroLabel(value) {
  return String(value).normalize("NFKC").replace(/[^\p{L}\p{N} .,'’:+();\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function buildMacro(roll, characterName, whisper = false) {
  const formula = parseDiceFormula(roll.formula).formula;
  return `${whisper ? "/w gm " : ""}&{template:default} {{name=${macroLabel(roll.title)}}} {{Character=${macroLabel(characterName) || "Adventurer"}}} {{Roll=[[${formula}]]}} {{Formula=${formula}}} {{Details=${macroLabel(roll.details)}}}`;
}

export function buildBeyond20Request(roll, characterName, pageURL, whisper = false) {
  const url = new URL(pageURL);
  return {
    action: "roll", type: "chat-message", roll: "0", advantage: 0, whisper: whisper ? 1 : 0,
    character: {name: macroLabel(characterName) || "Adventurer", type: "BarrowSheet", source: "Barrow Ledger", url: `${url.origin}${url.pathname}`},
    name: macroLabel(roll.title),
    message: buildMacro(roll, characterName, whisper)
  };
}
