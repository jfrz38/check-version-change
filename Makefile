.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## install project dependencies
	pnpm install

.PHONY: typecheck
typecheck: ## run the TypeScript type checker
	pnpm typecheck

.PHONY: test
test: ## run the test suite once
	pnpm test

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
