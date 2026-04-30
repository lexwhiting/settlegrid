"""Port of ``packages/mcp/src/__tests__/exports.test.ts``.

Verifies every documented public name is exported, callable/instantiable
where appropriate, and has the right type. This is the procurement-checkbox
test: when somebody imports a name from the package, it had better be there.
"""

from __future__ import annotations

import inspect

import pytest

import settlegrid

# ─── version ─────────────────────────────────────────────────────────────


class TestVersionExports:
    def test_sdk_version_is_a_string(self) -> None:
        assert isinstance(settlegrid.SDK_VERSION, str)

    def test_dunder_version_matches_sdk_version(self) -> None:
        assert settlegrid.__version__ == settlegrid.SDK_VERSION

    def test_version_is_non_empty(self) -> None:
        assert len(settlegrid.SDK_VERSION) > 0

    def test_version_follows_semver_format(self) -> None:
        parts = settlegrid.SDK_VERSION.split(".")
        assert len(parts) == 3
        for part in parts:
            assert part.isdigit() or "-" in part or "+" in part


# ─── client class ────────────────────────────────────────────────────────


class TestClientExport:
    def test_settlegrid_class_is_exported(self) -> None:
        assert hasattr(settlegrid, "SettleGrid")
        assert isinstance(settlegrid.SettleGrid, type)

    def test_settlegrid_has_validate_key(self) -> None:
        assert callable(settlegrid.SettleGrid.validate_key)

    def test_settlegrid_has_validate_key_async(self) -> None:
        assert inspect.iscoroutinefunction(
            settlegrid.SettleGrid.validate_key_async
        )

    def test_settlegrid_has_meter(self) -> None:
        assert callable(settlegrid.SettleGrid.meter)

    def test_settlegrid_has_meter_async(self) -> None:
        assert inspect.iscoroutinefunction(settlegrid.SettleGrid.meter_async)

    def test_settlegrid_has_wrap(self) -> None:
        assert callable(settlegrid.SettleGrid.wrap)

    def test_settlegrid_has_clear_cache(self) -> None:
        assert callable(settlegrid.SettleGrid.clear_cache)

    def test_settlegrid_has_close(self) -> None:
        assert callable(settlegrid.SettleGrid.close)

    def test_settlegrid_has_aclose(self) -> None:
        assert inspect.iscoroutinefunction(settlegrid.SettleGrid.aclose)

    def test_wrapper_class_exported(self) -> None:
        assert hasattr(settlegrid, "Wrapper")
        assert isinstance(settlegrid.Wrapper, type)

    def test_invocation_class_exported(self) -> None:
        assert hasattr(settlegrid, "Invocation")
        assert isinstance(settlegrid.Invocation, type)


# ─── error classes ───────────────────────────────────────────────────────


_ERROR_CLASSES = [
    "SettleGridError",
    "InvalidKeyError",
    "InsufficientCreditsError",
    "BudgetExceededError",
    "ToolNotFoundError",
    "ToolDisabledError",
    "RateLimitedError",
    "SettleGridUnavailableError",
    "NetworkError",
    "TimeoutError",
]


class TestErrorClassExports:
    @pytest.mark.parametrize("name", _ERROR_CLASSES)
    def test_error_class_is_exported(self, name: str) -> None:
        assert hasattr(settlegrid, name), f"missing export: {name}"
        cls = getattr(settlegrid, name)
        assert isinstance(cls, type), f"{name} is not a class"

    @pytest.mark.parametrize(
        "name", [n for n in _ERROR_CLASSES if n != "SettleGridError"]
    )
    def test_error_class_extends_settlegrid_error(self, name: str) -> None:
        cls = getattr(settlegrid, name)
        assert issubclass(cls, settlegrid.SettleGridError)

    @pytest.mark.parametrize("name", _ERROR_CLASSES)
    def test_error_class_extends_exception(self, name: str) -> None:
        cls = getattr(settlegrid, name)
        assert issubclass(cls, Exception)

    def test_settlegrid_error_code_type_exported(self) -> None:
        # Literal type alias — should at least be importable.
        from settlegrid import SettleGridErrorCode  # noqa: F401


# ─── pydantic types ──────────────────────────────────────────────────────


_PYDANTIC_TYPES = [
    "KeyValidationResult",
    "MeterResult",
    "ValidateKeyRequest",
    "MeterRequest",
    "APIErrorBody",
]


class TestPydanticTypeExports:
    @pytest.mark.parametrize("name", _PYDANTIC_TYPES)
    def test_pydantic_type_exported(self, name: str) -> None:
        assert hasattr(settlegrid, name), f"missing export: {name}"
        cls = getattr(settlegrid, name)
        assert isinstance(cls, type)


# ─── cache exports ───────────────────────────────────────────────────────


class TestCacheExports:
    def test_lru_cache_exported(self) -> None:
        assert hasattr(settlegrid, "LRUCache")
        assert isinstance(settlegrid.LRUCache, type)

    def test_key_validation_cache_alias_exported(self) -> None:
        assert hasattr(settlegrid, "KeyValidationCache")
        # KeyValidationCache is a type alias — it should be a class /
        # subscriptable thing in Python (LRUCache[KeyValidationResult]).
        assert callable(settlegrid.KeyValidationCache)


# ─── docstrings present (procurement-checkbox quality) ───────────────────


class TestDocstrings:
    @pytest.mark.parametrize(
        "name",
        ["SettleGrid", "Wrapper", "Invocation", "LRUCache"]
        + _ERROR_CLASSES
        + _PYDANTIC_TYPES,
    )
    def test_class_has_docstring(self, name: str) -> None:
        cls = getattr(settlegrid, name)
        assert cls.__doc__ is not None, f"{name} missing docstring"
        assert len(cls.__doc__.strip()) > 0, f"{name} has empty docstring"
