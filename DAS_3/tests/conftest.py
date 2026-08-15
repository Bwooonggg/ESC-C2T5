"""Global pytest configuration for deterministic, offline-safe test runs."""

import os


# Application modules create the Langfuse client while test modules are imported,
# so tracing must be disabled before pytest begins collection. Live diagnostic
# runs can opt back in explicitly when exporting traces is intentional.
if os.getenv("DAS_ENABLE_TEST_TRACING") != "1":
    os.environ["LANGFUSE_TRACING_ENABLED"] = "false"
    os.environ["OTEL_SDK_DISABLED"] = "true"
