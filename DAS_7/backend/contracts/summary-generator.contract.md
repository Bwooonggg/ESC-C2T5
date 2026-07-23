# Summary Generator Contract

This is the provider-neutral logical contract for
`SummaryGeneratorPort.generate`. It defines what the backend sends to a
replaceable SummaryGeneratorService and what the service returns. An adapter
will translate this contract to the selected external provider's HTTP or SDK
format later.

## Operation

```text
generate(request: SummaryGenerationRequest): Promise<SummaryGenerationResult>
```

The application calls this operation only after it has loaded progress and the
student's current progress-version marker as one snapshot. The backend
rechecks that marker before saving the generated summary.

## Request

The request contains:

- `student`: the student's ID, display name, date of birth, band level, and
  `currentProgressVersion`.
- `records`: the progress records used as evidence for the summary.

Every record must belong to `student.studentId`. The application supplies the
records in ascending `date`, then ascending `recordId` order. Each record
contains its skill area, score, and notes. Scores are between `0` and `100`
with at most two decimal places, matching the domain and MySQL constraints.

An adapter may project that logical request to a JSON shape like this:

```json
{
    "student": {
        "studentId": "student-123",
        "name": "Example Student",
        "dateOfBirth": "2015-06-15",
        "bandLevel": "Band 2",
        "currentProgressVersion": "v7"
    },
    "records": [
        {
            "recordId": "record-001",
            "studentId": "student-123",
            "date": "2026-07-23",
            "skillArea": "Reading Fluency",
            "score": 82.5,
            "notes": "Reads short passages with occasional prompts."
        }
    ]
}
```

The request carries domain values, not database rows, credentials, session
tokens, or provider-specific fields. The adapter converts `Date` values to
the provider's agreed date format.

The transport metadata is supplied separately from this JSON request. Each
invocation carries a correlation ID for tracing and an idempotency ID for safe
retries. The adapter creates both when a caller does not provide them; retries
of one invocation must reuse the same values.

An empty `records` array is structurally valid, but the application should
return its `progressUnavailable` result instead of calling the generator when
there is no usable progress data.

## Response

The service returns:

```json
{
    "content": "A concise summary of the student's progress.",
    "metadata": {
        "providerModel": "example-model",
        "providerRequestId": "provider-request-123"
    }
}
```

- `content` is required and must be a non-empty string after trimming.
- `metadata` is optional JSON object data for provider diagnostics. It is not
  part of the domain `Summary` entity and must not be required by application
  workflows.
- The backend, not the provider, assigns `summaryId`, `generatedAt`, and
  `sourceProgressVersion` when it creates the domain `Summary`.

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
