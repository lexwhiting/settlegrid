"""Port of ``packages/mcp/src/__tests__/cache.extended.test.ts``.

Mirrors every cache-extended scenario from the TS suite to confirm
behavioral parity (constructor defaults, set/get round-trip, eviction
order under capacity, TTL boundaries, prune semantics, size reporting).
"""

from __future__ import annotations

import time

import pytest

from settlegrid import KeyValidationCache, KeyValidationResult, LRUCache


def _result(balance: int = 100) -> KeyValidationResult:
    return KeyValidationResult.model_validate(
        {
            "valid": True,
            "consumerId": "c",
            "toolId": "t",
            "keyId": "k",
            "balanceCents": balance,
        }
    )


# ─── constructor ─────────────────────────────────────────────────────────


class TestConstructor:
    def test_creates_cache_with_default_max_size_1000(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache()
        # 1000 inserts should all fit (default max_size=1000).
        for i in range(1000):
            cache.set(f"k{i}", _result(i))
        assert cache.size == 1000
        # 1001st insert evicts the LRU entry.
        cache.set("k1000", _result(1000))
        assert cache.size == 1000

    def test_creates_cache_with_custom_max_size(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(max_size=5)
        for i in range(10):
            cache.set(f"k{i}", _result(i))
        assert cache.size == 5

    def test_creates_cache_with_custom_ttl(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=0.05
        )
        cache.set("a", _result(1))
        assert cache.get("a") is not None
        time.sleep(0.1)
        assert cache.get("a") is None


# ─── set / get ───────────────────────────────────────────────────────────


class TestSetGet:
    def test_stores_and_retrieves_a_value(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        v = _result(42)
        cache.set("a", v)
        assert cache.get("a") == v

    def test_returns_none_for_missing_key(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        assert cache.get("nope") is None

    def test_increments_size_on_set(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        assert cache.size == 0
        cache.set("a", _result())
        assert cache.size == 1
        cache.set("b", _result())
        assert cache.size == 2

    def test_overwrites_existing_key_without_incrementing_size(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("a", _result(2))  # overwrite
        assert cache.size == 1
        got = cache.get("a")
        assert got is not None
        assert got.balance_cents == 2

    def test_stores_different_values_for_different_keys(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        cache.set("c", _result(3))
        a = cache.get("a")
        b = cache.get("b")
        c = cache.get("c")
        assert a is not None
        assert b is not None
        assert c is not None
        assert a.balance_cents == 1
        assert b.balance_cents == 2
        assert c.balance_cents == 3


# ─── eviction (LRU semantics) ────────────────────────────────────────────


class TestEviction:
    def test_evicts_oldest_entry_when_at_capacity(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=2, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        cache.set("c", _result(3))  # evicts 'a'
        assert cache.get("a") is None
        assert cache.get("b") is not None
        assert cache.get("c") is not None

    def test_accessing_key_moves_to_most_recently_used(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=2, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        # Access "a" → it should now be the most recently used.
        cache.get("a")
        # Inserting "c" should evict "b" (the now-least-recently-used).
        cache.set("c", _result(3))
        assert cache.get("a") is not None
        assert cache.get("b") is None
        assert cache.get("c") is not None

    def test_handles_max_size_of_1(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=1, ttl_seconds=60
        )
        cache.set("a", _result(1))
        assert cache.get("a") is not None
        cache.set("b", _result(2))
        assert cache.get("a") is None
        assert cache.get("b") is not None


# ─── TTL ─────────────────────────────────────────────────────────────────


class TestTTL:
    def test_returns_value_within_ttl(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=1.0
        )
        cache.set("a", _result(1))
        assert cache.get("a") is not None

    def test_returns_none_after_ttl_expires(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=0.05
        )
        cache.set("a", _result(1))
        time.sleep(0.1)
        assert cache.get("a") is None

    def test_deletes_expired_entry_on_access(self) -> None:
        """Reading an expired entry must not just hide it — it should
        actually be removed from the cache so size goes down."""
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=0.05
        )
        cache.set("a", _result(1))
        time.sleep(0.1)
        cache.get("a")  # triggers expiry-on-access
        # After sweep, the cache should reflect 0 entries.
        assert cache.size == 0


# ─── invalidate ──────────────────────────────────────────────────────────


class TestInvalidate:
    def test_removes_specific_key(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        cache.invalidate("a")
        assert cache.get("a") is None
        assert cache.get("b") is not None

    def test_does_nothing_for_non_existent_key(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.invalidate("does-not-exist")  # must not raise
        assert cache.get("a") is not None
        assert cache.size == 1


# ─── clear ───────────────────────────────────────────────────────────────


class TestClear:
    def test_removes_all_entries(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        cache.set("c", _result(3))
        cache.clear()
        assert cache.size == 0
        assert cache.get("a") is None

    def test_safe_to_call_on_empty_cache(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.clear()  # must not raise
        cache.clear()
        assert cache.size == 0


# ─── prune ───────────────────────────────────────────────────────────────


class TestPrune:
    def test_removes_all_expired_entries(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=0.05
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        cache.set("c", _result(3))
        time.sleep(0.1)
        removed = cache.prune()
        assert removed == 3
        assert cache.size == 0

    def test_returns_zero_when_nothing_to_prune(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        cache.set("a", _result(1))
        cache.set("b", _result(2))
        assert cache.prune() == 0

    def test_returns_zero_on_empty_cache(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        assert cache.prune() == 0


# ─── size ────────────────────────────────────────────────────────────────


class TestSize:
    def test_reflects_current_entry_count(self) -> None:
        cache: LRUCache[KeyValidationResult] = KeyValidationCache(
            max_size=10, ttl_seconds=60
        )
        assert cache.size == 0
        cache.set("a", _result(1))
        assert cache.size == 1
        cache.set("b", _result(2))
        assert cache.size == 2
        cache.invalidate("a")
        assert cache.size == 1
        cache.clear()
        assert cache.size == 0

    @pytest.mark.parametrize("bad_size", [0, -1, -100])
    def test_rejects_invalid_max_size(self, bad_size: int) -> None:
        with pytest.raises(ValueError):
            KeyValidationCache(max_size=bad_size, ttl_seconds=60)
