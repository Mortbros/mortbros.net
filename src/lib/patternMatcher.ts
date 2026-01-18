import type { NameMapping } from "./interfaces";

interface PatternSegment {
    type: 'literal' | 'regex' | 'nameSlot';
    content: string;
    regexPattern?: RegExp;
}

/**
 * Parses a mapping key into segments (literal, regex, or <p>/<p,> patterns)
 */
export function parseKey(key: string): PatternSegment[] {
    const segments: PatternSegment[] = [];
    let i = 0;

    while (i < key.length) {
        // Check for regex pattern: /pattern/flags
        if (key[i] === '/') {
            const regexEnd = key.indexOf('/', i + 1);
            if (regexEnd > i) {
                const pattern = key.slice(i + 1, regexEnd);
                const flags = key.slice(regexEnd + 1);
                try {
                    const regex = new RegExp(pattern, flags);
                    segments.push({
                        type: 'regex',
                        content: key.slice(i, regexEnd + 1 + flags.length),
                        regexPattern: regex
                    });
                    i = regexEnd + 1 + flags.length;
                    continue;
                } catch (e) {
                    // Invalid regex, treat as literal
                }
            }
        }

        // Check for name slot: <p> or <p,>
        // Check <p,> first (4 chars) before <p> (3 chars) to avoid partial match
        if (key[i] === '<') {
            if (key.slice(i, i + 4) === '<p,>') {
                segments.push({
                    type: 'nameSlot',
                    content: '<p,>'
                });
                i += 4;
                continue;
            } else if (key.slice(i, i + 3) === '<p>') {
                segments.push({
                    type: 'nameSlot',
                    content: '<p>'
                });
                i += 3;
                continue;
            }
        }

        // Literal text - collect until we hit a special character
        let literalEnd = i;
        while (literalEnd < key.length) {
            if (key[literalEnd] === '/' || key[literalEnd] === '<') {
                break;
            }
            literalEnd++;
        }

        if (literalEnd > i) {
            segments.push({
                type: 'literal',
                content: key.slice(i, literalEnd)
            });
            i = literalEnd;
        } else {
            i++;
        }
    }

    return segments;
}

/**
 * Builds a regex pattern from segments that can match and capture name characters
 */
function buildMatchingPattern(segments: PatternSegment[], nameMappingKeys: string[]): {
    pattern: RegExp;
    nameSlotIndices: number[];
} {
    const nameSlotIndices: number[] = [];
    const patternParts: string[] = ['^'];
    let captureGroupIndex = 1;

    // Sort name mapping keys by length (longest first) for greedy matching
    const sortedKeys = [...nameMappingKeys].sort((a, b) => b.length - a.length);
    // Escape special regex characters in name keys
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Create patterns: single match for <p>, multiple for <p,>
    // For <p,>, use non-capturing group for alternation, then wrap quantifier in capture group
    // This ensures we capture the entire sequence, not just the last match
    const namePatternSingle = `(${escapedKeys.join('|')})`;
    const namePatternMultiple = `((?:${escapedKeys.join('|')})+)`;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) continue;

        if (segment.type === 'literal') {
            // Escape special regex characters
            patternParts.push(segment.content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        } else if (segment.type === 'regex') {
            // Extract pattern from /pattern/flags
            const regexMatch = segment.content.match(/^\/(.+)\/(.*)$/);
            if (regexMatch) {
                patternParts.push(`(${regexMatch[1]})`);
                captureGroupIndex++; // Regex also creates a capture group
            }
        } else if (segment.type === 'nameSlot') {
            // Use single match for <p>, multiple for <p,>
            const pattern = segment.content === '<p,>' ? namePatternMultiple : namePatternSingle;
            patternParts.push(pattern);
            nameSlotIndices.push(captureGroupIndex);
            captureGroupIndex++;
        }
    }

    patternParts.push('$');
    const pattern = new RegExp(patternParts.join(''));

    return { pattern, nameSlotIndices };
}

/**
 * Greedily matches name characters against name mappings (longest match first)
 */
function matchNameCharacters(
    nameChars: string,
    nameMappings: NameMapping[]
): string[] {
    const results: string[] = [];
    let remaining = nameChars;

    // Sort mappings by key length (longest first) for greedy matching
    const sortedMappings = [...nameMappings].sort((a, b) => b.key.length - a.key.length);

    while (remaining.length > 0) {
        let matched = false;

        for (const mapping of sortedMappings) {
            if (remaining.startsWith(mapping.key)) {
                results.push(mapping.value);
                remaining = remaining.slice(mapping.key.length);
                matched = true;
                break;
            }
        }

        if (!matched) {
            // No mapping found for this character, skip it
            remaining = remaining.slice(1);
        }
    }

    return results;
}

/**
 * Tests if input matches a key pattern and extracts matched data
 */
export function matchPattern(
    input: string,
    key: string,
    nameMappings: NameMapping[]
): { matched: boolean; matchedNames: string[] } {
    const segments = parseKey(key);
    const hasNameSlot = segments.some(s => s.type === 'nameSlot');

    if (!hasNameSlot) {
        return { matched: false, matchedNames: [] };
    }

    const nameMappingKeys = nameMappings.map(m => m.key);
    const { pattern, nameSlotIndices } = buildMatchingPattern(segments, nameMappingKeys);

    const match = input.match(pattern);
    if (!match) {
        return { matched: false, matchedNames: [] };
    }

    // Extract name characters from the first name slot
    if (nameSlotIndices.length > 0) {
        const nameSlotIndex = nameSlotIndices[0];
        if (nameSlotIndex !== undefined) {
            const nameChars = match[nameSlotIndex];
            if (nameChars) {
                const matchedNames = matchNameCharacters(nameChars, nameMappings);
                return { matched: true, matchedNames };
            }
        }
    }

    return { matched: false, matchedNames: [] };
}

/**
 * Expands a value template by replacing <p> with comma-separated names
 */
export function expandValue(value: string, names: string[]): string {
    if (names.length === 0) {
        return value.replace(/<p>/g, '');
    }

    const namesText = names.join(', ');
    return value.replace(/<p>/g, namesText);
}
