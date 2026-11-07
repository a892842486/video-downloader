
import contextlib
import os
import sys
import time
import traceback
from pathlib import Path

import yt_dlp
from yt_dlp.networking.impersonate import ImpersonateTarget

def download_video(
    url,
    download_path,
    progress_callback=None,
    referer=None,
    title=None,
    fallback_url=None,
):
    if not isinstance(url, str) or not url.startswith(("https://", "http://")):
        return {"success": False, "error": "Invalid video URL"}

    if not isinstance(download_path, str) or not download_path.strip():
        return {"success": False, "error": "Invalid download path"}

    last_report = 0.0

    def report_progress(data):
        nonlocal last_report

        status = data.get("status")
        now = time.monotonic()

        # 每秒回報一次；完成下載時立即回報
        if status == "downloading" and now - last_report < 1:
            return

        last_report = now


        total = data.get("total_bytes") or data.get("total_bytes_estimate")

        downloaded = data.get("downloaded_bytes")

        if data.get("status") == "finished":
            downloaded = total or downloaded or 0
        else:
            downloaded = downloaded or 0

        speed = data.get("speed")
        eta = data.get("eta")


        percent = (
            round(downloaded / total * 100, 1)
            if total
            else None
        )

        if progress_callback:
            progress_callback({
                "event": "progress",
                "status": status,
                "downloadedBytes": downloaded,
                "totalBytes": total,
                "percent": percent,
                "speed": speed,
                "eta": eta,
            })

    try:
        output_dir = Path(download_path).expanduser()
        folder_created = not output_dir.is_dir()

        output_dir.mkdir(parents=True, exist_ok=True)

        if folder_created and progress_callback:
            progress_callback({
                "event": "folder_created",
                "path": str(output_dir),
            })

        options = {
            "paths": {"home": str(output_dir)},
            "outtmpl": "%(title)s [%(resolution)s].%(ext)s",
            "impersonate": ImpersonateTarget.from_str("chrome"),
            "format": "bv*+ba/b",
            "merge_output_format": "mp4",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "color": {"stderr": "no_color", "stdout": "no_color"},
            "progress_hooks": [report_progress],
            "overwrites": False,
            "continuedl": True,
        }

        # 自動帶入來源網頁 Referer
        if isinstance(referer, str) and referer.startswith(("https://", "http://")):
            options["http_headers"] = {
                "Referer": referer,
            }

        # 避免 yt-dlp 的文字輸出干擾 Native Messaging
        with contextlib.redirect_stdout(sys.stderr):
            with yt_dlp.YoutubeDL(options) as ydl:
                # 先取得影片資訊，不開始下載
                info = ydl.extract_info(url, download=False)

                if not info:
                    return {
                        "success": False,
                        "error": "無法取得影片資訊",
                    }

                # yt-dlp 標題無效時，才使用網頁標題備援
                video_title = info.get("title", "")

                if (
                    isinstance(title, str)
                    and title.strip()
                    and (
                        not isinstance(video_title, str)
                        or not video_title.strip()
                        or video_title.lower() in ("video", "playlist", "index", "master")
                    )
                ):
                    clean_title = title.strip()

                    # 移除網頁標題最後一段常見的網站後綴
                    for separator in [" | ", " - ", " — "]:
                        if separator in clean_title:
                            clean_title = clean_title.rsplit(separator, 1)[0].strip()
                            break

                    info["title"] = clean_title

                # 根據影片資訊推算輸出檔名
                filename = ydl.prepare_filename(info)
                final_path = Path(filename)

                if info.get("requested_formats"):
                    final_path = final_path.with_suffix(".mp4")

                # 已有完成檔案就直接跳過
                if final_path.is_file():
                    return {
                        "success": True,
                        "skipped": True,
                        "title": info.get("title", "Unknown"),
                        "filename": final_path.name,
                        "downloadPath": str(output_dir),
                    }

                # 使用已修改標題的影片資訊下載，避免重新解析
                info = ydl.process_ie_result(info, download=True)


        return {
            "success": True,
            "title": info.get("title", "Unknown") if info else "Unknown",
            "downloadPath": str(output_dir),
        }

    except Exception:
        return {
            "success": False,
            "error": traceback.format_exc(),
        }
