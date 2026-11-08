
import json
import struct
import sys

from downloader import download_video


# 保留原始 stdout，專門供 Native Messaging 使用
NATIVE_STDOUT = sys.stdout.buffer


def read_message():
    raw_length = sys.stdin.buffer.read(4)

    if not raw_length:
        return None

    message_length = struct.unpack("<I", raw_length)[0]
    message = sys.stdin.buffer.read(message_length)

    return json.loads(message.decode("utf-8"))


def send_message(message):
    encoded = json.dumps(message).encode("utf-8")

    NATIVE_STDOUT.write(struct.pack("<I", len(encoded)))
    NATIVE_STDOUT.write(encoded)
    NATIVE_STDOUT.flush()


def main():
    while True:
        message = read_message()

        if message is None:
            break

        action = message.get("action")
        request_id = message.get("requestId")

        if action == "ping":
            response = {
                "success": True,
                "message": "Python Native Host connected!",
            }

        elif action == "download":
            def on_progress(progress):
                send_message({
                    **progress,
                    "requestId": request_id,
                })

            response = download_video(
                message.get("url"),
                message.get("downloadPath"),
                progress_callback=on_progress,
                referer=message.get("referer"),
                title=message.get("title"),
                fallback_url=message.get("fallbackUrl"),
            )

        else:
            response = {
                "success": False,
                "error": f"Unknown action: {action}",
            }

        if response.get("skipped"):
            response["event"] = "skipped"
        elif response["success"]:
            response["event"] = "completed"
        else:
            response["event"] = "error"

        response["requestId"] = request_id
        send_message(response)


if __name__ == "__main__":
    main()
