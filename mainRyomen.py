#!/usr/bin/env python3
"""CarX Street Enterprise Account Engineering Terminal CLI (Ryomen Edition).

A high-performance, token-free, key-free, interactive command-line interface
for CarX Street. Designed to run seamlessly on PC terminals (Windows, Linux, macOS)
and mobile environments like Android Termux.

Features:
- Complete authentication & session management (Zero re-typing required)
- Comprehensive live profile diagnostics & version 74 account fixer
- High-volume currency (Cash & Gold) & XP (Level 50) injection
- Official Google Play receipt-verified Street Pass & Battle Pass Event Points (EP)
- 100% map exploration (6 regions) & 40 gas station unlock
- Mega Real Estate (all houses & garages)
- 98-car premium vehicle catalog import & Stage 4-9 Max Speed Tuning
- Infinite fuel & nitro capacity configuration
- Full aesthetic unlocks: 15 Animated Neons, 60+ Plates, Tires, Rims, Avatars & Banners
- Live 2-gate Anti-Cheat ban health check & hardware fingerprint rotation
- Local JSON Anti-Ban snapshot backups & 1-click unban account rebuild
- High-concurrency parallel bulk account generation (1-50 accounts with auto-export)
- 1-Click GOD MODE maxing out every aspect of an account instantly
"""

import asyncio
import copy
import datetime
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# Force UTF-8 encoding across Windows CMD, PowerShell, and Termux
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Enable Virtual Terminal Processing on Windows for ANSI colors
if os.name == "nt":
    os.system("")

# Configure file-only logger to preserve terminal output cleanliness
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ryomen_cli.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8")]
)
# Silence verbose third-party loggers
for mod in ("httpx", "httpcore", "asyncio"):
    logging.getLogger(mod).setLevel(logging.WARNING)

# Core imports from project
from core.http_client import init_http_client, close_http_client
from core.security import generate_random_email, generate_random_password
from carx.services import CarXService, load_premium_cars
from carx.constants import PREMIUM_CAR_LABELS, WP_NAMES


# ==============================================================================
# ANSI Terminal Color Palette & Formatting
# ==============================================================================
class C:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    BLUE = "\033[94m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    RESET = "\033[0m"


def clear_screen() -> None:
    """Clears the console screen across Windows and Unix/Termux."""
    os.system("cls" if os.name == "nt" else "clear")


def print_banner() -> None:
    """Renders the Ryomen Edition ASCII header."""
    print(f"{C.RED}{C.BOLD}")
    print(r"  ██████╗ ██╗   ██╗ ██████╗ ███╗   ███╗███████╗███╗   ██╗")
    print(r"  ██╔══██╗╚██╗ ██╔╝██╔═══██╗████╗ ████║██╔════╝████╗  ██║")
    print(r"  ██████╔╝ ╚████╔╝ ██║   ██║██╔████╔██║█████╗  ██╔██╗ ██║")
    print(r"  ██╔══██╗  ╚██╔╝  ██║   ██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║")
    print(r"  ██║  ██║   ██║   ╚██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║")
    print(r"  ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝")
    print(f"{C.RESET}{C.CYAN}{C.BOLD}    🏎️  CARX STREET ACCOUNT ENGINEER CLI  🏎️{C.RESET}")
    print(f"{C.GRAY}    ──────────────────────────────────────────────────────{C.RESET}")
    print(f"    {C.GREEN}✓ No Bot Token Needed{C.RESET}  •  {C.GREEN}✓ 100% Free & Keyless{C.RESET}  •  {C.GREEN}✓ PC & Termux{C.RESET}")
    print(f"{C.GRAY}    ──────────────────────────────────────────────────────{C.RESET}\n")


def print_success(msg: str) -> None:
    print(f" {C.GREEN}{C.BOLD}[✓]{C.RESET} {C.GREEN}{msg}{C.RESET}")


def print_error(msg: str) -> None:
    print(f" {C.RED}{C.BOLD}[✗]{C.RESET} {C.RED}{msg}{C.RESET}")


def print_warning(msg: str) -> None:
    print(f" {C.YELLOW}{C.BOLD}[!]{C.RESET} {C.YELLOW}{msg}{C.RESET}")


def print_info(msg: str) -> None:
    print(f" {C.CYAN}{C.BOLD}[i]{C.RESET} {C.CYAN}{msg}{C.RESET}")


def print_section(title: str) -> None:
    print(f"\n{C.YELLOW}{C.BOLD}━━━ [ {title.upper()} ] ━━━{C.RESET}")


def pause() -> None:
    print()
    try:
        input(f"{C.GRAY}Press {C.WHITE}[ENTER]{C.GRAY} to return to main menu...{C.RESET}")
    except (KeyboardInterrupt, EOFError):
        pass


def ask(prompt: str, default: Optional[str] = None) -> str:
    """Prompts for user input with optional default value."""
    def_txt = f" {C.GRAY}(default: {default}){C.RESET}" if default is not None else ""
    try:
        val = input(f" {C.WHITE}{prompt}{def_txt}: {C.CYAN}").strip()
        print(f"{C.RESET}", end="")
        return val if val else (default or "")
    except (KeyboardInterrupt, EOFError):
        print(f"{C.RESET}")
        return default or ""


# ==============================================================================
# Custom Database Adapter (Plug & Play Architecture)
# ==============================================================================
# NOTE: mainRyomen.py has ZERO active database connections by default.
# It does NOT connect to MongoDB, MySQL, PostgreSQL, or any remote database.
# All operations run directly against official CarX servers using local sessions.
#
# If you want to connect your own database (SQLite, PostgreSQL, Supabase,
# Firebase, MySQL, etc.), implement your logic inside the methods below.
# All methods are non-blocking async hooks and safe no-ops by default.
# ==============================================================================
class CustomDatabaseAdapter:
    """Optional database hook interface for user-defined storage."""

    @classmethod
    async def on_startup(cls) -> None:
        """Called when CLI launches. Initialize your custom database here."""
        pass

    @classmethod
    async def on_shutdown(cls) -> None:
        """Called when CLI exits. Close your custom database connections here."""
        pass

    @classmethod
    async def save_account(cls, email: str, password: str, carx_id: Optional[str] = None) -> None:
        """Hook called when an account is authenticated or registered."""
        pass

    @classmethod
    async def save_snapshot(cls, email: str, snapshot: Dict[str, Any]) -> None:
        """Hook called when an anti-ban snapshot backup is generated."""
        pass

    @classmethod
    async def get_snapshot(cls, email: str) -> Optional[Dict[str, Any]]:
        """Hook called to load a saved snapshot from your database."""
        return None

    @classmethod
    async def save_bulk_accounts(cls, accounts: List[Dict[str, Any]]) -> None:
        """Hook called when bulk accounts are generated."""
        pass


# ==============================================================================
# Active User Session Manager
# ==============================================================================
class Session:
    """Holds active credentials and cached account state in memory."""
    email: Optional[str] = None
    password: Optional[str] = None
    carx_id: Optional[str] = None
    cached_profile: Optional[Dict[str, Any]] = None

    @classmethod
    def is_logged_in(cls) -> bool:
        return bool(cls.email and cls.password)

    @classmethod
    def set(cls, email: str, password: str, carx_id: Optional[str] = None) -> None:
        cls.email = email.strip()
        cls.password = password.strip()
        cls.carx_id = carx_id

    @classmethod
    def clear(cls) -> None:
        cls.email = None
        cls.password = None
        cls.carx_id = None
        cls.cached_profile = None


# ==============================================================================
# Core CLI Application Class
# ==============================================================================
class RyomenCLI:
    """Orchestrates all user operations and menu navigation."""

    def __init__(self) -> None:
        self.service = CarXService()
        self.snapshots_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")
        os.makedirs(self.snapshots_dir, exist_ok=True)

    async def ensure_active_account(self) -> bool:
        """Ensures an account is active. Prompts for credentials if none are loaded."""
        if Session.is_logged_in():
            return True

        print_warning("No active account is currently selected.")
        print(f"{C.WHITE} Please provide account credentials to proceed:{C.RESET}")
        email = ask("Enter CarX Email")
        if not email:
            print_error("Email cannot be empty.")
            return False
        password = ask("Enter CarX Password")
        if not password:
            print_error("Password cannot be empty.")
            return False

        print_info(f"Authenticating account {email}...")
        ok, res = await self.service.verify_profile(email, password)
        if ok:
            Session.set(email, password, carx_id=str(res.get("carx_id", "Unknown")))
            Session.cached_profile = res
            await CustomDatabaseAdapter.save_account(email, password, Session.carx_id)
            print_success(f"Authenticated successfully! CarX ID: {Session.carx_id}")
            return True
        else:
            print_error(f"Authentication failed: {res}")
            choice = ask("Save these credentials anyway? (y/N)", "n").lower()
            if choice == "y":
                Session.set(email, password)
                await CustomDatabaseAdapter.save_account(email, password)
                return True
            return False

    # --------------------------------------------------------------------------
    # 1. Login / Set Active Account
    # --------------------------------------------------------------------------
    async def handle_login(self) -> None:
        print_section("Account Authentication")
        email = ask("Enter CarX Email", Session.email or "")
        if not email:
            print_error("Email is required.")
            return
        password = ask("Enter CarX Password", Session.password or "")
        if not password:
            print_error("Password is required.")
            return

        print_info(f"Authenticating {email} on CarX servers...")
        ok, res = await self.service.verify_profile(email, password)
        if ok:
            Session.set(email, password, carx_id=str(res.get("carx_id", "Unknown")))
            Session.cached_profile = res
            await CustomDatabaseAdapter.save_account(email, password, Session.carx_id)
            print_success(f"Account active! CarX ID: {Session.carx_id}")
            print(f" {C.WHITE}• Cash:{C.RESET} ${res.get('money', 0):,}")
            print(f" {C.WHITE}• Gold:{C.RESET} {res.get('gold', 0):,} 🪙")
            print(f" {C.WHITE}• Level:{C.RESET} {res.get('level', 1)} ({res.get('xp', 0):,} XP)")
            print(f" {C.WHITE}• Owned Cars:{C.RESET} {res.get('total_cars', 0)}")
        else:
            print_error(f"Failed to verify: {res}")
            if ask("Keep credentials in session anyway? (y/N)", "n").lower() == "y":
                Session.set(email, password)
                await CustomDatabaseAdapter.save_account(email, password)
                print_info("Credentials saved for active session.")

    # --------------------------------------------------------------------------
    # 2. Verify Profile & Status
    # --------------------------------------------------------------------------
    async def handle_verify(self) -> None:
        print_section("Profile Diagnostics & Verification")
        if not await self.ensure_active_account():
            return

        print_info(f"Fetching live profile telemetry for {Session.email}...")
        ok, res = await self.service.verify_profile(Session.email, Session.password)
        if not ok:
            print_error(f"Verification failed: {res}")
            return

        Session.cached_profile = res
        carx_id = res.get("carx_id", "Unknown")
        Session.carx_id = str(carx_id)

        premium_status = "ACTIVE (VIP)" if res.get("premium") else "Inactive"
        lvl = res.get("level", 1)
        xp_val = res.get("xp", 0)
        level_str = f"Level {lvl} ({xp_val:,} XP)"
        money_str = f"${res.get('money', 0):,}"
        gold_str = f"{res.get('gold', 0):,} 🪙"
        ep_str = f"{res.get('ep', 0):,} EP"
        clubs_str = f"{res.get('clubs_count', 0)} / 20 Clubs Finished"
        cars_str = f"{res.get('total_cars', 0)} Vehicles"
        dver_str = str(res.get("data_version", 74))

        print(f"\n {C.CYAN}{C.BOLD}┌────────────────────────────────────────────────────────┐{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}│                CARX ACCOUNT STATUS CARD                │{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}├────────────────────────────────────────────────────────┤{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Account Email:{C.RESET}   {Session.email:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}CarX ID:{C.RESET}         {str(carx_id):<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Data Version:{C.RESET}    {dver_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Premium Pass:{C.RESET}    {premium_status:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Player Level:{C.RESET}    {level_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Money (Cash):{C.RESET}    {money_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Gold Coins:{C.RESET}      {gold_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Event Points:{C.RESET}    {ep_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Clubs Done:{C.RESET}      {clubs_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Owned Cars:{C.RESET}      {cars_str:<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}└────────────────────────────────────────────────────────┘{C.RESET}")

        preview = res.get("cars_preview", [])
        if preview:
            car_names = [PREMIUM_CAR_LABELS.get(c, c) for c in preview]
            print(f" {C.GRAY}Top garage cars:{C.RESET} {', '.join(car_names)}")

    # --------------------------------------------------------------------------
    # 3. Fix Account
    # --------------------------------------------------------------------------
    async def handle_fix(self) -> None:
        print_section("Fix Account (Version 74 & Integrity)")
        if not await self.ensure_active_account():
            return

        print_info(f"Executing deep profile integrity repair for {Session.email}...")
        ok, msg = await self.service.fix_account(Session.email, Session.password)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 4. Register Fresh Account
    # --------------------------------------------------------------------------
    async def handle_register(self) -> None:
        print_section("Register Fresh Account (Tutorial Skipped)")
        email_opt = ask("Enter Email (or press Enter for random email)")
        email = email_opt if email_opt else generate_random_email()

        pwd_opt = ask("Enter Password (or press Enter for secure random password)")
        password = pwd_opt if pwd_opt else generate_random_password()

        nickname = ask("Enter Nickname", "RyomenX")

        print_info(f"Creating fresh CarX ID account: {email}...")
        ok, msg = await self.service.create_fresh_account(email, password, nickname)
        if ok:
            await CustomDatabaseAdapter.save_account(email, password)
            print_success(msg)
            print(f" {C.GREEN}{C.BOLD}Account Credentials:{C.RESET}")
            print(f" {C.WHITE}Email:{C.RESET}    {email}")
            print(f" {C.WHITE}Password:{C.RESET} {password}")
            if ask("Set this new account as your active session? (Y/n)", "y").lower() == "y":
                Session.set(email, password)
                print_info("New account set as active session!")
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 5. Switch / Logout
    # --------------------------------------------------------------------------
    def handle_logout(self) -> None:
        print_section("Account Session")
        if Session.is_logged_in():
            print_info(f"Logging out account: {Session.email}")
            Session.clear()
            print_success("Session cleared cleanly.")
        else:
            print_warning("No active session to log out.")

    # --------------------------------------------------------------------------
    # 6. Delete Account
    # --------------------------------------------------------------------------
    async def handle_delete_account(self) -> None:
        print_section("Permanent Account Deletion")
        if not await self.ensure_active_account():
            return

        print_warning(f"DANGER: You are about to permanently DELETE account {Session.email}!")
        print_warning("This purges your profile and CarX ID from official servers completely.")
        conf = ask("Type 'DELETE' to confirm irreversible purge")
        if conf != "DELETE":
            print_info("Account deletion cancelled.")
            return

        print_info(f"Submitting permanent purge request for {Session.email}...")
        ok, msg = await self.service.delete_carx_account(Session.email, Session.password)
        if ok:
            print_success(f"Account {Session.email} successfully purged from CarX servers.")
            Session.clear()
        else:
            print_error(f"Deletion failed: {msg}")

    # --------------------------------------------------------------------------
    # 7. Currency Injection (Money & Gold)
    # --------------------------------------------------------------------------
    async def handle_currency(self) -> None:
        print_section("Inject Money (Cash) & Gold")
        if not await self.ensure_active_account():
            return

        print(f" {C.WHITE}[1]{C.RESET} Starter Pack:     $5,000,000 Cash  +  500,000 Gold")
        print(f" {C.WHITE}[2]{C.RESET} Pro Pack:        $10,000,000 Cash  +  1,000,000 Gold")
        print(f" {C.WHITE}[3]{C.RESET} Tycoon Pack:     $50,000,000 Cash  +  5,000,000 Gold")
        print(f" {C.WHITE}[4]{C.RESET} Extreme Pack:   $100,000,000 Cash  + 10,000,000 Gold")
        print(f" {C.WHITE}[5]{C.RESET} Max Safe:       $500,000,000 Cash  + 50,000,000 Gold")
        print(f" {C.WHITE}[6]{C.RESET} Custom Amounts")

        choice = ask("Select option (1-6)", "3")
        soft, hard = 50_000_000, 5_000_000
        if choice == "1":
            soft, hard = 5_000_000, 500_000
        elif choice == "2":
            soft, hard = 10_000_000, 1_000_000
        elif choice == "3":
            soft, hard = 50_000_000, 5_000_000
        elif choice == "4":
            soft, hard = 100_000_000, 10_000_000
        elif choice == "5":
            soft, hard = 500_000_000, 50_000_000
        elif choice == "6":
            raw_s = ask("Enter Cash amount", "50000000")
            raw_h = ask("Enter Gold amount", "5000000")
            try:
                soft = int(raw_s.replace(",", "").replace("_", ""))
                hard = int(raw_h.replace(",", "").replace("_", ""))
            except ValueError:
                print_error("Invalid number entered.")
                return

        print_info(f"Injecting ${soft:,} Cash and {hard:,} Gold into {Session.email}...")
        ok, msg = await self.service.inject_currency(Session.email, Session.password, soft=soft, hard=hard)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 8. Level 50 XP Boost
    # --------------------------------------------------------------------------
    async def handle_xp(self) -> None:
        print_section("Experience & Level Boost")
        if not await self.ensure_active_account():
            return

        print(f" {C.WHITE}[1]{C.RESET} Instant Max Level 50 (93,000 XP) [Recommended]")
        print(f" {C.WHITE}[2]{C.RESET} Level 25 (46,500 XP)")
        print(f" {C.WHITE}[3]{C.RESET} Custom XP Amount")

        choice = ask("Select option (1-3)", "1")
        if choice == "1":
            xp = 93_000
        elif choice == "2":
            xp = 46_500
        elif choice == "3":
            try:
                xp = int(ask("Enter exact XP amount", "93000").replace(",", ""))
            except ValueError:
                print_error("Invalid XP number.")
                return
        else:
            xp = 93_000

        print_info(f"Setting XP to {xp:,} for {Session.email}...")
        ok, msg = await self.service.inject_xp(Session.email, Session.password, xp=xp)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 9. Street Pass Unlock
    # --------------------------------------------------------------------------
    async def handle_streetpass(self) -> None:
        print_section("Unlock Street Pass (Google Play Receipt)")
        if not await self.ensure_active_account():
            return

        print_info(f"Submitting Google Play IAP verification receipt to CarX Store...")
        ok, msg = await self.service.activate_streetpass(Session.email, Session.password)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 10. Inject Event Points (EP)
    # --------------------------------------------------------------------------
    async def handle_ep(self) -> None:
        print_section("Inject Event Points (EP) for Battle Pass")
        if not await self.ensure_active_account():
            return

        print(f" {C.WHITE}[1]{C.RESET}  4,000 EP (8 Packs of 500 EP)")
        print(f" {C.WHITE}[2]{C.RESET} 10,000 EP (20 Packs of 500 EP) [Recommended]")
        print(f" {C.WHITE}[3]{C.RESET} 20,000 EP (40 Packs of 500 EP)")
        print(f" {C.WHITE}[4]{C.RESET} Custom EP Amount")

        choice = ask("Select option (1-4)", "2")
        if choice == "1":
            amount = 4_000
        elif choice == "2":
            amount = 10_000
        elif choice == "3":
            amount = 20_000
        elif choice == "4":
            try:
                amount = int(ask("Enter total EP amount", "10000").replace(",", ""))
            except ValueError:
                print_error("Invalid EP amount.")
                return
        else:
            amount = 10_000

        async def _ep_progress(current: int, total: int) -> None:
            pct = int((current / max(1, total)) * 100)
            bar = ("█" * (pct // 5)).ljust(20, "░")
            print(f"\r {C.CYAN}[EP Burst]{C.RESET} [{C.GREEN}{bar}{C.RESET}] {current:,}/{total:,} EP ({pct}%)", end="", flush=True)

        print_info(f"Starting burst receipt injection of {amount:,} EP into {Session.email}...")
        ok, msg, count = await self.service.unlock_ep(
            email=Session.email,
            password=Session.password,
            amount=amount,
            progress_callback=_ep_progress
        )
        print()  # newline after progress bar
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 11. Activate Premium Pass
    # --------------------------------------------------------------------------
    async def handle_premium_pass(self) -> None:
        print_section("Activate CarX Premium Pass")
        if not await self.ensure_active_account():
            return

        print_info(f"Activating Premium VIP Pass flags in profile...")
        ok, msg = await self.service.activate_premium(Session.email, Session.password)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 12. Unlock All Maps & Gas Stations
    # --------------------------------------------------------------------------
    async def handle_maps(self) -> None:
        print_section("Unlock All Maps & 40 Gas Stations")
        if not await self.ensure_active_account():
            return

        print_info(f"Unlocking all 6 world regions and 40 gas stations for {Session.email}...")
        ok, msg = await self.service.unlock_maps(Session.email, Session.password)
        if ok:
            print_success(msg)
            print(f" {C.GRAY}Regions unlocked:{C.RESET} Industrial, Midtown, Mountain, Port, Suburb, Sunset.")
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 13. Mega Real Estate
    # --------------------------------------------------------------------------
    async def handle_real_estate(self) -> None:
        print_section("Mega Real Estate (All Houses & Garages)")
        if not await self.ensure_active_account():
            return

        print_info(f"Acquiring all houses, apartments, and garage properties...")
        ok, msg = await self.service.unlock_mega_owner(Session.email, Session.password)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 14. Premium Cars Catalog & Import
    # --------------------------------------------------------------------------
    async def handle_cars(self) -> None:
        print_section("Premium Cars Catalog & Garage Import")
        if not await self.ensure_active_account():
            return

        catalog = load_premium_cars()
        if not catalog:
            print_error("Premium cars catalog (premium_cars.json) not found or empty.")
            return

        order = list(catalog.keys())
        print(f" Catalog currently contains {C.GREEN}{len(order)} premium vehicles{C.RESET}.")
        print(f" {C.WHITE}[1]{C.RESET} View Full 98-Car Catalog (Paginated)")
        print(f" {C.WHITE}[2]{C.RESET} Import Specific Car(s) by ID or Index")
        print(f" {C.WHITE}[3]{C.RESET} Import ALL 98 Premium Cars (Instant Full Garage)")

        choice = ask("Select option (1-3)", "2")
        if choice == "1":
            page_size = 20
            for start in range(0, len(order), page_size):
                print(f"\n{C.CYAN}--- Cars {start + 1} to {min(start + page_size, len(order))} of {len(order)} ---{C.RESET}")
                for idx in range(start, min(start + page_size, len(order))):
                    cid = order[idx]
                    label = PREMIUM_CAR_LABELS.get(cid, cid)
                    print(f" {C.WHITE}[{idx + 1:02d}]{C.RESET} {cid:<22} -> {C.YELLOW}{label}{C.RESET}")
                if start + page_size < len(order):
                    if ask("Show next page? (Y/n)", "y").lower() != "y":
                        break

            sub_c = ask("Would you like to import any cars now? (Enter indices/names or press Enter to skip)")
            if not sub_c:
                return
            selection = sub_c
        elif choice == "3":
            selection = "ALL"
        else:
            print(f"\n {C.GRAY}Examples: '1, 5, 12' or 'nissanskyline, toyotasupra2020' or 'ALL'{C.RESET}")
            selection = ask("Enter car numbers or identifiers", "nissanskyline")

        print_info(f"Injecting selected vehicle(s) into {Session.email}...")
        ok, msg = await self.service.add_premium_cars(Session.email, Session.password, selection, force=True)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 15. Max Speed Tuning
    # --------------------------------------------------------------------------
    async def handle_speed_tune(self) -> None:
        print_section("Max Speed Tune (Stage 4-9 Parts)")
        if not await self.ensure_active_account():
            return

        print_info("Scanning player garage for tunable vehicles...")
        ok, cars = await self.service.list_tunable_cars(Session.email, Session.password)
        if not ok or not cars:
            print_error(f"Could not retrieve cars: {cars}")
            return

        print(f"\n {C.CYAN}Owned Vehicles Available for Tuning:{C.RESET}")
        print(f" {C.WHITE}[0]{C.RESET} {C.GREEN}{C.BOLD}ALL CARS IN GARAGE (Batch Upgrade){C.RESET}")
        for idx, cid, label in cars:
            print(f" {C.WHITE}[{idx}]{C.RESET} {label} {C.GRAY}(ID: {cid}){C.RESET}")

        target_str = ask("Select car number to tune (0 for ALL)", "0")
        try:
            target_idx = int(target_str)
            arg = None if target_idx == 0 else target_idx
        except ValueError:
            print_error("Invalid selection.")
            return

        print_info(f"Applying Stage 4-9 performance parts & AWD conversions...")
        ok, msg = await self.service.speed_tune(Session.email, Session.password, target_idx=arg)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 16. Infinite Fuel & Nitro
    # --------------------------------------------------------------------------
    async def handle_fuel_nitro(self) -> None:
        print_section("Infinite Fuel & Nitro Capacity")
        if not await self.ensure_active_account():
            return

        print(f" {C.WHITE}[1]{C.RESET} Max Infinite: 999,999 Capacity Fuel & Nitro [Recommended]")
        print(f" {C.WHITE}[2]{C.RESET} Custom Values")

        choice = ask("Select option (1-2)", "1")
        if choice == "1":
            cap = 999_999
            fuel, nitro = cap, cap
        else:
            try:
                fuel = int(ask("Enter Fuel capacity", "999999").replace(",", ""))
                nitro = int(ask("Enter Nitro capacity", "999999").replace(",", ""))
            except ValueError:
                print_error("Invalid numbers.")
                return

        print_info(f"Setting Fuel ({fuel:,}) and Nitro ({nitro:,}) across all owned cars...")
        ok, msg = await self.service.customize_fuel_nitro(Session.email, Session.password, nitro=nitro, fuel=fuel)
        if ok:
            print_success(msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 17-22. Visuals & Aesthetics
    # --------------------------------------------------------------------------
    async def handle_neons(self) -> None:
        print_section("Unlock 15 Animated Neons")
        if not await self.ensure_active_account():
            return
        print_info(f"Injecting 15 animated underglow sets onto all vehicles...")
        ok, msg = await self.service.unlock_neon(Session.email, Session.password)
        (print_success if ok else print_error)(msg)

    async def handle_plates(self) -> None:
        print_section("Unlock 60+ Custom Number Plates")
        if not await self.ensure_active_account():
            return
        print_info(f"Injecting 60+ custom number plates across all vehicles...")
        ok, msg = await self.service.unlock_numberplate(Session.email, Session.password)
        (print_success if ok else print_error)(msg)

    async def handle_tires(self) -> None:
        print_section("Unlock 14 Tire Side-Wall Styles")
        if not await self.ensure_active_account():
            return
        print_info(f"Injecting tire side-walls (Drifthunters, Shinobi, etc.)...")
        ok, msg = await self.service.unlock_tire(Session.email, Session.password)
        (print_success if ok else print_error)(msg)

    async def handle_rims(self) -> None:
        print_section("Unlock 100+ Wheel Rims")
        if not await self.ensure_active_account():
            return
        print_info(f"Injecting 100+ aftermarket wheel rim styles...")
        ok, msg = await self.service.unlock_wheel_rims(Session.email, Session.password)
        (print_success if ok else print_error)(msg)

    async def handle_profile_style(self) -> None:
        print_section("Unlock Profile Aesthetics (Avatars & Banners)")
        if not await self.ensure_active_account():
            return
        print(f" Slots range from 1 to 18 for Avatars, Banners, and Frames.")
        av = int(ask("Avatar Number (1-18)", "16") or "16")
        ba = int(ask("Banner Number (1-18)", "16") or "16")
        fr = int(ask("Frame Number (1-18)", "16") or "16")
        em = int(ask("Emoji Number (1-4)", "4") or "4")

        print_info("Unlocking profile cosmetics and applying setup...")
        ok, msg = await self.service.unlock_profile_style(
            Session.email, Session.password, avatar=av, banner=ba, frame=fr, emoji=em
        )
        (print_success if ok else print_error)(msg)

    async def handle_all_visuals(self) -> None:
        print_section("Unlock ALL Visuals & Aesthetics Combo")
        if not await self.ensure_active_account():
            return

        print_info("Running complete visual styling sequence...")
        # 1. Neons
        print_info("• Unlocking 15 Animated Neons...")
        ok1, m1 = await self.service.unlock_neon(Session.email, Session.password)
        # 2. Plates
        print_info("• Unlocking 60+ Number Plates...")
        ok2, m2 = await self.service.unlock_numberplate(Session.email, Session.password)
        # 3. Tires
        print_info("• Unlocking 14 Tire Lettering Styles...")
        ok3, m3 = await self.service.unlock_tire(Session.email, Session.password)
        # 4. Rims
        print_info("• Unlocking 100+ Wheel Rims...")
        ok4, m4 = await self.service.unlock_wheel_rims(Session.email, Session.password)
        # 5. Styles
        print_info("• Unlocking Profile Avatars, Banners & Frames...")
        ok5, m5 = await self.service.unlock_profile_style(Session.email, Session.password)

        if all([ok1, ok2, ok3, ok4, ok5]):
            print_success("All Neons, Plates, Tires, Rims, and Profile Styles unlocked successfully!")
        else:
            print_warning("Visuals combo completed with some notices. Check profile in-game.")

    # --------------------------------------------------------------------------
    # 23. Live Anti-Ban Health Check
    # --------------------------------------------------------------------------
    async def handle_antiban_check(self) -> None:
        print_section("Live Anti-Ban Security Health Check")
        if not await self.ensure_active_account():
            return

        print_info(f"Querying CarX verification security gates for {Session.email}...")
        status, msg, details = await self.service.antiban_check(Session.email, Session.password)

        print(f"\n {C.CYAN}{C.BOLD}┌────────────────────────────────────────────────────────┐{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}│              CARX ANTI-CHEAT GATE TELEMETRY            │{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}├────────────────────────────────────────────────────────┤{C.RESET}")
        st_color = C.GREEN if status == "alive" else (C.RED if status == "banned" else C.YELLOW)
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Overall Status:{C.RESET}   {st_color}{status.upper():<38}{C.RESET} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}CarX UID:{C.RESET}         {str(details.get('carx_id', 'Unknown')):<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Anti-Cheat Gate:{C.RESET}  {str(details.get('anti_cheat_gate', 'Unknown')):<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Profile Gate:{C.RESET}     {str(details.get('profile_gate', 'Unknown')):<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}│{C.RESET} {C.WHITE}Status Code:{C.RESET}      {str(details.get('error_code') or 'None'):<38} {C.CYAN}│{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}└────────────────────────────────────────────────────────┘{C.RESET}")

        if status == "alive":
            print_success("Account is 100% CLEAN and passing all security gates!")
        elif status == "banned":
            print_error(f"ACCOUNT IS BANNED: {msg}")
            print_warning("Use option [25] One-Click Anti-Ban Rebuild to unban this account!")
        else:
            print_warning(f"Notice: {msg}")

    # --------------------------------------------------------------------------
    # 24. Save Anti-Ban Snapshot
    # --------------------------------------------------------------------------
    async def handle_save_snapshot(self) -> None:
        print_section("Save Anti-Ban Snapshot (Local Backup)")
        if not await self.ensure_active_account():
            return

        print_info(f"Extracting full profile snapshot for {Session.email}...")
        ok, snapshot = await self.service.antiban_snapshot(Session.email, Session.password)
        if not ok:
            print_error(f"Snapshot extraction failed: {snapshot}")
            return

        clean_name = Session.email.replace("@", "_at_").replace(".", "_")
        file_path = os.path.join(self.snapshots_dir, f"snapshot_{clean_name}.json")

        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=2)
            await CustomDatabaseAdapter.save_snapshot(Session.email, snapshot)
            print_success(f"Snapshot successfully saved to local disk!")
            print(f" {C.WHITE}• Backup Location:{C.RESET} {file_path}")
            print(f" {C.WHITE}• Cash Backed Up:{C.RESET}  ${snapshot.get('soft', 0):,}")
            print(f" {C.WHITE}• Gold Backed Up:{C.RESET}  {snapshot.get('hard', 0):,} 🪙")
            print(f" {C.WHITE}• Level / XP:{C.RESET}      {snapshot.get('xp', 0):,} XP")
            print(f" {C.WHITE}• Event Points:{C.RESET}    {snapshot.get('ep', 0):,} EP")
            print(f" {C.WHITE}• Owned Cars:{C.RESET}      {len(snapshot.get('cars', []))} Vehicles")
            print(f" {C.WHITE}• Clubs Done:{C.RESET}      {snapshot.get('clubs_count', 0)} / 20 Completed")
        except Exception as e:
            print_error(f"Failed to write snapshot file: {e}")

    # --------------------------------------------------------------------------
    # 25. One-Click Anti-Ban Rebuild / Unban
    # --------------------------------------------------------------------------
    async def handle_antiban_rebuild(self) -> None:
        print_section("One-Click Anti-Ban Rebuild & Unban")
        if not await self.ensure_active_account():
            return

        clean_name = Session.email.replace("@", "_at_").replace(".", "_")
        file_path = os.path.join(self.snapshots_dir, f"snapshot_{clean_name}.json")

        snapshot_data = {}
        if os.path.exists(file_path):
            print_info(f"Found local backup snapshot for {Session.email}!")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    snapshot_data = json.load(f)
                ts = snapshot_data.get("timestamp", 0)
                dt_str = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S") if ts else "Unknown"
                print(f" {C.GRAY}Snapshot date: {dt_str} | Cars: {len(snapshot_data.get('cars', []))}{C.RESET}")
            except Exception:
                pass

        if not snapshot_data:
            custom_db_snap = await CustomDatabaseAdapter.get_snapshot(Session.email)
            if custom_db_snap:
                snapshot_data = custom_db_snap
                print_info("Loaded snapshot from custom database adapter!")

        if not snapshot_data:
            print_warning("No local snapshot backup found for this email.")
            print(f"{C.WHITE} A fresh Maxed-Out Level 50 base snapshot ($50M Cash, 1M Gold, All Clubs, All Maps) will be generated.{C.RESET}")

        print_warning(f"Rebuild will purge the banned ID for {Session.email}, rotate device fingerprint, and resurrect it.")
        if ask("Proceed with unban rebuild? (Y/n)", "y").lower() != "y":
            print_info("Unban rebuild cancelled.")
            return

        print_info("Executing full unban restoration sequence...")
        ok, msg = await self.service.antiban_rebuild(
            email=Session.email,
            password=Session.password,
            snapshot=snapshot_data,
            nickname="RyomenX"
        )
        if ok:
            # Strip HTML tags from message for terminal clarity
            clean_msg = msg.replace("<b>", "").replace("</b>", "")
            clean_msg = clean_msg.replace("<code>", f"{C.CYAN}").replace("</code>", f"{C.RESET}")
            print_success(clean_msg)
        else:
            print_error(msg)

    # --------------------------------------------------------------------------
    # 26. ⚡ GOD MODE (1-Click Max Out Everything)
    # --------------------------------------------------------------------------
    async def handle_god_mode(self) -> None:
        print_section("⚡ GOD MODE: 1-Click Max Out Everything ⚡")
        if not await self.ensure_active_account():
            return

        print(f" {C.YELLOW}{C.BOLD}You are about to apply the ULTIMATE GOD MODE package to:{C.RESET}")
        print(f" {C.CYAN}{C.BOLD}{Session.email}{C.RESET}\n")
        print(f" {C.WHITE}This package applies in sequential order:{C.RESET}")
        print(f"  {C.GREEN}✓{C.RESET} Fix Account (v74 data version & quests)")
        print(f"  {C.GREEN}✓{C.RESET} $50,000,000 Cash + 5,000,000 Gold")
        print(f"  {C.GREEN}✓{C.RESET} Instant Level 50 (93,000 XP)")
        print(f"  {C.GREEN}✓{C.RESET} Unlock Street Pass (Google Play Receipt Verified)")
        print(f"  {C.GREEN}✓{C.RESET} 10,000 Event Points (EP) for Battle Pass")
        print(f"  {C.GREEN}✓{C.RESET} Activate CarX Premium Pass")
        print(f"  {C.GREEN}✓{C.RESET} Unlock All 6 Maps & 40 Gas Stations")
        print(f"  {C.GREEN}✓{C.RESET} Mega Real Estate (All Houses & Garages)")
        print(f"  {C.GREEN}✓{C.RESET} Unlock 15 Animated Neons")
        print(f"  {C.GREEN}✓{C.RESET} Unlock 60+ Custom Number Plates")
        print(f"  {C.GREEN}✓{C.RESET} Unlock 14 Tire Side-Wall Lettering Styles")
        print(f"  {C.GREEN}✓{C.RESET} Unlock 100+ Wheel Rims")
        print(f"  {C.GREEN}✓{C.RESET} Unlock Profile Cosmetics (Avatar, Banner, Frame, Emoji)")
        print(f"  {C.GREEN}✓{C.RESET} Max Speed Tune on all cars in garage")
        print(f"  {C.GREEN}✓{C.RESET} Infinite 999,999 Fuel & Nitro on all cars")

        if ask("\nExecute GOD MODE on this account? (Y/n)", "y").lower() != "y":
            print_info("GOD MODE execution aborted.")
            return

        print_info("Igniting GOD MODE sequence...")
        start_time = time.time()

        # Step 1: Fix
        print_info("[1/14] Fixing account version & base integrity...")
        await self.service.fix_account(Session.email, Session.password)

        # Step 2: Currency
        print_info("[2/14] Injecting $50M Cash and 5M Gold...")
        await self.service.inject_currency(Session.email, Session.password, soft=50_000_000, hard=5_000_000)

        # Step 3: XP
        print_info("[3/14] Boosting experience to Level 50 (93,000 XP)...")
        await self.service.inject_xp(Session.email, Session.password, xp=93_000)

        # Step 4: StreetPass
        print_info("[4/14] Verifying StreetPass Google Play receipt...")
        await self.service.activate_streetpass(Session.email, Session.password)

        # Step 5: EP
        print_info("[5/14] Injecting 10,000 Event Points (EP)...")
        await self.service.unlock_ep(Session.email, Session.password, amount=10_000)

        # Step 6: Premium
        print_info("[6/14] Activating Premium VIP Pass...")
        await self.service.activate_premium(Session.email, Session.password)

        # Step 7: Maps
        print_info("[7/14] Unlocking all 6 Maps and 40 Gas Stations...")
        await self.service.unlock_maps(Session.email, Session.password)

        # Step 8: Real Estate
        print_info("[8/14] Unlocking all Houses and Garages...")
        await self.service.unlock_mega_owner(Session.email, Session.password)

        # Step 9: Neons
        print_info("[9/14] Injecting 15 Animated Neons...")
        await self.service.unlock_neon(Session.email, Session.password)

        # Step 10: Plates
        print_info("[10/14] Injecting 60+ Number Plates...")
        await self.service.unlock_numberplate(Session.email, Session.password)

        # Step 11: Tires & Rims
        print_info("[11/14] Injecting Tires and 100+ Wheel Rims...")
        await self.service.unlock_tire(Session.email, Session.password)
        await self.service.unlock_wheel_rims(Session.email, Session.password)

        # Step 12: Profile Style
        print_info("[12/14] Unlocking Profile Style aesthetics...")
        await self.service.unlock_profile_style(Session.email, Session.password)

        # Step 13: Speed Tune
        print_info("[13/14] Max Speed Tuning all garage cars...")
        await self.service.speed_tune(Session.email, Session.password, target_idx=None)

        # Step 14: Fuel & Nitro
        print_info("[14/14] Setting 999,999 Fuel and Nitro capacity...")
        await self.service.customize_fuel_nitro(Session.email, Session.password, nitro=999_999, fuel=999_999)

        elapsed = round(time.time() - start_time, 1)
        print_success(f"🔥 GOD MODE COMPLETED IN {elapsed} SECONDS! 🔥")
        print_info("Account is now fully maxed out! Running live diagnostic check...")
        await self.handle_verify()

    # --------------------------------------------------------------------------
    # 27. Bulk Account Generator
    # --------------------------------------------------------------------------
    async def handle_bulk_create(self) -> None:
        print_section("Parallel Bulk Account Generator")
        count_str = ask("How many accounts to create (1-50)?", "5")
        try:
            count = max(1, min(50, int(count_str)))
        except ValueError:
            count = 5

        base_email = ask("Base email prefix or 'random'", "random")
        password = ask("Account password or 'random'", "random")

        print(f"\n {C.WHITE}Select Currency Package:{C.RESET}")
        print(f" {C.WHITE}[1]{C.RESET} $10,000,000 Cash + 1,000,000 Gold + 4,000 EP [Standard]")
        print(f" {C.WHITE}[2]{C.RESET} $50,000,000 Cash + 5,000,000 Gold + 10,000 EP [Maxed]")
        cur_opt = ask("Select package (1-2)", "1")
        if cur_opt == "2":
            soft, hard, ep = 50_000_000, 5_000_000, 10_000
        else:
            soft, hard, ep = 10_000_000, 1_000_000, 4_000

        print_info(f"Generating {count} accounts in parallel with selected features...")
        ok, res = await self.service.bulk_create_accounts(
            base_email=base_email,
            password=password,
            count=count,
            soft=soft,
            hard=hard,
            ep=ep,
            features="all"
        )

        if not ok:
            print_error("Bulk account generation failed.")
            return

        success_count = res.get("success", 0)
        total_count = res.get("total", count)
        accounts = res.get("accounts", [])

        # Save to local text file
        ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        export_file = os.path.join(os.getcwd(), f"bulk_accounts_{ts_str}.txt")

        try:
            with open(export_file, "w", encoding="utf-8") as f:
                f.write(f"=== CARX STREET GENERATED ACCOUNTS ({ts_str}) ===\n")
                f.write(f"Total: {total_count} | Successful: {success_count}\n\n")
                for acc in accounts:
                    status_flag = "SUCCESS" if acc.get("success") else "FAILED"
                    f.write(f"[{status_flag}] Email: {acc.get('email')} | Password: {acc.get('password')} | Note: {acc.get('note')}\n")
            print_success(f"Generated {success_count}/{total_count} accounts successfully!")
            print_success(f"Exported credentials to file: {export_file}")
            await CustomDatabaseAdapter.save_bulk_accounts(accounts)
        except Exception as e:
            print_warning(f"Could not save to file: {e}")

        print(f"\n {C.CYAN}Summary of Generated Accounts:{C.RESET}")
        for acc in accounts:
            icon = f"{C.GREEN}✓{C.RESET}" if acc.get("success") else f"{C.RED}✗{C.RESET}"
            print(f" {icon} {acc.get('email')} | Pass: {acc.get('password')} ({acc.get('note')})")

    # --------------------------------------------------------------------------
    # Main Interactive Menu Loop
    # --------------------------------------------------------------------------
    async def run(self) -> None:
        """Runs the interactive terminal menu loop."""
        clear_screen()
        await init_http_client()
        await CustomDatabaseAdapter.on_startup()

        try:
            while True:
                clear_screen()
                print_banner()

                # Active Session Header
                if Session.is_logged_in():
                    carx_txt = f" (CarX ID: {Session.carx_id})" if Session.carx_id else ""
                    print(f" {C.GREEN}{C.BOLD}● ACTIVE ACCOUNT:{C.RESET} {C.WHITE}{Session.email}{carx_txt}{C.RESET}")
                else:
                    print(f" {C.YELLOW}{C.BOLD}○ ACTIVE ACCOUNT:{C.RESET} {C.GRAY}None (Enter credentials or choose an option below){C.RESET}")

                print(f"{C.GRAY}──────────────────────────────────────────────────────────────────{C.RESET}")
                print(f" {C.CYAN}{C.BOLD}[ 🔐 ACCOUNT & DIAGNOSTICS ]{C.RESET}")
                print(f"  {C.WHITE}[01]{C.RESET} Login / Set Active Account       {C.WHITE}[04]{C.RESET} Register Fresh Account")
                print(f"  {C.WHITE}[02]{C.RESET} Verify Profile & Status Card     {C.WHITE}[05]{C.RESET} Switch / Logout Current Account")
                print(f"  {C.WHITE}[03]{C.RESET} Fix Account (Version 74 & Maps)  {C.WHITE}[06]{C.RESET} Delete CarX ID Account (Permanent)")

                print(f"\n {C.CYAN}{C.BOLD}[ 💰 CURRENCY & PASSES ]{C.RESET}")
                print(f"  {C.WHITE}[07]{C.RESET} Inject Money & Gold Coins        {C.WHITE}[10]{C.RESET} Inject Event Points / EP")
                print(f"  {C.WHITE}[08]{C.RESET} Boost Max Level 50 (XP)          {C.WHITE}[11]{C.RESET} Activate Premium VIP Pass")
                print(f"  {C.WHITE}[09]{C.RESET} Unlock Street Pass (IAP Receipt)")

                print(f"\n {C.CYAN}{C.BOLD}[ 🗺️ WORLD & GARAGE ]{C.RESET}")
                print(f"  {C.WHITE}[12]{C.RESET} Unlock All 6 Maps & 40 Stations  {C.WHITE}[15]{C.RESET} Max Speed Tune (Stage 4-9)")
                print(f"  {C.WHITE}[13]{C.RESET} Mega Real Estate (All Houses)    {C.WHITE}[16]{C.RESET} Infinite Fuel & Nitro (999,999)")
                print(f"  {C.WHITE}[14]{C.RESET} Import Premium Cars (98 Models)")

                print(f"\n {C.CYAN}{C.BOLD}[ 🎨 VISUALS & COSMETICS ]{C.RESET}")
                print(f"  {C.WHITE}[17]{C.RESET} Unlock 15 Animated Neons         {C.WHITE}[20]{C.RESET} Unlock 100+ Wheel Rims")
                print(f"  {C.WHITE}[18]{C.RESET} Unlock 60+ Number Plates         {C.WHITE}[21]{C.RESET} Unlock Profile Style (Avatars)")
                print(f"  {C.WHITE}[19]{C.RESET} Unlock 14 Tire Lettering Styles  {C.WHITE}[22]{C.RESET} {C.MAGENTA}Unlock ALL Visuals Combo Pack{C.RESET}")

                print(f"\n {C.CYAN}{C.BOLD}[ 🛡️ ANTI-BAN & RECOVERY ]{C.RESET}")
                print(f"  {C.WHITE}[23]{C.RESET} Live Anti-Ban Gate Health Check  {C.WHITE}[25]{C.RESET} {C.GREEN}One-Click Anti-Ban Rebuild{C.RESET}")
                print(f"  {C.WHITE}[24]{C.RESET} Save Anti-Ban Snapshot Backup")

                print(f"\n {C.CYAN}{C.BOLD}[ ⚡ POWER FEATURES ]{C.RESET}")
                print(f"  {C.YELLOW}{C.BOLD}[26] ⚡ GOD MODE: Max Out EVERYTHING in 1-Click! ⚡{C.RESET}")
                print(f"  {C.WHITE}[27]{C.RESET} Parallel Bulk Account Generator (1-50 Accounts)")

                print(f"\n  {C.RED}[00]{C.RESET} Exit Ryomen CLI")
                print(f"{C.GRAY}──────────────────────────────────────────────────────────────────{C.RESET}")

                raw_choice = ask("Select an option (0-27)", "").strip()
                if not raw_choice:
                    continue

                if raw_choice in ("0", "00", "exit", "q", "quit"):
                    print_info("Exiting CarX Street Ryomen CLI. Keep drifting!")
                    break

                try:
                    opt = int(raw_choice)
                except ValueError:
                    print_error("Invalid selection. Please enter a number between 0 and 27.")
                    time.sleep(1)
                    continue

                # Dispatchers
                if opt == 1:
                    await self.handle_login()
                elif opt == 2:
                    await self.handle_verify()
                elif opt == 3:
                    await self.handle_fix()
                elif opt == 4:
                    await self.handle_register()
                elif opt == 5:
                    self.handle_logout()
                elif opt == 6:
                    await self.handle_delete_account()
                elif opt == 7:
                    await self.handle_currency()
                elif opt == 8:
                    await self.handle_xp()
                elif opt == 9:
                    await self.handle_streetpass()
                elif opt == 10:
                    await self.handle_ep()
                elif opt == 11:
                    await self.handle_premium_pass()
                elif opt == 12:
                    await self.handle_maps()
                elif opt == 13:
                    await self.handle_real_estate()
                elif opt == 14:
                    await self.handle_cars()
                elif opt == 15:
                    await self.handle_speed_tune()
                elif opt == 16:
                    await self.handle_fuel_nitro()
                elif opt == 17:
                    await self.handle_neons()
                elif opt == 18:
                    await self.handle_plates()
                elif opt == 19:
                    await self.handle_tires()
                elif opt == 20:
                    await self.handle_rims()
                elif opt == 21:
                    await self.handle_profile_style()
                elif opt == 22:
                    await self.handle_all_visuals()
                elif opt == 23:
                    await self.handle_antiban_check()
                elif opt == 24:
                    await self.handle_save_snapshot()
                elif opt == 25:
                    await self.handle_antiban_rebuild()
                elif opt == 26:
                    await self.handle_god_mode()
                elif opt == 27:
                    await self.handle_bulk_create()
                else:
                    print_error("Invalid option number.")

                pause()

        finally:
            await CustomDatabaseAdapter.on_shutdown()
            await close_http_client()


# ==============================================================================
# Script Entry Point
# ==============================================================================
def main() -> None:
    """Synchronous launcher running the async CLI loop."""
    try:
        asyncio.run(RyomenCLI().run())
    except (KeyboardInterrupt, SystemExit):
        print(f"\n{C.YELLOW}Session interrupted by user. Goodbye!{C.RESET}")
    except Exception as e:
        print(f"\n{C.RED}Unexpected error: {e}{C.RESET}")


if __name__ == "__main__":
    main()
