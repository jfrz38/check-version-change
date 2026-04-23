import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import type { ActionOutputs } from '../../src/types';

interface ActionMockState {
  failedMessages: string[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  warnings: string[];
}

const state: ActionMockState = {
  failedMessages: [],
  inputs: {},
  outputs: {},
  warnings: [],
};

vi.mock('@actions/core', () => ({
  getInput(name: string, options?: { required?: boolean }) {
    const value = state.inputs[name] ?? '';
    if (options?.required && !value) {
      throw new Error(`Input "${name}" is required.`);
    }
    return value;
  },
  setOutput(name: string, value: string) {
    state.outputs[name] = String(value);
  },
  warning(message: string) {
    state.warnings.push(String(message));
  },
  setFailed(message: string) {
    state.failedMessages.push(String(message));
  },
}));

vi.mock('@actions/github', () => ({
  context: {
    runId: 123456,
  },
}));

export interface ActionRunResult {
  outputs: Record<string, string>;
  result: ActionOutputs;
  warnings: string[];
}

export interface TemporaryProject {
  cleanup(): void;
  dirPath: string;
  filePath(relativePath: string): string;
}

function resetActionState(): void {
  state.failedMessages = [];
  state.inputs = {};
  state.outputs = {};
  state.warnings = [];
}

export function createTemporaryProject(files: Record<string, string>): TemporaryProject {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'check-version-change-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(dirPath, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return {
    cleanup() {
      fs.rmSync(dirPath, { recursive: true, force: true });
    },
    dirPath,
    filePath(relativePath: string) {
      return path.join(dirPath, relativePath);
    },
  };
}

export async function runActionWithInputs(inputs: Record<string, string>): Promise<ActionRunResult> {
  resetActionState();
  state.inputs = { ...inputs };

  vi.resetModules();
  const { run } = await import('../../src/main');
  const result = await run();

  return {
    outputs: { ...state.outputs },
    result,
    warnings: [...state.warnings],
  };
}
