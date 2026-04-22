import type { CompareSource as CompareSourceValue } from '../../types';

export class CompareSource {
  readonly value: CompareSourceValue;

  private constructor(value: CompareSourceValue) {
    this.value = value;
  }

  static fromInput(rawValue: string): CompareSource {
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized || normalized === 'registry') {
      return new CompareSource('registry');
    }

    if (normalized === 'git-ref') {
      return new CompareSource('git-ref');
    }

    throw new Error(`Unsupported compare-source "${rawValue}". Expected "registry" or "git-ref".`);
  }

  isRegistry(): boolean {
    return this.value === 'registry';
  }

  isGitRef(): boolean {
    return this.value === 'git-ref';
  }
}
