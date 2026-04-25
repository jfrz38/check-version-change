.PHONY: major minor patch
major minor patch:

VERSION_BUMP := $(or $(VERSION),$(word 2,$(MAKECMDGOALS)))

.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## install project dependencies
	pnpm install

.PHONY: upgrade-version
upgrade-version: ## bump package version with major, minor, or patch, refresh the lockfile, and rebuild
	node -e "const v='$(VERSION_BUMP)'; if (!['major','minor','patch'].includes(v)) { console.error('Usage: make upgrade-version major|minor|patch'); process.exit(1); }"
	pnpm version $(VERSION_BUMP) --no-git-tag-version
	pnpm install
	pnpm build

.PHONY: typecheck
typecheck: ## run the TypeScript type checker
	pnpm typecheck

.PHONY: test
test: ## run the test suite once
	pnpm test

.PHONY: test-smoke
test-smoke: ## run the smoke test suite
	pnpm test:smoke

.PHONY: test-acceptance
test-acceptance: ## run the acceptance test suite
	pnpm test:acceptance

.PHONY: test-watch
test-watch: ## run the test suite in watch mode
	pnpm test:watch

.PHONY: test-coverage
test-coverage: ## run the test suite with coverage
	pnpm test:coverage

.PHONY: build
build: ## build the bundled GitHub Action
	pnpm build

.PHONY: validate
validate: ## run the full local validation pipeline
	pnpm validate

.PHONY: ci
ci: ## alias for the full local validation pipeline
	pnpm validate
