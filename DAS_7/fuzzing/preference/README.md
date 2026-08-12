# DAS 7 Notification Preference Fuzzer

This robustness campaign tests the real Express preference route and the real
`PreferenceService` with an in-memory repository. It never connects to Supabase, email, an LLM,
or any production service.

The Java 8 fuzzer sends generated JSON over localhost and checks these properties:

- invalid input returns HTTP 400 and performs no write;
- valid input returns HTTP 200 and performs exactly one in-memory write;
- email addresses are trimmed and lower-cased;
- a body `parentId` cannot replace the parent ID from the URL;
- oversized JSON returns HTTP 413 without reaching the repository;
- the server remains responsive throughout the campaign.

## Requirements

- Node dependencies installed in `DAS_7/backend`
- Java 8 or later JDK (`java` and `javac` on `PATH`)
- Windows PowerShell

Maven, Supabase credentials, and backend environment files are not required.

## Run

From `DAS_7/backend`:

```powershell
npm run fuzz:preferences
```

That command runs for 12 hours. For a 10-second smoke run:

```powershell
npm run fuzz:preferences:smoke
```

Run for a custom duration or deterministic seed:

```powershell
powershell -ExecutionPolicy Bypass -File fuzzing/preference/run.ps1 `
  -DurationHours 2 `
  -Seed 184295731
```

The fuzzer prints progress and the seed. On failure it stops immediately and saves the request
under `fuzzing/preference/failures/`; that directory is ignored by Git.
