FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
COPY agent/requirements.txt agent/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt -r agent/requirements.txt
COPY backend/ backend/
COPY agent/ agent/
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
