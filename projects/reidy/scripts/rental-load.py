"""Small local performance demonstration; no third-party dependencies.
Run against an already running demo: python scripts/rental-load.py --requests 100 --workers 8
"""
import argparse
import concurrent.futures
import json
import time
import urllib.request


def request(base, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8082")
    parser.add_argument("--property-url", default="http://localhost:8081")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if args.requests < 1 or args.workers < 1:
        parser.error("requests and workers must be positive")
    property_data = {
        "address": "100 Synthetic Load Test Ave", "city": "Chicago", "state": "IL",
        "zipCode": "60601", "propertyType": "RESIDENTIAL", "bedrooms": 2,
        "bathrooms": 1, "squareFootage": 1200, "yearBuilt": 2000, "askingPrice": 250000,
    }
    prop = request(args.property_url, "/api/properties", property_data)
    path = f"/api/properties/{prop['id']}/rental/RENTAL_ESTIMATE"

    def fetch(_):
        started = time.perf_counter()
        result = request(args.base_url, path)
        assert result["endpoint"] == "RENTAL_ESTIMATE"
        return (time.perf_counter() - started) * 1000

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        latencies = sorted(pool.map(fetch, range(args.requests)))
    elapsed = time.perf_counter() - started
    print(json.dumps({
        "requests": args.requests, "workers": args.workers, "elapsedSeconds": round(elapsed, 3),
        "requestsPerSecond": round(args.requests / elapsed, 1),
        "medianMs": round(latencies[len(latencies) // 2], 2),
        "p95Ms": round(latencies[min(len(latencies)-1, int(len(latencies)*0.95))], 2),
        "propertyId": prop["id"],
    }, indent=2))
    print("Inspect appraisal management port 9082: /actuator/metrics/rental.provider.calls and rental.cache.requests for cache counters.")
    print("This measures the local demo, including refresh-lease coordination and synchronous property lookup; it is not a production capacity claim.")


if __name__ == "__main__":
    main()
