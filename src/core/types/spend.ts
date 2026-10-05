export * from './monthlyIngestion';

export type FileSourceType = 'capex_d365' | 'opex_d365' | 'capex_ax' | 'opex_ax' | 'summary_pr';

export interface SkuMasterRecord {
  id: string;
  productId: string;
  name: string;
  purchCategoryLv1: string;
  purchCategoryLv2: string;
  purchCategoryLv3: string;
  purchCategoryLv4: string;
  prItemId: string;
  prFaCategory: string;
  cprItemId: string;
  cprFaCategory: string;
  spItemId: string;
  unitOfMeasurement: string;
  isGenericProduct: boolean | string;
  brand: string;
  specification1: string;
  specification2: string;
  specification3: string;
  partNumber: string;
  standardPrice: number;
  isActive: boolean | string;
  isContract: boolean | string;
  formattedSkuName?: string;
  // Parsed 4-component SKU decomposition: [ItemKomoditas];[Spec umum];[Brand];[PartNumber]
  commodityItem?: string; // Level 5 taxonomy
  generalSpec?: string;
}

/**
 * Parsed SKU Components Structure:
 * [ItemKomoditas];[Spec umum];[Brand];[PartNumber]
 */
export interface ParsedSkuComponents {
  commodityItem: string; // Level 5 taxonomy (ItemKomoditas)
  generalSpec: string;   // Spec umum / specifications (clean/normalized)
  spec1?: string | null; // Slot 1 (e.g. XS or null)
  spec2?: string | null; // Slot 2 (e.g. null)
  spec3?: string | null; // Slot 3 (e.g. null)
  rawSpec?: string;      // Original raw spec string (e.g. DURES,-,-)
  brand: string;         // Brand label
  partNumber: string;    // Part number / model identifier
  rawString: string;
  normalizedSyntax?: string; // Standardized syntax e.g. "commodity;spec;brand;part"
}

/**
 * Checks if an individual spec slot is empty / NA / placeholder (including '.', '-', ',-,-', etc.)
 */
export function isSpecSlotEmpty(slot: string | null | undefined): boolean {
  if (slot === null || slot === undefined) return true;
  const s = String(slot).trim().toUpperCase();
  if (
    s === '' ||
    s === '-' ||
    s === '--' ||
    s === '---' ||
    s === '.' ||
    s === '..' ||
    s === '...' ||
    s === ',' ||
    s === 'NA' ||
    s === 'N/A' ||
    s === 'NONE' ||
    s === 'NOT APPLICABLE' ||
    s === 'TIDAK ADA' ||
    s === 'NULL' ||
    s === 'NIL' ||
    s === '0'
  ) {
    return true;
  }
  // If slot contains only dots, dashes, commas, slashes, or whitespace (e.g. "-,-", ",-,-", ".-.", "...", "-/-", ", - , -")
  if (/^[\.\-,\s\/]+$/.test(s)) {
    return true;
  }
  return false;
}

/**
 * Normalizes a spec slot: returns null if empty/NA/dash/dot (bila isinya hanya '-' harus dinormalisasi menjadi blank atau null),
 * atau string slot yang sudah di-trim bersih tanpa spasi di ujung-ujung kata.
 */
export function normalizeSpecSlot(slot: string | null | undefined): string | null {
  if (slot === null || slot === undefined) return null;
  const s = String(slot).trim();
  if (isSpecSlotEmpty(s)) return null;
  const cleaned = s.replace(/\s+/g, ' ').trim();
  return isSpecSlotEmpty(cleaned) ? null : cleaned;
}

/**
 * Parses the 3-slot specification form separated by comma (spec 1, spec 2, spec 3).
 * In ERP/master data, form spec terdiri dari 3 slot yang dipisahkan koma.
 * Jika spec 2 dan spec 3 sebenarnya NA (di master data terisi "-" atau "."),
 * atau jika data PO menggunakan "." / "-" ketika tidak ada spesifikasi,
 * fungsi ini menormalkannya sehingga e.g. "DURES,-,-" atau "DURES, -, -" identik dengan "DURES",
 * dan spesifikasi yang hanya berupa "-" dinormalisasi menjadi null / blank.
 */
export function parseSpecSlots(specString: string | null | undefined): {
  spec1: string | null;
  spec2: string | null;
  spec3: string | null;
  normalized: string;
  activeSlots: string[];
} {
  if (!specString || isSpecSlotEmpty(specString)) {
    return { spec1: null, spec2: null, spec3: null, normalized: '', activeSlots: [] };
  }
  const rawSlots = String(specString).split(',').map(s => s.trim());
  const s1 = normalizeSpecSlot(rawSlots[0]);
  const s2 = normalizeSpecSlot(rawSlots[1]);
  const s3 = normalizeSpecSlot(rawSlots[2]);

  const activeSlots = [s1, s2, s3].filter((s): s is string => Boolean(s));
  const normalized = activeSlots.join(', ');

  return {
    spec1: s1,
    spec2: s2,
    spec3: s3,
    normalized,
    activeSlots
  };
}

/**
 * Normalizes a specification string into a canonical representation for matching.
 * "XS,-,-"    -> "xs"
 * "XS"        -> "xs"
 * "XS, -, -"  -> "xs"
 * "."         -> "" (PO data empty placeholder)
 * "-,-,-"     -> "" (Master data empty placeholder)
 * ",-,-"      -> "" (Master data empty placeholder)
 * "-"         -> ""
 */
export function normalizeSpecString(specString: string | null | undefined): string {
  if (!specString || isSpecSlotEmpty(specString)) return '';
  return parseSpecSlots(specString).normalized.replace(/\s+/g, ' ').toLowerCase().trim();
}

/**
 * Normalizes an entire 4-part SKU string for exact comparison:
 * Trims leading and trailing spaces for every component separated by semicolon (;),
 * Collapses internal whitespace,
 * Normalizes 3-slot specifications removing NA/'-'/'.' slots,
 * Normalizes empty/generic brands and part numbers.
 * Example:
 *   "SNELI DOKTER ;XS,-,-;NB;NP"
 *   -> "sneli dokter;xs;generic;np"
 *   "SNELI DOKTER  ; XS; NB; NP "
 *   -> "sneli dokter;xs;generic;np"
 *   "SNELI DOKTER  ; . ; NB; NP "
 *   -> "sneli dokter;;generic;np"
 *   "SNELI DOKTER ;-,-,-;NB;NP"
 *   -> "sneli dokter;;generic;np"
 */
export function normalizeSkuSyntax(input: string | null | undefined): string {
  if (!input) return '';
  let clean = String(input).trim();
  clean = clean.replace(/\s*::\s*[a-zA-Z0-9_\-\.]+.*$/, '').trim();
  const parts = clean.split(';').map(p => p.trim());

  const commodity = (parts[0] || '').replace(/\s+/g, ' ').toLowerCase().trim();
  const spec = normalizeSpecString(parts[1] || '');
  
  let brand = (parts[2] || '').replace(/\s+/g, ' ').toLowerCase().trim();
  if (isSpecSlotEmpty(brand) || brand === 'generic' || brand === 'nb') brand = 'generic';

  let partNumber = (parts.slice(3).join(';') || '').replace(/\s+/g, ' ').toLowerCase().trim();
  if (isSpecSlotEmpty(partNumber) || partNumber === 'np') partNumber = 'np';

  return `${commodity};${spec};${brand};${partNumber}`;
}

/**
 * Decomposes a semicolon-delimited SKU or string into its 4 constituent components:
 * [ItemKomoditas];[Spec umum];[Brand];[PartNumber]
 * Trims leading and trailing whitespace on each component separated by semicolon (;).
 * Normalizes spec 1, 2, 3 so that any '-' or '.' slots become null / blank.
 * If delimiter is absent, treats the entire clean string as ItemKomoditas (Lv 5).
 */
export function decomposeSkuString(input: string | null | undefined): ParsedSkuComponents {
  if (!input) {
    return { commodityItem: '', generalSpec: '', spec1: null, spec2: null, spec3: null, brand: '', partNumber: '', rawString: '' };
  }
  // Strip any trailing ::skuCode if present to ensure clean constituent parts
  let clean = String(input).trim();
  clean = clean.replace(/\s*::\s*[a-zA-Z0-9_\-\.]+.*$/, '').trim();
  
  // Trim spaces at beginning and end of each component separated by ';'
  const parts = clean.split(';').map(p => p.trim());

  const rawCommodity = (parts[0] || '').trim();
  const rawSpec = (parts[1] || '').trim();
  const specParsed = parseSpecSlots(rawSpec);
  const cleanSpec = isSpecSlotEmpty(rawSpec) ? '' : (specParsed.normalized || '');

  // Brand: trim and normalize empty/generic
  let rawBrand = (parts[2] || '').replace(/\s+/g, ' ').trim();
  if (isSpecSlotEmpty(rawBrand)) rawBrand = '';

  // Part Number: trim and normalize empty/np
  let rawPart = (parts.slice(3).join(';') || '').replace(/\s+/g, ' ').trim();
  if (isSpecSlotEmpty(rawPart)) {
    rawPart = '';
  } else {
    // If part number starts with standard NP / NA tokens followed by operational note text, extract NP/NA cleanly
    const npMatch = rawPart.match(/^(np|na|none|nihil)\b(?:\s*[:\-_;,\s]+(.*))?$/i);
    if (npMatch) {
      rawPart = npMatch[1].toUpperCase();
    }
  }

  return {
    commodityItem: (rawCommodity || clean).replace(/\s+/g, ' ').trim(),
    generalSpec: cleanSpec,
    spec1: specParsed.spec1,
    spec2: specParsed.spec2,
    spec3: specParsed.spec3,
    rawSpec,
    brand: rawBrand,
    partNumber: rawPart,
    rawString: clean,
    normalizedSyntax: normalizeSkuSyntax(clean)
  };
}

/**
 * Formats a Master SKU into the standardized 4-part syntax:
 * [ItemKomoditas];[Spec umum];[Brand];[PartNumber]
 * ItemKomoditas acts as Level 5 Procurement Taxonomy.
 */
export function getFormattedSkuName(sku: SkuMasterRecord): string {
  const decomp = decomposeSkuString(sku.name);
  const name = (sku.commodityItem || decomp.commodityItem || sku.name || '').trim();
  const spec1 = sku.specification1 || decomp.spec1 || '';
  const spec2 = sku.specification2 || decomp.spec2 || '';
  const spec3 = sku.specification3 || decomp.spec3 || '';
  const brand = (sku.brand || decomp.brand || '').trim();
  const partNum = (sku.partNumber || decomp.partNumber || '').trim();
  
  const specParsed = parseSpecSlots(sku.generalSpec || decomp.generalSpec || [spec1, spec2, spec3].join(','));
  const specs = specParsed.normalized || '-';

  return `${name};${specs};${brand};${partNum}`;
}

export interface SplitItemNameResult {
  itemName: string;
  itemNotes?: string;
  rawItemName: string;
  extractedSkuCode?: string;
}

/**
 * Splits and cleans raw Item Name from PO Excel records:
 * 1. Separates multi-line cell entries where ERP users stored notes on new lines (e.g. Alt+Enter) into itemNotes.
 * 2. Detects and extracts Master SKU / Product ID embedded after '::' delimiter
 *    (e.g. "PEMBANGUNAN BARU ; STANDARD; NB; NP ::100101010140 ").
 *    The extracted code becomes the top priority pairing key, while the itemName is cleaned of the ::[code] suffix.
 */
export function splitItemNameAndNotes(raw: string | null | undefined): SplitItemNameResult {
  if (!raw) {
    return { itemName: '', itemNotes: undefined, rawItemName: '', extractedSkuCode: undefined };
  }
  const rawStr = String(raw).trim();
  // Split on newlines or Excel XML carriage return tokens
  const lines = rawStr
    .split(/\r\n|\r|\n|_x000D_\n|_x000D_/g)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { itemName: '', itemNotes: undefined, rawItemName: rawStr, extractedSkuCode: undefined };
  }

  const primaryLine = lines[0];
  let cleanItemName = primaryLine;
  let extractedSkuCode: string | undefined = undefined;
  const trailingNotes: string[] = lines.slice(1);

  // Check if primaryLine contains '::' with SKU / Product ID code
  // Example: "PEMBANGUNAN BARU ; STANDARD; NB; NP ::100101010140 "
  // Example: "ITEM NAME :: 100101010140"
  const doubleColonMatch = primaryLine.match(/^(.*?)\s*::\s*([a-zA-Z0-9_\-\.]+)(?:\s+(.*))?$/);
  if (doubleColonMatch) {
    cleanItemName = doubleColonMatch[1].trim();
    // Clean trailing semicolon if present before '::'
    cleanItemName = cleanItemName.replace(/;\s*$/, '').trim();
    extractedSkuCode = doubleColonMatch[2].trim();
    if (doubleColonMatch[3]?.trim()) {
      trailingNotes.unshift(doubleColonMatch[3].trim());
    }
  }

  const itemNotes = trailingNotes.length > 0 ? trailingNotes.join('\n') : undefined;

  return {
    itemName: cleanItemName,
    itemNotes,
    rawItemName: rawStr,
    extractedSkuCode
  };
}

/**
 * Computes Jaro-Winkler similarity between two strings (returns 0.0 to 1.0).
 * Highly effective for short strings, typos, and Brand name variations.
 */
export function computeJaroWinklerSimilarity(s1: string, s2: string): number {
  const str1 = String(s1 || '').trim().toLowerCase();
  const str2 = String(s2 || '').trim().toLowerCase();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const len1 = str1.length;
  const len2 = str2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (!str2Matches[j] && str1[i] === str2[j]) {
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix scale (p = 0.1, max 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return Math.min(1.0, jaro + prefix * 0.1 * (1 - jaro));
}

/**
 * Computes token-based Jaccard and substring similarity between two multi-word strings.
 * Perfect for Indonesian medical procurement descriptions where word order may vary:
 * e.g. "KASA STERIL LIPAT" vs "KASA LIPAT STERIL" -> 1.0
 * e.g. "SNELI DOKTER LENGAN PANJANG" vs "SNELI DOKTER LGN PANJANG" -> high similarity
 */
export function computeTokenSetSimilarity(strA: string, strB: string): number {
  const sA = String(strA || '').toLowerCase().trim();
  const sB = String(strB || '').toLowerCase().trim();
  if (sA === sB) return 1.0;
  if (!sA || !sB) return 0.0;

  const tokensA = sA.split(/[\s,;./\-_]+/).filter(t => t.length > 0);
  const tokensB = sB.split(/[\s,;./\-_]+/).filter(t => t.length > 0);

  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  let matchScore = 0;
  const matchedB = new Set<number>();

  for (const tA of tokensA) {
    let bestTokenMatch = 0;
    let bestJ = -1;

    for (let j = 0; j < tokensB.length; j++) {
      if (matchedB.has(j)) continue;
      const tB = tokensB[j];

      if (tA === tB) {
        bestTokenMatch = 1.0;
        bestJ = j;
        break;
      }

      // Check abbreviations / prefix (e.g. lgn vs lengan, dok vs dokter)
      if (
        (tA.length >= 3 && tB.startsWith(tA)) ||
        (tB.length >= 3 && tA.startsWith(tB))
      ) {
        const sim = Math.min(tA.length, tB.length) / Math.max(tA.length, tB.length);
        if (sim > bestTokenMatch) {
          bestTokenMatch = sim;
          bestJ = j;
        }
      } else if (tA.length >= 4 && tB.length >= 4) {
        const jw = computeJaroWinklerSimilarity(tA, tB);
        if (jw > 0.82 && jw > bestTokenMatch) {
          bestTokenMatch = jw;
          bestJ = j;
        }
      }
    }

    if (bestJ !== -1 && bestTokenMatch >= 0.70) {
      matchedB.add(bestJ);
      matchScore += bestTokenMatch;
    }
  }

  const denominator = Math.max(tokensA.length, tokensB.length);
  return matchScore / denominator;
}

/**
 * Extracts numbers and attached units (e.g. 10ML, 20ML, 50L, 500MG, 12FR, 2X3CM, 10X10, 10 ML).
 * Handles numbers attached to unit characters where word-boundary \b fails.
 */
export function extractNumbersWithUnits(str: string): string[] {
  if (!str) return [];
  const normalized = str.toLowerCase().replace(/,/g, '.');
  const tokens: string[] = [];
  // Match digits (with optional decimal) followed by optional unit suffix (ml, mg, l, fr, cm, mm, m, g, kg, etc.)
  const regex = /(?:^|[^\w.])(\d+(?:\.\d+)?)\s*([a-z%]+)?(?=[^\w.]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(normalized)) !== null) {
    const val = m[1];
    const unit = m[2] ? m[2].trim() : '';
    if (unit) {
      tokens.push(`${val}${unit}`);
    }
    tokens.push(val); // Also include bare numeric value for pure comparison
  }
  return tokens;
}

/**
 * Safety check: Verifies if two spec/item strings contain conflicting numbers/sizes.
 * For example, "10ML" vs "20ML", or "500MG" vs "100MG", or "12 FR" vs "14 FR", or "50L" vs "20L".
 * If numbers are present in both but do not overlap, returns true to prevent false matching.
 */
export function hasConflictingNumbers(strA: string, strB: string): boolean {
  if (!strA || !strB) return false;
  const numsA = extractNumbersWithUnits(strA);
  const numsB = extractNumbersWithUnits(strB);

  if (numsA.length === 0 || numsB.length === 0) return false;

  const setA = new Set(numsA);
  const hasCommon = numsB.some(n => setA.has(n));
  return !hasCommon;
}

/**
 * Safety check: Verifies if two strings contain diametrically opposing modifiers or antonyms.
 * Prevents false EXACT_MATCH on items like "STERIL" vs "NON STERIL", "DEWASA" vs "ANAK", etc.
 */
export function hasConflictingModifiers(strA: string, strB: string): boolean {
  if (!strA || !strB) return false;
  const a = strA.toLowerCase();
  const b = strB.toLowerCase();

  // 1. Steril vs Non-Steril
  const isNonSterilA = /(?:non[\s-]*steril|unsterile)/i.test(a);
  const isSterilA = /steril/i.test(a) && !isNonSterilA;
  const isNonSterilB = /(?:non[\s-]*steril|unsterile)/i.test(b);
  const isSterilB = /steril/i.test(b) && !isNonSterilB;
  if ((isNonSterilA && isSterilB) || (isSterilA && isNonSterilB)) return true;

  // 2. Dewasa / Adult vs Anak / Pediatric / Bayi / Neonatal
  const isAdultA = /(?:dewasa|adult)/i.test(a);
  const isPediatricA = /(?:anak|pediatric|paediatric|bayi|infant|neonatal)/i.test(a);
  const isAdultB = /(?:dewasa|adult)/i.test(b);
  const isPediatricB = /(?:anak|pediatric|paediatric|bayi|infant|neonatal)/i.test(b);
  if ((isAdultA && isPediatricB) || (isPediatricA && isAdultB)) return true;

  // 3. Tanpa / Without vs Dengan / With
  const isWithoutA = /(?:tanpa|without|free)/i.test(a);
  const isWithA = /(?:dengan|with)/i.test(a);
  const isWithoutB = /(?:tanpa|without|free)/i.test(b);
  const isWithB = /(?:dengan|with)/i.test(b);
  if ((isWithoutA && isWithB) || (isWithA && isWithoutB)) return true;

  // 4. Injak vs Dorong / Gantung
  const isInjakA = /\binjak\b/i.test(a);
  const isDorongA = /\b(?:dorong|gantung)\b/i.test(a);
  const isInjakB = /\binjak\b/i.test(b);
  const isDorongB = /\b(?:dorong|gantung)\b/i.test(b);
  if ((isInjakA && isDorongB) || (isDorongA && isInjakB)) return true;

  // 5. Gender
  const isMaleA = /\b(?:pria|male)\b/i.test(a);
  const isFemaleA = /\b(?:wanita|female)\b/i.test(a);
  const isMaleB = /\b(?:pria|male)\b/i.test(b);
  const isFemaleB = /\b(?:wanita|female)\b/i.test(b);
  if ((isMaleA && isFemaleB) || (isFemaleA && isMaleB)) return true;

  // 6. Clothing / Glove sizes: XS, S, M, L, XL, XXL (distinct single size)
  const sizeRegex = /\b(xxs|xs|s|m|l|xl|xxl|small|medium|large)\b/gi;
  const sizesA = Array.from(new Set((a.match(sizeRegex) || []).map(s => s.toLowerCase())));
  const sizesB = Array.from(new Set((b.match(sizeRegex) || []).map(s => s.toLowerCase())));
  if (sizesA.length === 1 && sizesB.length === 1 && sizesA[0] !== sizesB[0]) {
    return true;
  }

  return false;
}

export interface WeightedSkuMatchResult {
  totalScore: number;
  commodityScore: number;
  specScore: number;
  brandScore: number;
  partNumberScore: number;
  goldenBoostApplied: boolean;
  isBrandInSpec: boolean;
  matchExplanation: string;
}

/**
 * Computes 4-component weighted fuzzy similarity with multiplier:
 * - Commodity (Max 50% * similarity)
 * - Spec 1, 2, 3 merged (Max 30% * similarity, with number and modifier conflict protection)
 * - Brand (Max 10% * similarity, with Cross-Check for Brand leaked into Spec and distinct brand penalty)
 * - Part Number (Max 10%, with Golden Boost >= 95% if identical and commodity matches >= 70%)
 */
export function computeWeightedSkuSimilarity(
  txDecomp: ParsedSkuComponents,
  candSku: SkuMasterRecord,
  candDecomp: ParsedSkuComponents
): WeightedSkuMatchResult {
  const txComm = (txDecomp.commodityItem || '').replace(/\s+/g, ' ').toLowerCase().trim();
  const candComm = (candSku.commodityItem || candDecomp.commodityItem || candSku.name || '').replace(/\s+/g, ' ').toLowerCase().trim();

  // Full item text comparison for global conflict guards
  const txFull = `${txDecomp.rawString || txDecomp.commodityItem || ''} ${txDecomp.generalSpec || txDecomp.rawSpec || ''}`.toLowerCase();
  const candFull = `${candSku.name || candSku.commodityItem || ''} ${candSku.generalSpec || candSku.specification1 || ''}`.toLowerCase();

  const hasModifierConflict = hasConflictingModifiers(txFull, candFull);
  const hasGlobalNumConflict = hasConflictingNumbers(txFull, candFull);

  // 1. KOMODITAS (Max 50%)
  let commSim = 0;
  if (txComm && candComm) {
    if (txComm === candComm) {
      commSim = 1.0;
    } else {
      commSim = computeTokenSetSimilarity(txComm, candComm);
    }
  }

  // If critical modifier or number conflicts in item name, penalize commodity match
  if (hasModifierConflict || hasGlobalNumConflict) {
    commSim = Math.min(commSim, 0.4);
  }
  const commodityScore = Math.round(50 * commSim);

  // 2. SPEC (Max 30%)
  const txSpec = normalizeSpecString(txDecomp.generalSpec || txDecomp.rawSpec);
  const candSpec = normalizeSpecString(candSku.generalSpec || candDecomp.generalSpec || candSku.specification1);

  const isTxSpecEmpty = !txSpec || isSpecSlotEmpty(txSpec);
  const isCandSpecEmpty = !candSpec || isSpecSlotEmpty(candSpec);

  let specSim = 0;
  let hasConflictingSpecNum = false;

  if (isTxSpecEmpty && isCandSpecEmpty) {
    // Keduanya kosong / NA -> cocok identik
    specSim = 1.0;
  } else if (!isTxSpecEmpty && !isCandSpecEmpty) {
    if (txSpec === candSpec) {
      specSim = 1.0;
    } else {
      // Check 3-slot equality if available
      const spec1Match = txDecomp.spec1 && candDecomp.spec1 && txDecomp.spec1.toLowerCase() === candDecomp.spec1.toLowerCase();
      const spec2Match = (!txDecomp.spec2 && !candDecomp.spec2) || (txDecomp.spec2 && candDecomp.spec2 && txDecomp.spec2.toLowerCase() === candDecomp.spec2.toLowerCase());
      const spec3Match = (!txDecomp.spec3 && !candDecomp.spec3) || (txDecomp.spec3 && candDecomp.spec3 && txDecomp.spec3.toLowerCase() === candDecomp.spec3.toLowerCase());

      if (spec1Match && spec2Match && spec3Match) {
        specSim = 1.0;
      } else if (spec1Match) {
        specSim = 0.85;
      } else {
        specSim = computeTokenSetSimilarity(txSpec, candSpec);
      }

      // Safety check: jika ada angka/ukuran yang bertolak belakang (misal 10ml vs 20ml), batalkan specSim
      if (hasConflictingNumbers(txSpec, candSpec) || hasGlobalNumConflict) {
        hasConflictingSpecNum = true;
        specSim = 0;
      }
    }
  } else {
    // Satu ada spec, satu tidak ada spec
    specSim = (commSim >= 0.85 && !hasGlobalNumConflict && !hasModifierConflict) ? 0.3 : 0.05;
  }

  if (hasModifierConflict) {
    specSim = 0;
  }

  const specScore = Math.round(30 * specSim);

  // 3. BRAND (Max 10%)
  const txBrand = (txDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();
  const candBrand = (candSku.brand || candDecomp.brand || '').replace(/\s+/g, ' ').toLowerCase().trim();

  const isTxBrandGeneric = !txBrand || isSpecSlotEmpty(txBrand) || txBrand === 'generic' || txBrand === 'nb';
  const isCandBrandGeneric = !candBrand || isSpecSlotEmpty(candBrand) || candBrand === 'generic' || candBrand === 'nb';

  let brandSim = 0;
  let isBrandInSpec = false;
  let hasConflictingBrand = false;

  // Cross-slot check: Brand terselip di dalam Spec PO
  if (isTxBrandGeneric && !isCandBrandGeneric && candBrand.length >= 3) {
    const rawPoSpec = (txDecomp.rawSpec || txDecomp.generalSpec || '').toLowerCase();
    if (rawPoSpec.includes(candBrand)) {
      isBrandInSpec = true;
      brandSim = 1.0;
    }
  }

  if (!isBrandInSpec) {
    if (isTxBrandGeneric && isCandBrandGeneric) {
      brandSim = 1.0;
    } else if (!isTxBrandGeneric && !isCandBrandGeneric) {
      if (txBrand === candBrand || candBrand.includes(txBrand) || txBrand.includes(candBrand)) {
        brandSim = 1.0;
      } else {
        const jw = computeJaroWinklerSimilarity(txBrand, candBrand);
        if (jw >= 0.85) {
          brandSim = jw;
        } else {
          // Brand distinct and incompatible (e.g. Lenovo vs HP, Terumo vs B.Braun)
          hasConflictingBrand = true;
          brandSim = 0;
        }
      }
    } else {
      brandSim = 0;
    }
  }
  const brandScore = Math.round(10 * brandSim);

  // 4. PART NUMBER (Max 10%)
  const cleanTxPart = (txDecomp.partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanCandPart = (candSku.partNumber || candDecomp.partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const isTxPartNP = !cleanTxPart || isSpecSlotEmpty(cleanTxPart) || cleanTxPart === 'np';
  const isCandPartNP = !cleanCandPart || isSpecSlotEmpty(cleanCandPart) || cleanCandPart === 'np';

  let partNumberScore = 0;
  let goldenBoostApplied = false;
  let hasConflictingPart = false;

  if (isTxPartNP && isCandPartNP) {
    partNumberScore = 10;
  } else if (!isTxPartNP && !isCandPartNP) {
    if (cleanTxPart === cleanCandPart) {
      partNumberScore = 10;
      // GOLDEN BOOST: Jika part number persis sama (non-trivial >= 3 karakter) dan komoditas memiliki kemiripan kuat (>= 70%)
      if (cleanTxPart.length >= 3 && commSim >= 0.70 && !hasConflictingSpecNum && !hasModifierConflict && !hasConflictingBrand) {
        goldenBoostApplied = true;
      }
    } else {
      if (cleanTxPart.length >= 3 && cleanCandPart.length >= 3) {
        hasConflictingPart = true;
      }
      partNumberScore = 0;
    }
  } else {
    partNumberScore = 0;
  }

  let totalScore = commodityScore + specScore + brandScore + partNumberScore;
  if (goldenBoostApplied) {
    totalScore = Math.max(totalScore, 95);
  }

  // Hard safety caps for conflicting products:
  if (hasModifierConflict) {
    totalScore = Math.min(totalScore, 35);
  } else if (hasConflictingSpecNum || hasGlobalNumConflict) {
    totalScore = Math.min(totalScore, 40);
  } else if (hasConflictingBrand) {
    // Distinct brands cannot be exact match
    totalScore = Math.min(totalScore, 45);
  } else if (hasConflictingPart) {
    // Distinct part numbers cannot be exact match
    totalScore = Math.min(totalScore, 50);
  }

  const reasons: string[] = [];
  if (commodityScore > 0) reasons.push(`Komoditas (${commodityScore}/50)`);
  if (specScore > 0) reasons.push(`Spec (${specScore}/30)`);
  if (isBrandInSpec) reasons.push(`Brand di Spec (+10%)`);
  else if (brandScore > 0) reasons.push(`Brand (${brandScore}/10)`);
  if (goldenBoostApplied) reasons.push(`Part# Golden Boost (+95%)`);
  else if (partNumberScore > 0) reasons.push(`Part# (${partNumberScore}/10)`);

  if (hasModifierConflict) reasons.push('[BLOCKED: Modifier Berlawanan/Antonym]');
  if (hasConflictingSpecNum || hasGlobalNumConflict) reasons.push('[BLOCKED: Konflik Angka/Ukuran]');
  if (hasConflictingBrand) reasons.push(`[BLOCKED: Brand Berbeda (${txBrand} vs ${candBrand})]`);
  if (hasConflictingPart) reasons.push(`[BLOCKED: Part Number Berbeda (${cleanTxPart} vs ${cleanCandPart})]`);

  return {
    totalScore,
    commodityScore,
    specScore,
    brandScore,
    partNumberScore,
    goldenBoostApplied,
    isBrandInSpec,
    matchExplanation: reasons.join(' + ')
  };
}

/**
 * Canonical Transaction ID Generator:
 * Transaksi unik murni berdasarkan PO ID (purchId) dan Line Number (lineNumber).
 * Hospital code dan file source tidak diikutsertakan karena tidak relevan sebagai penentu keunikan transaksi.
 * Bila ada perpaduan PO ID dan Line Number yang sama, transaksi tersebut adalah transaksi yang sama
 * dan ID yang dihasilkan akan identik sehingga transaksi terbaru otomatis menimpa (upsert) yang lama.
 */
export function buildSpendRecordId(
  purchId: string | number | null | undefined,
  lineNumber: string | number | null | undefined,
  fallbackIndex?: number
): string {
  const rawPo = String(purchId ?? '').trim().toLowerCase();
  const safePo = rawPo ? rawPo.replace(/[^a-z0-9_-]/g, '_') : (fallbackIndex !== undefined ? `unknown_po_${fallbackIndex}` : 'unknown_po');
  
  const rawLine = String(lineNumber ?? '').trim();
  const parsedLineNum = parseInt(rawLine, 10);
  const safeLine = !isNaN(parsedLineNum) 
    ? String(parsedLineNum) 
    : (rawLine ? rawLine.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : (fallbackIndex !== undefined ? String(fallbackIndex) : '1'));
    
  return `po_${safePo}__line_${safeLine}`;
}

export interface SpendRecord {
  id: string;
  sourceFile: FileSourceType;
  sourceFileName: string;
  hospitalCode: string;
  archetype: string;
  createdDate: string; // ISO string or formatted date
  monthYear: string; // 'YYYY-MM'
  purchId: string;
  lineNumber: number | string;
  purchReqName: string;
  miiReferenceReqNum?: string; // MIIREFERENCEREQNUM from ERP (e.g. PRQ-2601-0003646)
  vendorName: string;
  itemId: string;
  itemName: string;
  rawItemName?: string; // Original full cell string from ERP Excel before line separation
  itemNotes?: string;   // Extracted operational notes from Line 2 and onwards
  extractedSkuCode?: string; // Master SKU Product ID extracted from '::' in PO itemName
  purchUnit: string;
  paymentTerm: string;
  purchaseCategory: string;
  documentState: string;
  purchasePool: string;
  purchStatusNamePo: string;
  procurementCategory: string;
  mappedCategory?: string;
  purchPrice: number;
  purchQty: number;
  lineDisc: number;
  linePercent: number;
  totalLineAmount: number;
  currency?: string;
  skuMasterId?: string;
  candidateSkuId?: string; // SkuMaster ID suggested for partial orphan (not confirmed)
  matchTier?: 'DIRECT_CODE' | 'DIRECT_ID' | 'EXACT_SYNTAX' | 'COMPONENT_EXACT' | 'FUZZY_HIGH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' | 'MANUAL';
  budgetGroup?: string;
  budgetCode?: string;
  taxonomyLv1?: string;
  taxonomyLv2?: string;
  taxonomyLv3?: string;
  taxonomyLv4?: string;
  taxonomyLv5?: string; // ItemKomoditas (Level 5)
  // SKU Decomposition fields: [ItemKomoditas];[Spec umum];[Brand];[PartNumber]
  commodityItem?: string; // Level 5 taxonomy
  generalSpec?: string;
  brand?: string;
  partNumber?: string;
  // Orphan status
  orphanStatus?: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN';
  orphanConfidenceScore?: number; // 0 - 100%
  orphanMatchReason?: string;
  // PR (Purchase Requisition) pairing attributes
  purchaseReqId?: string; // No PR, e.g. pr-0000-26-01-00001
  requester?: string; // username Requester, e.g. carren.mokalu
  requesterName?: string; // formatted / full name
  department?: string; // department mapped from username or PR description, e.g. Legal, Strategy & Commercial
  costCenter?: string; // Cost Center, e.g. 0003, 0013, 0015
  prSubject?: string; // Subject / Project Name, e.g. Professional fees Nindyo 2026
  prCategoryType?: string;
  prDocumentStatus?: string;
  prPairingKeyType?: 'PO' | 'PRQ' | 'UNPAIRED'; // Dual-key pairing identifier (PURCHID vs MIIREFERENCEREQNUM)
  vendorCity?: string;
  island?: string;
  region?: string;
  purchaseOrderNo?: string;
}

/**
 * Detects whether a record is a PR Summary reference record rather than a real PO Line transaction.
 * PR Summary records must NOT be treated as commercial PO spend or evaluated in PO Line compliance!
 */
export function isPrSummaryRecord(r: Partial<SpendRecord> | null | undefined): boolean {
  if (!r) return false;
  // 1. Explicit PR file source
  if (r.sourceFile === 'summary_pr' || (r.sourceFile as string) === 'pr_requisition') return true;

  // 2. Filename indicates PR summary and not an OPEX/CAPEX PO file
  const fileName = (r.sourceFileName || '').toLowerCase();
  if (
    (fileName.includes('summary_pr') || 
     fileName.includes('pr_summary') || 
     fileName.includes('rekap_pr') ||
     fileName.includes('summary pr') ||
     fileName.includes('requisition')) && 
    !r.sourceFile?.includes('pex') && 
    !fileName.includes('capex') && 
    !fileName.includes('opex')
  ) {
    return true;
  }

  // 3. Fake PO numbers derived from PR numbers
  const purchId = (r.purchId || '').toUpperCase().trim();
  if (purchId.startsWith('PR-') || purchId.startsWith('PRQ-') || purchId.startsWith('PR_') || purchId.startsWith('PRQ_')) {
    return true;
  }

  // 4. Record has purchaseReqId identical to purchId and zero price/qty
  if (r.purchaseReqId && r.purchId === r.purchaseReqId && (!r.purchPrice || r.purchPrice === 0) && (!r.purchQty || r.purchQty <= 1)) {
    return true;
  }

  return false;
}

export type OrphanFilterType = 
  | 'ALL' 
  | 'EXACT_MATCH' 
  | 'PARTIAL_ORPHAN' 
  | 'PARTIAL_40' 
  | 'PARTIAL_50' 
  | 'PARTIAL_60' 
  | 'PARTIAL_80' 
  | 'PARTIAL_90' 
  | 'FULL_ORPHAN';

export interface SpendFilterCriteria {
  searchQuery: string;
  hospitalCode: string;
  sourceFile: string;
  spendType: 'all' | 'CAPEX' | 'OPEX';
  category: string;
  vendorName: string;
  startDate: string;
  endDate: string;
  orphanFilter?: OrphanFilterType;
}

export interface SpendSummaryKPIs {
  totalSpend: number;
  totalTransactions: number;
  uniqueVendors: number;
  uniqueHospitals: number;
  totalCapexSpend: number;
  totalOpexSpend: number;
  averagePoAmount: number;
  // Exact PO-PR Pairing Metrics
  pairedTransactions?: number;
  unpairedTransactions?: number;
  pairedSpend?: number;
  unpairedSpend?: number;
  pairingRatePct?: number;
}

export interface MonthlyTrendItem {
  month: string;
  capex: number;
  opex: number;
  total: number;
}

export interface HospitalSpendItem {
  hospitalCode: string;
  spend: number;
  percentage: number;
}

export interface CategorySpendItem {
  category: string;
  spend: number;
  percentage: number;
}

export interface VendorSpendItem {
  vendorName: string;
  spend: number;
  transactionsCount: number;
}

export interface AiSpendInsight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  riskAreas: string[];
}

export interface ManualFilterField {
  include: string[]; // Array of keywords that MUST be present
  exclude: string[]; // Array of keywords that MUST NOT be present
}

export interface ManualFilterCard {
  id: string;
  commodity_remark_product?: ManualFilterField;
  commodity_l5?: ManualFilterField;
  item_specification?: ManualFilterField;
  brand_name?: ManualFilterField;
  part_number?: ManualFilterField;
  vendor_name?: ManualFilterField;
  hospital_code?: ManualFilterField;
  hospital_island?: ManualFilterField;
  vendor_city?: ManualFilterField;
  l1_taxonomy?: ManualFilterField;
  l2_taxonomy?: ManualFilterField;
  l3_taxonomy?: ManualFilterField;
  l4_taxonomy?: ManualFilterField;
  month?: ManualFilterField;
  day_of_month?: ManualFilterField;
  archetype?: ManualFilterField;
  budget_group?: ManualFilterField;
  purchase_category?: ManualFilterField;
  department?: ManualFilterField;
}

export interface ParsedQueryFilter {
  search_intent: string;
  product_keywords: {
    include: string[];
    exclude: string[];
  };
  entity_filters: {
    location_code?: string[];
    hospital_island?: string[];
    year?: string[];
    day_of_month?: string[];
    vendor_name?: string[];
    spend_category?: 'all' | 'CAPEX' | 'OPEX';
    min_amount?: number;
  };
  suggested_false_positives?: string[];
  taxonomy_hints?: string[];
}

export interface MonthlyBreakdownItem {
  month: string;
  spend: number;
  quantity: number;
  transactionsCount: number;
}

export interface TopVendorItem {
  vendorName: string;
  spend: number;
  quantity: number;
  transactionsCount: number;
}

export interface TopItemBreakdown {
  itemName: string;
  spend: number;
  quantity: number;
  unit?: string;
  transactionsCount: number;
}

export interface RankedVendorItem {
  vendorName: string;
  spend: number;
  poCount: number;
  sharePct: number;
  domicileCity?: string;
}

export interface AggregatedQueryStats {
  totalTransactions: number; // PO line records count
  totalPoLines?: number;     // Alias for total line records
  distinctPoCount: number;   // Count of distinct PO numbers (purchId)
  totalSpend: number;
  totalQuantity: number;
  averageUnitPrice: number;
  averagePoAmount: number;   // Average spend per distinct PO
  monthlyBreakdown: MonthlyBreakdownItem[];
  peakMonth?: {
    month: string;
    spend: number;
    quantity: number;
  };
  topVendors: TopVendorItem[];
  topItems: TopItemBreakdown[];
  // Enriched breakdowns for advanced natural language query answers
  topVendorRanked?: {
    winner: RankedVendorItem;
    rankingList: RankedVendorItem[];
  };
  breakdownByIsland?: Record<string, { spend: number; poCount: number; lineCount: number }>;
  breakdownByArchetype?: Record<string, { spend: number; poCount: number; hospitalCount: number }>;
  breakdownByVendorCity?: Record<string, { spend: number; poCount: number; vendorCount: number }>;
  breakdownByHospital?: Array<{ hospitalCode: string; hospitalName: string; spend: number; poCount: number }>;
  breakdownByDepartment?: Array<{ department: string; spend: number; poCount: number; lineCount: number; quantity: number }>;
  executionTimeMs: number;
  scannedRecordsCount: number;
  matchedRecordsCount: number;
}

export interface DiscoveredCandidates {
  relevantFields: string[];
  commoditiesL5?: string[];
  specifications?: string[];
  brands?: string[];
  hospitals?: string[];
  vendors?: string[];
  months?: string[];
  purchaseCategories?: string[];
  taxonomiesByLevel?: {
    l1: string[];
    l2: string[];
    l3: string[];
    l4: string[];
    l5: string[];
  };
  islands?: string[];
  archetypes?: string[];
  vendorCities?: string[];
  synonymsExpanded?: string[];
}

export interface CandidateTriageDecision {
  field: string;
  candidate: string;
  decision: 'INCLUDE' | 'EXCLUDE' | 'DISCARD';
  reason: string;
}

export interface CandidateTriageResult {
  search_intent: string;
  reasoningSummary: string;
  relevantFieldsTargeted: string[];
  candidateDecisions: CandidateTriageDecision[];
  suggestedCards: ManualFilterCard[];
  product_keywords: {
    include: string[];
    exclude: string[];
  };
  entity_filters: {
    location_code?: string[];
    year?: string[];
    vendor_name?: string[];
    spend_category?: 'all' | 'CAPEX' | 'OPEX';
    min_amount?: number;
  };
  suggested_false_positives?: string[];
  taxonomy_hints?: string[];
}

export interface QueryPipelineResult {
  query: string;
  parsedFilter: ParsedQueryFilter;
  aggregatedStats: AggregatedQueryStats;
  narrativeResponse: string;
  matchedRecords: SpendRecord[];
  timestamp: string;
  triageResult?: CandidateTriageResult;
  filterCards?: ManualFilterCard[];
  agenticTrace?: any;
}

export interface SavedAiQueryPreset {
  id: string;
  title: string;
  description: string;
  originalUserQuery: string;
  filterCards: ManualFilterCard[];
  parsedFilter?: ParsedQueryFilter;
  narrativeInsight?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedBatchMeta {
  id: string;
  fileName: string;
  fileType: string;
  recordCount: number;
  totalValue?: number;
  totalQty?: number;
  skippedCount?: number;
  uploadedAt: string;
}

export interface TokenLogEntry {
  id: string;
  timestamp: string;
  model: string;
  actionType: string;
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  costUsd: number;
  costIdr: number; // 1 USD = 18000 IDR
  promptText?: string;
  responseText?: string;
  metadata?: Record<string, any>;
}

export interface HospitalMasterRecord {
  id: string;
  hospitalCode: string;
  erpHospitalUnitCode?: string; // Kode hospital unit di ERP terdiri dari 4 karakter angka: 0000 s/d 9999
  hospitalName: string;
  city: string;
  region: string; // e.g. "Jabodetabek", "Jawa Barat", "Jawa Timur", "Sumatera Utara", "Bali", "Sulawesi Selatan", etc.
  island: string; // e.g. "Jawa", "Sumatera", "Bali & Nusa Tenggara", "Sulawesi", "Kalimantan", "Papua"
  tier?: string; // e.g. "Tertiary Hub", "Secondary Spoke", "Primary Clinic"
  hospitalTier?: string;
  bedCapacity?: number;
  address?: string;
  isActive?: boolean;
}

export interface VendorMasterRecord {
  id: string;
  vendorCode: string;
  vendorName: string;
  category?: string;
  primaryCategory?: string;
  domicileCity: string;
  domicileRegion: string;
  domicileIsland: string;
  npwp?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  paymentTermDefault?: string;
  tierRating?: 'Tier 1 - Preferred' | 'Tier 2 - Approved' | 'Tier 3 - Under Review' | 'Tier 4 - High Risk' | 'Tier 1 Strategic' | 'Tier 2 Preferred' | 'Tier 3 Tactical' | string;
  status?: 'ACTIVE' | 'FLAGGED_PRICE_HIKE' | 'SUSPENDED' | 'UNDER_REVIEW';
  isActive?: boolean;
  notes?: string;
}

export interface PriceSurgeItem {
  id: string;
  itemId: string;
  itemName: string;
  vendorName: string;
  startMonth: string;
  latestMonth: string;
  initialPrice: number;
  latestPrice: number;
  minPrice: number;
  maxPrice: number;
  priceDelta: number;
  percentageIncrease: number;
  totalQtyPurchased: number;
  totalSpend: number;
  estimatedExtraCost: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'STABLE';
}

export interface IntraVendorDiscrepancyItem {
  id: string;
  vendorName: string;
  itemId: string;
  itemName: string;
  minPrice: number;
  minPriceHospital: string;
  minPriceMonth: string;
  maxPrice: number;
  maxPriceHospital: string;
  maxPriceMonth: string;
  priceVariancePct: number;
  priceDeltaIDR: number;
  totalQtyAtHigherPrice: number;
  totalLeakageAmount: number; // Potential money saved if all purchases had been at the vendor's own minimum price
  hospitalsInvolved: string[];
}

export interface VendorSwitchingOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  currentVendor: string;
  currentAvgPrice: number;
  currentQty: number;
  currentTotalSpend: number;
  priceIncreasePct: number;
  alternativeVendor: string;
  alternativePrice: number;
  alternativePriceVariancePct: number;
  unitSavingIDR: number;
  totalPotentialSavingIDR: number;
  savingPct: number;
  recommendationNote: string;
  feasibilityScore: 'HIGH' | 'MEDIUM' | 'REQUIRES_CONTRACT_REVIEW';
}

export interface RegionalPriceAnalysisItem {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  island: string;
  region: string;
  city: string;
  hospitalCode: string;
  hospitalName: string;
  actualAvgPrice: number;
  benchmarkJabodetabekPrice: number;
  regionalPriceIndex: number; // e.g. 115% vs Jabodetabek 100%
  expectedFairLogisticsMarkupPct: number; // e.g. 5-8% for Outer Islands
  excessiveMarkupPct: number; // actual markup - expected fair markup
  isExcessiveMarkup: boolean;
  totalSpend: number;
  totalQty: number;
  potentialFairAdjustmentSaving: number;
}

export interface StandardPriceAuditItem {
  id: string;
  productId: string;
  itemId: string;
  itemName: string;
  category: string;
  standardPriceERP: number; // Price registered in SKU Master / ERP reference
  actualMinPrice: number;
  actualAvgPrice: number;
  actualMaxPrice: number;
  priceVarianceVsStandardPct: number; // ((actualAvg - standard) / standard) * 100
  totalSpend: number;
  totalQty: number;
  auditClassification: 'OVERPRICED_PURCHASE' | 'STANDARD_TOO_HIGH' | 'OPTIMAL_MATCH' | 'NO_ERP_STANDARD';
  skuTeamActionRequired: string;
  recommendedNewStandardPrice: number;
}

export interface SuggestedSkuMatch {
  sku: SkuMasterRecord;
  similarityScore: number; // 0 to 100
  matchReason: string;
  matchType: 'EXACT_CODE' | 'EXACT_NAME' | 'TOKEN_SIMILARITY' | 'SYNONYM_MATCH' | 'CATEGORY_MATCH';
}

export interface UnmatchedItemSummary {
  id: string; // key (e.g. itemName normalized)
  itemName: string;
  itemIds: string[];
  // Decomposed SKU components for the transaction item
  commodityItem: string; // Level 5 taxonomy
  generalSpec?: string;
  brand?: string;
  partNumber?: string;
  // Orphan classification scale
  orphanStatus: 'PARTIAL_ORPHAN' | 'FULL_ORPHAN';
  orphanConfidenceScore: number; // 0 to 100%
  orphanExplanation?: string;
  candidateSkuId?: string;
  candidateSku?: SkuMasterRecord;
  candidateMatchReason?: string;
  bestMatchedSku?: SkuMasterRecord;
  bestMatchedComponents?: {
    commodityMatch: boolean;
    specMatch: boolean;
    brandMatch: boolean;
    partNumberMatch: boolean;
  };
  procurementCategory: string;
  mappedCategory?: string;
  purchUnits: string[];
  transactionCount: number;
  totalSpend: number;
  totalQty: number;
  avgUnitPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  hospitals: Array<{ code: string; count: number; spend: number }>;
  vendors: Array<{ name: string; count: number; spend: number }>;
  samplePurchIds: string[];
  firstSeenDate: string;
  lastSeenDate: string;
  suggestedMatches: SuggestedSkuMatch[];
}

export interface MaintenanceHealthStats {
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  transactionMatchRatePct: number;
  totalSpendAmount: number;
  matchedSpendAmount: number;
  unmatchedSpendAmount: number;
  spendMatchRatePct: number;
  totalUniqueItemsInTx: number;
  matchedUniqueItems: number;
  unmatchedUniqueItems: number;
  itemMatchRatePct: number;
  // Orphan item scale stats
  partialOrphanTransactions?: number;
  fullOrphanTransactions?: number;
  partialOrphanSpendAmount?: number;
  fullOrphanSpendAmount?: number;
  partialOrphanUniqueItems?: number;
  fullOrphanUniqueItems?: number;
  totalMasterSkus: number;
  skusWithStandardPrice: number;
  skusMissingStandardPrice: number;
  skusWithFullTaxonomy: number;
  skusMissingTaxonomy: number;
  totalMasterHospitals: number;
  totalMasterVendors: number;
}

export interface MaintenanceCacheData {
  id: string; // 'maintenance_summary'
  unmatchedList: UnmatchedItemSummary[];
  healthStats: MaintenanceHealthStats;
  lastUpdated: string;
  recordsCount: number;
  skusCount: number;
  hospitalsCount: number;
  vendorsCount: number;
}

export interface PrecalculatedCubeAggregates {
  id: string; // 'latest_aggregates'
  computedAt: string;
  recordsCount: number;
  skusCount: number;
  kpis: SpendSummaryKPIs;
  topVendors: VendorSpendItem[];
  topCategories: CategorySpendItem[];
  hospitalSpend: HospitalSpendItem[];
  monthlyTrend: MonthlyTrendItem[];
  orphanStats: {
    partialOrphanCount: number;
    partialOrphanSpend: number;
    fullOrphanCount: number;
    fullOrphanSpend: number;
    matchedSpendAmount: number;
    totalSpendAmount: number;
    spendMatchRatePct: number;
    itemMatchRatePct: number;
  };
  healthStats: MaintenanceHealthStats;
  prPairingStats?: {
    totalTransactions: number;
    pairedTransactions: number;
    unpairedTransactions: number;
    pairedSpend: number;
    unpairedSpend: number;
    pairedPercentage: number;
    pairedByPrqCount: number;
    pairedByPoCount: number;
    uniqueRequesters: number;
    uniqueDepartments: number;
  };
  aiSummaryPromptContext: string; // Compact Markdown text optimized for AI API (< 1,000 tokens)
}

export interface PurchaseRequisitionRecord {
  id: string; // e.g. "pr-0000-26-01-00001" or unique key
  unit: string; // 4-digit ERP Hospital Unit Code, e.g. "0000"
  purchaseReqId: string; // No PR, e.g. "pr-0000-26-01-00001"
  subject: string; // Subject / Project Name, e.g. "Professional fees Nindyo 2026"
  categoryType?: string; // e.g. "professional fees (consultant)", "other opex"
  documentStatus?: string; // e.g. "Approved"
  requester: string; // username, e.g. "carren.mokalu"
  costCenter: string; // e.g. "0003"
  description?: string; // e.g. "legal", "strategy and commercial", "procurement"
  waitingTo?: string;
  erpId: string; // PO Number in ERP, e.g. "PO-0000-2..." which pairs to SpendRecord.purchId, or PRQ code which pairs to MIIREFERENCEREQNUM
  purchId?: string; // Direct PO reference if mapped separately
  createdDate?: string;
  submittedDate?: string;
  totalAmount?: number;
  pairingStatus?: 'PAIRED_PO' | 'PAIRED_PRQ' | 'UNPAIRED';
  pairedPoCount?: number;
  matchedSpendCount?: number;
}

export interface UserDepartmentMappingRecord {
  id: string;
  username: string; // e.g. "carren.mokalu"
  fullName: string; // e.g. "Carren Mokalu"
  department: string; // e.g. "Legal"
  costCenter?: string; // e.g. "0003"
  hospitalUnitCode?: string; // 4-digit code e.g. "0000"
  hospitalName?: string; // e.g. "Siloam Hospitals Head Office CGP"
  email?: string;
  title?: string;
  isActive?: boolean;
}

/**
 * Enterprise Department Master Record (Clean & Standardized Registry for AI Copilot Reference)
 */
export interface DepartmentMasterRecord {
  id: string; // Unique ID, e.g. "dept-fo", "dept-fms-ga"
  departmentCode: string; // e.g. "FO", "FMS-GA", "PHARM", "RAD", "ICU"
  cleanDepartmentName: string; // Canonical name: e.g. "Front Office", "Facility Management Service & General Affair (FMS - GA)"
  divisionCategory: string; // e.g. "Frontlines & Hospitality", "General Affairs & Facilities", "Clinical Inpatient", etc.
  rawAliases: string[]; // Variations: ['front office', 'fo', 'admission', 'admisi', 'reception', 'customer service']
  costCenters?: string[]; // e.g. ["1035", "1036"]
  assignedHospitalCodes?: string[]; // ["ALL"] or specific hospital codes
  description?: string;
  isActive: boolean;
  isAiReference: boolean; // Flag status: actively referenced by AI Spend Copilot during semantic matching
  transactionCount?: number; // Cached count of transactions matching this department
  totalSpend?: number; // Cached sum of spend matching this department (IDR)
  requesterCount?: number; // Count of requesters linked to this department
  sampleRequesters?: string[]; // Sample usernames
  sampleHospitals?: string[]; // Hospital codes where this dept has activity
  updatedAt?: string;
}

/**
 * Raw Department Discovery Item from uploaded spend/PR files
 */
export interface RawDepartmentDiscoveryItem {
  rawName: string;
  source: 'SPEND_UPLOAD' | 'PR_UPLOAD' | 'USER_DIRECTORY';
  occurrences: number;
  totalSpend: number;
  matchedDepartmentId?: string;
  matchedCleanName?: string;
  matchConfidence: number; // 0 to 1
  isMapped: boolean;
  suggestedAliases?: string[];
}

export interface SkuMappingCacheRecord {
  itemKey: string; // unique normalized item name key
  rawItemName: string;
  matchedSkuId: string | null;
  candidateSkuId?: string | null;
  orphanStatus: 'EXACT_MATCH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN';
  matchTier?: 'DIRECT_CODE' | 'DIRECT_ID' | 'EXACT_SYNTAX' | 'COMPONENT_EXACT' | 'FUZZY_HIGH' | 'PARTIAL_ORPHAN' | 'FULL_ORPHAN' | 'MANUAL';
  confidenceScore: number;
  matchReason: string;
  matchedSku?: SkuMasterRecord | null;
  candidateSku?: SkuMasterRecord | null;
  taxonomy: {
    taxonomyLv1: string;
    taxonomyLv2: string;
    taxonomyLv3: string;
    taxonomyLv4: string;
    taxonomyLv5: string;
    brand: string;
    spec: string;
    partNumber: string;
  };
  updatedAt: number;
}

export interface SavedGoogleSkuSearchItem {
  productId: string;
  commodityItem: string;
  brand: string;
  partNumber: string;
  specLine: string;
  purchCategoryLv1: string;
  purchCategoryLv2: string;
  unitOfMeasurement: string;
  isVirtualSku?: boolean;
  totalSpend: number;
  totalQty: number;
  transactionCount: number;
}

export interface SavedGoogleSkuSearchPreset {
  id: string;
  title: string;
  description?: string;
  searchQuery: string;
  brandFilter?: string;
  selectedCategory?: string;
  selectedItems: SavedGoogleSkuSearchItem[];
  selectedProductIds: string[];
  createdAt: string;
  updatedAt: string;
}
