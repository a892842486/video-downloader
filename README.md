# Video Downloader

使用 Chrome Extension、Python、yt-dlp 與 FFmpeg 開發的網頁影片下載工具，支援影片偵測、下載管理、進度顯示與影音合併。

透過 Chrome Native Messaging 連接 Python，由擴充功能負責操作介面與任務管理，Python 負責實際下載。

<!-- 專案主要截圖 -->

## Features

- 偵測網頁影片並提供下載按鈕
- 自動選擇最佳可用畫質，支援影音合併
- 顯示下載進度、速度與剩餘時間
- 支援多任務下載、取消與中斷任務重新下載（部分來源可續傳）
- 自訂下載位置，保存下載紀錄
- 可開關網頁下載按鈕
- 影片下載能力取決於 yt-dlp 對來源網站的支援情況，部分網站可能無法下載

## Tech Stack

| 分類 | 技術 |
| --- | --- |
| Chrome Extension | Manifest V3 |
| Frontend | HTML / CSS / JavaScript |
| Native Host | Python 3.13 |
| Communication | Chrome Native Messaging |
| Video Download | yt-dlp |
| Video Processing | FFmpeg |

## Architecture

- `manifest.json`：擴充功能設定與權限
- `content/`：網頁影片偵測與下載按鈕
- `popup/`：操作介面與下載清單
- `background.js`：下載任務管理與 Python 通訊
- `native/`：Python 下載核心與 Native Host 設定

**下載流程：**

`content.js` → `background.js` → `Native Messaging` → `host.py` → `downloader.py` → `yt-dlp / FFmpeg`

## Screenshots

<!-- 放入操作介面、下載進度等截圖 -->

## Installation

### Requirements

- Windows 10 / 11
- Google Chrome
- Python 3.13
- yt-dlp
- FFmpeg

### Setup

**1. 下載專案**

下載本專案 ZIP 並解壓縮，或使用 Git Clone。

**2. 安裝必要工具**

開啟 PowerShell：

```powershell
winget install Python.Python.3.13
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

重新開啟 PowerShell，安裝 Python 版 yt-dlp 與相關依賴：

```powershell
py -3.13 -m pip install -U "yt-dlp[default,curl-cffi]"
```

**3. 確認安裝成功**

```powershell
py -3.13 --version
yt-dlp --version
ffmpeg -version
py -3.13 -c "import yt_dlp; print(yt_dlp.version.__version__)"
py -3.13 -c "import curl_cffi; print(curl_cffi.__version__)"
```

**4. 安裝 Chrome Extension**

1. 開啟 Chrome，前往 `chrome://extensions/`。
2. 開啟「開發人員模式」。
3. 點選「載入未封裝項目」，選擇專案資料夾。
4. 複製擴充功能 ID，供 Native Host 設定使用。

**5. 設定 Native Host**

複製 `native/host.example.json`，命名為 `native/host.json`，修改：

- `path`：設定為 `native/host.bat` 的絕對路徑。
- `allowed_origins`：填入 `chrome-extension://擴充功能ID/`。

注意：Windows 路徑在 JSON 中需要使用雙反斜線，例如 `C:\\video_downloader\\native\\host.bat`。

**6. 註冊 Native Host**

在專案根目錄開啟 PowerShell：

```powershell
$hostJson = (Resolve-Path ".\native\host.json").Path
$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.video_downloader.host"

New-Item -Path $regPath -Force | Out-Null
Set-Item -Path $regPath -Value $hostJson
```

**7. 確認註冊**

```powershell
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.video_downloader.host" /ve
```

確認登錄檔指向正確的 `host.json`。

**8. 開始使用**

1. 重新載入 Chrome 擴充功能。
2. 點擊 Chrome 工具列上的 Video Downloader。
3. 設定影片下載資料夾。
4. 開啟有影片的網頁，點擊下載按鈕。
5. 在擴充功能視窗查看下載進度與結果。

> 本專案於 Windows 10 開發及測試。Native Messaging 安裝方式依目前開發環境整理，尚未完成其他電腦的安裝驗證。

> 請僅下載有權保存的影片，並遵守網站使用條款及相關著作權規範。
