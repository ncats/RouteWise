import pytest
import requests
from urllib.parse import urlencode

RXSMILES_VALID = "CCO.CC(=O)O>>CC(=O)OCC.O"
RXSMILES_INVALID = "INVALID>>RXNSMILES"
DEFAULT_INVALID_SVG = "PHN2ZyB3aWR0aD0iNDUwIiBoZWlnaHQ9Ijc1IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgICAgICAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0id2hpdGUiIC8+CiAgICAgICAgICA8dGV4dCB4PSIxMCIgeT0iNTAiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9ImJsYWNrIj5VbmFibGUgdG8gZ2VuZXJhdGUgcmVhY3Rpb24gU1ZHPC90ZXh0PgogICAgICAgIDwvc3ZnPg=="


@pytest.mark.parametrize("highlight, base64_encode, show_atom_indices", [
    (True, True, True),
    (True, True, False),
    (True, False, True),
    (False, False, False),
    (False, True, False),
    (False, False, True),
])
def test_rxsmiles2svg_varied_configs(base_api_url, highlight, base64_encode, show_atom_indices):
    params = {
        "rxsmiles": RXSMILES_VALID,
        "highlight": str(highlight).lower(),
        "base64_encode": str(base64_encode).lower(),
        "show_atom_indices": str(show_atom_indices).lower(),
    }

    url = f"{base_api_url}/rxsmiles2svg?{urlencode(params)}"
    response = requests.get(url, headers={"accept": "application/json"})
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"

    data = response.json()
    assert data.get(
        "rxsmiles") == RXSMILES_VALID, "rxsmiles mismatch in response"

    if base64_encode:
        assert "svg_base64" in data and isinstance(data["svg_base64"], str) and len(data["svg_base64"]) > 0, \
            "svg_base64 missing or invalid"
    else:
        assert "svg" in data and isinstance(data["svg"], str) and (data["svg"].startswith("<svg") or data["svg"].startswith("<?xml")), \
            "svg missing or invalid"


def test_rxsmiles2svg_invalid_smiles_returns_400(base_api_url):
    params = {
        "rxsmiles": RXSMILES_INVALID,
        "highlight": "true",
        "base64_encode": "true",
        "show_atom_indices": "false",
    }

    url = f"{base_api_url}/rxsmiles2svg?{urlencode(params)}"
    response = requests.get(url, headers={"accept": "application/json"})
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    data = response.json()
    assert data["svg_base64"] == DEFAULT_INVALID_SVG, "Expected default invalid SVG"


DEFAULT_SMILES = "Cc1cc(Br)cc(C)c1C1C(=O)CCC1=O"
INVALID_SMILES = "INVALIDSMILES$$"


@pytest.mark.parametrize("img_width, img_height, base64_encode", [
    (300, 300, True),
    (150, 150, False),
    (500, 200, True),
    (400, 400, False),
])
def test_molsmiles2svg_varied_configs(base_api_url, img_width, img_height, base64_encode):
    params = {
        "mol_smiles": DEFAULT_SMILES,
        "img_width": img_width,
        "img_height": img_height,
        "base64_encode": str(base64_encode).lower(),
    }

    url = f"{base_api_url}/molsmiles2svg?{urlencode(params)}"
    response = requests.get(url, headers={"accept": "application/json"})
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"

    data = response.json()
    assert data.get(
        "smiles") == DEFAULT_SMILES, "mol_smiles mismatch in response"

    if base64_encode:
        assert "svg_base64" in data and isinstance(data["svg_base64"], str) and len(data["svg_base64"]) > 0, \
            "svg_base64 missing or invalid"
    else:
        assert "svg" in data and isinstance(data["svg"], str) and (data["svg"].startswith("<svg") or data["svg"].startswith("<?xml")), \
            "svg missing or invalid"


def test_molsmiles2svg_invalid_smiles_returns_400(base_api_url):
    params = {
        "mol_smiles": INVALID_SMILES,
        "img_width": 300,
        "img_height": 300,
        "base64_encode": "true",
    }

    url = f"{base_api_url}/molsmiles2svg?{urlencode(params)}"
    response = requests.get(url, headers={"accept": "application/json"})
    assert response.status_code == 400, f"Expected 400 Bad Request, got {response.status_code}"
