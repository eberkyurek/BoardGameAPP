# Ek bağımlılık yok: yalnızca Python standart kitaplığı kullanılır.
FROM python:3.12-slim

WORKDIR /app
COPY . .

# Sunucu maç kayıtlarını data/ klasörüne yazar; yetkisiz bir kullanıcıyla çalışır.
RUN useradd --create-home app && chown -R app /app
USER app

ENV HOST=0.0.0.0 \
    PORT=8000 \
    PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["python", "server.py"]
