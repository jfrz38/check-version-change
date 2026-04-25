# Check Version Change

[![CI](https://github.com/jfrz38/check-version-change/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jfrz38/check-version-change/actions/workflows/ci.yml)
[![Release](https://github.com/jfrz38/check-version-change/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/jfrz38/check-version-change/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/v/release/jfrz38/check-version-change?display_name=tag)](https://github.com/jfrz38/check-version-change/releases)
[![GitHub Marketplace](https://img.shields.io/badge/marketplace-check--version--change-blue?logo=githubactions)](https://github.com/marketplace/actions/check-version-change)
[![License](https://img.shields.io/github/license/jfrz38/check-version-change)](LICENSE)

`check-version-change` is a production-oriented GitHub Action that compares the version declared in your repository with either the latest version published to a package registry or the version stored in another Git ref, then exposes the result as workflow outputs.

Use it to gate publish jobs, detect whether a package version changed in a pull request, or compare the current project version against `npm`, `PyPI`, `Maven Central`, `crates.io`, or the `Go module proxy`.

## Quick Start

Compare the version in `package.json` against the version in the pull request base ref:

```yaml
name: Check version

on:
  pull_request:

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: version-check
        uses: jfrz38/check-version-change@v1
        with:
          file-path: package.json

      - name: Print result
        run: |
          echo "changed=${{ steps.version-check.outputs.changed }}"
          echo "local=${{ steps.version-check.outputs.local-version }}"
          echo "compared=${{ steps.version-check.outputs.compared-version }}"
          echo "is-higher=${{ steps.version-check.outputs.is-higher }}"
```

By default, the action uses `compare-source: git-ref`. On pull requests it compares against the base commit or base branch.

## Publish Gate Example

Run a publish step only when the local version is different and semver-greater than the version in the target ref:

```yaml
name: Publish when version changes

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: version-check
        uses: jfrz38/check-version-change@v1
        with:
          file-path: package.json
          compare-ref: HEAD^

      - name: Publish package
        if: steps.version-check.outputs.changed == 'true' && steps.version-check.outputs.is-higher == 'true'
        run: npm publish
```

## Registry Example

Compare the local version against the latest version published to the matching registry:

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: pyproject.toml
    compare-source: registry
```

When `registry: auto`, the registry is detected from the file type.

## Supported Files

| File | Registry |
| --- | --- |
| `package.json` | npm |
| `pyproject.toml` | PyPI |
| `setup.py` | PyPI |
| `pom.xml` | Maven Central |
| `build.gradle` | Maven Central |
| `build.gradle.kts` | Maven Central |
| `Cargo.toml` | crates.io |
| `go.mod` | Go module proxy |

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `file-path` | Yes | - | Path to `package.json`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Cargo.toml`, or `go.mod`. |
| `package-name` | No | detected | Override the package name used for registry lookup. |
| `registry` | No | `auto` | Registry to query: `auto`, `npm`, `pypi`, `maven-central`, `crates-io`, or `go-proxy`. |
| `compare-source` | No | `git-ref` | Comparison source: `git-ref` or `registry`. |
| `compare-ref` | No | PR base ref | Git ref to compare against when `compare-source=git-ref`. |
| `compare-file-path` | No | `file-path` | File path to read from the target ref when `compare-source=git-ref`. |
| `version-pattern` | No | parser default | Custom regex used to extract the local version. Must contain exactly one capture group. |
| `compare-semver` | No | `true` | Compute `is-higher` with semver when both versions are semver-compatible. |

## Outputs

| Output | Description |
| --- | --- |
| `changed` | `true` when the local version differs from the compared version, or when no compared version exists. |
| `local-version` | Version detected in the repository file. |
| `compared-version` | Version used as the comparison target. |
| `published-version` | Legacy alias for `compared-version`. |
| `is-higher` | `true` when `compare-semver=true` and the local version is semver-greater than the compared version. |
| `registry-detected` | Registry used for lookup, or an empty string when `compare-source=git-ref`. |
| `package-name-detected` | Package name used for lookup. |
| `comparison-source-detected` | Comparison source used by the action. |
| `compare-ref-resolved` | Resolved Git ref used when `compare-source=git-ref`. |
| `compare-file-path-resolved` | Resolved file path used when `compare-source=git-ref`. |

## Comparison Modes

### Git Ref

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: package.json
    compare-source: git-ref
```

This is the default mode. The action reads the same project file from another Git ref and compares that version with the current workspace.

On `pull_request` events, `compare-ref` can be omitted because the action uses the pull request base ref. For other events, pass `compare-ref` explicitly:

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: package.json
    compare-source: git-ref
    compare-ref: origin/main
```

Use `fetch-depth: 0` with `actions/checkout` when comparing against another branch or commit.

### Registry

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: package.json
    compare-source: registry
```

Registry mode compares the local version with the latest published package version.

## More Examples

### npm

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: package.json
    compare-source: registry
```

### PyPI

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: pyproject.toml
    compare-source: registry
```

### Maven Central

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: pom.xml
    compare-source: registry
```

For Gradle projects:

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: build.gradle
    compare-source: registry
```

### crates.io

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: Cargo.toml
    compare-source: registry
```

### Go Modules

`go.mod` does not define a standard local package version field, so provide `version-pattern`:

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: go.mod
    compare-source: registry
    version-pattern: 'version\s*=\s*"([^"]+)"'
```

### Custom Version Pattern

Use `version-pattern` when the version is stored in a custom field:

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: pyproject.toml
    version-pattern: 'build_version\s*=\s*"([^"]+)"'
```

The regex is applied to the full file contents and must contain exactly one capture group.

### Different File In Target Ref

```yaml
- id: version-check
  uses: jfrz38/check-version-change@v1
  with:
    file-path: apps/web/package.json
    compare-source: git-ref
    compare-ref: origin/main
    compare-file-path: package.json
```

## Version Comparison

`changed` uses exact string comparison:

| Local version | Compared version | `changed` |
| --- | --- | --- |
| `1.2.0` | `1.1.0` | `true` |
| `1.2.0` | `1.2.0` | `false` |
| `1.2.0` | none | `true` |

`is-higher` is only `true` when:

- `compare-semver` is `true`
- both versions are semver-compatible
- the local version is greater than the compared version

This lets you distinguish "changed" from "safe to publish as a higher semver version".
