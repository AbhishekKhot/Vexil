import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from '../project.service';

describe('ProjectService', () => {
    let projectService: ProjectService;

    beforeEach(() => {
        projectService = new ProjectService();
    });

    it('should throw an error if project name is too short', async () => {
        await expect(projectService.createProject('Ab'))
            .rejects
            .toThrow('Project name must be at least 3 characters');
    });
});

export class ProjectService {
    async createProject(name: string) {
        if (name.length < 3) {
            throw new Error('Project name must be at least 3 characters');
        }
        // Logic to save to DB will go here next
        return { name };
    }
}