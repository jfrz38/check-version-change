import { afterEach } from 'vitest';
import { createTemporaryProject } from './action-test-harness';

export const NETWORK_TIMEOUT_MS = 60000;

export function useTemporaryProject() {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  return {
    create(files: Record<string, string>) {
      project = createTemporaryProject(files);
      return project;
    },
  };
}
