"""
TripZen App Store Screenshot Generator
Generates iOS App Store-ready screenshots at iPhone 6.7" dimensions (1290 x 2796)
and iPhone 6.5" dimensions (1284 x 2778) and iPad 12.9" (2048 x 2732)
"""
import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"

# Device specs (Apple App Store required sizes)
DEVICES = {
    "iphone_6_7": {"width": 1290, "height": 2796, "css_width": 430, "css_height": 932},
    "iphone_6_5": {"width": 1284, "height": 2778, "css_width": 428, "css_height": 926},
}

# Screens to capture (route, file_name, login_required, role)
SCREENS = [
    ("/onboarding", "01_onboarding", False, None),
    ("/login", "02_login", False, None),
    ("/parent", "03_parent_home", True, "parent"),
    ("/parent/booking", "04_parent_booking", True, "parent"),
    ("/parent/history", "05_parent_history", True, "parent"),
    ("/parent/messages", "06_parent_messages", True, "parent"),
    ("/parent/account", "07_parent_account", True, "parent"),
    ("/driver", "08_driver_home", True, "driver"),
    ("/driver/scan", "09_driver_scan", True, "driver"),
    ("/admin", "10_admin_dashboard", True, "admin"),
    ("/admin/map", "11_admin_livemap", True, "admin"),
    ("/admin/students", "12_admin_students", True, "admin"),
]

CREDS = {
    "parent": ("priya@tripzen.com", "parent123"),
    "driver": ("driver@tripzen.com", "driver123"),
    "admin": ("admin@tripzen.com", "admin123"),
}


async def login(page, role):
    """Log in via the login screen and wait for redirect."""
    await page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=20000)
    await page.wait_for_timeout(1500)
    email, password = CREDS[role]
    
    try:
        inputs = page.locator("input")
        await inputs.nth(0).fill(email)
        await inputs.nth(1).fill(password)
        await page.wait_for_timeout(500)
        # Click sign in button
        await page.locator("text=/^Sign In$/").first.click(timeout=5000)
        await page.wait_for_timeout(4000)
    except Exception as e:
        print(f"   Login error for {role}: {e}")


async def capture_for_device(device_name, device_spec, out_dir):
    """Capture all screens for one device size."""
    os.makedirs(out_dir, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        
        # Use device scale factor of 3 to get retina-quality output
        # CSS dimensions x 3 = actual pixel dimensions
        context = await browser.new_context(
            viewport={"width": device_spec["css_width"], "height": device_spec["css_height"]},
            device_scale_factor=3,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = await context.new_page()
        
        # Track current role to avoid re-logging in
        current_role = None
        
        for route, name, needs_login, role in SCREENS:
            try:
                if needs_login and current_role != role:
                    await login(page, role)
                    current_role = role
                
                await page.goto(f"{BASE_URL}{route}", wait_until="networkidle", timeout=15000)
                await page.wait_for_timeout(3000)  # let animations finish & data load
                
                out_path = os.path.join(out_dir, f"{name}.png")
                await page.screenshot(path=out_path, full_page=False)
                size_kb = os.path.getsize(out_path) // 1024
                print(f"   ✓ {name}.png ({size_kb}KB)")
            except Exception as e:
                print(f"   ✗ {name}: {e}")
        
        await browser.close()


async def main():
    base_out = "/app/screenshots"
    os.makedirs(base_out, exist_ok=True)
    
    for device_name, device_spec in DEVICES.items():
        print(f"\n=== Capturing for {device_name} ({device_spec['width']}x{device_spec['height']}) ===")
        out_dir = os.path.join(base_out, device_name)
        await capture_for_device(device_name, device_spec, out_dir)
    
    print("\n=== DONE ===")
    for device_name in DEVICES:
        out_dir = os.path.join(base_out, device_name)
        if os.path.exists(out_dir):
            files = sorted(os.listdir(out_dir))
            print(f"\n{device_name}/")
            for f in files:
                print(f"  - {f}")


if __name__ == "__main__":
    asyncio.run(main())
