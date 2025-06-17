
import pytest
import re


def test_graph_retrieval_dropdown(page, base_url):
    page.goto(base_url)

    # Locate the Ant Design Select using data-testid
    dropdown = page.get_by_test_id("GraphRetrievalDropdown")

    # ✅ Step 1: Ensure the dropdown is visible
    assert dropdown.is_visible(), "Dropdown is not visible"

    # ✅ Step 2: Ensure the default value is 'Upload JSON'
    # AntD renders the selected text in a nested <span>
    selected_text = dropdown.locator(".ant-select-selection-item")
    assert selected_text.inner_text().strip(
    ) == "Upload JSON", "Default selected value is not 'Upload JSON'"

    # ✅ Step 3: Click to open the dropdown options
    dropdown.click()

    # AntD renders the options in a popup container outside of the Select DOM
    options_container = page.locator(
        ".ant-select-dropdown:not(.ant-select-dropdown-hidden)")

    # Ensure the options appear
    options = options_container.locator(".ant-select-item-option")
    expected_options = ["Upload JSON",
                        "Upload Cytoscape JSON", "Example Graphs"]

    found_options = options.all_inner_texts()
    for option in expected_options:
        assert any(
            option in text for text in found_options), f"Option '{option}' not found in dropdown"
def select_graph_option(page, option_text):
    """Helper to select a dropdown option by visible label from Ant Design Select."""
    dropdown = page.get_by_test_id("GraphRetrievalDropdown")
    dropdown.click()
    option = page.locator(f".ant-select-item-option >> text={option_text}")
    option.wait_for(state="visible", timeout=3000)
    option.click()


def test_graph_retrieval_dropdown(page, base_url):
    page.goto(base_url)

    dropdown = page.get_by_test_id("GraphRetrievalDropdown")
    assert dropdown.is_visible(), "Dropdown is not visible"

    # ✅ Check default selection
    selected_text = dropdown.locator(".ant-select-selection-item")
    assert selected_text.inner_text().strip() == "Upload JSON", "Default selected value is not 'Upload JSON'"

    # ✅ Open dropdown and verify available options
    dropdown.click()
    options_container = page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")
    options = options_container.locator(".ant-select-item-option")
    expected_options = ["Upload JSON", "Upload Cytoscape JSON", "Example Graphs"]

    found_options = options.all_inner_texts()
    for option in expected_options:
        assert any(option in text for text in found_options), f"Option '{option}' not found in dropdown"


@pytest.mark.parametrize("option_label", [
    "Upload JSON",
    "Upload Cytoscape JSON"
])
def test_file_upload_modes(page, base_url, option_label):
    page.goto(base_url)
    select_graph_option(page, option_label)

    form_container = page.locator("#GraphFormContainer")
    assert form_container.is_visible(), f"{option_label}: GraphFormContainer not visible"

    h4 = form_container.locator("h4")
    assert h4.inner_text().strip() == "Upload Valid JSON File", f"{option_label}: Expected H4 text not found"

    button = form_container.get_by_role("button", name="Select JSON file")
    assert button.is_visible(), f"{option_label}: 'Select JSON file' button not visible"


def test_example_graph_mode(page, base_url):
    page.goto(base_url)
    select_graph_option(page, "Example Graphs")

    expected_buttons = [
        "Example 1",
        "Example 2",
        "Predicted Route Example",
        "Hybrid Routes Example"
    ]

    for btn_text in expected_buttons:
        btn = page.get_by_role("button", name=btn_text)
        assert btn.is_visible(), f"Button '{btn_text}' not visible in Example Graphs mode"

@pytest.mark.parametrize("button_label", [
    "Example 1",
    "Example 2",
    "Predicted Route Example",
    "Hybrid Routes Example"
])
def test_example_graph_button_loads_graph_info(page, base_url, button_label):
    page.goto(base_url)
    select_graph_option(page, "Example Graphs")

    # Click the example button
    page.get_by_role("button", name=button_label).click()

    # Wait 2 seconds
    page.wait_for_timeout(1000)

    # Wait for graph-info div to appear
    graph_info = page.locator("#graph-info")
    graph_info.wait_for(state="visible", timeout=3000)
    text = graph_info.inner_text()

    # Assert presence of "Nodes: <number>" and "Edges: <number>"
    assert "Nodes: N/A" not in text, f"'Nodes: N/A' found in graph-info for '{button_label}'"
    assert "Edges: N/A" not in text, f"'Edges: N/A' found in graph-info for '{button_label}'"

    assert re.search(r"Nodes:\s*\d+", text), f"'Nodes' number not found in graph-info for '{button_label}'"
    assert re.search(r"Edges:\s*\d+", text), f"'Edges' number not found in graph-info for '{button_label}'"