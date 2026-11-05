
import os
import contextlib
import sys
import time
from pathlib import Path

import yt_dlp


def download_video(url, download_path, progress_callback=None):
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

                # 根據 yt-dlp 選擇的格式推算輸出檔名
                filename = ydl.prepare_filename(info)

                # 使用 FFmpeg 合併時，最終檔案通常為 MP4
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

                # 尚未下載，正常執行
                info = ydl.extract_info(url, download=True)


        return {
            "success": True,
            "title": info.get("title", "Unknown") if info else "Unknown",
            "downloadPath": str(output_dir),
        }

    except Exception as error:
        return {"success": False, "error": str(error)}
