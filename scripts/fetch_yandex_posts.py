#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Забирает новости и акции салона с Яндекс Карт в site/diana/data/posts.json.

Зачем: раздел «Акции» на сайте не выдумывается вручную — Диана публикует
новости в карточке организации на Яндексе, и сайт показывает ровно их.

Источник — вкладка «Новости» карточки организации. Публичного API нет,
поэтому страница открывается браузером (лента догружается прокруткой,
длинные тексты спрятаны под «Читать далее») и разбирается по вёрстке.

Как и в сборщике отзывов:
  * селекторы собраны в CANDIDATES — при смене вёрстки пробуются по очереди;
  * скрипт НИКОГДА не затирает существующий JSON пустотой: при провале
    выходит с кодом 1, прошлые акции остаются на сайте;
  * `--debug` печатает структуру страницы, чтобы подобрать новые селекторы.

Запуск:
    python3 scripts/fetch_yandex_posts.py --debug
    python3 scripts/fetch_yandex_posts.py --html сохранённая-страница.html
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date

ORG_ID = "64270712446"
POSTS_URL = "https://yandex.ru/maps/org/perfect_ton/%s/posts/" % ORG_ID
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "diana", "data", "posts.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# (карточка, дата, текст, фото)
CANDIDATES = [
    (".business-posts-list-post-view",
     ".business-posts-list-post-view__date",
     ".business-posts-list-post-view__text",
     ".business-post-photo-view img"),
    ("[class*=posts-list-post-view]",
     "[class*=post-view__date]",
     "[class*=post-view__text]",
     "[class*=post-photo] img"),
]

CAPTCHA_MARKERS = ("SmartCaptcha", "Подтвердите, что запросы отправляли вы",
                   "showcaptcha", "запросы, поступившие с вашего IP-адреса")

MONTHS = {"янв": 1, "фев": 2, "мар": 3, "апр": 4, "мая": 5, "май": 5, "июн": 6,
          "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12}


def looks_like_captcha(html):
    return any(m in html for m in CAPTCHA_MARKERS)


def soup_of(html):
    from bs4 import BeautifulSoup
    return BeautifulSoup(html, "html.parser")


def clean(text):
    text = re.sub(r"[ \t ]+", " ", (text or "")).strip()
    # «Читать далее» остаётся в тексте отдельной строкой — он тут лишний
    text = re.sub(r"\s*Читать далее\s*$", "", text)
    return re.sub(r"\n{3,}", "\n\n", text)


def title_of(text):
    """Заголовок карточки — первая осмысленная строка новости."""
    for line in (text or "").split("\n"):
        line = line.strip(" .!—-")
        if len(line) > 3:
            return (line[:70] + "…") if len(line) > 72 else line
    return "Новость салона"


def date_key(text):
    """Для сортировки: «3 июня, 09:02» → (месяц, день, время)."""
    m = re.search(r"(\d{1,2})\s+([а-яё]{3})", (text or "").lower())
    if not m:
        return (0, 0)
    return (MONTHS.get(m.group(2), 0), int(m.group(1)))


def parse_posts(html):
    if looks_like_captcha(html):
        print("Яндекс показал капчу — данные не тронуты.", file=sys.stderr)
        return []

    soup = soup_of(html)
    for card_sel, date_sel, text_sel, photo_sel in CANDIDATES:
        cards = soup.select(card_sel)
        items = []
        for card in cards:
            text = clean(card.select_one(text_sel).get_text("\n")) if card.select_one(text_sel) else ""
            if not text:
                continue
            photos = []
            for img in card.select(photo_sel):
                src = img.get("src") or img.get("data-src") or ""
                if src.startswith("//"):
                    src = "https:" + src
                if src.startswith("http"):
                    photos.append(src)
            d = card.select_one(date_sel)
            items.append({
                "title": title_of(text),
                "date": clean(d.get_text(" ")) if d else "",
                "text": text,
                "photos": photos[:1],          # на карточку хватает одной картинки
            })
        if items:
            return items
    return []


def download_photos(items, out_dir):
    """Картинки складываем рядом с сайтом: чужие ссылки живут недолго."""
    import urllib.request
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)
    for it in items:
        local = []
        for src in it.get("photos", []):
            name = hashlib.sha1(src.encode("utf-8")).hexdigest()[:16] + ".jpg"
            path = os.path.join(out_dir, name)
            rel = "data/posts/" + name
            if os.path.exists(path):
                local.append(rel)
                continue
            # В ленте картинки отдаются в размере L (500 px) — для слайдера мелко.
            # У Яндекса тот же файл доступен крупнее: пробуем от большего к меньшему.
            data = None
            for size in ("XXXL", "XXL", "L"):
                url = re.sub(r"/[A-Za-z]+$", "/" + size, src)
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=25) as resp:
                        data = resp.read()
                    if len(data) > 400:
                        break
                    data = None
                except Exception as exc:       # noqa: BLE001 — размер может отсутствовать
                    print("размер %s не отдался (%s)" % (size, exc), file=sys.stderr)
            if data:
                with open(path, "wb") as f:
                    f.write(data)
                local.append(rel)
        it["photos"] = local


def diagnose(html):
    soup = soup_of(html)
    seen = {}
    for el in soup.find_all(True):
        for cls in (el.get("class") or []):
            if re.search(r"post|news", cls, re.I):
                seen[cls] = seen.get(cls, 0) + 1
    print("классы со словом post/news:", file=sys.stderr)
    for cls, n in sorted(seen.items(), key=lambda kv: -kv[1])[:25]:
        print("  %-52s %d" % (cls, n), file=sys.stderr)


def fetch_browser(url):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH") or None,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        ctx = browser.new_context(locale="ru-RU", timezone_id="Europe/Moscow",
                                  viewport={"width": 1280, "height": 1600}, user_agent=UA)
        page = ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)

        seen = -1
        for _ in range(25):                    # лента догружается прокруткой
            count = page.evaluate("document.querySelectorAll('[class*=post-view]').length")
            if count == seen:
                break
            seen = count
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(900)

        # Кликать «Читать далее» нельзя: Яндекс уводит на страницу одного
        # поста и лента пропадает. Полный текст и так лежит в разметке —
        # он лишь визуально обрезан стилями.
        html = page.content()
        browser.close()
    return html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", help="разобрать сохранённый HTML вместо запроса к Яндексу")
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    if args.html:
        with open(args.html, encoding="utf-8") as f:
            html = f.read()
        source = "файл " + args.html
    else:
        try:
            html = fetch_browser(POSTS_URL)
            source = "страница новостей"
        except Exception as exc:               # noqa: BLE001 — причина уходит в лог
            print("страница новостей: не получилось (%s)" % exc, file=sys.stderr)
            return 1

    items = parse_posts(html)
    print("%s: распознано новостей — %d" % (source, len(items)), file=sys.stderr)
    if not items:
        if args.debug:
            diagnose(html)
        print("Новости не распознаны — файл не переписан.", file=sys.stderr)
        return 1

    items.sort(key=lambda i: date_key(i.get("date")), reverse=True)
    items = items[: args.limit]
    out = os.path.normpath(OUT)
    download_photos(items, os.path.join(os.path.dirname(out), "posts"))

    payload = {
        "source": "Яндекс Карты",
        "org_url": POSTS_URL,
        "updated": date.today().strftime("%d.%m.%Y"),
        "items": items,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Сохранено новостей: %d -> %s" % (len(items), out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
