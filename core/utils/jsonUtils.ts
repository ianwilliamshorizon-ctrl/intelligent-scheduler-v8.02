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
                // Better lookahead check to determine if this is the closing quote of a string key or value
                const remaining = cleaned.slice(i + 1);
                const trimmed = remaining.trimStart();
                let isClosing = false;

                if (trimmed === '') {
                    isClosing = true;
                } else {
                    const firstChar = trimmed[0];
                    if (firstChar === ':' || firstChar === '}' || firstChar === ']') {
                        isClosing = true;
                    } else if (firstChar === ',') {
                        const afterComma = trimmed.slice(1).trimStart();
                        if (afterComma === '') {
                            isClosing = true;
                        } else {
                            const nextChar = afterComma[0];
                            // Valid next elements after a comma in JSON are:
                            // - '"' (next key or next string element)
                            // - '{' or '[' (next object or array element)
                            // - '}' or ']' (trailing comma before closing brace/bracket)
                            // - boolean, null, or a number
                            if (nextChar === '"' || nextChar === '}' || nextChar === ']' || 
                                nextChar === '{' || nextChar === '[' || 
                                /^(?:true\b|false\b|null\b|-?\d)/.test(afterComma)) {
                                isClosing = true;
                            }
                        }
                    }
                }

                if (isClosing) {
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
