#!/usr/bin/env python3
"""Load & scalability test harness for SkulPulse API.

Simulates concurrent logins, sustained sessions, and API throughput.
Run against a running API instance (local Docker or staging).

Usage:
  python scripts/load_test.py --base-url http://localhost:5330/api/v1
  python scripts/load_test.py --base-url http://localhost:5330/api/v1 --concurrent-logins 100 --duration 60

Requirements: httpx (pip install httpx)
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from dataclasses import dataclass, field
from typing import Any

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx", file=sys.stderr)
    sys.exit(1)


@dataclass
class ScenarioResult:
    name: str
    total_requests: int = 0
    successes: int = 0
    failures: int = 0
    rate_limited: int = 0
    latencies_ms: list[float] = field(default_factory=list)
    errors: dict[str, int] = field(default_factory=dict)

    def record(self, status: int, latency_ms: float) -> None:
        self.total_requests += 1
        self.latencies_ms.append(latency_ms)
        if status == 429:
            self.rate_limited += 1
        elif 200 <= status < 400:
            self.successes += 1
        else:
            self.failures += 1
            key = str(status)
            self.errors[key] = self.errors.get(key, 0) + 1

    def summary(self) -> dict[str, Any]:
        lat = self.latencies_ms
        return {
            "scenario": self.name,
            "total_requests": self.total_requests,
            "successes": self.successes,
            "failures": self.failures,
            "rate_limited": self.rate_limited,
            "error_breakdown": self.errors,
            "latency_ms": {
                "min": round(min(lat), 1) if lat else 0,
                "p50": round(statistics.median(lat), 1) if lat else 0,
                "p95": round(_percentile(lat, 95), 1) if lat else 0,
                "p99": round(_percentile(lat, 99), 1) if lat else 0,
                "max": round(max(lat), 1) if lat else 0,
                "mean": round(statistics.mean(lat), 1) if lat else 0,
            },
        }


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(len(sorted_vals) * pct / 100)
    return sorted_vals[min(idx, len(sorted_vals) - 1)]


async def _timed_request(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    **kwargs: Any,
) -> tuple[int, float]:
    start = time.perf_counter()
    resp = await client.request(method, path, **kwargs)
    elapsed = (time.perf_counter() - start) * 1000
    return resp.status_code, elapsed


async def scenario_health_burst(
    base_url: str, concurrency: int, iterations: int
) -> ScenarioResult:
    result = ScenarioResult(name="health_burst")
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:

        async def one() -> None:
            async with sem:
                for _ in range(iterations):
                    status, ms = await _timed_request(client, "GET", "/health")
                    result.record(status, ms)

        await asyncio.gather(*[one() for _ in range(concurrency)])
    return result


async def scenario_concurrent_logins(
    base_url: str,
    concurrency: int,
    email_prefix: str,
    password: str,
) -> ScenarioResult:
    result = ScenarioResult(name="concurrent_logins")
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:

        async def one(i: int) -> None:
            async with sem:
                status, ms = await _timed_request(
                    client,
                    "POST",
                    "/auth/platform/login",
                    json={"email": f"loadtest{i}@example.com", "password": password},
                )
                result.record(status, ms)

        await asyncio.gather(*[one(i) for i in range(concurrency)])
    return result


async def scenario_sustained_session(
    base_url: str,
    access_token: str,
    duration_seconds: int,
    rps: int,
) -> ScenarioResult:
    result = ScenarioResult(name="sustained_session")
    end = time.time() + duration_seconds
    headers = {"Authorization": f"Bearer {access_token}"}
    interval = 1.0 / max(rps, 1)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        while time.time() < end:
            status, ms = await _timed_request(client, "GET", "/auth/me", headers=headers)
            result.record(status, ms)
            await asyncio.sleep(interval)
    return result


async def scenario_mixed_throughput(
    base_url: str,
    access_token: str | None,
    concurrency: int,
    total_requests: int,
) -> ScenarioResult:
    result = ScenarioResult(name="mixed_throughput")
    sem = asyncio.Semaphore(concurrency)
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}

    paths = [
        ("GET", "/health"),
        ("GET", "/auth/me"),
        ("GET", "/health/ready"),
    ]

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:

        async def one(i: int) -> None:
            async with sem:
                method, path = paths[i % len(paths)]
                kwargs: dict[str, Any] = {}
                if path == "/auth/me" and access_token:
                    kwargs["headers"] = headers
                status, ms = await _timed_request(client, method, path, **kwargs)
                result.record(status, ms)

        await asyncio.gather(*[one(i) for i in range(total_requests)])
    return result


async def _obtain_token(base_url: str, email: str, password: str) -> str | None:
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        resp = await client.post(
            "/auth/platform/login",
            json={"email": email, "password": password},
        )
        if resp.status_code == 200:
            return resp.json()["access_token"]
    return None


def _print_report(results: list[ScenarioResult]) -> None:
    print("\n" + "=" * 72)
    print("LOAD TEST RESULTS")
    print("=" * 72)
    for r in results:
        s = r.summary()
        print(f"\n--- {s['scenario']} ---")
        print(f"  Total:        {s['total_requests']}")
        print(f"  Successes:    {s['successes']}")
        print(f"  Failures:     {s['failures']}")
        print(f"  Rate limited: {s['rate_limited']}")
        if s["error_breakdown"]:
            print(f"  Errors:       {s['error_breakdown']}")
        lat = s["latency_ms"]
        print(
            f"  Latency (ms): min={lat['min']} p50={lat['p50']} "
            f"p95={lat['p95']} p99={lat['p99']} max={lat['max']} mean={lat['mean']}"
        )

    print("\n--- Assessment ---")
    critical = [r for r in results if r.name in ("health_burst", "mixed_throughput")]
    for r in critical:
        s = r.summary()
        p95 = s["latency_ms"]["p95"]
        if p95 > 500:
            print(f"  WARNING: {r.name} p95 latency {p95}ms exceeds 500ms target")
        else:
            print(f"  OK: {r.name} p95 latency {p95}ms within target")


async def main() -> None:
    parser = argparse.ArgumentParser(description="SkulPulse API load test")
    parser.add_argument("--base-url", default="http://localhost:5330/api/v1")
    parser.add_argument("--concurrent-logins", type=int, default=50)
    parser.add_argument("--health-concurrency", type=int, default=50)
    parser.add_argument("--health-iterations", type=int, default=20)
    parser.add_argument("--mixed-concurrency", type=int, default=30)
    parser.add_argument("--mixed-requests", type=int, default=300)
    parser.add_argument("--sustained-duration", type=int, default=30)
    parser.add_argument("--sustained-rps", type=int, default=5)
    parser.add_argument("--admin-email", default="admin@skulpulse.ug")
    parser.add_argument("--admin-password", default="ChangeMe!Admin2025")
    args = parser.parse_args()

    print(f"Target: {args.base_url}")
    results: list[ScenarioResult] = []

    # 1. Health burst (baseline throughput)
    print("Running health burst...")
    results.append(
        await scenario_health_burst(
            args.base_url, args.health_concurrency, args.health_iterations
        )
    )

    # 2. Concurrent login spike
    print("Running concurrent login spike...")
    results.append(
        await scenario_concurrent_logins(
            args.base_url,
            args.concurrent_logins,
            email_prefix="load",
            password="wrong-password",
        )
    )

    # 3. Obtain valid token for authenticated scenarios
    token = await _obtain_token(args.base_url, args.admin_email, args.admin_password)
    if token:
        print("Running sustained session...")
        results.append(
            await scenario_sustained_session(
                args.base_url, token, args.sustained_duration, args.sustained_rps
            )
        )
    else:
        print("Skipping sustained session — could not obtain admin token")

    # 4. Mixed throughput
    print("Running mixed throughput...")
    results.append(
        await scenario_mixed_throughput(
            args.base_url, token, args.mixed_concurrency, args.mixed_requests
        )
    )

    _print_report(results)


if __name__ == "__main__":
    asyncio.run(main())
