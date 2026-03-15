import { Vehicle, InspectionDiagram } from '../../types';

/**
 * Calculates the Levenshtein distance between two strings.
 * This is a measure of the difference between two sequences.
 */
const levenshtein = (s1: string, s2: string): number => {
    if (s1.length < s2.length) { return levenshtein(s2, s1); }

    const s2len = s2.length;
    if (s1.length === s2len && s1 === s2) { return 0; }

    let previousRow = Array.from({ length: s2len + 1 }, (_, i) => i);
    
    for (let i = 0; i < s1.length; i++) {
        let currentRow = [i + 1];
        for (let j = 0; j < s2len; j++) {
            const insertions = previousRow[j + 1] + 1;
            const deletions = currentRow[j] + 1;
            const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
            currentRow.push(Math.min(insertions, deletions, substitutions));
        }
        previousRow = currentRow;
    }

    return previousRow[s2len];
};

/**
 * Finds the best inspection diagram for a given vehicle based on make and model with a scoring system,
 * including fuzzy matching for the make.
 *
 * @param vehicle The vehicle to find a diagram for.
 * @param diagrams The list of all available inspection diagrams.
 * @returns The ID of the best-matched inspection diagram, or null if no suitable match is found.
 */
export const findBestDiagramMatch = (vehicle: Vehicle, diagrams: InspectionDiagram[]): string | null => {
    if (!vehicle || !diagrams || diagrams.length === 0) {
        return null;
    }

    const vehicleMake = vehicle.make.toLowerCase().trim();
    const vehicleModel = vehicle.model.toLowerCase().trim();

    let bestMatchId: string | null = null;
    let highestScore = -1;

    for (const diagram of diagrams) {
        const diagramMake = diagram.make.toLowerCase().trim();
        const diagramModel = diagram.model.toLowerCase().trim();
        let currentScore = 0;
        let makeMatchFactor = 0;

        // Priority 1: Exact make match.
        if (diagramMake === vehicleMake) {
            makeMatchFactor = 1.0;
        } 
        // Priority 2: Fuzzy make match for typos.
        // Allow a Levenshtein distance of up to 2 for makes longer than 3 characters.
        else if (diagramMake.length > 3 && levenshtein(diagramMake, vehicleMake) <= 2) {
            makeMatchFactor = 0.9; // Apply a small penalty for the fuzzy match.
        }

        if (makeMatchFactor > 0) {
            let modelScore = 0;
            // Exact model match is highest priority.
            if (diagramModel === vehicleModel) {
                modelScore = 5;
            // Vehicle model contains diagram model (e.g., Veh: "911 GT3 RS", Dia: "911 GT3").
            } else if (vehicleModel.includes(diagramModel) && diagramModel.length > 0) {
                modelScore = 3 + (diagramModel.length / vehicleModel.length); // Favor more specific matches.
            // Make-only match is the fallback.
            } else {
                modelScore = 1;
            }
            currentScore = modelScore * makeMatchFactor;
        }

        if (currentScore > highestScore) {
            highestScore = currentScore;
            bestMatchId = diagram.id;
        }
    }

    // Only return a match if the score is reasonably high.
    // A make-only match with a typo will have a score of 1 * 0.9 = 0.9, which will be excluded.
    // An exact make-only match will be 1. We accept any match better than a fuzzy make-only match.
    return highestScore >= 1 ? bestMatchId : null;
};
