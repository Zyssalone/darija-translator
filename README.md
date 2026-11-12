# Darija Translator

LLM-powered RESTful web service that translates text into Moroccan Arabic Dialect (Darija).  
**CSC 3374 — Pr. El Habib Nfaoui**

![Java](https://img.shields.io/badge/Java_21-Jakarta_EE-green)
![Chrome](https://img.shields.io/badge/Chrome-Extension_MV3-blue)
![PHP](https://img.shields.io/badge/PHP-Web_Client-purple)
![Python](https://img.shields.io/badge/Python-CLI-yellow)
![React Native](https://img.shields.io/badge/React_Native-Mobile-cyan)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Chrome Ext  │     │  PHP Client  │     │  Mobile App  │
│  (Side Panel)│     │  (Web UI)    │     │ (React Native│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────┬───────┘────────────────────┘
                    ▼
          ┌──────────────────┐
          │   REST API        │
          │  localhost:8080   │
          │  Jakarta EE +     │
          │  Grizzly HTTP     │
          └────────┬──────────┘
                   ▼
          ┌──────────────────┐
          │   LLM Proxy       │
          │  (OpenAI-compat.) │
          └───────────────────┘
```

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/translate` | Translate a single text |
| `POST` | `/api/translate/batch` | Translate multiple texts |
| `GET`  | `/api/translate/health` | Health check |
| `GET`  | `/api/translate/history` | Translation history |

All endpoints require **Basic Auth** (`Authorization: Basic base64(user:pass)`).

### Request body (`POST /api/translate`)

```json
{
  "text": "Hello, how are you?",
  "sourceLang": "auto",
  "targetLang": "Darija",
  "transliterate": true
}
```

### Response

```json
{
  "translation": "سلام، كيداير؟",
  "transliteration": "salam, kidayr?",
  "detectedLang": "English"
}
```

## Setup

### Prerequisites

- **Java 21** and **Maven**
- An OpenAI-compatible LLM API running on `http://127.0.0.1:5005/`
- **PHP 7+** (for the web client)
- **Node.js / Expo** (for the mobile app)
- **Chrome** (for the extension)

### 1. Backend

```bash
cd translator-service

# Create config (not tracked by git)
cat > translator.properties <<EOF
api.key=YOUR_API_KEY
api.url=http://127.0.0.1:5005/v1/chat/completions
api.model=gpt-4
EOF

mvn clean package
java -jar target/darija-translator-1.0-SNAPSHOT.jar
# Server starts on http://localhost:8080/api/
```

### 2. Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. Click the extension icon to open the side panel

**Features:** translate text, translate entire pages, auto-translate on text selection, history, favorites, dark mode.

### 3. PHP Web Client

```bash
cd clients/php
php -S localhost:8000
# Open http://localhost:8000 in your browser
```

### 4. Python CLI

```bash
cd clients/python
python translate.py
# Interactive mode starts — type text to translate

# Or translate a file:
python translate.py --file input.txt --output output.txt
```

### 5. React Native Mobile App

```bash
cd clients/mobile
npm install
npx expo start
# Scan QR code with Expo Go app
```

## Project Structure

```
├── translator-service/          # Java backend (Jakarta EE + Grizzly)
│   ├── src/main/java/com/translator/
│   │   ├── App.java             # Server entry point
│   │   ├── TranslatorResource.java  # REST endpoints
│   │   ├── TranslationService.java  # LLM proxy logic
│   │   ├── BasicAuthFilter.java     # Authentication
│   │   └── CorsFilter.java         # CORS headers
│   └── pom.xml
├── chrome-extension/            # Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── sidepanel.html/js        # Main UI
│   ├── content.js               # Page translation + selection detection
│   └── background.js            # Context menu + side panel opener
├── clients/
│   ├── php/index.php            # PHP web client
│   ├── python/translate.py      # Python CLI client
│   └── mobile/                  # React Native (Expo) app
│       └── App.js
└── README.md
```

## Supported Languages

**Source:** Auto-detect, English, French, Spanish, German, Turkish, Arabic (MSA)  
**Target:** Moroccan Darija, English, French, Spanish, Arabic (MSA)
