# Cukai backend — FastAPI + receipt OCR, packaged for Render (or any Docker host).
#
# Build context is the REPO ROOT (see render.yaml: dockerContext: .), because
# backend/main.py imports the sibling `pipeline` package and both must sit
# together on the import path. Build locally with:
#
#     docker build -f backend/Dockerfile -t cukai-api .
#     docker run -p 8000:8000 --env-file backend/.env cukai-api

FROM python:3.12-slim

# Tesseract is the OCR engine behind pipeline/receipt_ocr.py (/receipts/scan).
# It is a system binary, not pip-installable — without it, receipt scanning
# 500s at runtime even though the app boots fine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Dependencies first, so a code-only change doesn't re-run pip on every deploy.
# backend/requirements.txt is a superset of pipeline/requirements.txt.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code — both packages importable from /app (see backend/main.py).
COPY backend/ ./backend/
COPY pipeline/ ./pipeline/

EXPOSE 8000

# Render injects $PORT; fall back to 8000 for a plain `docker run`.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
