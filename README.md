# Check Version Change

`check-version-change` is a production-oriented GitHub Action that compares the version declared in your repository with the latest version published to a package registry, then exposes the result as workflow outputs.

It supports:

- `package.json` -> npm
- `pyproject.toml` -> PyPI
- `setup.py` -> PyPI
- `pom.xml` -> Maven Central
- `build.gradle` / `build.gradle.kts` -> Maven Central
- `Cargo.toml` -> crates.io
- `go.mod` -> Go module proxy

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `file-path` | Yes | - | Path to `package.json`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Cargo.toml`, or `go.mod` |
| `package-name` | No | detected | Override the package name used for the registry lookup |
| `registry` | No | `auto` | `auto`, `npm`, `pypi`, `maven-central`, `crates-io`, or `go-proxy` |
| `version-pattern` | No | - | Regex used to extract the local version from file contents. Must contain exactly one capture group |
| `compare-semver` | No | `true` | Whether to compute `is-higher` using semver rules |

## Outputs

| Output | Description |
| --- | --- |
| `changed` | `true` when the local version differs from the published version, or when the package does not exist in the registry |
| `local-version` | Version detected in the repository file |
| `published-version` | Published version, or `""` when the package is not found |
| `is-higher` | `true` when `compare-semver=true` and the local version is semver-greater than the published version |
| `registry-detected` | Registry used for the lookup |
| `package-name-detected` | Package name used for the lookup |

## Detection Rules

### Registry detection

When `registry=auto`:

- `package.json` -> `npm`
- `pyproject.toml` -> `pypi`
- `setup.py` -> `pypi`
- `pom.xml` -> `maven-central`
- `build.gradle` / `build.gradle.kts` -> `maven-central`
- `Cargo.toml` -> `crates-io`
- `go.mod` -> `go-proxy`

### Package name detection

- `package.json` -> `name`
- `pyproject.toml` -> `[project].name`, then fallback to `[tool.poetry].name`
- `setup.py` -> parsed from the `setup(...)` call using an AST-style parser
- `pom.xml` -> `groupId:artifactId`
- `build.gradle` / `build.gradle.kts` -> `group:artifact`, using `archivesBaseName`, `settings.gradle`, or the directory name for the artifact
- `Cargo.toml` -> `[package].name`
- `go.mod` -> `module`

### Version detection

Without `version-pattern`:

- `package.json` -> `version`
- `pyproject.toml` -> `[project].version`, then fallback to `[tool.poetry].version`
- `setup.py` -> parsed from the `setup(...)` call using an AST-style parser
- `pom.xml` -> `<version>`, falling back to `<parent><version>` when needed
- `build.gradle` / `build.gradle.kts` -> static `version = ...` or values backed by `gradle.properties`
- `Cargo.toml` -> `[package].version`
- `go.mod` -> no standard local version field, so use `version-pattern`

With `version-pattern`:

- The action applies the regex to the full file contents.
- The regex must contain exactly one capture group.
- If the pattern does not match, the action fails.
- Package name detection still uses the file parser unless `package-name` is explicitly provided.

## Registry Lookups

- npm -> `https://registry.npmjs.org/<package>` and reads `dist-tags.latest`
- PyPI -> `https://pypi.org/pypi/<package>/json` and reads `info.version`
- Maven Central -> `https://search.maven.org/solrsearch/select` and reads `response.docs[0].latestVersion`
- crates.io -> `https://index.crates.io/...` and selects the highest non-yanked version from the sparse index
- Go module proxy -> `https://proxy.golang.org/<module>/@latest` and reads `Version`

Behavior:

- `404`, `401`, or `403` are treated as "package not found"
- network failures are retried once
- any other non-success response fails the action

## Version Comparison Policy

`changed` always uses exact string comparison:

- no published version -> `changed=true`
- published version exists -> `changed = local-version != published-version`

`is-higher` is intentionally conservative:

- no published version -> `false`
- `compare-semver=false` -> `false`
- `compare-semver=true` and both versions are semver-compatible -> computed with semver rules
- if either version is not semver-compatible -> the action logs a warning and leaves `is-higher=false`

This keeps publish gating predictable while avoiding incorrect ordering for non-semver version schemes.

## Example Workflow

```yaml
name: Publish when version changes

on:
  push:
    branches: [main]

jobs:
  check-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: version-check
        uses: ./
        with:
          file-path: package.json

      - name: Print outputs
        run: |
          echo "changed=${{ steps.version-check.outputs.changed }}"
          echo "local=${{ steps.version-check.outputs.local-version }}"
          echo "published=${{ steps.version-check.outputs.published-version }}"
          echo "is-higher=${{ steps.version-check.outputs.is-higher }}"
          echo "registry=${{ steps.version-check.outputs.registry-detected }}"
          echo "package=${{ steps.version-check.outputs.package-name-detected }}"

      - name: Publish package
        if: steps.version-check.outputs.changed == 'true' && steps.version-check.outputs.is-higher == 'true'
        run: npm publish
```

## More Examples

### PyPI with auto detection

```yaml
- id: version-check
  uses: ./
  with:
    file-path: pyproject.toml
```

### setup.py with explicit package name override

```yaml
- id: version-check
  uses: ./
  with:
    file-path: setup.py
    package-name: my-package
```

### Maven Central with pom.xml

```yaml
- id: version-check
  uses: ./
  with:
    file-path: pom.xml
```

### Maven Central with build.gradle

```yaml
- id: version-check
  uses: ./
  with:
    file-path: build.gradle
```

For Maven Central, the detected package name uses `groupId:artifactId` format. You can also pass `package-name` explicitly in that same format.

### crates.io with Cargo.toml

```yaml
- id: version-check
  uses: ./
  with:
    file-path: Cargo.toml
```

### Go module proxy with go.mod

```yaml
- id: version-check
  uses: ./
  with:
    file-path: go.mod
    version-pattern: 'version\\s*=\\s*"([^"]+)"'
```

For `go.mod`, the action detects the module path automatically, but Go does not define a standard local version field in `go.mod`, so `version-pattern` is required unless you override local version extraction in some other file workflow.

### Custom version pattern

```yaml
- id: version-check
  uses: ./
  with:
    file-path: pyproject.toml
    version-pattern: 'build_version\\s*=\\s*"([^"]+)"'
```

## Build

Install dependencies and rebuild the bundled action:

```bash
pnpm install
pnpm build
```

Run the unit tests:

```bash
pnpm test
```

The repository already includes a checked-in `dist/index.js` so the action can run directly from GitHub without installing dependencies at action runtime.
