from pathlib import Path

import pytest

from route_catalog import ROUTES


def _is_unmounted(response):
    if response.status_code != 404:
        return False
    try:
        return str(response.json().get("message", "")).startswith("Không tìm thấy route ")
    except ValueError:
        return False


@pytest.mark.catalog
@pytest.mark.parametrize("route", ROUTES, ids=lambda route: route.id)
def test_catalogued_route_is_mounted_and_protected(api, route_path, route):
    if not route.live_probe:
        pytest.skip("live probe intentionally disabled because this endpoint sends email")
    response = api.request(route.method, route_path(route.path), json={} if route.method != "GET" else None)
    assert not _is_unmounted(response), f"catalogued route is not mounted: {route.id}"
    if route.protected:
        assert response.status_code == 401, f"anonymous {route.id} returned {response.status_code}, expected 401"


def test_catalog_has_unique_method_paths():
    ids = [route.id for route in ROUTES]
    assert len(ids) == len(set(ids))


def test_side_effecting_mail_route_is_statically_mounted():
    source = Path(__file__).parents[2] / "backend/src/modules/customer/auth/auth.route.js"
    if not source.exists():
        pytest.skip("backend source is unavailable; live mail probe remains intentionally disabled")
    assert 'router.get("/test-mail", controller.testMail)' in source.read_text(encoding="utf-8")
