from importlib import import_module
from types import ModuleType
from typing import Any, cast

lifespan_module = import_module("lifespan")


def test_load_embedding_model_prefers_local_files(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    class _FakeSentenceTransformer:
        def __init__(self, model_name: str, **kwargs) -> None:
            calls.append({"model_name": model_name, **kwargs})

    fake_module = cast(Any, ModuleType("sentence_transformers"))
    fake_module.SentenceTransformer = _FakeSentenceTransformer
    monkeypatch.setattr(
        lifespan_module,
        "set_embedding_model",
        lambda model: calls.append({"set_model": model}),
    )
    monkeypatch.setitem(__import__("sys").modules, "sentence_transformers", fake_module)

    lifespan_module._load_embedding_model("BAAI/bge-small-zh-v1.5")

    assert calls[0] == {
        "model_name": "BAAI/bge-small-zh-v1.5",
        "device": "cpu",
        "local_files_only": True,
    }
    assert "set_model" in calls[1]


def test_load_embedding_model_falls_back_to_online_download(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    class _FakeSentenceTransformer:
        def __init__(self, model_name: str, **kwargs) -> None:
            calls.append({"model_name": model_name, **kwargs})
            if kwargs.get("local_files_only") is True:
                raise OSError("missing local cache")

    fake_module = cast(Any, ModuleType("sentence_transformers"))
    fake_module.SentenceTransformer = _FakeSentenceTransformer
    monkeypatch.setattr(
        lifespan_module,
        "set_embedding_model",
        lambda model: calls.append({"set_model": model}),
    )
    monkeypatch.setitem(__import__("sys").modules, "sentence_transformers", fake_module)

    lifespan_module._load_embedding_model("BAAI/bge-small-zh-v1.5")

    assert calls[0] == {
        "model_name": "BAAI/bge-small-zh-v1.5",
        "device": "cpu",
        "local_files_only": True,
    }
    assert calls[1] == {
        "model_name": "BAAI/bge-small-zh-v1.5",
        "device": "cpu",
    }
    assert "set_model" in calls[2]
