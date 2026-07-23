# Recommendation Generator Contract

This is the provider-neutral logical contract for
`RecommendationGeneratorPort.generate`. It defines what the backend sends to
a replaceable RecommendationGeneratorService and what the service returns. An
adapter will translate this contract to the selected external provider's HTTP
or SDK format later.

## Operation

```text
generate(request: RecommendationGenerationRequest): Promise<RecommendationGenerationResult>
```

The application calls this operation only after an explicit recommendation
request has resolved the student's latest persisted summary. The generator
does not load a different summary, read MySQL, or decide which student the
request belongs to.

## Request

The request contains exactly one immutable `Summary` basis:

- `summaryId`: the identity that the resulting recommendation must reference.
- `studentId`: the student that owns the summary.
- `content`: the generated summary text.
- `generatedAt`: when the summary was generated.
- `sourceProgressVersion`: the progress snapshot represented by the summary.

An adapter may project that logical request to a JSON shape like this:

```json
{
    "summary": {
        "summaryId": "summary-123",
        "studentId": "student-123",
        "content": "The student is improving in reading fluency.",
        "generatedAt": "2026-07-23T12:00:00.000Z",
        "sourceProgressVersion": "v7"
    }
}
```

The request carries the domain summary, not database rows, credentials,
session tokens, or provider-specific fields. The adapter converts `Date` values
to the provider's agreed timestamp format.

The transport metadata is supplied separately from this JSON request. Each
invocation carries a correlation ID for tracing and an idempotency ID for safe
retries. The adapter creates both when a caller does not provide them; retries
of one invocation must reuse the same values.

## Response

The service returns one recommendation content value:

```json
{
    "content": "Continue short daily reading practice and discuss unfamiliar words.",
    "metadata": {
        "providerModel": "example-model",
        "providerRequestId": "provider-request-456"
    }
}
```

- `content` is required and must be a non-empty string after trimming.
- `metadata` is optional JSON object data for provider diagnostics. It is not
  part of the domain `Recommendation` entity and must not be required by
  application workflows.
- The backend, not the provider, assigns `recommendationId` and
  `generatedAt`, and persists the request's `summaryId` and `studentId` as the
  recommendation's basis relationship.

## Failure behavior

The adapter maps transport failures, timeouts, authentication failures, rate
limits, and malformed provider responses into provider-neutral application
errors. Raw provider response shapes and credentials must not cross the port.
Timeouts, correlation IDs, idempotency IDs, and retryability classification are
enforced at the adapter boundary. Provider-neutral errors include the service
name, correlation ID, retryability, and (when applicable) HTTP status without
exposing provider response bodies. Retry orchestration remains a caller or
worker policy.

## Compatibility rule

Changing the selected provider must only require changing the generator
adapter and its composition configuration. Domain entities, application
workflows, controllers, and this logical port remain provider-neutral.
