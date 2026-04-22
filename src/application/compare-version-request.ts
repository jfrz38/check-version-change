import path from 'node:path';
import { CompareSource } from '../domain/value-objects/compare-source';
import type { RegistryInput } from '../types';

export interface CompareVersionRequestProps {
  cwd: string;
  filePath: string;
  compareFilePath?: string;
  packageNameOverride?: string;
  registry: RegistryInput;
  compareSource: CompareSource;
  compareRef?: string;
  versionPattern?: string;
  compareSemver: boolean;
}

export class CompareVersionRequest {
  readonly cwd: string;
  readonly filePath: string;
  readonly compareFilePath: string;
  readonly packageNameOverride: string;
  readonly registry: RegistryInput;
  readonly compareSource: CompareSource;
  readonly compareRef: string;
  readonly versionPattern?: string;
  readonly compareSemver: boolean;

  constructor(props: CompareVersionRequestProps) {
    this.cwd = props.cwd;
    this.filePath = path.resolve(props.cwd, props.filePath);
    this.compareFilePath = path.resolve(props.cwd, props.compareFilePath || props.filePath);
    this.packageNameOverride = props.packageNameOverride?.trim() || '';
    this.registry = props.registry;
    this.compareSource = props.compareSource;
    this.compareRef = props.compareRef?.trim() || '';
    this.versionPattern = props.versionPattern?.trim() || undefined;
    this.compareSemver = props.compareSemver;
  }
}
