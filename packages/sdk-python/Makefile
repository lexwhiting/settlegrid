.PHONY: install test lint type build clean smoke all

VENV ?= .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

install:
	python -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"

test:
	$(VENV)/bin/pytest --cov=settlegrid --cov-report=term --cov-fail-under=90

lint:
	$(VENV)/bin/ruff check settlegrid tests

type:
	$(VENV)/bin/mypy settlegrid

build: clean
	$(PY) -m build
	$(VENV)/bin/twine check dist/*

smoke: build
	rm -rf /tmp/sg-smoke
	python -m venv /tmp/sg-smoke
	/tmp/sg-smoke/bin/pip install --upgrade pip
	/tmp/sg-smoke/bin/pip install dist/*.whl
	/tmp/sg-smoke/bin/python -c "import settlegrid; print('OK', settlegrid.SDK_VERSION)"

clean:
	rm -rf dist build *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

all: lint type test build
