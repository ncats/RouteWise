import requests
from urllib.parse import urlencode

TEST_RXSMILES = "[O:1]=[C:2]1[C:6]2([CH2:11][CH2:10][NH:9][CH2:8][CH2:7]2)[N:5]([C:12]2[CH:17]=[CH:16][CH:15]=[CH:14][CH:13]=2)[CH2:4][N:3]1[CH2:18][C:19]1[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=1[C:21]([O:23][C:24]([CH3:27])([CH3:26])[CH3:25])=[O:22].[I-].[Na+].C(=O)([O-])[O-].[K+].[K+].Cl[CH2:41][CH2:42][CH2:43][N:44]1[C:52]2[C:47](=[CH:48][CH:49]=[CH:50][CH:51]=2)[C:46]([CH3:54])([CH3:53])[C:45]1=[O:55]>CC(=O)CC>[CH3:54][C:46]1([CH3:53])[C:47]2[C:52](=[CH:51][CH:50]=[CH:49][CH:48]=2)[N:44]([CH2:43][CH2:42][CH2:41][N:9]2[CH2:8][CH2:7][C:6]3([N:5]([C:12]4[CH:13]=[CH:14][CH:15]=[CH:16][CH:17]=4)[CH2:4][N:3]([CH2:18][C:19]4[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=4[C:21]([O:23][C:24]([CH3:27])([CH3:25])[CH3:26])=[O:22])[C:2]3=[O:1])[CH2:11][CH2:10]2)[C:45]1=[O:55] |f:1.2,3.4.5|"
TEST_MAPPED = "[O:1]=[C:2]1[C:6]2([CH2:11][CH2:10][NH:9][CH2:8][CH2:7]2)[N:5]([C:12]2[CH:17]=[CH:16][CH:15]=[CH:14][CH:13]=2)[CH2:4][N:3]1[CH2:18][C:19]1[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=1[C:21]([O:23][C:24]([CH3:27])([CH3:26])[CH3:25])=[O:22].Cl[CH2:41][CH2:42][CH2:43][N:44]1[C:52]2[C:47](=[CH:48][CH:49]=[CH:50][CH:51]=2)[C:46]([CH3:54])([CH3:53])[C:45]1=[O:55]>[K+].[K+].C(=O)([O-])[O-].CC(=O)CC.[Na+].[I-]>[CH3:54][C:46]1([CH3:53])[C:47]2[C:52](=[CH:51][CH:50]=[CH:49][CH:48]=2)[N:44]([CH2:43][CH2:42][CH2:41][N:9]2[CH2:8][CH2:7][C:6]3([N:5]([C:12]4[CH:13]=[CH:14][CH:15]=[CH:16][CH:17]=4)[CH2:4][N:3]([CH2:18][C:19]4[CH:31]=[CH:30][CH:29]=[CH:28][C:20]=4[C:21]([O:23][C:24]([CH3:27])([CH3:25])[CH3:26])=[O:22])[C:2]3=[O:1])[CH2:11][CH2:10]2)[C:45]1=[O:55] |f:2.3.4,6.7|"


def test_normalizeroles_rxsmiles_normalization(base_api_url):
    payload = {"rxsmiles": TEST_RXSMILES}
    response = requests.post(f"{base_api_url}/normalize_roles", json=payload)

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"

    data = response.json()

    assert "rxsmiles" in data, "Missing normalized rxsmiles in response"
    assert "original_rxsmiles" in data, "Missing original_rxsmiles in response"

    # The original string should match what we sent
    assert data["original_rxsmiles"] == TEST_RXSMILES, "original_rxsmiles mismatch"

    # Ensure that normalization has changed the rxsmiles (e.g., roles reordered, fragments normalized)
    assert data["rxsmiles"] != TEST_RXSMILES, "rxsmiles was not normalized"

    # Ensure that normalization has changed the rxsmiles (e.g., roles reordered, fragments normalized)
    assert data["rxsmiles"] == TEST_MAPPED


def test_normalizeroles_rxsmiles_no_atommapping(base_api_url):
    payload = {"rxsmiles": "NOMAPPING>>RXSMILES"}
    response = requests.post(f"{base_api_url}/normalize_roles", json=payload)

    assert response.status_code == 400, f"Expected 400 Bad Request, got {response.status_code}"


def test_compute_all_bi_returns_expected_keys(base_api_url):
    rxsmiles = "ClC(Cl)(O[C:5](=[O:11])OC(Cl)(Cl)Cl)Cl.[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][NH:34][CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1.C(N(CC)CC)C.Cl.[CH3:45][NH:46][OH:47].[Cl-].[NH4+]>ClCCl.O>[Cl:13][C:14]1[CH:19]=[CH:18][C:17]([C:20]2[N:21]=[C:22]([CH:31]3[CH2:36][CH2:35][N:34]([C:5](=[O:11])[N:46]([OH:47])[CH3:45])[CH2:33][CH2:32]3)[S:23][C:24]=2[C:25]2[CH:30]=[CH:29][CH:28]=[CH:27][CH:26]=2)=[CH:16][CH:15]=1"

    params = {
        "rxsmiles": rxsmiles
    }

    url = f"{base_api_url}/compute_all_bi?{urlencode(params)}"
    response = requests.get(url, headers={"accept": "application/json"})

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"

    data = response.json()

    for key in ["pbi", "rbi", "tbi"]:
        assert key in data, f"Missing key '{key}' in response"
        assert isinstance(data[key], (int, float)
                          ), f"{key} is not a number: {data[key]}"
