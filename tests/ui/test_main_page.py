def test_homepage_title_and_header(page, base_url):
    page.goto(base_url)
    
    # Check title contains "RouteWise"
    assert "RouteWise" in page.title()

    # Check <div id="main-header"> exists
    main_header = page.locator("#main-header")
    assert main_header.is_visible(), "main-header div is not visible"

    # Check there is an <h3> inside with text "RouteWise"
    h3 = main_header.locator("h3")
    assert h3.is_visible(), "No <h3> found inside #main-header"
    assert h3.inner_text().strip() == "RouteWise", "Header text does not match 'RouteWise'"

    # Check for <img> tag inside #main-header
    img = main_header.locator("img")
    assert img.is_visible(), "No <img> tag found inside #main-header"