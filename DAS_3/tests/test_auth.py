# from __future__ import annotations

# from dataclasses import dataclass
# from datetime import UTC, datetime, timedelta
# from json import JSONDecodeError
# from types import SimpleNamespace
# from typing import Any
# from unittest.mock import AsyncMock

# import jwt
# import pytest
# from cryptography.hazmat.primitives.asymmetric import ec, rsa
# from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError, PyJWKSetError
# from langgraph_sdk import Auth

# from das_agent.auth import (
#     HEALTHCHECK_IDENTITY,
#     JwtVerificationError,
#     JwtVerificationServiceError,
#     SupabaseAuthSettings,
#     SupabaseJwtVerifier,
#     SupabaseTeacherRepository,
#     TeacherRepositoryUnavailable,
#     auth,
#     authorize_thread_create,
#     authorize_thread_delete,
#     authorize_thread_read,
#     authorize_thread_run,
#     authorize_thread_search,
#     authorize_thread_update,
#     authenticate,
#     authenticate_request,
#     create_teacher_repository,
#     reject_unhandled_resource,
# )


# ISSUER = "https://project-ref.supabase.co/auth/v1"
# SUBJECT = "a9f5a628-52f0-4cf2-85a4-c5e53513a59a"
# OTHER_SUBJECT = "57b7fcb1-8b25-47eb-8c09-0e805d8a8794"


# @dataclass
# class FakeSigningKey:
#     key: Any


# class FakeJwksClient:
#     def __init__(self, public_key: Any, error: Exception | None = None) -> None:
#         self._public_key = public_key
#         self._error = error
#         self.tokens: list[str] = []

#     def get_signing_key_from_jwt(self, token: str) -> FakeSigningKey:
#         self.tokens.append(token)
#         if self._error:
#             raise self._error
#         return FakeSigningKey(self._public_key)


# class FakeVerifier:
#     def __init__(self, subject: str | None = SUBJECT, error: Exception | None = None) -> None:
#         self.subject = subject
#         self._error = error
#         self.tokens: list[str] = []

#     def verify(self, token: str) -> str:
#         self.tokens.append(token)
#         if self._error:
#             raise self._error
#         if self.subject is None:
#             raise JwtVerificationError("Invalid bearer token")
#         return self.subject


# class FakeTeacherRepository:
#     def __init__(self, is_teacher: bool) -> None:
#         self._is_teacher = is_teacher
#         self.checked_subjects: list[str] = []

#     async def is_teacher(self, auth_user_id: str) -> bool:
#         self.checked_subjects.append(auth_user_id)
#         return self._is_teacher


# class FakeTeacherQuery:
#     def __init__(self, data: list[dict[str, str]] | None = None, error: Exception | None = None) -> None:
#         self.data = data or []
#         self.error = error
#         self.calls: list[tuple[str, Any]] = []

#     def select(self, columns: str) -> "FakeTeacherQuery":
#         self.calls.append(("select", columns))
#         return self

#     def eq(self, column: str, value: str) -> "FakeTeacherQuery":
#         self.calls.append(("eq", (column, value)))
#         return self

#     def limit(self, count: int) -> "FakeTeacherQuery":
#         self.calls.append(("limit", count))
#         return self

#     def execute(self) -> SimpleNamespace:
#         if self.error:
#             raise self.error
#         return SimpleNamespace(data=self.data)


# class FakeSupabaseClient:
#     def __init__(self, query: FakeTeacherQuery) -> None:
#         self.query = query
#         self.calls: list[tuple[str, str]] = []

#     def schema(self, name: str) -> "FakeSupabaseClient":
#         self.calls.append(("schema", name))
#         return self

#     def table(self, name: str) -> FakeTeacherQuery:
#         self.calls.append(("table", name))
#         return self.query


# def auth_context(subject: str) -> SimpleNamespace:
#     return SimpleNamespace(user=SimpleNamespace(identity=subject))


# def matches_metadata_filter(
#     metadata_filter: dict[str, str], metadata: dict[str, str]
# ) -> bool:
#     return all(metadata.get(key) == value for key, value in metadata_filter.items())


# def test_thread_owner_handlers_are_registered_for_every_used_thread_action():
#     expected_handlers = {
#         "create": authorize_thread_create,
#         "read": authorize_thread_read,
#         "update": authorize_thread_update,
#         "delete": authorize_thread_delete,
#         "search": authorize_thread_search,
#         "create_run": authorize_thread_run,
#     }

#     for action, handler in expected_handlers.items():
#         assert auth._handlers[("threads", action)] == [handler]


# @pytest.mark.asyncio
# async def test_global_fallback_is_registered_and_rejects_unhandled_resources():
#     assert auth._global_handlers == [reject_unhandled_resource]

#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await reject_unhandled_resource(auth_context(SUBJECT), {})

#     assert error.value.status_code == 403
#     assert error.value.detail == "Forbidden"


# def issue_token(
#     private_key: Any,
#     *,
#     algorithm: str = "RS256",
#     issuer: str = ISSUER,
#     subject: object = SUBJECT,
#     audience: str | None = "authenticated",
#     expires_at: datetime | None = None,
# ) -> str:
#     claims = {
#         "iss": issuer,
#         "sub": subject,
#         "exp": expires_at or datetime.now(UTC) + timedelta(minutes=5),
#     }
#     if audience is not None:
#         claims["aud"] = audience

#     return jwt.encode(
#         claims,
#         private_key,
#         algorithm=algorithm,
#         headers={"kid": "test-key"},
#     )


# @pytest.fixture
# def jwt_verifier() -> tuple[SupabaseJwtVerifier, Any, FakeJwksClient]:
#     private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
#     jwks_client = FakeJwksClient(private_key.public_key())
#     return SupabaseJwtVerifier(ISSUER, jwks_client), private_key, jwks_client


# def test_jwks_verifier_accepts_valid_asymmetric_token(jwt_verifier):
#     verifier, private_key, jwks_client = jwt_verifier
#     token = issue_token(private_key)

#     assert verifier.verify(token) == SUBJECT
#     assert jwks_client.tokens == [token]


# def test_jwks_verifier_accepts_valid_es256_token():
#     private_key = ec.generate_private_key(ec.SECP256R1())
#     jwks_client = FakeJwksClient(private_key.public_key())
#     verifier = SupabaseJwtVerifier(ISSUER, jwks_client)
#     token = issue_token(private_key, algorithm="ES256")

#     assert verifier.verify(token) == SUBJECT
#     assert jwks_client.tokens == [token]


# def test_jwks_verifier_does_not_apply_an_audience_policy(jwt_verifier):
#     verifier, private_key, _ = jwt_verifier

#     assert verifier.verify(issue_token(private_key, audience="another-audience")) == SUBJECT


# @pytest.mark.parametrize(
#     ("token_kwargs", "tamper"),
#     [
#         ({"issuer": "https://another-project.supabase.co/auth/v1"}, False),
#         ({"expires_at": datetime.now(UTC) - timedelta(minutes=1)}, False),
#         ({"subject": ""}, False),
#         ({}, True),
#     ],
# )
# def test_jwks_verifier_rejects_invalid_tokens(jwt_verifier, token_kwargs, tamper):
#     verifier, private_key, _ = jwt_verifier
#     token = issue_token(private_key, **token_kwargs)
#     if tamper:
#         header, payload, signature = token.split(".")
#         signature = f"{'A' if signature[0] != 'A' else 'B'}{signature[1:]}"
#         token = f"{header}.{payload}.{signature}"

#     with pytest.raises(JwtVerificationError):
#         verifier.verify(token)


# @pytest.mark.parametrize(
#     "jwks_error",
#     [
#         PyJWKClientConnectionError("JWKS unavailable"),
#         PyJWKSetError("Malformed key set"),
#         JSONDecodeError("Invalid JSON", "not-json", 0),
#         PyJWKClientError("The JWKS endpoint did not return a JSON object"),
#     ],
# )
# def test_jwks_verifier_reports_jwks_failures_as_service_errors(jwt_verifier, jwks_error):
#     verifier, _, jwks_client = jwt_verifier
#     jwks_client._error = jwks_error

#     with pytest.raises(JwtVerificationServiceError):
#         verifier.verify("header.payload.signature")


# def test_jwks_verifier_reports_unknown_key_as_invalid_token(jwt_verifier):
#     verifier, _, jwks_client = jwt_verifier
#     jwks_client._error = PyJWKClientError('Unable to find a signing key that matches: "x"')

#     with pytest.raises(JwtVerificationError):
#         verifier.verify("header.payload.signature")


# def test_settings_derive_the_project_jwks_url(monkeypatch):
#     monkeypatch.setenv("SUPABASE_URL", "https://project-ref.supabase.co/")
#     monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
#     monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)

#     settings = SupabaseAuthSettings.from_environment()

#     assert settings.issuer == ISSUER
#     assert settings.jwks_url == f"{ISSUER}/.well-known/jwks.json"


# @pytest.mark.asyncio
# async def test_supabase_teacher_repository_returns_true_for_teacher_profile():
#     query = FakeTeacherQuery(data=[{"auth_user_id": SUBJECT}])
#     repository = SupabaseTeacherRepository(FakeSupabaseClient(query))

#     assert await repository.is_teacher(SUBJECT) is True
#     assert query.calls == [
#         ("select", "auth_user_id"),
#         ("eq", ("auth_user_id", SUBJECT)),
#         ("limit", 1),
#     ]


# @pytest.mark.asyncio
# async def test_supabase_teacher_repository_returns_false_for_missing_profile():
#     repository = SupabaseTeacherRepository(FakeSupabaseClient(FakeTeacherQuery()))

#     assert await repository.is_teacher(SUBJECT) is False


# @pytest.mark.asyncio
# async def test_supabase_teacher_repository_reports_outages():
#     repository = SupabaseTeacherRepository(
#         FakeSupabaseClient(FakeTeacherQuery(error=OSError("Supabase unavailable")))
#     )

#     with pytest.raises(TeacherRepositoryUnavailable):
#         await repository.is_teacher(SUBJECT)


# def test_teacher_repository_uses_non_persistent_server_client():
#     captured: dict[str, Any] = {}

#     def client_factory(url: str, key: str, *, options: Any) -> FakeSupabaseClient:
#         captured.update(url=url, key=key, options=options)
#         return FakeSupabaseClient(FakeTeacherQuery())

#     settings = SupabaseAuthSettings(
#         supabase_url="https://project-ref.supabase.co",
#         service_role_key="service-role-key",
#         jwks_url=f"{ISSUER}/.well-known/jwks.json",
#     )

#     repository = create_teacher_repository(settings, client_factory)

#     assert isinstance(repository, SupabaseTeacherRepository)
#     assert captured["url"] == settings.supabase_url
#     assert captured["key"] == settings.service_role_key
#     assert captured["options"].auto_refresh_token is False
#     assert captured["options"].persist_session is False


# @pytest.mark.asyncio
# @pytest.mark.parametrize(
#     "headers",
#     [
#         {},
#         {"Authorization": "Basic abc"},
#         {b"authorization": b"Bearer"},
#     ],
# )
# async def test_missing_or_malformed_bearer_token_returns_401(headers):
#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate_request(headers, FakeVerifier(), FakeTeacherRepository(True))

#     assert error.value.status_code == 401


# @pytest.mark.asyncio
# async def test_healthcheck_path_is_available_without_authentication():
#     assert await authenticate({}, "/ok") == {"identity": HEALTHCHECK_IDENTITY}


# @pytest.mark.asyncio
# async def test_nearby_healthcheck_path_still_requires_authentication(monkeypatch):
#     monkeypatch.setattr("das_agent.auth.build_default_verifier", FakeVerifier)
#     monkeypatch.setattr(
#         "das_agent.auth.build_default_teacher_repository",
#         lambda: FakeTeacherRepository(True),
#     )

#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate({}, "/ok/")

#     assert error.value.status_code == 401


# @pytest.mark.asyncio
# async def test_invalid_token_returns_401():
#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate_request(
#             {"Authorization": "Bearer invalid"},
#             FakeVerifier(subject=None),
#             FakeTeacherRepository(True),
#         )

#     assert error.value.status_code == 401


# @pytest.mark.asyncio
# async def test_authentication_verifies_jwt_in_worker_thread(monkeypatch):
#     verifier = FakeVerifier()
#     to_thread = AsyncMock(side_effect=lambda function, *args: function(*args))
#     monkeypatch.setattr("das_agent.auth.asyncio.to_thread", to_thread)

#     user = await authenticate_request(
#         {"Authorization": "Bearer valid-token"},
#         verifier,
#         FakeTeacherRepository(True),
#     )

#     assert user == {"identity": SUBJECT}
#     assert to_thread.await_count == 1
#     assert to_thread.await_args.args[1] == "valid-token"
#     assert verifier.tokens == ["valid-token"]


# @pytest.mark.asyncio
# async def test_jwks_failure_returns_503():
#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate_request(
#             {"Authorization": "Bearer valid-token"},
#             FakeVerifier(error=JwtVerificationServiceError("JWKS unavailable")),
#             FakeTeacherRepository(True),
#         )

#     assert error.value.status_code == 503


# @pytest.mark.asyncio
# async def test_teacher_lookup_failure_returns_503():
#     class UnavailableTeacherRepository:
#         async def is_teacher(self, auth_user_id: str) -> bool:
#             raise TeacherRepositoryUnavailable("Supabase unavailable")

#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate_request(
#             {"Authorization": "Bearer valid-token"},
#             FakeVerifier(),
#             UnavailableTeacherRepository(),
#         )

#     assert error.value.status_code == 503


# @pytest.mark.asyncio
# async def test_valid_non_teacher_returns_403():
#     repository = FakeTeacherRepository(False)
#     with pytest.raises(Auth.exceptions.HTTPException) as error:
#         await authenticate_request(
#             {"Authorization": "Bearer valid-token"},
#             FakeVerifier(),
#             repository,
#         )

#     assert error.value.status_code == 403
#     assert repository.checked_subjects == [SUBJECT]


# @pytest.mark.asyncio
# async def test_valid_teacher_returns_jwt_subject_as_identity():
#     repository = FakeTeacherRepository(True)

#     user = await authenticate_request(
#         {"Authorization": "Bearer valid-token"},
#         FakeVerifier(),
#         repository,
#     )

#     assert user == {"identity": SUBJECT}
#     assert repository.checked_subjects == [SUBJECT]


# @pytest.mark.asyncio
# async def test_thread_create_overwrites_client_supplied_owner_metadata():
#     value = {"metadata": {"owner": OTHER_SUBJECT, "label": "Fractions"}}

#     metadata_filter = await authorize_thread_create(auth_context(SUBJECT), value)

#     assert value["metadata"] == {"owner": SUBJECT, "label": "Fractions"}
#     assert metadata_filter == {"owner": SUBJECT}


# @pytest.mark.asyncio
# async def test_thread_update_cannot_reassign_ownership():
#     value = {"metadata": {"owner": OTHER_SUBJECT, "label": "Fractions"}}

#     metadata_filter = await authorize_thread_update(auth_context(SUBJECT), value)

#     assert value["metadata"] == {"owner": SUBJECT, "label": "Fractions"}
#     assert metadata_filter == {"owner": SUBJECT}


# @pytest.mark.asyncio
# @pytest.mark.parametrize(
#     "handler",
#     [
#         authorize_thread_read,
#         authorize_thread_update,
#         authorize_thread_delete,
#         authorize_thread_search,
#         authorize_thread_run,
#     ],
# )
# async def test_thread_operations_filter_to_the_authenticated_owner(handler):
#     metadata_filter = await handler(auth_context(SUBJECT), {})

#     assert metadata_filter == {"owner": SUBJECT}
#     assert matches_metadata_filter(metadata_filter, {"owner": SUBJECT})
#     assert not matches_metadata_filter(metadata_filter, {"owner": OTHER_SUBJECT})
#     assert not matches_metadata_filter(metadata_filter, {})
