# Check Version Change

`check-version-change` is a production-oriented GitHub Action that compares the version declared in your repository with either the latest version published to a package registry or the version stored in another Git ref, then exposes the result as workflow outputs.

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
| `compare-source` | No | `git-ref` | `git-ref` or `registry` |
| `compare-ref` | No | auto on PRs | Git ref to compare against when `compare-source=git-ref`. On `pull_request` events it defaults to the base commit SHA or base branch |
| `compare-file-path` | No | same as `file-path` | File path to read from the target ref when `compare-source=git-ref` |
| `version-pattern` | No | - | Regex used to extract the local version from file contents. Must contain exactly one capture group |
| `compare-semver` | No | `true` | Whether to compute `is-higher` using semver rules |

## Outputs

| Output | Description |
| --- | --- |
| `changed` | `true` when the local version differs from the published version, or when the package does not exist in the registry |
| `local-version` | Version detected in the repository file |
| `compared-version` | Version used as the comparison target |
| `published-version` | Legacy alias for `compared-version` |
| `is-higher` | `true` when `compare-semver=true` and the local version is semver-greater than the compared version |
| `registry-detected` | Registry used for the lookup, or `""` when `compare-source=git-ref` |
| `package-name-detected` | Package name used for the lookup |
| `comparison-source-detected` | Comparison source used by the action |
| `compare-ref-resolved` | Resolved Git ref used when `compare-source=git-ref`, otherwise `""` |
| `compare-file-path-resolved` | Resolved file path used when `compare-source=git-ref`, otherwise `""` |

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

## Comparison Sources

### Git ref

This is the default mode.

When `compare-source=git-ref`, the action reads a file from another Git ref in the local checkout, extracts its version with the same parser or `version-pattern`, and compares that version against the current workspace.

Behavior:

- if `compare-ref` is provided, that ref is used directly
- if `compare-ref` is omitted on `pull_request` events, the action prefers the base commit SHA from the event payload and then the base branch
- if `compare-file-path` is omitted, the action first tries the same value as `file-path`
- if that path does not exist in the target ref, the action searches the target ref for a file with the same file name
- if multiple matching file names are found, the action fails and asks for `compare-file-path`
- if no pull request base information is available, the action requires `compare-ref`
- the compared ref must already exist in the local checkout available to the workflow

For CI jobs that compare against another branch, using `actions/checkout` with enough history is recommended, for example `fetch-depth: 0`.

### Registry

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

- no compared version -> `changed=true`
- compared version exists -> `changed = local-version != compared-version`

`is-higher` is intentionally conservative:

- no compared version -> `false`
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

### Compare against the pull request base branch version

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- id: version-check
  uses: ./
  with:
    file-path: package.json
    compare-source: git-ref
```

On `pull_request` events this uses the base commit SHA automatically.

### Compare against a specific branch

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- id: version-check
  uses: ./
  with:
    file-path: package.json
    compare-source: git-ref
    compare-ref: origin/main
```

### Compare against a different file in the target ref

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- id: version-check
  uses: ./
  with:
    file-path: apps/web/package.json
    compare-source: git-ref
    compare-ref: origin/main
    compare-file-path: package.json
```

## Development

Install dependencies and rebuild the bundled action:

```bash
pnpm install
pnpm typecheck
pnpm build
```

Run the unit tests:

```bash
pnpm test
```

Run the smoke tests:

```bash
pnpm test:smoke
```

Run the acceptance tests:

```bash
pnpm test:acceptance
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run tests with coverage:

```bash
pnpm test:coverage
```

Run the full local CI flow:

```bash
pnpm validate
```

## Makefile

If you prefer shorter commands, the repository also includes a `Makefile`:

```bash
make install
make typecheck
make test
make test-smoke
make test-acceptance
make test-watch
make test-coverage
make build
make validate
make ci
```

On Windows, this is useful if you already use Git Bash, MSYS2, Cygwin, or WSL. If you do not have `make`, the `pnpm` commands above are the primary interface.

## GitHub Workflows

The repository includes three workflows:

- `CI`: runs the unit validation pipeline on pull requests and pushes to `main`, and adds smoke tests on pushes to `main`
- `Release`: runs on every push to `main`, validates the project again, runs smoke tests, creates the exact version tag from `package.json` when it does not exist yet, and force-updates the major tag such as `v1`
- `Acceptance Tests`: runs only when launched manually with `workflow_dispatch`

The automated workflows rebuild the project and fail if the committed `dist/index.js` is not aligned with the source code. If that happens locally, run:

```bash
pnpm build
```

and commit the updated bundle before merging.

## Test Layout

The test suite is split by purpose:

- `tests/unit`: fast deterministic unit tests, used by `pnpm test`
- `tests/smoke`: lightweight end-to-end checks against real public registries, used on merges to `main`
- `tests/acceptance-tests`: broader real-registry acceptance coverage, launched manually

This means every merge to `main` automatically updates the floating major tag that consumers typically use:

```yaml
uses: owner/check-version-change@v1
```

If the version in `package.json` is new, the workflow also creates a matching GitHub Release for that exact tag.

The repository already includes a checked-in, minified `dist/index.js` so the action can run directly from GitHub without installing dependencies at action runtime.
