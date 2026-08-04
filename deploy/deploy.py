#!/usr/bin/env python3
"""
Заливка сайта на хостинг по FTP.

Запускается двойным кликом (deploy.command на Mac, deploy.bat на Windows)
или командой:  python3 deploy/deploy.py

Что делает по шагам:
  1. забирает свежую версию из GitHub (git pull);
  2. заливает содержимое папки site/ на хостинг;
  3. пишет, что именно отправлено.

Доступы берутся из файла deploy/.env — он в .gitignore и в репозиторий
не попадает. Образец: deploy/.env.example
"""

import ftplib
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
ENV = Path(__file__).resolve().parent / ".env"


def log(msg=""):
    print(msg, flush=True)


def read_env():
    """Читает KEY=value из deploy/.env, пропуская пустые строки и комментарии."""
    if not ENV.exists():
        log("Не найден файл с доступами: deploy/.env")
        log("Скопируйте deploy/.env.example в deploy/.env и впишите свои данные.")
        return None

    cfg = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        cfg[key.strip()] = value.strip().strip('"').strip("'")

    missing = [k for k in ("FTP_HOST", "FTP_USER", "FTP_PASS", "FTP_DIR") if not cfg.get(k)]
    if missing:
        log("В deploy/.env не хватает: " + ", ".join(missing))
        return None
    return cfg


def git_pull():
    """Подтягивает последнюю версию. Не критично: без git заливаем что есть."""
    log("1. Забираю свежую версию из GitHub…")
    try:
        r = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=ROOT, capture_output=True, text=True, timeout=90,
        )
        if r.returncode == 0:
            log("   " + (r.stdout.strip().splitlines() or ["готово"])[-1])
        else:
            log("   Пропускаю: " + (r.stderr.strip().splitlines() or ["не удалось"])[0])
            log("   Заливаю то, что сейчас лежит в папке.")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        log("   git недоступен — заливаю то, что сейчас лежит в папке.")


def collect_files():
    """Все файлы из site/, парами (локальный путь, путь на сервере)."""
    if not SITE.is_dir():
        log(f"Не найдена папка {SITE}")
        return []
    files = []
    for path in sorted(SITE.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            files.append((path, path.relative_to(SITE).as_posix()))
    return files


def ensure_dir(ftp, remote_dir):
    """Создаёт вложенные папки на сервере, если их ещё нет."""
    made = ""
    for part in remote_dir.strip("/").split("/"):
        if not part:
            continue
        made = f"{made}/{part}" if made else part
        try:
            ftp.mkd(made)
        except ftplib.error_perm:
            pass  # уже существует — это нормально


def upload(cfg, files):
    log(f"2. Подключаюсь к {cfg['FTP_HOST']}…")
    with ftplib.FTP(timeout=45) as ftp:
        ftp.connect(cfg["FTP_HOST"], int(cfg.get("FTP_PORT", 21)))
        ftp.login(cfg["FTP_USER"], cfg["FTP_PASS"])
        try:
            ftp.set_pasv(True)
        except Exception:
            pass

        target = cfg["FTP_DIR"].strip()
        try:
            ftp.cwd(target)
        except ftplib.error_perm:
            log(f"   Нет такой папки на сервере: {target}")
            log("   Проверьте FTP_DIR в deploy/.env — путь берётся из панели хостинга.")
            return False

        log(f"   Вошла, папка сайта: {ftp.pwd()}")
        log(f"3. Отправляю файлов: {len(files)}")

        total = 0
        for local, remote in files:
            if "/" in remote:
                ensure_dir(ftp, remote.rsplit("/", 1)[0])
            size = local.stat().st_size
            with local.open("rb") as fh:
                ftp.storbinary(f"STOR {remote}", fh)
            total += size
            log(f"   + {remote}  ({size // 1024} КБ)")

        log(f"   Отправлено: {total // 1024} КБ")
    return True


def main():
    log("=" * 52)
    log("  Заливка сайта на ashpartners.ru")
    log("=" * 52)

    cfg = read_env()
    if not cfg:
        return 1

    git_pull()

    files = collect_files()
    if not files:
        log("В папке site/ нечего заливать.")
        return 1

    try:
        ok = upload(cfg, files)
    except ftplib.error_perm as e:
        log(f"Хостинг отказал: {e}")
        log("Обычно это неверный логин, пароль или путь в deploy/.env.")
        return 1
    except OSError as e:
        log(f"Не получилось соединиться: {e}")
        log("Проверьте интернет и адрес FTP_HOST.")
        return 1

    if ok:
        log()
        log("Готово. Открывайте https://ashpartners.ru/")
    return 0 if ok else 1


if __name__ == "__main__":
    code = main()
    # окно не должно закрыться мгновенно при запуске двойным кликом
    if sys.stdout.isatty():
        try:
            input("\nНажмите Enter, чтобы закрыть…")
        except EOFError:
            pass
    sys.exit(code)
