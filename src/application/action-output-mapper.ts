import type { ActionOutputs } from '../types';
import type { CompareSource } from '../domain/value-objects/compare-source';
import type { SupportedRegistry } from '../types';

export interface BuildActionOutputsParams {
  changed: boolean;
  localVersion: string;
  comparedVersion: string;
  isHigher: boolean;
  registryDetected: SupportedRegistry | '';
  packageNameDetected: string;
  compareSource: CompareSource;
  compareRefResolved: string;
  compareFilePathResolved: string;
}

export function buildActionOutputs(params: BuildActionOutputsParams): ActionOutputs {
  return {
    changed: params.changed,
    localVersion: params.localVersion,
    comparedVersion: params.comparedVersion,
    publishedVersion: params.comparedVersion,
    isHigher: params.isHigher,
    registryDetected: params.registryDetected,
    packageNameDetected: params.packageNameDetected,
    comparisonSourceDetected: params.compareSource.value,
    compareRefResolved: params.compareRefResolved,
    compareFilePathResolved: params.compareFilePathResolved,
  };
}
