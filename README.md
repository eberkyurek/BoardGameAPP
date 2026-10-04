# Tahmin Oyunu

İki oyuncunun aynı sayısal hedefe yaklaşmak için birden fazla isim yazdığı çevrim içi tahmin oyunu. Örnek: "Nüfuslarının toplamı 400 milyon olan 5 ülke yaz." Cevapların değerleri toplanır; hedefe en yakın taraf soruyu kazanır.

Proje planlama ve prototip aşamasındadır.

| İçerik | Açıklama |
|---|---|
| [tahmin-oyunu-uygulama-plani.md](tahmin-oyunu-uygulama-plani.md) | Güncel ürün kararları, açık noktalar ve uygulama aşamaları |
| [prototype/](prototype/) | Hesapsız çalışan, oynanabilir prototip |
| [2-takimli-tahmin-oyunu-plani.md](2-takimli-tahmin-oyunu-plani.md) | Planın ilk taslağı |

## Yerelde çalıştırma

Ek kurulum gerekmez; Python 3.9 veya üstü yeterli.

```sh
cd prototype
python3 server.py
```

Ardından tarayıcıda `http://localhost:8000` adresini aç.

## Canlıya alma

Prototip bir sunucu programıdır; GitHub Pages gibi yalnızca durağan dosya sunan hizmetlerde çalışmaz. Depo, GitHub'a bağlanıp sunucu çalıştırabilen hizmetler için hazırdır.

**Render ile (ücretsiz plan):**

1. [render.com](https://render.com) üzerinde GitHub hesabınla oturum aç.
2. **New → Blueprint** seç ve bu depoyu bağla.
3. Render, depodaki `render.yaml` dosyasını okuyup `tahmin-oyunu` hizmetini önerir; **Apply** ile onayla.
4. Kurulum bitince hizmet sayfasındaki `https://….onrender.com` adresi oyunun canlı adresidir.

Bundan sonra `main` dalına gönderilen her değişiklik kendiliğinden yayına alınır.

**Başka bir hizmette:** `prototype/Dockerfile` Railway, Fly.io ve Koyeb gibi Docker çalıştıran her hizmette kullanılabilir. Sunucu `PORT` ortam değişkenindeki kapıyı dinler.

### Canlı ortamda bilinmesi gerekenler

- **Tek sunucu:** Maçlar sunucunun belleğinde tutulur. Hizmet birden fazla kopya hâlinde çalıştırılmamalıdır; yoksa oyuncular farklı kopyalara düşer.
- **Uyku:** Ücretsiz planlarda hizmet bir süre kullanılmayınca uyur. İlk açılış bir dakikaya yakın sürebilir ve o sırada süren maçlar silinir.
- **Kayıtlar:** Rakip olarak kullanılan maç kayıtları sunucunun geçici diskindedir; her yeni yayında sıfırlanır. Kayıt yokken rakip bot olur.
- **Kapsam:** Hesap, kalıcı puan ve derece yoktur. Bu sürüm oyunun kendisini denemek içindir.
