import { Version } from './version';

export class PublishedVersion {
  constructor(public readonly version: Version | null) {}

  toString(): string {
    return this.version?.value ?? '';
  }
}
