"""
Generate iPad 13" screenshots for App Store
Dimensions: 2064 x 2752 (or 2752 x 2064)
"""
import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"

# iPad 13" (M4 iPad Pro): 2064 x 2752 at 2x DPR
DEVICE = {"width": 2064, "height": 2752, "css_width": 1032, "css_height": 1376}

SCREENS = [
    ("/onboarding", "1_onboarding", False, None),
    ("/parent", "2_live_tracking", True, "parent"),
    ("/parent/booking", "3_easy_booking", True, "parent"),
    ("/parent/history", "4_trip_history", True, "parent"),
    ("/admin", "5_admin_overview", True, "admin"),
    ("/parent/account", "6_settings", True, "parent"),
]

CREDS = {
    "parent": ("priya@tripzen.com", "parent123"),
    "admin": ("admin@tripzen.com", "admin123"),
}


async def login(page, role):
    await page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=20000)
    await page.wait_for_timeout(1500)
    email, password = CREDS[role]
    inputs = page.locator("input")
    await inputs.nth(0).fill(email)
    await inputs.nth(1).fill(password)
    await page.wait_for_timeout(500)
    try:
        await page.locator("text=/^Sign In$/").first.click(timeout=5000)
        await page.wait_for_timeout(4000)
    except Exception as e:
        print(f"   Login error: {e}")


async def main():
    out_dir = "/app/screenshots/ipad_13"
    os.makedirs(out_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        context = await browser.new_context(
            viewport={"width": DEVICE["css_width"], "height": DEVICE["css_height"]},
            device_scale_factor=2,
            user_agent="Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = await context.new_page()

        current_role = None
        for route, name, needs_login, role in SCREENS:
            try:
                if needs_login and current_role != role:
                    await login(page, role)
                    current_role = role
                await page.goto(f"{BASE_URL}{route}", wait_until="networkidle", timeout=15000)
                await page.wait_for_timeout(3000)
                out_path = os.path.join(out_dir, f"{name}.png")
                await page.screenshot(path=out_path, full_page=False)
                size_kb = os.path.getsize(out_path) // 1024
                print(f"   ✓ {name}.png ({size_kb}KB)")
            except Exception as e:
                print(f"   ✗ {name}: {e}")

        await browser.close()

    # Verify dimensions
    print("\n=== Verifying dimensions ===")
    from PIL import Image
    for f in sorted(os.listdir(out_dir)):
        img = Image.open(os.path.join(out_dir, f))
        print(f"   {f}: {img.size}")


if __name__ == "__main__":
    asyncio.run(main())
