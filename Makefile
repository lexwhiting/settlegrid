.PHONY: python-install python-test python-lint python-build python-smoke python-all

PYTHON_SDK_DIR := packages/sdk-python

python-install:
	$(MAKE) -C $(PYTHON_SDK_DIR) install

python-test:
	$(MAKE) -C $(PYTHON_SDK_DIR) test

python-lint:
	$(MAKE) -C $(PYTHON_SDK_DIR) lint

python-build:
	$(MAKE) -C $(PYTHON_SDK_DIR) build

python-smoke:
	$(MAKE) -C $(PYTHON_SDK_DIR) smoke

python-all:
	$(MAKE) -C $(PYTHON_SDK_DIR) all
