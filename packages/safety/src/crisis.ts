/**
 * Crisis detection: invariants S1 (works on device, offline) and S2 (server re-check before any LLM call).
 *
 * Deterministic phrase rules, tuned for recall over precision:
 * - a false alarm only shows the SOS options;
 * - a miss could keep someone from them.
 *
 * Negation such as "I would never kill myself" is deliberately not handled, and colloquial phrases
 * such as "想死你了" (miss you so much) will trigger. Both are accepted false positives.
 * Change these rules only together with crisis.test.ts.
 */
import { normalizeForMatching } from './normalize.js';

export type CrisisLevel = 'none' | 'concern' | 'crisis';
export type CrisisCategory = 'suicide' | 'self_harm' | 'harm_others' | 'immediate_danger';

export interface CrisisInput {
  text?: string;
  /** Latest mood rating, 1 (lowest) to 5. A 1 on its own is a concern, not a crisis. */
  latestMood?: number;
}

export interface CrisisResult {
  level: CrisisLevel;
  /** Categories matched, sorted. Never contains the user's words. */
  categories: CrisisCategory[];
}

interface Rule {
  category: CrisisCategory;
  pattern: RegExp;
}

// English and Malay patterns run on normalised (lowercased, whitespace-collapsed) text.
const EN_RULES: Rule[] = [
  { category: 'suicide', pattern: /\bsuicid(e|al)\b/ },
  { category: 'suicide', pattern: /\b(kill|killing|end|ending|take|taking)\s*(my\s*self|my\s*own\s*life|my\s*life)\b/ },
  { category: 'suicide', pattern: /\bend(ing)?\s*it\s*all\b/ },
  { category: 'suicide', pattern: /\b(want|wanna|wanted|going|plan|planning)\s*(to\s*)?die\b/ },
  { category: 'suicide', pattern: /\bwish\s*(i\s*was|i\s*were|to\s*be)\s*dead\b/ },
  { category: 'suicide', pattern: /\bbetter\s*off\s*dead\b/ },
  { category: 'suicide', pattern: /\b(don't|do\s*not|dont|no\s*longer)\s*want\s*to\s*(live|be\s*alive|exist|wake\s*up)\b/ },
  { category: 'suicide', pattern: /\bno\s*(reason|point)\s*(to|in)\s*(live|living|going\s*on)\b/ },
  { category: 'suicide', pattern: /\bbunuh\s*diri\b/ },
  { category: 'self_harm', pattern: /\bself[\s-]*harm/ },
  { category: 'self_harm', pattern: /\b(hurt|hurting|cut|cutting|harm|harming|burn|burning)\s*my\s*self\b/ },
  { category: 'self_harm', pattern: /\boverdos(e|ed|ing)\b/ },
  { category: 'harm_others', pattern: /\b(kill|hurt|attack|stab)\s*(him|her|them|someone|somebody|my\s*(roommate|housemate|lecturer|friend|partner))\b/ },
  { category: 'immediate_danger', pattern: /\bi('m|m|\s*am)\s*(not\s*safe|in\s*danger|being\s*(attacked|followed|hurt))\b/ },
  { category: 'immediate_danger', pattern: /\b(feel|feeling)\s*unsafe\b/ },
  { category: 'immediate_danger', pattern: /\b(someone|somebody|he|she|they)\s*(is|are)\s*(following|attacking|hurting)\s*me\b/ },
];

// Chinese patterns run on normalised text with all spaces removed, so "想 死" still matches.
const ZH_RULES: Rule[] = [
  { category: 'suicide', pattern: /自杀|轻生|想死|不想活|活不下去|寻死|结束(自己的)?生命|了结自己|跳楼|跳河|上吊|烧炭/ },
  { category: 'self_harm', pattern: /自残|自伤|伤害自己|割腕|划伤自己|过量服药|吞(了)?(很多|一瓶|一整瓶)?药/ },
  { category: 'harm_others', pattern: /想杀人|杀了(他|她|他们|室友|人)/ },
  { category: 'immediate_danger', pattern: /有人(在)?(跟踪|尾随|打|袭击)我|我(现在)?(很)?不安全|我有危险/ },
];

export function detectCrisis(input: CrisisInput): CrisisResult {
  const found = new Set<CrisisCategory>();
  if (input.text) {
    const spaced = normalizeForMatching(input.text);
    const compact = spaced.replace(/ /g, '');
    for (const rule of EN_RULES) if (rule.pattern.test(spaced)) found.add(rule.category);
    for (const rule of ZH_RULES) if (rule.pattern.test(compact)) found.add(rule.category);
  }
  const categories = [...found].sort();
  if (categories.length > 0) return { level: 'crisis', categories };
  if (input.latestMood === 1) return { level: 'concern', categories };
  return { level: 'none', categories };
}
