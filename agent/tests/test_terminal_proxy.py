from importlib import import_module


proxy_module = import_module("services.terminal.proxy")

build_upstream_url = proxy_module.build_upstream_url
resolve_preview_route = proxy_module.resolve_preview_route


def test_resolve_preview_route_uses_loopback_for_daytona_proxy_subdomains() -> None:
    route = resolve_preview_route("http://22222-sandbox.proxy.localhost:14000")

    assert route.connect_host == "127.0.0.1"
    assert route.connect_port == 14000
    assert route.host_header == "22222-sandbox.proxy.localhost:14000"
    assert route.loopback_override is True


def test_build_upstream_url_can_override_connect_host_without_changing_host_header() -> None:
    upstream = build_upstream_url(
        "http://22222-sandbox.proxy.localhost:14000",
        "socket",
        "token=abc",
        connect_host="127.0.0.1",
        connect_port=14000,
    )

    assert upstream == "http://127.0.0.1:14000/socket?token=abc"


def test_resolve_preview_route_leaves_non_local_hosts_untouched() -> None:
    route = resolve_preview_route("https://preview.example.com")

    assert route.connect_host == "preview.example.com"
    assert route.connect_port == 443
    assert route.host_header == "preview.example.com"
    assert route.loopback_override is False
