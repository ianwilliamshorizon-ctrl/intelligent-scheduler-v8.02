/**
 * REPAIR JSON STRING
 * Heuristically repairs invalid JSON from AI responses:
 * 1. Removes trailing commas in objects and arrays.
 * 2. Replaces raw unescaped newlines inside string values with '\n'.
 * 3. Escapes unescaped double quotes inside string values.
 */
export const repairJsonString = (str: string): string => {
    // 1. Remove trailing commas in objects and arrays
    let cleaned = str.replace(/,(\s*[}\]])/g, '$1');

    // 2. Fix unescaped raw newlines and double quotes inside string values
    let result = '';
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];

        if (!inString) {
            if (char === '"') {
                inString = true;
                isEscaped = false;
                result += '"';
            } else {
                result += char;
            }
        } else {
            if (isEscaped) {
                result += char;
                isEscaped = false;
            } else if (char === '\\') {
                isEscaped = true;
                result += '\\';
            } else if (char === '\n' || char === '\r') {
                result += '\\n';
            } else if (char === '"') {
                // Lookahead to find if this is a closing quote
                let nextNonWs = '';
                for (let j = i + 1; j < cleaned.length; j++) {
                    const c = cleaned[j];
                    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
                        nextNonWs = c;
                        break;
                    }
                }

                if (nextNonWs === ',' || nextNonWs === ':' || nextNonWs === '}' || nextNonWs === ']' || nextNonWs === '') {
                    inString = false;
                    result += '"';
                } else {
                    // Unescaped quote inside string value -> escape it!
                    result += '\\"';
                }
            } else {
                result += char;
            }
        }
    }

    return result;
};
