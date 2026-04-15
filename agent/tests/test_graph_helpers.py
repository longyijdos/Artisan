from importlib import import_module

context_module = import_module("graph._context")
tools_module = import_module("graph._tools")

build_attachment_context = context_module.build_attachment_context
filter_backend_tool_calls = tools_module.filter_backend_tool_calls
normalize_attachments = context_module.normalize_attachments


def test_normalize_attachments_filters_invalid_entries() -> None:
    attachments = normalize_attachments([
        {"path": "src/app.ts", "name": "app.ts", "size": 12, "mimeType": "text/typescript"},
        {"path": ""},
        {"name": "missing-path"},
        "not-a-dict",
    ])

    assert attachments == [
        {
            "path": "src/app.ts",
            "name": "app.ts",
            "size": 12,
            "mimeType": "text/typescript",
        }
    ]


def test_build_attachment_context_mentions_paths() -> None:
    context = build_attachment_context([
        {"path": "docs/readme.md", "name": "readme.md", "size": 42}
    ])

    assert "docs/readme.md" in context
    assert "read_file" in context


def test_filter_backend_tool_calls_keeps_backend_tools_only() -> None:
    tool_calls = [
        {"name": "write_file", "args": {}},
        {"name": "ask_user", "args": {}},
        {"name": "execute_shell", "args": {}},
        {"name": "unknown_tool", "args": {}},
        "not-a-dict",
    ]

    filtered = filter_backend_tool_calls(tool_calls)

    assert filtered == [
        {"name": "write_file", "args": {}},
        {"name": "execute_shell", "args": {}},
    ]
