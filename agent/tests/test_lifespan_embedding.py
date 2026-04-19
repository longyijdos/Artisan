from importlib import import_module

lifespan_module = import_module("lifespan")


def test_log_embedding_backend_reports_remote_config(capsys, monkeypatch) -> None:
    monkeypatch.setattr(lifespan_module, "EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setattr(lifespan_module, "EMBEDDING_DIMENSION", 512)
    monkeypatch.setattr(lifespan_module, "is_embedding_configured", lambda: True)

    lifespan_module._log_embedding_backend()

    captured = capsys.readouterr()
    assert "Embedding API configured: text-embedding-3-small (512d)" in captured.out


def test_log_embedding_backend_reports_missing_config(capsys, monkeypatch) -> None:
    monkeypatch.setattr(lifespan_module, "is_embedding_configured", lambda: False)

    lifespan_module._log_embedding_backend()

    captured = capsys.readouterr()
    assert "Embedding API not configured" in captured.out
