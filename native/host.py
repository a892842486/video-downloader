
from downloader import download_video
import json
import struct
import sys


def read_message():
    raw_length = sys.stdin.buffer.read(4)

    if not raw_length:
        return None

    message_length = struct.unpack("<I", raw_length)[0]
    message = sys.stdin.buffer.read(message_length)

    return json.loads(message.decode("utf-8"))


def send_message(message):
    encoded = json.dumps(message).encode("utf-8")

    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()




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
            response = download_video(
                message.get("url"),
                message.get("downloadPath"),
            )

        else:
            response = {
                "success": False,
                "error": f"Unknown action: {action}",
            }

        response["requestId"] = request_id
        send_message(response)


if __name__ == "__main__":
    main()
