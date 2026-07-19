#!/usr/bin/env python3
"""RSSフィードをサーバー側(GitHub Actions)で直接取得し、
フロントエンドが読み込む静的な news.json / sources.js を生成する。

このスクリプトは .github/workflows/fetch-news.yml から定期実行される。
配信元を追加/削除/変更したいときは sources.json を編集してこのスクリプトを再実行すること
(sources.js は自動生成物なので直接編集しない)。
"""
from __future__ import annotations

import calendar
import html
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCES_JSON_PATH = REPO_ROOT / "sources.json"
SOURCES_JS_PATH = REPO_ROOT / "sources.js"
NEWS_JSON_PATH = REPO_ROOT / "news.json"

MAX_ITEMS_PER_SOURCE = 100   # 1ソースあたりの保存件数上限(旧allorigins経由の実測値に合わせる)
DESC_MAX_LEN = 220           # 要約の切り詰め文字数(フロントエンドの旧仕様を踏襲)
FETCH_TIMEOUT_SEC = 15
FETCH_MAX_ATTEMPTS = 2       # 一時的な失敗を1回だけリトライしてから前回データへフォールバック
MAX_WORKERS = 5              # 並列取得数(相手サイトのレート制限対策。旧FETCH_CONCURRENCYを踏襲)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(raw: str) -> str:
    """HTMLタグを除去してプレーンテキスト化する。
    フロントエンド側(utils.js の stripHtml)でも再度処理されるため簡易実装で十分
    (二重に通しても実害はなく、XSS対策の最終防衛ラインはクライアント側に置いてある)。
    """
    if not raw:
        return ""
    text = _TAG_RE.sub("", raw)
    text = html.unescape(text)
    return _WS_RE.sub(" ", text).strip()


def to_epoch_ms(struct_time) -> int | None:
    """feedparserのtime.struct_time(UTCに正規化済みだがtzinfoは持たない)をepochミリ秒に変換する。
    time.mktime()はローカルタイムゾーンで解釈するため、JST環境で実行すると9時間ズレる
    (GitHub Actionsランナー上はUTCなので気づきにくい) — 必ずcalendar.timegm()を使うこと。
    """
    if struct_time is None:
        return None
    return calendar.timegm(struct_time) * 1000


def extract_desc(entry) -> str:
    """RSSの<description>/Atomの<summary>/<content>のどれに入っていても取り出す。"""
    summary = entry.get("summary")
    if summary:
        return summary
    content_list = entry.get("content")
    if content_list:
        return content_list[0].get("value", "")
    return ""


def normalize_entry(entry) -> dict:
    pub_struct = entry.get("published_parsed") or entry.get("updated_parsed")
    return {
        "title": strip_html(entry.get("title", "")),
        "link": entry.get("link", ""),
        "desc": strip_html(extract_desc(entry))[:DESC_MAX_LEN],
        "pubDate": to_epoch_ms(pub_struct),
    }


def load_sources() -> list[dict]:
    with SOURCES_JSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def generate_sources_js(sources: list[dict]) -> None:
    """sources.json から sources.js(フロントエンドが<script src>で読み込むJS)を再生成する。"""
    body = json.dumps(sources, ensure_ascii=False, indent=2)
    js = (
        "'use strict';\n"
        "// このファイルは「ニュース取得元(RSSフィード)の一覧データ」を定義する。ロジックは持たない。\n"
        "// 自動生成ファイル — 手編集しないこと。配信元を追加/変更したい場合は sources.json を編集し、\n"
        "// scripts/fetch_news.py を実行して再生成する(GitHub Actionsが定期的に自動実行・再生成もする)。\n"
        "\n\n\n"
        "const SOURCES = " + body + ";\n"
    )
    SOURCES_JS_PATH.write_text(js, encoding="utf-8")


def load_previous_items() -> dict[str, list[dict]]:
    """前回の news.json を読み込む(取得失敗ソースのフォールバック用)。初回実行時は空。"""
    if not NEWS_JSON_PATH.exists():
        return {}
    try:
        with NEWS_JSON_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("items", {})
    except (json.JSONDecodeError, OSError):
        return {}


def fetch_source(source: dict) -> tuple[str, list[dict] | None, str | None]:
    """1ソースを取得・パースする。
    戻り値: (source_id, items, error)
      - 成功時: items は記事リスト(0件も正常。フィードが単に何も新着を出していないだけの場合がある)、error は None
      - 失敗時: items は None、error は原因の文字列(呼び出し側で前回データへのフォールバックに使う)
    """
    source_id = source["id"]
    last_error = None
    for attempt in range(1, FETCH_MAX_ATTEMPTS + 1):
        try:
            response = requests.get(
                source["rss"],
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/rss+xml, application/xml, text/xml, */*",
                },
                timeout=FETCH_TIMEOUT_SEC,
            )
            response.raise_for_status()
            parsed = feedparser.parse(response.content)
            if parsed.bozo and not parsed.entries:
                raise ValueError(f"parse error: {parsed.bozo_exception}")
            items = [normalize_entry(entry) for entry in parsed.entries[:MAX_ITEMS_PER_SOURCE]]
            return source_id, items, None
        except Exception as exc:  # noqa: BLE001 -- どんな例外でも他ソースの取得は止めない
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt < FETCH_MAX_ATTEMPTS:
                time.sleep(2)
    return source_id, None, last_error


def main() -> None:
    sources = load_sources()
    generate_sources_js(sources)

    previous_items = load_previous_items()
    result_items: dict[str, list[dict]] = {}
    failed_ids: list[str] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_source, source): source["id"] for source in sources}
        for future in as_completed(futures):
            source_id, items, error = future.result()
            if items is not None:
                result_items[source_id] = items
                print(f"OK   {source_id}: {len(items)} items")
            else:
                # 取得/パース失敗 -- 前回分をそのまま引き継ぐ(pubDateは書き換えない。
                # これにより2日鮮度フィルタが自然なTTLとして働き、恒久的に死んだフィードの記事は
                # 手動で消さなくても2日経てば自動的に表示から消える)
                carried = previous_items.get(source_id, [])
                result_items[source_id] = carried
                failed_ids.append(source_id)
                print(f"FAIL {source_id}: {error} (前回分{len(carried)}件を引き継ぎ)")

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": result_items,
    }
    with NEWS_JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    ok_count = len(sources) - len(failed_ids)
    print(f"\n合計 {len(sources)} ソース中 {ok_count} 件成功、{len(failed_ids)} 件失敗")
    if failed_ids:
        print("失敗ソース: " + ", ".join(failed_ids))


if __name__ == "__main__":
    main()
