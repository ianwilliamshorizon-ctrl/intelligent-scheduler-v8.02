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
                            if (nextChar === '}' || nextChar === ']') {
                                isClosing = true;
                            } else if (nextChar === '"') {
                                // Find the end of the next string in the lookahead
                                let nextEscaped = false;
                                let nextEndIdx = -1;
                                for (let j = 1; j < afterComma.length; j++) {
                                    if (nextEscaped) {
                                        nextEscaped = false;
                                    } else if (afterComma[j] === '\\') {
                                        nextEscaped = true;
                                    } else if (afterComma[j] === '"') {
                                        nextEndIdx = j;
                                        break;
                                    }
                                }
                                if (nextEndIdx !== -1) {
                                    const afterNextString = afterComma.slice(nextEndIdx + 1).trimStart();
                                    // In JSON, a key string must be followed by a colon ':'
                                    // An array element string can be followed by a comma ',' or closing bracket ']'
                                    if (afterNextString.length > 0 && (afterNextString[0] === ':' || afterNextString[0] === ']' || afterNextString[0] === ',')) {
                                        if (afterNextString[0] === ',') {
                                            // If it's followed by a comma, the token after that comma must be a valid JSON value/key start
                                            const afterNextComma = afterNextString.slice(1).trimStart();
                                            if (afterNextComma.length > 0) {
                                                if (/^[{"\[tf\-0-9]/.test(afterNextComma)) {
                                                    isClosing = true;
                                                }
                                            }
                                        } else {
                                            isClosing = true;
                                        }
                                    }
                                }
                            } else if (nextChar === '{' || nextChar === '[') {
                                isClosing = true;
                            } else if (/^(?:true\b|false\b|null\b|-?\d)/.test(afterComma)) {
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
