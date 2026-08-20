#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Забирает отзывы о салоне с Яндекс Карт в site/diana/data/reviews.json.

Зачем: на сайте отзывы отрисованы своей вёрсткой (см. diana.js), а не
iframe-виджетом Яндекса — виджет блокируется и ломает дизайн. Этот скрипт
раз в сутки обновляет данные, сайт остаётся статикой.

Важно про надёжность: публичного API отзывов у Яндекса нет, поэтому здесь
разбор вёрстки страницы. Вёрстка может измениться, а на IP облачных
раннеров Яндекс часто показывает капчу. Поэтому скрипт:
  * НИКОГДА не затирает существующий JSON пустотой — при неудаче выходит
    с кодом 1 и оставляет прошлые данные;
  * умеет работать из сохранённого HTML (--html), если страницу выгрузили
    руками из браузера.

Запуск:
    python3 scripts/fetch_yandex_reviews.py
    python3 scripts/fetch_yandex_reviews.py --html saved.html
"""

import argparse
import json
import os
import re
import sys
from datetime import date

ORG_ID = "64270712446"
ORG_URL = "https://yandex.ru/maps/org/perfect_ton/%s/reviews/" % ORG_ID
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "diana", "data", "reviews.json")

# Селекторы вёрстки Яндекс Карт. Самое хрупкое место — при поломке
# правим здесь, остальной код трогать не нужно.
SEL_CARD = ".business-reviews-card-view__review"
SEL_AUTHOR = ".business-review-view__author-name"
SEL_DATE = ".business-review-view__date"
SEL_TEXT = ".business-review-view__body-text"
SEL_STAR_FULL = ".business-rating-badge-view__star._full"
SEL_ORG_RATING = ".business-summary-rating-badge-view__rating-text"
SEL_ORG_COUNT = ".business-header-rating-view__text._clickable"


def looks_like_captcha(html: str) -> bool:
    markers = ("SmartCaptcha", "Подтвердите, что запросы отправляли вы",
               "showcaptcha", "Нам очень жаль, но запросы, поступившие")
    return any(m in html for m in markers)


def parse_html(html: str) -> dict:
    """Разбор сохранённой страницы без браузера (BeautifulSoup)."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    items = []
    for card in soup.select(SEL_CARD):
        text_el = card.select_one(SEL_TEXT)
        text = text_el.get_text(" ", strip=True) if text_el else ""
        if not text:
            continue
        author_el = card.select_one(SEL_AUTHOR)
        date_el = card.select_one(SEL_DATE)
        items.append({
            "author": author_el.get_text(strip=True) if author_el else "Гость",
            "date": date_el.get_text(strip=True) if date_el else "",
            "rating": len(card.select(SEL_STAR_FULL)) or None,
            "text": text,
        })

    rating_el = soup.select_one(SEL_ORG_RATING)
    count_el = soup.select_one(SEL_ORG_COUNT)
    rating = None
    if rating_el:
        m = re.search(r"[\d,.]+", rating_el.get_text())
        if m:
            rating = float(m.group(0).replace(",", "."))
    count = None
    if count_el:
        m = re.search(r"\d+", count_el.get_text())
        if m:
            count = int(m.group(0))

    return {"items": items, "rating": rating, "count": count}


def fetch_live() -> dict:
    """Открывает страницу отзывов в headless-браузере и прокручивает ленту."""
    from playwright.sync_api import sync_playwright

    exe = os.environ.get("CHROMIUM_PATH")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=exe or None,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        ctx = browser.new_context(
            locale="ru-RU",
            timezone_id="Europe/Moscow",
            viewport={"width": 1280, "height": 1600},
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
        )
        page = ctx.new_page()
        page.goto(ORG_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3000)

        if looks_like_captcha(page.content()):
            browser.close()
            raise RuntimeError("Яндекс показал капчу — автообновление не прошло")

        try:
            page.wait_for_selector(SEL_CARD, timeout=20000)
        except Exception:
            browser.close()
            raise RuntimeError("Карточки отзывов не найдены: вероятно, изменилась вёрстка")

        # Лента подгружается по мере прокрутки — крутим, пока растёт число карточек.
        seen = -1
        for _ in range(25):
            count = page.locator(SEL_CARD).count()
            if count == seen:
                break
            seen = count
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(900)

        html = page.content()
        browser.close()
    return parse_html(html)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", help="разобрать сохранённый HTML вместо запроса к Яндексу")
    ap.add_argument("--limit", type=int, default=24, help="сколько отзывов оставить")
    args = ap.parse_args()

    try:
        if args.html:
            with open(args.html, encoding="utf-8") as f:
                data = parse_html(f.read())
        else:
            data = fetch_live()
    except Exception as exc:                       # noqa: BLE001 — причина уходит в лог
        print("Не удалось обновить отзывы: %s" % exc, file=sys.stderr)
        print("Прошлые данные оставлены без изменений.", file=sys.stderr)
        return 1

    items = data["items"][: args.limit]
    if not items:
        print("Отзывы не распознаны — файл не переписан.", file=sys.stderr)
        return 1

    payload = {
        "source": "Яндекс Карты",
        "org_url": ORG_URL,
        "updated": date.today().strftime("%d.%m.%Y"),
        "rating": data["rating"],
        "count": data["count"],
        "items": items,
    }

    path = os.path.normpath(OUT)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Сохранено отзывов: %d → %s" % (len(items), path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
