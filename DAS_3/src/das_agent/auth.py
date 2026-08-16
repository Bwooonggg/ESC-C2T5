"""Supabase JWT authentication for the DAS3 LangGraph deployment."""

from __future__ import annotations

import asyncio
import os
from json import JSONDecodeError
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Protocol
from urllib.parse import urlparse

import jwt
from jwt import PyJWKClient
from jwt.exceptions import (
    InvalidTokenError,
    PyJWKClientConnectionError,
    PyJWKClientError,
    PyJWKSetError,
)
from langgraph_sdk import Auth
from supabase import create_client
from supabase.client import ClientOptions


ASYMMETRIC_JWT_ALGORITHMS = (
    "RS256",
    "RS384",
    "RS512",
    "ES256",
    "ES384",
    "ES512",
    "EdDSA",
)


class JwtVerificationError(Exception):
    """Raised when a bearer token cannot be trusted as a Supabase JWT."""


class JwtVerificationServiceError(Exception):
    """Raised when the configured JWKS endpoint cannot verify any token."""


class TeacherRepositoryUnavailable(Exception):
    """Raised when teacher membership cannot be checked."""


class TokenVerifier(Protocol):
    def verify(self, token: str) -> str:
        """Return the verified JWT subject or raise JwtVerificationError."""


class TeacherRepository(Protocol):
    async def is_teacher(self, auth_user_id: str) -> bool:
        """Return whether the authenticated Supabase user is a teacher."""


@dataclass(frozen=True)
class SupabaseAuthSettings:
    supabase_url: str
    service_role_key: str
    jwks_url: str

    @classmethod
    def from_environment(cls) -> "SupabaseAuthSettings":
        supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        configured_jwks_url = os.environ.get("SUPABASE_JWKS_URL", "").strip()

        if not supabase_url:
            raise RuntimeError("SUPABASE_URL must be configured for DAS3 authentication")
        if not service_role_key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY must be configured for DAS3 authentication"
            )

        parsed_url = urlparse(supabase_url)
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            raise RuntimeError("SUPABASE_URL must be an HTTPS Supabase project URL")

        jwks_url = configured_jwks_url or f"{supabase_url}/auth/v1/.well-known/jwks.json"
        parsed_jwks_url = urlparse(jwks_url)
        if parsed_jwks_url.scheme != "https" or not parsed_jwks_url.netloc:
            raise RuntimeError("SUPABASE_JWKS_URL must be an HTTPS URL")

        return cls(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
            jwks_url=jwks_url,
        )

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"


class SupabaseJwtVerifier:
    """Verifies asymmetric Supabase access tokens against the project JWKS."""

    def __init__(self, issuer: str, jwks_client: Any) -> None:
        self._issuer = issuer
        self._jwks_client = jwks_client

    @classmethod
    def from_settings(cls, settings: SupabaseAuthSettings) -> "SupabaseJwtVerifier":
        return cls(settings.issuer, PyJWKClient(settings.jwks_url, timeout=5))

    def verify(self, token: str) -> str:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=ASYMMETRIC_JWT_ALGORITHMS,
                issuer=self._issuer,
                options={
                    "require": ["exp", "iss", "sub"],
                    "verify_aud": False,
                },
            )
        except (
            JSONDecodeError,
            PyJWKClientConnectionError,
            PyJWKSetError,
        ) as error:
            raise JwtVerificationServiceError("JWKS verification is unavailable") from error
        except PyJWKClientError as error:
            if str(error) in {
                "The JWKS endpoint did not return a JSON object",
                "The JWKS endpoint did not contain any signing keys",
            }:
                raise JwtVerificationServiceError(
                    "JWKS verification is unavailable"
                ) from error
            raise JwtVerificationError("Invalid bearer token") from error
        except InvalidTokenError as error:
            raise JwtVerificationError("Invalid bearer token") from error

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.strip():
            raise JwtVerificationError("Invalid bearer token")
        return subject


class SupabaseTeacherRepository:
    """Looks up teacher membership through the server-side Supabase client."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def _lookup_teacher(self, auth_user_id: str) -> Any:
        return (
            self._client.schema("worksheet")
            .table("teachers")
            .select("auth_user_id")
            .eq("auth_user_id", auth_user_id)
            .limit(1)
            .execute()
        )

    async def is_teacher(self, auth_user_id: str) -> bool:
        try:
            response = await asyncio.to_thread(self._lookup_teacher, auth_user_id)
        except Exception as error:
            raise TeacherRepositoryUnavailable("Teacher lookup is unavailable") from error
        return bool(response.data)


def create_teacher_repository(
    settings: SupabaseAuthSettings,
    client_factory: Any = create_client,
) -> SupabaseTeacherRepository:
    client = client_factory(
        settings.supabase_url,
        settings.service_role_key,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        ),
    )
    return SupabaseTeacherRepository(client)


def extract_bearer_token(headers: dict[Any, Any]) -> str:
    authorization: str | bytes | None = None
    for name, value in headers.items():
        normalized_name = name.decode("latin-1") if isinstance(name, bytes) else str(name)
        if normalized_name.lower() == "authorization":
            authorization = value
            break

    if isinstance(authorization, bytes):
        authorization = authorization.decode("latin-1")
    if not isinstance(authorization, str):
        raise JwtVerificationError("Missing bearer token")

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise JwtVerificationError("Malformed bearer token")
    return parts[1]


async def authenticate_request(
    headers: dict[Any, Any],
    verifier: TokenVerifier,
    teacher_repository: TeacherRepository,
) -> dict[str, str]:
    """Authenticate one LangGraph request and return its authenticated identity."""
    try:
        subject = await asyncio.to_thread(verifier.verify, extract_bearer_token(headers))
    except JwtVerificationServiceError as error:
        raise Auth.exceptions.HTTPException(
            status_code=503,
            detail="Authentication service unavailable",
        ) from error
    except JwtVerificationError as error:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized") from error

    try:
        is_teacher = await teacher_repository.is_teacher(subject)
    except TeacherRepositoryUnavailable as error:
        raise Auth.exceptions.HTTPException(
            status_code=503,
            detail="Authentication service unavailable",
        ) from error

    if not is_teacher:
        raise Auth.exceptions.HTTPException(status_code=403, detail="Forbidden")

    return {"identity": subject}


@lru_cache(maxsize=1)
def build_default_verifier() -> SupabaseJwtVerifier:
    return SupabaseJwtVerifier.from_settings(SupabaseAuthSettings.from_environment())


@lru_cache(maxsize=1)
def build_default_teacher_repository() -> SupabaseTeacherRepository:
    return create_teacher_repository(SupabaseAuthSettings.from_environment())


auth = Auth()
HEALTHCHECK_IDENTITY = "das3-healthcheck"


@auth.authenticate
async def authenticate(
    headers: dict[Any, Any],
    path: str,
) -> Auth.types.MinimalUserDict:
    if path == "/ok":
        return {"identity": HEALTHCHECK_IDENTITY}

    return await authenticate_request(
        headers,
        build_default_verifier(),
        build_default_teacher_repository(),
    )


@auth.on
async def reject_unhandled_resource(
    ctx: Auth.types.AuthContext,
    value: Any,
) -> None:
    """Deny resources and actions without an explicit authorization handler."""
    raise Auth.exceptions.HTTPException(status_code=403, detail="Forbidden")


def thread_owner_filter(ctx: Auth.types.AuthContext) -> Auth.types.FilterType:
    """Limit a thread operation to resources owned by the authenticated teacher."""
    return {"owner": ctx.user.identity}


@auth.on.threads.create
async def authorize_thread_create(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.create.value,
) -> Auth.types.FilterType:
    """Stamp new threads with their authenticated owner."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return thread_owner_filter(ctx)


@auth.on.threads.read
async def authorize_thread_read(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.read.value,
) -> Auth.types.FilterType:
    """Restrict thread and run reads to the thread owner."""
    return thread_owner_filter(ctx)


@auth.on.threads.update
async def authorize_thread_update(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.update.value,
) -> Auth.types.FilterType:
    """Restrict updates to the owner and prevent ownership reassignment."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return thread_owner_filter(ctx)


@auth.on.threads.delete
async def authorize_thread_delete(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.delete.value,
) -> Auth.types.FilterType:
    """Restrict thread and run deletion to the thread owner."""
    return thread_owner_filter(ctx)


@auth.on.threads.search
async def authorize_thread_search(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.search.value,
) -> Auth.types.FilterType:
    """Restrict thread and run search results to the thread owner."""
    return thread_owner_filter(ctx)


@auth.on.threads.create_run
async def authorize_thread_run(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.threads.create_run.value,
) -> Auth.types.FilterType:
    """Require run creation, including streams and interrupts, to own its thread."""
    return thread_owner_filter(ctx)
