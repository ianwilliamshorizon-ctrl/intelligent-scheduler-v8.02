import { describe, it, expect } from 'vitest';
import { repairJsonString } from '../../core/utils/jsonUtils';

describe('repairJsonString', () => {
    it('handles valid JSON without modification', () => {
        const input = '{"name": "Admin", "id": 123}';
        expect(JSON.parse(repairJsonString(input))).toEqual({
            name: "Admin",
            id: 123
        });
    });

    it('removes trailing commas', () => {
        const input = '{"name": "Admin", "items": [1, 2, ],}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            name: "Admin",
            items: [1, 2]
        });
    });

    it('escapes unescaped double quotes inside string values', () => {
        const input = '{"description": "We use "genuine" Panel Alcantara fabric for best stretch"}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            description: 'We use "genuine" Panel Alcantara fabric for best stretch'
        });
    });

    it('replaces raw newlines inside string values with escaped newlines', () => {
        const input = '{\n  "explanation": "Line 1\nLine 2\nLine 3"\n}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            explanation: "Line 1\nLine 2\nLine 3"
        });
    });

    it('handles mixed issues: trailing commas, raw newlines, and unescaped quotes', () => {
        const input = '{\n  "explanation": "Materials: "genuine" Alcantara\n- Cost: £50\n- Optional: yes",\n  "quantity": 2,\n}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            explanation: 'Materials: "genuine" Alcantara\n- Cost: £50\n- Optional: yes',
            quantity: 2
        });
    });
});
