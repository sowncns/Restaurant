import os

import pytest
import requests


def assert_envelope(response, key, kind):
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("application/json")
    payload = response.json()
    assert isinstance(payload.get("message"), str) and payload["message"]
    assert isinstance(payload.get(key), kind)
    return payload[key]


@pytest.mark.contract
def test_health_contract(api_config):
    base = api_config["base_url"]
    health_url = base[:-4] + "/health" if base.endswith("/api") else base + "/health"
    response = requests.get(health_url, timeout=api_config["timeout"], verify=api_config["verify"])
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


@pytest.mark.contract
def test_companies_contract(api):
    assert_envelope(api.get("/public/companies"), "companies", list)


@pytest.mark.contract
def test_home_banners_contract(api):
    assert_envelope(api.get("/public/home-banners"), "banners", list)


@pytest.mark.contract
def test_company_children_contracts(api):
    companies = assert_envelope(api.get("/public/companies"), "companies", list)
    company_id = os.getenv("E2E_COMPANY_ID") or (companies[0].get("company_id") if companies else None)
    if not company_id:
        pytest.skip("no public company and E2E_COMPANY_ID is absent")
    assert_envelope(api.get(f"/public/companies/{company_id}"), "company", dict)
    assert_envelope(api.get(f"/public/companies/{company_id}/branches"), "branches", list)
    assert_envelope(api.get(f"/public/companies/{company_id}/categories"), "categories", list)
    assert_envelope(api.get(f"/public/companies/{company_id}/menu"), "menu", list)


@pytest.mark.contract
def test_branch_contract(api):
    branch_id = os.getenv("E2E_BRANCH_ID")
    if not branch_id:
        pytest.skip("E2E_BRANCH_ID absent")
    assert_envelope(api.get(f"/public/branches/{branch_id}"), "branch", dict)


@pytest.mark.contract
def test_menu_item_contract(api):
    item_id = os.getenv("E2E_MENU_ITEM_ID")
    if not item_id:
        pytest.skip("E2E_MENU_ITEM_ID absent")
    assert_envelope(api.get(f"/public/menu-items/{item_id}"), "item", dict)
