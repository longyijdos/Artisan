import os
import sys
import json
import httpx
from pathlib import Path
from dotenv import load_dotenv

# 配置路径
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# 从环境变量读取配置
API_URL = os.getenv("daytona_remote", "http://localhost:18000/api").rstrip('/')
API_KEY = os.getenv("daytona_apikey")
ORG_ID = os.getenv("organizationID")
SNAPSHOT_NAME = os.getenv("defaultsnapshot", "artisan-sandbox")
DOCKERFILE_PATH = SCRIPT_DIR / "Dockerfile.sandbox"

def get_headers():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    if ORG_ID:
        headers["X-Daytona-Organization-ID"] = ORG_ID
    return headers

def list_snapshots():
    """获取所有 Snapshot 列表"""
    url = f"{API_URL}/snapshots"
    with httpx.Client() as client:
        resp = client.get(url, headers=get_headers())
        resp.raise_for_status()
        return resp.json()

def create_snapshot(dockerfile_content):
    """通过 POST 请求创建 Snapshot"""
    url = f"{API_URL}/snapshots"
    payload = {
        "name": SNAPSHOT_NAME,
        "general": False,
        "cpu": 2,
        "memory": 4,
        "disk": 8,
        "buildInfo": {
            "dockerfileContent": dockerfile_content
        }
    }
    
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, headers=get_headers(), json=payload)
        if resp.status_code in (200, 201):
            return resp.json()
        else:
            print(f"✗ API 错误: {resp.status_code} - {resp.text}")
            return None

def main():
    print("=" * 60)
    print(f"  Daytona Snapshot Setup: {SNAPSHOT_NAME}")
    print("=" * 60)
    
    if not API_KEY:
        print("✗ 错误: 未在 .env 中找到 daytona_apikey")
        sys.exit(1)

    # 1. 检查是否已存在
    print("\n[1/3] 检查现有 Snapshot...")
    try:
        snapshots = list_snapshots()
        items = snapshots.get("items", [])
        for item in items:
            if item.get("name") == SNAPSHOT_NAME:
                print(f"✓ Snapshot '{SNAPSHOT_NAME}' 已存在 (ID: {item.get('id')}, 状态: {item.get('state')})")
                return
    except Exception as e:
        print(f"⚠ 警告: 无法获取列表 ({e})，尝试直接创建...")

    # 2. 读取 Dockerfile
    print("[2/3] 读取 Dockerfile...")
    if not DOCKERFILE_PATH.exists():
        print(f"✗ 错误: 找不到 Dockerfile: {DOCKERFILE_PATH}")
        sys.exit(1)
    dockerfile_content = DOCKERFILE_PATH.read_text()

    # 3. 创建 Snapshot
    print(f"[3/3] 正在创建 Snapshot '{SNAPSHOT_NAME}'...")
    result = create_snapshot(dockerfile_content)
    if result:
        print(f"✓ Snapshot 创建成功!")
        print(f"  - ID: {result.get('id')}")
        print(f"  - 状态: {result.get('state')}")
        print("\nDaytona 正在后台构建镜像...")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
