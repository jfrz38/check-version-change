import type { FileFormat as FileFormatValue } from '../../types';

export class FileFormat {
  readonly value: FileFormatValue;

  private constructor(value: FileFormatValue) {
    this.value = value;
  }

  static fromInput(rawValue: string): FileFormat {
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized || normalized === 'auto') {
      return new FileFormat('auto');
    }

    if (normalized === 'raw') {
      return new FileFormat('raw');
    }

    throw new Error(`Unsupported file-format "${rawValue}". Expected "auto" or "raw".`);
  }

  isRaw(): boolean {
    return this.value === 'raw';
  }
}
