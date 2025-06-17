import requests

def test_root_endpoint_returns_200(base_api_url):
    response = requests.get(f"{base_api_url}/")
    assert response.status_code == 200, f"Expected 200 OK but got {response.status_code}"

def test_status_endpoint_returns_ok(base_api_url):
    response = requests.get(f"{base_api_url}/status")
    assert response.status_code == 200, f"Expected 200 OK but got {response.status_code}"
    assert response.json() == {"status": "OK"}, f"Expected body {{'status': 'OK'}} but got {response.json()}"
