export class Version {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error('Version cannot be empty.');
    }

    this.value = normalized;
  }

  equals(other: Version): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
