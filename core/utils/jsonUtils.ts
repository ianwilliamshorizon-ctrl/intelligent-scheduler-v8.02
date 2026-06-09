/**
 * REPAIR JSON STRING
 * Heuristically repairs invalid JSON from AI responses:
 * 1. Removes trailing commas in objects and arrays.
 * 2. Replaces raw unescaped newlines inside string values with '\n'.
 * 3. Escapes unescaped double quotes inside string values.
 */
export const repairJsonString = (str: string): string => {
    let cleaned = str;

    // 1. Strip single-line comments (// ...) and multi-line comments (/* ... */)
    cleaned = cleaned.replace(/(?<!:|https|http)\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Convert single-quoted keys to double quotes (handles hyphens, spaces, etc.)
    cleaned = cleaned.replace(/'((?:[^'\\]|\\.)*)'\s*:/g, '"$1":');

    // 3. Convert single-quoted string values to double-quoted ones
    cleaned = cleaned.replace(/(?<=[:,\s\[\{])'((?:[^'\\]|\\.)*)'(?=\s*[,\]\}]|$)/g, (match, p1) => {
        const unescapedSingle = p1.replace(/\\'/g, "'").replace(/"/g, '\\"');
        return `"${unescapedSingle}"`;
    });

    // 4. Wrap unquoted keys (e.g. name: -> "name":)
    cleaned = cleaned.replace(/(?<=[{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '"$1":');

    // 5. Remove trailing commas in objects and arrays
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // 6. Fix unescaped raw newlines and unescaped double quotes inside string values using context stack
    let result = '';
    let inString = false;
    let isEscaped = false;
    let stringType = null; // 'key' | 'value'
    let lastStructuralChar = '';
    const contextStack: string[] = [];

    function isValidValueStart(s: string): boolean {
        const t = s.trimStart();
        if (t === '') return false;
        const c = t[0];
        if (c === '"' || c === "'" || c === '{' || c === '[' || c === '-' || (c >= '0' && c <= '9')) return true;
        if (t.startsWith('true') || t.startsWith('false') || t.startsWith('null')) return true;
        return false;
    }

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];

        if (!inString) {
            // Check for unquoted key start
            const remaining = cleaned.slice(i);
            const unquotedKeyMatch = remaining.match(/^([a-zA-Z0-9_-]+)\s*:/);
            if (unquotedKeyMatch) {
                const keyName = unquotedKeyMatch[1];
                result += `"${keyName}"`;
                i += keyName.length - 1; // advance to the end of keyName
                lastStructuralChar = ''; // will be set to ':' when loop processes ':'
                continue;
            }

            if (char === '"') {
                inString = true;
                isEscaped = false;
                const currentContext = contextStack[contextStack.length - 1];
                if (currentContext === '[') {
                    stringType = 'value';
                } else if (lastStructuralChar === ':') {
                    stringType = 'value';
                } else {
                    stringType = 'key';
                }
                result += '"';
            } else {
                if (char === '{' || char === '[') {
                    contextStack.push(char);
                    lastStructuralChar = char;
                } else if (char === '}') {
                    if (contextStack[contextStack.length - 1] === '{') {
                        contextStack.pop();
                    }
                    lastStructuralChar = char;
                } else if (char === ']') {
                    if (contextStack[contextStack.length - 1] === '[') {
                        contextStack.pop();
                    }
                    lastStructuralChar = char;
                } else if (char === ',' || char === ':') {
                    lastStructuralChar = char;
                } else if (lastStructuralChar === ':' && !/\s/.test(char)) {
                    lastStructuralChar = 'v';
                }
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
                const remaining = cleaned.slice(i + 1);
                const trimmed = remaining.trimStart();
                let isClosing = false;
                let insertComma = false;
                const currentContext = contextStack[contextStack.length - 1];

                if (trimmed === '') {
                    isClosing = true;
                } else if (stringType === 'key') {
                    if (trimmed[0] === ':') {
                        isClosing = true;
                    }
                } else if (stringType === 'value') {
                    const nextChar = trimmed[0];
                    if (currentContext === '[') {
                        if (nextChar === ']') {
                            const afterBracket = trimmed.slice(1).trimStart();
                            if (afterBracket === '' || afterBracket[0] === ',' || afterBracket[0] === '}' || afterBracket[0] === ']') {
                                isClosing = true;
                            }
                        } else if (nextChar === ',') {
                            const afterComma = trimmed.slice(1).trimStart();
                            if (afterComma === '' || afterComma[0] === ']') {
                                isClosing = true;
                            } else if (isValidValueStart(afterComma)) {
                                isClosing = true;
                            }
                        }
                    } else {
                        if (nextChar === '}') {
                            const afterBrace = trimmed.slice(1).trimStart();
                            if (afterBrace === '' || afterBrace[0] === ',' || afterBrace[0] === '}' || afterBrace[0] === ']') {
                                isClosing = true;
                            }
                        } else if (nextChar === ',') {
                            const afterComma = trimmed.slice(1).trimStart();
                            if (afterComma === '' || afterComma[0] === '}') {
                                isClosing = true;
                            } else if (afterComma[0] === '"') {
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
                                    if (afterNextString.length > 0 && afterNextString[0] === ':') {
                                        isClosing = true;
                                    }
                                }
                            }
                        } else if (nextChar === '"') {
                            const doubleQuoteKeyMatch = trimmed.match(/^"([^"\\]|\\.)*"\s*:/);
                            if (doubleQuoteKeyMatch) {
                                const afterColon = trimmed.slice(doubleQuoteKeyMatch[0].length);
                                if (isValidValueStart(afterColon)) {
                                    isClosing = true;
                                    insertComma = true;
                                }
                            }
                        } else {
                            const unquotedKeyMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:/);
                            if (unquotedKeyMatch) {
                                const afterColon = trimmed.slice(unquotedKeyMatch[0].length);
                                if (isValidValueStart(afterColon)) {
                                    isClosing = true;
                                    insertComma = true;
                                }
                            }
                        }
                    }
                }

                if (isClosing) {
                    inString = false;
                    result += '"';
                    if (insertComma) {
                        result += ',';
                        lastStructuralChar = ',';
                    } else if (stringType === 'value') {
                        lastStructuralChar = '';
                    }
                } else {
                    result += '\\"';
                }
            } else {
                result += char;
            }
        }
    }

    if (inString) {
        result += '"';
        if (stringType === 'key') {
            result += ': null';
        }
    } else if (lastStructuralChar === ':') {
        result += 'null';
    }

    while (contextStack.length > 0) {
        const last = contextStack.pop();
        if (last === '{') {
            result += '}';
        } else if (last === '[') {
            result += ']';
        }
    }

    return result;
};
