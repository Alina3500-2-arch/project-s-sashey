#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Забирает отзывы о салоне с Яндекса в site/diana/data/reviews.json.

Зачем: на сайте отзывы отрисованы своей вёрсткой (см. diana.js), а не
iframe-виджетом Яндекса — виджет блокируется и тянет чужой дизайн.

Источник данных — страница виджета отзывов
(`yandex.ru/maps-reviews-widget/?id=...`). Она отдаётся обычным HTML,
без JS-приложения, поэтому парсится надёжнее самой карты. Если она
недоступна, есть запасной путь через браузер по странице организации.

Публичного API отзывов у Яндекса нет, поэтому здесь разбор вёрстки.
Вёрстка меняется — на этот случай:
  * селекторы собраны в CANDIDATES: несколько наборов, пробуем по очереди;
  * при неудаче `--debug` печатает в лог структуру страницы, чтобы
    подобрать новые селекторы, не гадая;
  * скрипт НИКОГДА не затирает существующий JSON пустотой — при провале
    выходит с кодом 1, прошлые отзывы остаются на сайте.

Запуск:
    python3 scripts/fetch_yandex_reviews.py --debug
    python3 scripts/fetch_yandex_reviews.py --html сохранённая-страница.html
"""

import argparse
import json
import os
import re
import sys
from datetime import date

ORG_ID = "64270712446"
ORG_URL = "https://yandex.ru/maps/org/perfect_ton/%s/reviews/" % ORG_ID
WIDGET_URL = "https://yandex.ru/maps-reviews-widget/?id=%s" % ORG_ID
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "diana", "data", "reviews.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# Наборы селекторов: (карточка, автор, дата, текст, звезда). Пробуем по порядку —
# первый, который дал отзывы, и выигрывает.
CANDIDATES = [
    # страница виджета отзывов
    (".comment", ".comment__author-name", ".comment__date", ".comment__text",
     ".stars-list__star._active"),
    (".mv-review", ".mv-review__author", ".mv-review__date", ".mv-review__text",
     ".mv-review__star._full"),
    # страница организации на Картах
    (".business-reviews-card-view__review", ".business-review-view__author-name",
     ".business-review-view__date", ".business-review-view__body-text",
     ".business-rating-badge-view__star._full"),
    (".business-review-view", ".business-review-view__author-name",
     ".business-review-view__date", ".spoiler-view__text-container",
     ".business-rating-badge-view__star._full"),
]

CAPTCHA_MARKERS = ("SmartCaptcha", "Подтвердите, что запросы отправляли вы",
                   "showcaptcha", "запросы, поступившие с вашего IP-адреса")


def looks_like_captcha(html):
    return any(m in html for m in CAPTCHA_MARKERS)


def soup_of(html):
    from bs4 import BeautifulSoup
    return BeautifulSoup(html, "html.parser")


def parse_reviews(html):
    """Пробует наборы селекторов, возвращает (отзывы, рейтинг, количество)."""
    soup = soup_of(html)

    best = []
    for card_sel, author_sel, date_sel, text_sel, star_sel in CANDIDATES:
        items = []
        for card in soup.select(card_sel):
            text_el = card.select_one(text_sel)
            text = text_el.get_text(" ", strip=True) if text_el else ""
            if len(text) < 10:
                continue
            author_el = card.select_one(author_sel)
            date_el = card.select_one(date_sel)
            items.append({
                "author": author_el.get_text(strip=True) if author_el else "Гость",
                "date": date_el.get_text(strip=True) if date_el else "",
                "rating": len(card.select(star_sel)) or None,
                "text": text,
            })
        if len(items) > len(best):
            best = items

    rating, count = None, None
    m = re.search(r'"ratingValue"\s*:\s*"?([\d.,]+)', html)
    if m:
        rating = float(m.group(1).replace(",", "."))
    m = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
    if m:
        count = int(m.group(1))
    if rating is None:
        el = soup.select_one(".rating__value, .business-summary-rating-badge-view__rating-text")
        if el:
            m = re.search(r"[\d,.]+", el.get_text())
            if m:
                rating = float(m.group(0).replace(",", "."))

    return best, rating, count


def diagnose(html):
    """Печатает структуру страницы, чтобы подобрать селекторы по факту."""
    print("--- ДИАГНОСТИКА СТРАНИЦЫ ---", file=sys.stderr)
    print("длина HTML: %d символов" % len(html), file=sys.stderr)
    print("капча: %s" % ("ДА" if looks_like_captcha(html) else "нет"), file=sys.stderr)

    soup = soup_of(html)
    title = soup.title.get_text(strip=True) if soup.title else "—"
    print("title: %s" % title, file=sys.stderr)

    # Элементы с длинным русским текстом — почти наверняка тела отзывов.
    seen = {}
    for tag in soup.find_all(True):
        if tag.find(True):                       # только листья
            continue
        txt = tag.get_text(" ", strip=True)
        if len(txt) < 60 or not re.search(r"[а-яё]", txt, re.I):
            continue
        cls = " ".join(tag.get("class") or []) or "(без class)"
        seen.setdefault(cls, []).append(txt[:90])

    print("кандидаты в текст отзыва (класс → сколько → пример):", file=sys.stderr)
    for cls, samples in sorted(seen.items(), key=lambda kv: -len(kv[1]))[:12]:
        print("  %-55s %3d  %s" % (cls[:55], len(samples), samples[0]), file=sys.stderr)

    # Часто повторяющиеся классы — каркас карточек.
    counts = {}
    for tag in soup.find_all(True):
        for cls in tag.get("class") or []:
            counts[cls] = counts.get(cls, 0) + 1
    repeated = [(c, n) for c, n in counts.items() if 3 <= n <= 80]
    print("часто повторяющиеся классы:", file=sys.stderr)
    for cls, n in sorted(repeated, key=lambda kv: -kv[1])[:20]:
        print("  %-55s %3d" % (cls[:55], n), file=sys.stderr)
    print("--- КОНЕЦ ДИАГНОСТИКИ ---", file=sys.stderr)


def fetch_widget():
    """Страница виджета: обычный HTML, браузер не нужен."""
    import urllib.request
    req = urllib.request.Request(WIDGET_URL, headers={
        "User-Agent": UA,
        "Accept-Language": "ru-RU,ru;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
    })
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_browser(url):
    """Запасной путь: полноценный браузер со скроллом ленты."""
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
        for _ in range(25):                       # лента догружается при прокрутке
            count = page.evaluate("document.querySelectorAll('[class*=review]').length")
            if count == seen:
                break
            seen = count
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(900)
        # Длинные отзывы Яндекс прячет под «Ещё» — раскрываем, иначе текст
        # приедет обрезанным на ~300 символах.
        for _ in range(3):
            opened = page.evaluate("""() => {
              const words = ['ещё', 'еще', 'читать целиком', 'развернуть'];
              let n = 0;
              document.querySelectorAll('a, span, div, button').forEach(el => {
                if (el.children.length) return;
                const t = (el.textContent || '').trim().toLowerCase();
                if (words.includes(t)) { el.click(); n++; }
              });
              return n;
            }""")
            if not opened:
                break
            page.wait_for_timeout(700)

        html = page.content()
        browser.close()
    return html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", help="разобрать сохранённый HTML вместо запроса к Яндексу")
    ap.add_argument("--limit", type=int, default=24)
    ap.add_argument("--debug", action="store_true", help="печатать структуру страницы при неудаче")
    args = ap.parse_args()

    sources = []
    if args.html:
        with open(args.html, encoding="utf-8") as f:
            sources.append(("файл " + args.html, f.read()))
    else:
        for name, getter in (("виджет отзывов", fetch_widget),
                             ("страница организации", lambda: fetch_browser(ORG_URL))):
            try:
                sources.append((name, getter()))
            except Exception as exc:              # noqa: BLE001 — причина уходит в лог
                print("%s: не получилось (%s)" % (name, exc), file=sys.stderr)

    if not sources:
        print("Ни один источник не ответил. Прошлые данные не тронуты.", file=sys.stderr)
        return 1

    for name, html in sources:
        items, rating, count = parse_reviews(html)
        print("%s: распознано отзывов — %d" % (name, len(items)), file=sys.stderr)
        if items:
            payload = {
                "source": "Яндекс Карты",
                "org_url": ORG_URL,
                "updated": date.today().strftime("%d.%m.%Y"),
                "rating": rating,
                "count": count,
                "items": items[: args.limit],
            }
            path = os.path.normpath(OUT)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print("Сохранено отзывов: %d → %s" % (len(payload["items"]), path))
            return 0
        if args.debug:
            print("\n>>> источник: %s" % name, file=sys.stderr)
            diagnose(html)

    print("Отзывы не распознаны — файл не переписан, прошлые данные на месте.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
