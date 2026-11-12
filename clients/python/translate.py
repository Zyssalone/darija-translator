#!/usr/bin/env python3
"""Darija Translator — Python CLI client.

Usage:
    python translate.py "Hello, how are you?"
    python translate.py                            # interactive mode
    python translate.py --speak "Good morning"     # translate + TTS
    python translate.py --file input.txt           # batch translate file
    python translate.py --file input.txt -o out.txt
    python translate.py --translit "Hello"         # with Latin transliteration
    python translate.py --copy "Hello"             # copy result to clipboard
"""

import argparse
import base64
import io
import json
import sys
import urllib.request
import urllib.error

# ponytail: Windows terminal can't print Arabic without this
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

API_URL = "http://localhost:8080/api/translate"
USERNAME = "admin"
PASSWORD = "password123"


def _auth_header():
    return base64.b64encode(f"{USERNAME}:{PASSWORD}".encode()).decode()


def translate(text, source_lang="auto", target_lang="Darija", transliterate=False):
    payload = json.dumps({
        "text": text, "sourceLang": source_lang,
        "targetLang": target_lang, "transliterate": transliterate,
    }).encode()

    req = urllib.request.Request(API_URL, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Basic {_auth_header()}",
    })

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            if data.get("error"):
                return {"error": data["error"]}
            return data
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection error: {e.reason} — is the server running?"}


def batch_translate(texts, source_lang="auto", target_lang="Darija", transliterate=False):
    url = API_URL + "/batch"
    payload = json.dumps({
        "texts": texts, "sourceLang": source_lang,
        "targetLang": target_lang, "transliterate": transliterate,
    }).encode()

    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Basic {_auth_header()}",
    })

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def speak(text):
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty("rate", 140)
        engine.say(text)
        engine.runAndWait()
    except ImportError:
        print("(Install pyttsx3 for TTS: pip install pyttsx3)")
    except Exception as e:
        print(f"(TTS error: {e})")


def copy_to_clipboard(text):
    try:
        import subprocess
        subprocess.run(["clip.exe"], input=text.encode("utf-16-le"), check=True)
        print("(Copied to clipboard)")
    except Exception:
        try:
            import subprocess
            subprocess.run(["pbcopy"], input=text.encode(), check=True)
            print("(Copied to clipboard)")
        except Exception:
            print("(Clipboard not available — install pyperclip or use Windows/macOS)")


def get_history(limit=10):
    url = API_URL + f"/history?limit={limit}"
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {_auth_header()}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def format_result(data, show_translit=False):
    lines = []
    if data.get("error"):
        return f"Error: {data['error']}"
    lines.append(data.get("translation", ""))
    if show_translit and data.get("transliteration"):
        lines.append(f"  ({data['transliteration']})")
    if data.get("detectedLang"):
        lines.append(f"  [Detected: {data['detectedLang']}]")
    return "\n".join(lines)


def interactive():
    print("=" * 52)
    print("  Darija Translator — Interactive Mode")
    print("  Commands: lang, translit, history, quit")
    print("=" * 52)

    langs = {"1": "auto", "2": "English", "3": "French", "4": "Spanish", "5": "Arabic (MSA)"}
    source_lang = "auto"
    target_lang = "Darija"
    translit = False

    while True:
        try:
            text = input(f"\n[{source_lang} → {target_lang}] > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not text:
            continue
        if text.lower() in ("quit", "exit", "q"):
            print("Bye!")
            break
        if text.lower() == "translit":
            translit = not translit
            print(f"  Transliteration: {'ON' if translit else 'OFF'}")
            continue
        if text.lower() == "history":
            h = get_history()
            if isinstance(h, dict) and "error" in h:
                print(h["error"])
            elif not h:
                print("No history yet.")
            else:
                for i, entry in enumerate(h, 1):
                    src = entry.get("source", "")[:40]
                    trl = entry.get("translation", "")[:40]
                    print(f"  {i}. {src}... → {trl}...")
            continue
        if text.lower() == "lang":
            for k, v in langs.items():
                marker = " ←" if v == source_lang else ""
                print(f"  {k}. {v}{marker}")
            choice = input("Pick source (1-5): ").strip()
            if choice in langs:
                source_lang = langs[choice]
                print(f"  Source language: {source_lang}")
            continue

        result = translate(text, source_lang, target_lang, translit)
        print(f"\n  ← {format_result(result, translit)}")


def main():
    parser = argparse.ArgumentParser(description="Darija Translator CLI")
    parser.add_argument("text", nargs="?", help="Text to translate")
    parser.add_argument("--lang", default="auto", help="Source language (default: auto)")
    parser.add_argument("--target", default="Darija", help="Target language (default: Darija)")
    parser.add_argument("--translit", action="store_true", help="Include Latin transliteration")
    parser.add_argument("--speak", action="store_true", help="Read translation aloud")
    parser.add_argument("--copy", action="store_true", help="Copy translation to clipboard")
    parser.add_argument("--file", help="Translate each line of a file")
    parser.add_argument("-o", "--output", help="Output file for --file mode")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--history", action="store_true", help="Show recent translations")
    args = parser.parse_args()

    if args.history:
        h = get_history()
        if isinstance(h, dict) and "error" in h:
            print(h["error"])
        elif not h:
            print("No history yet.")
        else:
            for i, entry in enumerate(h, 1):
                print(f"{i}. [{entry.get('sourceLang', '?')} → {entry.get('targetLang', '?')}]")
                print(f"   {entry.get('source', '')}")
                print(f"   → {entry.get('translation', '')}")
                if entry.get("transliteration"):
                    print(f"   ({entry['transliteration']})")
                print()
        return

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        if not lines:
            print("File is empty.")
            return

        print(f"Translating {len(lines)} lines...")
        # batch if <=20, else one-by-one
        if len(lines) <= 20:
            results = batch_translate(lines, args.lang, args.target, args.translit)
            if isinstance(results, dict) and "error" in results:
                print(f"Error: {results['error']}")
                return
        else:
            results = []
            for i, line in enumerate(lines):
                r = translate(line, args.lang, args.target, args.translit)
                results.append(r)
                print(f"  [{i+1}/{len(lines)}] done", end="\r")
            print()

        out_lines = []
        for i, r in enumerate(results):
            if isinstance(r, dict) and r.get("error"):
                out_lines.append(f"[ERROR] {r['error']}")
            else:
                t = r.get("translation", "") if isinstance(r, dict) else str(r)
                out_lines.append(t)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write("\n".join(out_lines) + "\n")
            print(f"Saved to {args.output}")
        else:
            for line in out_lines:
                print(line)
        return

    if not args.text:
        interactive()
        return

    result = translate(args.text, args.lang, args.target, args.translit)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_result(result, args.translit))

    translation = result.get("translation", "") if isinstance(result, dict) else ""
    if args.speak and translation:
        speak(translation)
    if args.copy and translation:
        copy_to_clipboard(translation)


if __name__ == "__main__":
    main()
