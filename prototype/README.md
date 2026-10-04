# Tahmin Oyunu — Prototip

Oyun akışını denemek için hazırlanmış, hesapsız çalışan prototip. Buradaki teknoloji nihai teknoloji kararı değildir; kurallar `../tahmin-oyunu-uygulama-plani.md` dosyasındaki kararları izler.

## Çalıştırma

Ek kurulum gerekmez; macOS ile gelen Python yeterli.

```sh
python3 server.py
```

Tarayıcıda `http://localhost:8000` adresini aç. İki oyunculu denemek için ikinci bir sekme veya gizli pencere kullan.

Aynı Wi-Fi ağındaki bir telefon veya başka bir bilgisayarla oynamak için:

```sh
HOST=0.0.0.0 python3 server.py
```

Sunucu açılırken diğer cihazların kullanacağı adresi yazar.

## Neler var

- **Hızlı maç:** Çevrim içi bekleyen biri varsa onunla, 8 saniye içinde kimse çıkmazsa önceki bir oyuncunun kaydıyla, kayıt da yoksa botla eşleşir.
- **Oda kur / Katıl:** Dört karakterlik oda koduyla arkadaşla maç.
- **Sorular:** 195 ülke üzerinden nüfus, yüzölçümü ve millî gelir; her soruda 2–5 cevap ve dolgu cevapları engelleyen alt sınır.
- **Kurallar:** 120 saniye, kilitleme, iki taraf kilitleyince erken sonuç, 1 / 0,5 / 0 puan, 5 soru, en çok 10 uzatma sorusu, ardından yazı tura.
- **Yazım düzeltme:** `almnya` → Almanya gibi hatalar kendiliğinden düzeltilir; belirsiz yazımlarda (`kongo`, `kore`) adaylar gösterilir.

## Bilinçli olarak eksik bırakılanlar

Hesap, kalıcı puan, derece, liderlik tablosu, İngilizce arayüz ve yönetim ekranları yok. Bağlantısı 20 saniye kesilen oyuncu maçı kaybetmiş sayılır. Sunucu yeniden başlatılınca süren maçlar silinir.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `server.py` | Web sunucusu, eşleşme, oda kodu, kayıtlar |
| `game.py` | Maç akışı: süreler, kilitleme, uzatma, yazı tura |
| `rules.py` | Soru üretimi, cevap değerlendirme, puanlama |
| `names.py` | Ad eşleştirme ve yazım düzeltme |
| `static/` | Tarayıcı arayüzü |
| `data/countries.json` | Ülke verisi |
| `data/recordings.json` | Biten maçların kayıtları (oynadıkça oluşur) |
| `tools/build_data.py` | Veriyi kaynaklardan yeniden üretir |

## Veri

Ülke listesi ve adlar Wikidata'dan (CC0), sayısal değerler Dünya Bankası Açık Veri'den (CC BY 4.0) alındı: nüfus 2025, yüzölçümü 2023, millî gelir çoğunlukla 2025. Vatikan'ın değerleri Wikidata'dandır. Bu, plandaki "1 Ocak itibarıyla yayımlanmış en güncel değer" tanımının prototip karşılığıdır; denetlenmiş bir veri sürümü değildir.

## Testler

```sh
python3 -m unittest discover -s tests
```
