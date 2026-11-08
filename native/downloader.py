
import contextlib
import sys
import time
import traceback
from pathlib import Path

import yt_dlp


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

    def fix_video_title(info):
        video_title = info.get("title", "")
        video_id = info.get("id", "")

        invalid_titles = ("video", "playlist", "index", "master")

        if (
            isinstance(title, str)
            and title.strip()
            and (
                not video_title
                or video_title == video_id
                or video_title.lower() in invalid_titles
            )
        ):
            info["title"] = title.strip()

        return [], info

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

        if status == "finished":
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

        ydl_title_hook = yt_dlp.postprocessor.common.PostProcessor()
        ydl_title_hook.run = fix_video_title

        # SpankBang 使用網站首頁作為 Referer
        if isinstance(referer, str) and referer.startswith(("https://", "http://")):
            if referer.startswith(("https://spankbang.com/", "http://spankbang.com/")):
                referer = "https://spankbang.com"

            options["http_headers"] = {
                "Referer": referer,
            }
        # 避免 yt-dlp 的文字輸出干擾 Native Messaging
        with contextlib.redirect_stdout(sys.stderr):
            with yt_dlp.YoutubeDL(options) as ydl:
                ydl.add_post_processor(ydl_title_hook, when="pre_process")

                try:
                    info = ydl.extract_info(url, download=True)

                    if not info:
                        raise ValueError("無法取得影片資訊")

                except yt_dlp.utils.DownloadError:
                    if (
                        not isinstance(fallback_url, str)
                        or not fallback_url.startswith(("https://", "http://"))
                        or fallback_url == url
                    ):
                        raise

                    print(
                        "[Video Downloader] 原始網址失敗，嘗試 HLS 備援",
                        file=sys.stderr,
                    )

                    info = ydl.extract_info(fallback_url, download=True)

                    if not info:
                        raise ValueError("HLS 備援無法取得影片資訊")

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
