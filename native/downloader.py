
from pathlib import Path

import yt_dlp


def download_video(url, download_path):
    if not isinstance(url, str) or not url.startswith(("https://", "http://")):
        return {
            "success": False,
            "error": "Invalid video URL",
        }

    if not isinstance(download_path, str) or not download_path.strip():
        return {
            "success": False,
            "error": "Invalid download path",
        }

    try:
        output_dir = Path(download_path).expanduser()
        output_dir.mkdir(parents=True, exist_ok=True)

        options = {
            "paths": {"home": str(output_dir)},
            "outtmpl": "%(title)s [%(resolution)s].%(ext)s",
            "format": "bv*+ba/b",
            "merge_output_format": "mp4",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)

        return {
            "success": True,
            "title": info.get("title", "Unknown") if info else "Unknown",
            "downloadPath": str(output_dir),
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
        }
