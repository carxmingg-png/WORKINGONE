#!/usr/bin/env python3
"""
CarX Street - Account Data Extractor
Extract whole account or individual parts
Saves as JSON + compressed string
Supports both modern 'l84l' and legacy compression formats
"""

import base64
import gzip
import json
import requests
import os
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================

USER_AGENT = 'UnityPlayer/6000.0.64f1 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)'
AUTH_URL = 'https://carx-id-prod.carx-online.com/api/auth'
PROFILE_URL = 'https://street-prod.carx-online.com/str/v1/client/profiles'

SAVE_FOLDER = os.path.join(os.getcwd(), "carx_extracted")

PARTS = {
    'cars':         {'path': 'cars.items',                         'desc': 'All cars in garage'},
    'maps':         {'path': 'game_world_parts',                   'desc': 'Unlocked maps'},
    'resources':    {'path': 'resources',                          'desc': 'Silver, gold, XP'},
    'premium':      {'path': 'has_premium',                        'desc': 'Street Pass status'},
    'stats':        {'path': 'statistics',                         'desc': 'Player statistics'},
    'quests':       {'path': 'quests',                             'desc': 'Quest progress'},
    'achievements': {'path': 'achievements',                       'desc': 'Achievements'},
    'business':     {'path': 'business_car_deliveries_completed',  'desc': 'Business progress'},
    'tuning':       {'path': 'tuning',                             'desc': 'Tuning parts'},
    'styling':      {'path': 'styling',                            'desc': 'Visual items'},
    'friends':      {'path': 'friends',                            'desc': 'Friend list'},
    'real_estates': {'path': 'real_estates',                       'desc': 'Properties'},
    'shop_packs':   {'path': 'shop_owned_packs',                   'desc': 'Shop packs'},
    'unlocks':      {'path': 'unlocks',                            'desc': 'Unlocked content'},
    'battle_pass':  {'path': 'battle_pass_event_rewards',          'desc': 'Battle pass'},
    'locations':    {'path': 'locations',                          'desc': 'All locations'},
    'clubs':        {'path': 'clubs',                              'desc': 'All clubs'},
    'slots':        {'path': 'real_estate_slots',                  'desc': 'Garage slots'},
    'races':        {'path': 'race_generators',                    'desc': 'Race generators'},
}

# ============================================================
# API
# ============================================================

def login(email, password):
    # Strategy 1: deviceId = email (extractor default)
    payloads = [
        {'deviceId': email, 'deviceUniqueId': email, 'username': email, 'password': password, 'project': 'STREET'},
        {'deviceId': email.replace('@', '_').replace('.', '_')[:32], 'deviceUniqueId': email.replace('@', '_').replace('.', '_')[:32], 'username': email, 'password': password, 'project': 'STREET'}
    ]
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    for p in payloads:
        try:
            r = requests.post(f'{AUTH_URL}/login', data=p, headers=headers, timeout=15)
            if r.status_code == 200:
                data = r.json().get('d', {})
                if data and 'token' in data:
                    return data['token'], data.get('carxId', data.get('carx_id', ''))
        except Exception:
            pass

    print(f"  ❌ Login failed. Check credentials.")
    return None, None

def find_compressed_data(d):
    """Recursively search for compressed_data in envelope"""
    if isinstance(d, dict):
        if 'compressed_data' in d and isinstance(d['compressed_data'], str) and len(d['compressed_data']) > 0:
            return d['compressed_data']
        for v in d.values():
            res = find_compressed_data(v)
            if res:
                return res
    return None

def get_raw_compressed(token):
    """Get raw compressed string from server with multiple header strategies"""
    headers_list = [
        {'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Authorization': f'Bearer {token}', 'x-token': token, 'X-Project': 'STREET'},
        {'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Authorization': f'Bearer {token}'}
    ]
    for h in headers_list:
        try:
            r = requests.get(PROFILE_URL, headers=h, timeout=20)
            if r.status_code == 200:
                j = r.json()
                comp = find_compressed_data(j)
                if comp:
                    return comp
        except Exception as e:
            print(f"  ⚠️ Fetch note: {e}")
    return None

def decompress(compressed_string):
    """Decompress supporting both modern l84l and legacy formats"""
    if not compressed_string:
        return {}
    c = compressed_string.strip()
    # Case 1: modern l84l
    if c.startswith("l84l"):
        try:
            raw = base64.b64decode(c[4:])
            gz = raw[1:] if raw[0] == 0 else raw
            return json.loads(gzip.decompress(gz).decode('utf-8'))
        except Exception as e:
            print(f"  ⚠️ l84l decode error: {e}")
    # Case 2: standard base64
    try:
        raw = base64.b64decode(c)
        try:
            return json.loads(gzip.decompress(raw[4:]).decode('utf-8'))
        except Exception:
            return json.loads(gzip.decompress(raw).decode('utf-8'))
    except Exception as e:
        print(f"  ⚠️ Legacy decode error: {e}")
        return {}

def compress(data):
    """Compress data to modern l84l string"""
    json_bytes = json.dumps(data, separators=(',', ':')).encode('utf-8')
    gz = gzip.compress(json_bytes, compresslevel=1)
    return "l84l" + base64.b64encode(b"\x00" + gz).decode('ascii')

# ============================================================
# EXTRACT HELPERS
# ============================================================

def get_nested(data, path):
    keys = path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    return value

def show_part_summary(part_name, data):
    if data is None:
        print(f"     ⚠️  No data")
        return
    
    if part_name == 'cars' and isinstance(data, dict):
        models = sorted(set(c.get('__desc_id', '?') for c in data.values() if isinstance(c, dict)))
        print(f"     🚗 {len(data)} cars ({len(models)} unique)")
        for m in models[:8]:
            print(f"        • {m}")
        if len(models) > 8:
            print(f"        ... and {len(models) - 8} more")
    
    elif part_name == 'maps' and isinstance(data, dict):
        print(f"     🗺️  {len(data)} maps: {', '.join(sorted(data.keys()))}")
    
    elif part_name == 'resources' and isinstance(data, dict):
        print(f"     💰 Resources:")
        for k, v in data.items():
            if isinstance(v, dict) and 'amount' in v:
                print(f"        • {k}: {v['amount']:,}")
    
    elif part_name == 'premium':
        print(f"     ⭐ Premium: {'✅ Active' if data else '❌ Inactive'}")
    
    elif part_name == 'stats' and isinstance(data, dict):
        print(f"     📊 {len(data)} stats")
    
    elif part_name == 'locations' and isinstance(data, dict):
        print(f"     📍 {len(data)} locations")
    
    elif part_name == 'clubs' and isinstance(data, dict):
        print(f"     🎯 {len(data)} clubs: {', '.join(sorted(data.keys())[:5])}")
    
    elif isinstance(data, (dict, list)):
        print(f"     📦 {len(data)} items")
    else:
        print(f"     📦 Value: {data}")

def show_account_summary(profile):
    print()
    print("  📊 ACCOUNT SUMMARY:")
    print("  " + "=" * 50)
    
    print(f"  👤 Nickname: {profile.get('nickname', 'unknown')}")
    print(f"  🆔 CarX ID: {profile.get('carx_id', profile.get('account_id', 'unknown'))}")
    
    cars = profile.get('cars', {}).get('items', {})
    if cars:
        models = sorted(set(c.get('__desc_id', '?') for c in cars.values() if isinstance(c, dict)))
        print(f"  🚗 Cars: {len(cars)} ({len(models)} unique)")
    else:
        print(f"  🚗 Cars: 0")
    
    resources = profile.get('resources', {})
    if isinstance(resources, dict):
        for k, v in resources.items():
            if isinstance(v, dict) and 'amount' in v:
                print(f"  💰 {k}: {v['amount']:,}")
    
    maps = profile.get('game_world_parts', {})
    if isinstance(maps, dict):
        print(f"  🗺️  Maps: {len(maps)} ({', '.join(sorted(maps.keys()))})")
    
    print(f"  ⭐ Premium: {'✅' if profile.get('has_premium') else '❌'}")
    print(f"  🏢 Properties: {len(profile.get('real_estates', {}))}")
    print(f"  🎯 Clubs: {len(profile.get('clubs', {}))}")
    print(f"  📋 Version: {profile.get('data_version', '?')}")
    print(f"  📦 Total fields: {len(profile)}")
    print("  " + "=" * 50)

# ============================================================
# SAVE FUNCTIONS
# ============================================================

def ensure_folders():
    os.makedirs(SAVE_FOLDER, exist_ok=True)
    os.makedirs(os.path.join(SAVE_FOLDER, "full_account"), exist_ok=True)
    for part in PARTS.keys():
        os.makedirs(os.path.join(SAVE_FOLDER, part), exist_ok=True)

def save_as_json(data, filepath):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    size = os.path.getsize(filepath)
    print(f"  ✅ JSON: {filepath} ({size:,} bytes)")

def save_as_compressed(data, filepath):
    compressed = compress(data)
    with open(filepath, 'w') as f:
        f.write(compressed)
    size = os.path.getsize(filepath)
    print(f"  ✅ Compressed: {filepath} ({size:,} bytes)")

# ============================================================
# EXTRACT WHOLE ACCOUNT
# ============================================================

def extract_whole_account(email, password):
    print(f"\n📥 EXTRACTING WHOLE ACCOUNT: {email}")
    print("=" * 60)
    
    print(f"\n  🔑 Logging in...")
    token, carx_id = login(email, password)
    if not token:
        return None
    print(f"  ✅ Logged in: {carx_id}")
    
    print(f"  📥 Downloading account data...")
    compressed_string = get_raw_compressed(token)
    if not compressed_string:
        print("  ❌ Failed to download compressed data")
        return None
    print(f"  ✅ Downloaded ({len(compressed_string):,} chars)")
    
    print(f"  🔓 Decompressing...")
    profile = decompress(compressed_string)
    if not profile:
        print("  ❌ Failed to decompress save")
        return None
    print(f"  ✅ Decompressed")
    
    show_account_summary(profile)
    
    nickname = profile.get('nickname', email.split('@')[0])
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = f"{nickname}_{timestamp}"
    folder = os.path.join(SAVE_FOLDER, "full_account")
    
    print(f"\n  💾 SAVING:")
    json_path = os.path.join(folder, f"{base_name}.json")
    save_as_json(profile, json_path)
    
    txt_path = os.path.join(folder, f"{base_name}.txt")
    with open(txt_path, 'w') as f:
        f.write(compressed_string)
    txt_size = os.path.getsize(txt_path)
    print(f"  ✅ Compressed: {txt_path} ({txt_size:,} bytes)")
    
    print(f"\n  ✅ WHOLE ACCOUNT EXTRACTED!")
    return profile

# ============================================================
# EXTRACT SINGLE PART
# ============================================================

def extract_single_part(email, password, part_name):
    print(f"\n📥 EXTRACTING [{part_name.upper()}] from: {email}")
    print("-" * 50)
    
    token, carx_id = login(email, password)
    if not token:
        return
    print(f"  ✅ Logged in: {carx_id}")
    
    compressed_string = get_raw_compressed(token)
    if not compressed_string:
        return
    
    profile = decompress(compressed_string)
    nickname = profile.get('nickname', email.split('@')[0])
    
    path = PARTS[part_name]['path']
    data = get_nested(profile, path)
    if data is None:
        print(f"  ⚠️ No {part_name} data found!")
        return
    
    show_part_summary(part_name, data)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = f"{part_name}_{nickname}_{timestamp}"
    folder = os.path.join(SAVE_FOLDER, part_name)
    
    json_data = {
        'part_type': part_name,
        'extracted_at': datetime.now().isoformat(),
        'source_account': email,
        'source_nickname': nickname,
        'data': data
    }
    json_path = os.path.join(folder, f"{base_name}.json")
    save_as_json(json_data, json_path)
    
    txt_path = os.path.join(folder, f"{base_name}.txt")
    save_as_compressed(data, txt_path)
    print(f"\n  ✅ [{part_name.upper()}] EXTRACTED!")

def browse_files():
    print(f"\n  📁 SAVED FILES ({SAVE_FOLDER}):")
    print("  " + "=" * 50)
    total = 0
    full_folder = os.path.join(SAVE_FOLDER, "full_account")
    if os.path.exists(full_folder):
        files = sorted(os.listdir(full_folder))
        if files:
            print(f"\n  📂 full_account/ ({len(files)} files)")
            for f in files:
                size = os.path.getsize(os.path.join(full_folder, f))
                file_type = "JSON" if f.endswith('.json') else "COMPRESSED"
                print(f"     • {f} ({size:,} bytes) [{file_type}]")
                total += 1
    
    for part in sorted(PARTS.keys()):
        part_folder = os.path.join(SAVE_FOLDER, part)
        if os.path.exists(part_folder):
            files = sorted(os.listdir(part_folder))
            if files:
                print(f"\n  📂 {part}/ ({len(files)} files)")
                for f in files:
                    size = os.path.getsize(os.path.join(part_folder, f))
                    file_type = "JSON" if f.endswith('.json') else "COMPRESSED"
                    print(f"     • {f} ({size:,} bytes) [{file_type}]")
                    total += 1
    if total == 0:
        print("  ⚠️ No saved files yet")
    else:
        print(f"\n  📊 Total: {total} files")

def main():
    ensure_folders()
    while True:
        print("\n" + "=" * 60)
        print("  CarX Street - Account Data Extractor")
        print(f"  📁 {SAVE_FOLDER}")
        print("=" * 60)
        print("  [1] Extract WHOLE account (JSON + compressed)")
        print("  [2] Extract ONE part (JSON + compressed)")
        print("  [3] Browse saved files")
        print("  [0] Exit\n")
        
        choice = input("  Choice: ").strip()
        if choice == "0":
            break
        elif choice == "1":
            email = input("  Email: ").strip()
            password = input("  Password: ").strip()
            if email and password:
                extract_whole_account(email, password)
        elif choice == "2":
            part_names = list(PARTS.keys())
            for i, (name, info) in enumerate(PARTS.items(), 1):
                print(f"    [{i:2}] {name:15} - {info['desc']}")
            try:
                idx = int(input("\n  Select part: ").strip()) - 1
                if 0 <= idx < len(part_names):
                    part = part_names[idx]
                    email = input("  Email: ").strip()
                    password = input("  Password: ").strip()
                    if email and password:
                        extract_single_part(email, password, part)
            except ValueError:
                pass
        elif choice == "3":
            browse_files()

if __name__ == "__main__":
    main()
