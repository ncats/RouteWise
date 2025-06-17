import os
import pytest
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

BASE_UI_URL = os.getenv("BASE_UI_URL")
BASE_API_URL = os.getenv("BASE_API_URL")
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"

@pytest.fixture(scope="session")
def base_ui_url():
    return BASE_UI_URL

@pytest.fixture(scope="session")
def base_api_url():
    return BASE_API_URL

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        yield browser
        browser.close()

# Base page
@pytest.fixture
def page(browser):
    context = browser.new_context(
        base_url=BASE_UI_URL
    )
    page = context.new_page()
    yield page
    context.close()