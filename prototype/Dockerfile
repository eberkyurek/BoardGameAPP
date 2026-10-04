# Ek paket yok: yalnızca Node.js'in kendi modülleri kullanılır.
FROM node:22-slim

WORKDIR /app
COPY . .

# Sunucu maç kayıtlarını data/ klasörüne yazar; yetkisiz bir kullanıcıyla çalışır.
RUN chown -R node /app
USER node

ENV PORT=8000 \
    NODE_ENV=production
EXPOSE 8000

CMD ["node", "server.js"]
