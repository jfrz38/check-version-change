export class PackageName {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error('Package name cannot be empty.');
    }

    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }
}
