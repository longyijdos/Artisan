from importlib import import_module

import httpx
import pytest

embeddings_module = import_module("services.knowledge.embeddings")


def test_is_embedding_configured_requires_key_and_base(monkeypatch) -> None:
    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_KEY", "sk-test")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_BASE", "https://example.com/v1")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_MODEL_NAME", "text-embedding-3-small")

    assert embeddings_module.is_embedding_configured() is True

    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_BASE", None)
    assert embeddings_module.is_embedding_configured() is False


@pytest.mark.asyncio
async def test_embed_texts_posts_openai_compatible_request(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _FakeAsyncClient:
        def __init__(self, **kwargs) -> None:
            captured["client_kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, url: str, *, headers: dict[str, str], json: dict[str, object]):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            request = httpx.Request("POST", url, headers=headers)
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"index": 1, "embedding": [0.3, 0.4]},
                        {"index": 0, "embedding": [0.1, 0.2]},
                    ]
                },
                request=request,
            )

    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_KEY", "sk-test")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_BASE", "https://example.com/v1")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_DIMENSION", 2)
    monkeypatch.setattr(embeddings_module.httpx, "AsyncClient", _FakeAsyncClient)

    vectors = await embeddings_module.embed_texts(["hello", "world"])

    assert vectors == [[0.1, 0.2], [0.3, 0.4]]
    assert captured["url"] == "https://example.com/v1/embeddings"
    assert captured["headers"] == {
        "Authorization": "Bearer sk-test",
        "Content-Type": "application/json",
    }
    assert captured["json"] == {
        "model": "text-embedding-3-small",
        "input": ["hello", "world"],
        "dimensions": 2,
        "encoding_format": "float",
    }


@pytest.mark.asyncio
async def test_embed_texts_rejects_dimension_mismatch(monkeypatch) -> None:
    class _FakeAsyncClient:
        def __init__(self, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, url: str, *, headers: dict[str, str], json: dict[str, object]):
            request = httpx.Request("POST", url, headers=headers)
            return httpx.Response(
                200,
                json={"data": [{"index": 0, "embedding": [0.1, 0.2, 0.3]}]},
                request=request,
            )

    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_KEY", "sk-test")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_API_BASE", "https://example.com/v1")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setattr(embeddings_module, "EMBEDDING_DIMENSION", 2)
    monkeypatch.setattr(embeddings_module.httpx, "AsyncClient", _FakeAsyncClient)

    with pytest.raises(RuntimeError, match="expected 2, got 3"):
        await embeddings_module.embed_texts(["hello"])
