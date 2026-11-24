import { describe, it, expect } from 'vitest';
import {
    TRAINING_MODULES,
    getRequiredModulesForUser,
    getModuleStatusForUser,
    getUserCpdSummary
} from '../../core/data/trainingModules';
import { TrainingRecord, User } from '../../types';

describe('trainingCpd', () => {
    const receptionist: User = {
        id: 'user-rec',
        email: 'rec@brookspeed.com',
        role: 'Garage Concierge',
        name: 'Sam',
        allowedViews: ['inquiries', 'estimates', 'jobs'],
    };

    it('assigns role-relevant modules for Garage Concierge', () => {
        const mods = getRequiredModulesForUser(receptionist);
        const ids = mods.map(m => m.id);
        expect(ids).toContain('first-time-user');
        expect(ids).toContain('workflow');
        expect(ids).toContain('mobile');
        expect(ids).not.toContain('directors');
    });

    it('flags Refresher Due when module version advances beyond completedVersion', () => {
        const estimatesMod = TRAINING_MODULES.find(m => m.id === 'estimates')!;
        const oldRecord: TrainingRecord = {
            id: 'user-rec__estimates',
            userId: 'user-rec',
            moduleId: 'estimates',
            completedVersion: '0.9',
            score: 100,
            passed: true,
            cpdMinutes: 20,
            attempts: 1,
            completedAt: '2026-01-01T10:00:00Z',
        };
        const res = getModuleStatusForUser(estimatesMod, [oldRecord], 'user-rec');
        expect(res.status).toBe('refresher_due');

        const currentRecord: TrainingRecord = { ...oldRecord, completedVersion: estimatesMod.version };
        const resCurrent = getModuleStatusForUser(estimatesMod, [currentRecord], 'user-rec');
        expect(resCurrent.status).toBe('current');
    });

    it('computes CPD summary and nextModuleId accurately', () => {
        const required = getRequiredModulesForUser(receptionist);
        const first = required[0];
        const rec: TrainingRecord = {
            id: `user-rec__${first.id}`,
            userId: 'user-rec',
            moduleId: first.id,
            completedVersion: first.version,
            score: 100,
            passed: true,
            cpdMinutes: first.cpdMinutes,
            attempts: 1,
            completedAt: '2026-11-24T10:00:00Z',
        };
        const summary = getUserCpdSummary(receptionist, [rec]);
        expect(summary.completedCurrentCount).toBe(1);
        expect(summary.totalCpdMinutes).toBe(first.cpdMinutes);
        expect(summary.nextModuleId).toBe(required[1].id);
    });
});
