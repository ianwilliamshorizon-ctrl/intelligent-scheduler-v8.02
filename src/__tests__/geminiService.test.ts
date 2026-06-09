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

    it('retains unescaped double quotes followed by commas inside string values', () => {
        const input = '{\n  "explanation": "We use "genuine", non-backed Panel Alcantara fabric for curves.",\n  "quantity": 1\n}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            explanation: 'We use "genuine", non-backed Panel Alcantara fabric for curves.',
            quantity: 1
        });
    });

    it('handles nested braces and brackets inside string values', () => {
        const input = '{\n  "explanation": "We need to check the following: { \'brakes\': \'worn\' } or [ \'pads\', \'discs\' ].",\n  "extractedLineItems": []\n}';
        const repaired = repairJsonString(input);
        expect(JSON.parse(repaired)).toEqual({
            explanation: 'We need to check the following: { "brakes": "worn" } or [ "pads", "discs" ].',
            extractedLineItems: []
        });
    });

    it('handles missing commas between keys with double-quoted and unquoted keys', () => {
        const input1 = `{
            "description": "MOT"
            "quantity": 1
        }`;
        expect(JSON.parse(repairJsonString(input1))).toEqual({
            description: "MOT",
            quantity: 1
        });

        const input2 = `{
            "description": "MOT"
            quantity_2: 1
        }`;
        expect(JSON.parse(repairJsonString(input2))).toEqual({
            description: "MOT",
            quantity_2: 1
        });
    });

    it('handles truncated JSON ending inside key, value, or at colon', () => {
        const inputKey = `{
            "extractedLineItems": [
                {
                    "descrip`;
        expect(JSON.parse(repairJsonString(inputKey))).toEqual({
            extractedLineItems: [
                {
                    descrip: null
                }
            ]
        });

        const inputValue = `{
            "extractedLineItems": [
                {
                    "description": "MOT`;
        expect(JSON.parse(repairJsonString(inputValue))).toEqual({
            extractedLineItems: [
                {
                    description: "MOT"
                }
            ]
        });

        const inputColon = `{
            "extractedLineItems": [
                {
                    "description": `;
        expect(JSON.parse(repairJsonString(inputColon))).toEqual({
            extractedLineItems: [
                {
                    description: null
                }
            ]
        });
    });
});
