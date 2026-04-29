.PHONY: install test lint type build clean smoke all check-python

VENV ?= .venv
# H26 hostile fix — system `python3` is often 3.9 on Mac, which fails
# the >=3.10 requires-python floor. Prefer the highest available
# python3.x binary (3.12 → 3.11 → 3.10). Override with `PYTHON=python3.X`.
PYTHON ?= $(shell command -v python3.12 || command -v python3.11 || command -v python3.10 || command -v python3)
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

check-python:
	@if [ -z "$(PYTHON)" ]; then \
		echo "ERROR: no python3 binary found in PATH. Install python@3.10+ (e.g., 'brew install python@3.12')." && exit 1; \
	fi
	@$(PYTHON) -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" || \
		(echo "ERROR: $(PYTHON) is $$($(PYTHON) --version) — need >=3.10. Override with 'PYTHON=python3.12 make install' or install python@3.10+." && exit 1)
	@echo "Using $(PYTHON) ($$($(PYTHON) --version))"

install: check-python
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"
	$(PIP) check

test:
	$(VENV)/bin/pytest --cov=settlegrid --cov-report=term --cov-fail-under=90

lint:
	$(VENV)/bin/ruff check settlegrid tests

type:
	$(VENV)/bin/mypy settlegrid

build: clean
	$(PY) -m build
	$(VENV)/bin/twine check dist/*

smoke: check-python build
	# H29 hostile fix — `pip check` after install verifies no transitive
	# dep conflicts (the explicit hostile-contract-c requirement).
	rm -rf /tmp/sg-smoke
	$(PYTHON) -m venv /tmp/sg-smoke
	/tmp/sg-smoke/bin/pip install --upgrade pip
	/tmp/sg-smoke/bin/pip install dist/*.whl
	/tmp/sg-smoke/bin/pip check
	/tmp/sg-smoke/bin/python -c "import settlegrid; print('OK', settlegrid.SDK_VERSION)"
	/tmp/sg-smoke/bin/python -c "from settlegrid import SettleGrid, Wrapper, Invocation, InvalidKeyError, RateLimitedError, KeyValidationResult, MeterResult; print('imports OK')"

clean:
	rm -rf dist build *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

all: lint type test build
