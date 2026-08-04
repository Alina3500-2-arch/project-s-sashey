#!/bin/bash
# macOS: двойной клик по этому файлу заливает сайт.
cd "$(dirname "$0")/.."
python3 deploy/deploy.py
