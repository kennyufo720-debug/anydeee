"""
Social Media Uploader — Facebook & Instagram
使用 Meta Graph API v19.0
支援：圖片貼文、影片/Reels、限時動態、純文字貼文
"""

import os
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

FB_PAGE_ID    = os.getenv("FB_PAGE_ID")
FB_PAGE_TOKEN = os.getenv("FB_PAGE_TOKEN")
IG_USER_ID    = os.getenv("IG_USER_ID")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY")  # 免費圖床，用於 IG 圖片上傳

GRAPH_BASE = "https://graph.facebook.com/v19.0"
QUEUE_DIR  = Path(__file__).parent / "queue"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v"}


# ── 圖片上傳到 imgbb（取得公開 URL 供 IG 使用）────────────────────
def upload_image_to_imgbb(image_path: str) -> str:
    if not IMGBB_API_KEY:
        raise ValueError("缺少 IMGBB_API_KEY，請到 https://imgbb.com 申請免費 API key")
    with open(image_path, "rb") as f:
        r = requests.post(
            "https://api.imgbb.com/1/upload",
            params={"key": IMGBB_API_KEY, "expiration": 600},  # 10 分鐘夠用
            files={"image": f},
            timeout=30,
        )
    r.raise_for_status()
    return r.json()["data"]["url"]


# ── Facebook 發布 ─────────────────────────────────────────────────
def fb_post_text(caption: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{FB_PAGE_ID}/feed",
        data={"message": caption, "access_token": FB_PAGE_TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def fb_post_photo(image_url: str, caption: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{FB_PAGE_ID}/photos",
        data={"url": image_url, "caption": caption, "access_token": FB_PAGE_TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def fb_post_video(video_url: str, caption: str) -> dict:
    """影片需要公開可存取的 URL（Google Drive / Dropbox / Cloudinary 等）"""
    r = requests.post(
        f"{GRAPH_BASE}/{FB_PAGE_ID}/videos",
        data={"file_url": video_url, "description": caption, "access_token": FB_PAGE_TOKEN},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


# ── Instagram 發布 ────────────────────────────────────────────────
def ig_publish_container(container_id: str) -> dict:
    """等待容器處理完成後發布"""
    for _ in range(10):  # 最多等 50 秒
        status_r = requests.get(
            f"{GRAPH_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": FB_PAGE_TOKEN},
            timeout=15,
        )
        status = status_r.json().get("status_code", "")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise RuntimeError("IG 媒體容器處理失敗")
        time.sleep(5)

    r = requests.post(
        f"{GRAPH_BASE}/{IG_USER_ID}/media_publish",
        data={"creation_id": container_id, "access_token": FB_PAGE_TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def ig_post_photo(image_url: str, caption: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{IG_USER_ID}/media",
        data={"image_url": image_url, "caption": caption, "access_token": FB_PAGE_TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json()["id"]
    return ig_publish_container(container_id)


def ig_post_reel(video_url: str, caption: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{IG_USER_ID}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": FB_PAGE_TOKEN,
        },
        timeout=60,
    )
    r.raise_for_status()
    container_id = r.json()["id"]
    return ig_publish_container(container_id)


def ig_post_story_photo(image_url: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{IG_USER_ID}/media",
        data={
            "media_type": "STORIES",
            "image_url": image_url,
            "access_token": FB_PAGE_TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json()["id"]
    return ig_publish_container(container_id)


def ig_post_story_video(video_url: str) -> dict:
    r = requests.post(
        f"{GRAPH_BASE}/{IG_USER_ID}/media",
        data={
            "media_type": "STORIES",
            "video_url": video_url,
            "access_token": FB_PAGE_TOKEN,
        },
        timeout=60,
    )
    r.raise_for_status()
    container_id = r.json()["id"]
    return ig_publish_container(container_id)


# ── Queue 處理 ────────────────────────────────────────────────────
def _find_media(folder: Path) -> tuple[str | None, str]:
    """回傳 (檔案路徑, 副檔名)"""
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() in IMAGE_EXTS:
            return str(f), "image"
        if f.suffix.lower() in VIDEO_EXTS:
            return str(f), "video"
    return None, ""


def process_next() -> str:
    """
    發布 queue/ 裡下一個待處理的資料夾。
    回傳結果訊息。
    """
    if not QUEUE_DIR.exists():
        QUEUE_DIR.mkdir()
        return "已建立 queue/ 資料夾，請在裡面放入貼文資料夾。"

    pending = sorted([
        d for d in QUEUE_DIR.iterdir()
        if d.is_dir() and not (d / ".done").exists()
    ])

    if not pending:
        return "Queue 是空的，目前沒有待發布的內容。"

    item = pending[0]
    config_path  = item / "config.json"
    caption_path = item / "caption.txt"

    if not config_path.exists():
        return (
            f"⚠️ 資料夾 `{item.name}` 缺少 config.json，已跳過。\n"
            "請參考 queue/example/ 的範例。"
        )

    config    = json.loads(config_path.read_text(encoding="utf-8"))
    caption   = caption_path.read_text(encoding="utf-8").strip() if caption_path.exists() else ""
    post_type = config.get("type", "photo")       # photo | video | reel | story | text
    platforms = config.get("platforms", ["facebook", "instagram"])
    video_url = config.get("video_url", "")       # 影片需提供公開 URL

    media_path, media_kind = _find_media(item)
    media_url = None
    results   = []

    # ── 準備媒體 URL ──────────────────────────────────────────
    if post_type == "text":
        pass  # 不需要媒體
    elif media_kind == "image":
        try:
            media_url = upload_image_to_imgbb(media_path)
        except Exception as e:
            return f"❌ 圖片上傳失敗：{e}"
    elif media_kind == "video":
        if not video_url:
            return (
                f"❌ 影片貼文需要在 config.json 提供 `video_url`（公開可存取的連結）。\n"
                f"資料夾：{item.name}"
            )
        media_url = video_url
    else:
        if post_type != "text":
            return f"❌ 資料夾 `{item.name}` 找不到媒體檔案。"

    # ── 發布到各平台 ──────────────────────────────────────────
    if "facebook" in platforms:
        try:
            if post_type == "text":
                fb_post_text(caption)
            elif post_type in ("photo", "story"):
                fb_post_photo(media_url, caption)
            elif post_type in ("video", "reel"):
                fb_post_video(media_url, caption)
            results.append("Facebook ✅")
        except Exception as e:
            results.append(f"Facebook ❌ {str(e)[:80]}")

    if "instagram" in platforms:
        try:
            if post_type == "photo":
                ig_post_photo(media_url, caption)
            elif post_type == "reel":
                ig_post_reel(media_url, caption)
            elif post_type == "story":
                if media_kind == "image":
                    ig_post_story_photo(media_url)
                else:
                    ig_post_story_video(media_url)
            elif post_type == "text":
                # IG 不支援純文字貼文（API 限制），改發圖片
                results.append("Instagram ⚠️ IG 不支援純文字貼文，已跳過")
                # 如果你有底圖，改用 photo 類型
            results.append("Instagram ✅")
        except Exception as e:
            results.append(f"Instagram ❌ {str(e)[:80]}")

    # ── 標記為完成 ────────────────────────────────────────────
    (item / ".done").touch()

    return f"📤 已發布：*{item.name}*\n" + "\n".join(results)


def list_queue() -> str:
    """列出 queue 狀態"""
    if not QUEUE_DIR.exists():
        return "Queue 資料夾不存在。"

    items = sorted([d for d in QUEUE_DIR.iterdir() if d.is_dir()])
    if not items:
        return "Queue 是空的。"

    lines = []
    for d in items:
        done = (d / ".done").exists()
        cfg  = {}
        if (d / "config.json").exists():
            cfg = json.loads((d / "config.json").read_text(encoding="utf-8"))
        icon = "✅" if done else "⏳"
        ptype = cfg.get("type", "?")
        lines.append(f"{icon} `{d.name}` [{ptype}]")

    pending = sum(1 for d in items if not (d / ".done").exists())
    return f"Queue 狀態（{pending} 待發布）：\n" + "\n".join(lines)
