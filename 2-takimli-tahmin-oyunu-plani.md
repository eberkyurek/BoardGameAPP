# 2 Takımlı Tahmin Oyunu — Uygulama Planı

> Bu belge, ürün kararlarını ve uygulama planını netleştirmek içindir. Paylaşılan sohbetteki kullanıcı isteği doğrultusunda burada uygulama geliştirme veya teknik değişiklik yapılmamıştır. Karara bağlanmamış maddeler öneri olarak kalır.

**Kaynak sohbet:** [2 Takımlı Tahmin Oyunu Planı](https://chatgpt.com/s/cx_6ac2176b39988191a59bfaf52d230126)  
**Durum:** Planlama sürüyor; 16–23 numaralı kararlar bekleniyor.  
**Tasarım renk referansı:** [Coolors paleti](https://coolors.co/palette/61a0af-96c9dc-f06c9b-f9b9b7-f5d491)

## 1. Ürün hedefi

İki oyuncunun çevrim içi olarak aynı hedefe yönelik birden fazla yanıt verdiği, yanıtların sayısal değerlerinin toplandığı ve hedefe mutlak olarak en yakın toplamın kazandığı eğlenceli bir tahmin oyunu.

İlk sürüm web üzerinde çalışacak. İleride aynı hesaplar ve oyun sistemiyle birlikte çalışacak Android ve iOS istemcileri eklenebilmesi hedefleniyor. İlk prototipte yalnızca **Genel** kategorisi kullanılacak; veri ve soru yapısı ileride yeni kategoriler eklenmesine izin verecek.

## 2. Ürün gereksinimleri

- İlk sürümde maçlar 1’e 1 oynanır.
- Oyuncular rastgele rakiple veya davet ettikleri arkadaşlarıyla oynayabilir.
- Hesaplı oyuncular hesap oluşturabilir, giriş yapabilir, profillerini ve kalıcı istatistiklerini görebilir.
- Misafir olarak oyun oynanabilir. Misafirler yalnızca misafirlerle eşleşir; maç içi skoru görür ancak maç sonrası kalıcı puan ve derece kazanmaz.
- Ürün Türkçe ile başlayacak; içerik yapısı ileride İngilizceyi destekleyecek şekilde hazırlanır.
- Sorular kategori ve etiketlerle saklanır. Prototipte yalnızca Genel kategorisi aktiftir.
- Cevaplar metin kutularına yazılır; soru başına istenen yanıt sayısı değişebilir.
- Tasarım dili ciddi olmayan, eğlenceli bir görsel hiyerarşi kullanır ve belirtilen renk paletini referans alır.

## 3. Üzerinde uzlaşılan oyun kuralları

| Konu | Karar |
|---|---|
| Oyuncu sayısı | 1’e 1 |
| Normal maç uzunluğu | 5 soru |
| Beraberlik | Beşinci sorudan sonra skor eşitse beraberlik bozulana kadar ek soru oynanır |
| Yanıt sayısı | Soruya göre değişir; her yanıt için ayrı metin kutusu kullanılır |
| Yanıt süresi | Soru başına, bütün kutular için toplam 60 saniye |
| Yakınlık hesabı | Hedefin altı ve üstü eşit değerlendirilir; mutlak fark esas alınır |
| Soru puanı | Kazanana 1, kaybedene 0; eşit uzaklıkta iki oyuncuya da 0,5 |
| Aynı oyuncunun tekrarları | Aynı isim aynı oyuncunun listesinde tekrar kullanılamaz |
| Eksik/geçersiz liste | Geçersiz veya eksik liste 0 puan alır |
| Cevap gizliliği | Oyuncular birbirinin cevaplarını kilitleme aşamasında göremez |
| Kilitleme | “Cevabı kilitle” sonrasında oyuncu yanıtlarını değiştiremez; iki oyuncu da kilitleyince sonuç hemen açılır |
| Yazım düzeltme | Otomatik düzeltme önceliklidir. Sistem aday gösterebilir; oyuncu süre içinde aday seçebilir. Seçmezse yazdığı metin korunur ve çözümleme kuralına göre değerlendirilir |
| Sonuç ekranı | Her yanıtın sayısal değeri, liste toplamı ve hedeften uzaklık gösterilir |
| Sonraki soru | Sonuçtan sonra en geç 30 saniyede geçilir; iki oyuncu da hazır olduğunu bildirirse hemen ilerlenir |
| Veri kaynakları | Kaynaklar oyuncuya gösterilmek zorunda değildir; veri setinde izlenebilir, güncellenebilir ve değiştirilebilir olmalıdır |
| Veri güvenilirliği | Alan bazlı kaynak sıralaması, yayımdan önce kontrol/onay ve maç boyunca sabit veri sürümü kabul edildi |

### Kaynak ve veri ilkeleri

Her veri alanı için ayrı kaynak önceliği tutulur:

1. Veriyi üreten kurumun veya ilgili platformun doğrudan verisi.
2. Kaynaklarını ve yöntemini açıklayan güvenilir derleme.
3. Kaynak gösteren, editoryal denetimli referans; inceleme ve onay sonrasında.
4. Kaynağı belirsiz listeler ve doğrulanmamış yapay zekâ çıktıları sayısal cevap kaynağı olarak kullanılmaz.

Her soru için veri tanımı, birim, kapsam, tarih ve kaynak kaydı bulunmalıdır. Yeni veya değiştirilmiş veriler taslakta kontrol edilip onaylandıktan sonra yayımlanır. Devam eden maç kullandığı veri sürümüyle tamamlanır; yayımlanan güncelleme geçmiş maç sonuçlarını değiştirmez.

## 4. Cevap doğrulama ilkesi

Oyuncunun yazdığı metin ile bu metne sistemde bir sayısal değer bulunması ayrı konulardır. Tanınan alternatif adlar ve yazım varyantları aynı varlığa bağlanabilir (ör. “pink” → P!nk). Belirsiz eşleşmeler sessizce başka bir varlığa çevrilmemeli; aday gösterilirse oyuncu seçim yapabilmeli. Aday seçimi de 60 saniyelik süre içinde tamamlanır.

Tanınamayan metnin geçerliliği, uyarı davranışı ve süre dolunca nasıl sonuçlanacağı henüz karara bağlanmamıştır (Madde 18).

## 5. Hesap, profil ve maç türleri

Hesaplı oyuncu için kayıt/giriş, profil, derece ve maç istatistikleri; misafir için kalıcı kimlik ve maç sonrası puan kaydı olmaması gerekir. Rastgele dereceli maç ve arkadaşla derecesiz maç ayrımı önerilmiştir ancak henüz onaylanmamıştır. Arkadaş daveti için ilk sürümde özel oda bağlantısı/kodu yeterli olabilir; arkadaş listesi ve çevrim içi durumu kapsamı açık karardır.

## 6. Önerilen ürün ve geliştirme aşamaları

Bu sıralama plan taslağıdır; açık ürün kararları yanıtlandıktan sonra kapsam ve tamamlanma koşulları kesinleştirilecektir.

1. **Oyun kurallarını tamamlama** — puanlama, süre, cevap çözümleme ve istisnaları tek anlamlı hale getirmek. Çıktı: aynı girdiler için tutarlı sonuç veren kural seti.
2. **Hesap ve eşleşme** — kayıt/giriş, profil, misafir, rastgele eşleşme, arkadaş daveti ve maç türlerini belirlemek.
3. **Soru ve veri yönetimi** — Genel kategorisi için soru havuzu, alan bazlı kaynaklar, veri sürümleri ve içerik yayımlama sürecini belirlemek.
4. **Ekranlar ve tasarım** — giriş/ana ekran, eşleşme/lobi, cevap, sonuç ve profil akışlarını eğlenceli görsel dille tasarlamak.
5. **Teknik mimari** — web ilkesiyle başlayıp ortak API ve veri modeli üzerinden ileride Android/iOS desteğini mümkün kılmak; gerçek zamanlı maç ve sunucu otoritesini tasarlamak.
6. **Geliştirme ve doğrulama** — prototipten oynanabilir web sürümüne ilerlemek; oyun akışı, adalet ve hata durumlarını doğrulamak.
7. **Yayın ve işletim** — barındırma, maliyet, izleme, yedekleme, güvenlik ve destek süreçlerini belirlemek.

## 7. Planlama sırasında ele alınacak teknik/ürün riskleri

- **Veri tutarlılığı:** Aynı sorudaki tüm cevaplar aynı tarih, kapsam ve ölçüm tanımıyla karşılaştırılmalı.
- **Yanlış eşleştirme:** Otomatik düzeltme oyuncunun kastetmediği ülke veya sanatçıya sessizce yönlendirmemeli.
- **Geçersiz cevap avantajı:** Eksik/geçersiz listenin puanı ve geçerli rakibin karşısındaki sonucu kesin kurala bağlanmalı.
- **Çevrim içi adalet:** Süre sunucu tarafından belirlenmeli; bağlantı kopması, yenileme, geç yanıt ve terk kuralları tanımlanmalı.
- **Sonsuz ek soru:** Beraberlik uzatmaları ve iki tarafın hareketsiz kalması için bir bitiş/terk kuralı belirlenmeli.
- **Eşleşme havuzu:** Misafir ve hesaplı oyuncu havuzlarının ayrılması bekleme süresini artırabilir; hesaplı oyuncunun misafir arkadaşıyla oynama yolu açık karardır.
- **Puan ve derece:** Maç içi skor, kalıcı istatistik ve beceri derecesinin amaçları ayrılmalı; arkadaş maçlarının dereceye etkisi kararlaştırılmalı.

## 8. Yanıt bekleyen kararlar

Paylaşılan konuşmanın sonunda aşağıdaki 16–23 numaralı sorular sorulmuş, henüz kullanıcı yanıtı görünmemektedir. Öneriler onaylanmış karar değildir.

| # | Konu | Açık karar |
|---|---|---|
| 16 | Geçersiz listeye karşı puan | Bir oyuncunun listesi geçersiz, rakibin listesi geçerliyse geçerli liste sahibi doğrudan 1 puan alacak mı? İki liste de geçersizse ikisi de 0 alacak. |
| 17 | Sürenin dolması | Kilitlemeden süre biterse kutulardaki mevcut cevaplar otomatik kilitlenip değerlendirilecek mi? |
| 18 | Tanınamayan metin | Otomatik düzeltme ve aday seçimine rağmen çözümlenemeyen metin korunup geçersiz mi sayılacak; süre dolmadan uyarı gösterilecek mi? |
| 19 | Kayıt ve giriş | İlk sürümde e-posta/şifre, e-postaya tek kullanımlık kod ve/veya Google ile giriş seçeneklerinden hangileri olacak? E-posta doğrulaması zorunlu mu? |
| 20 | Profil görünürlüğü ve avatar | Rakibe kullanıcı adı, avatar, derece, maç ve galibiyet sayısı gösterilsin mi? E-posta gizli kalmalı. Avatarlar hazır karakterlerden mi seçilsin, görsel yükleme de olsun mu? |
| 21 | Maç türleri | Rastgele dereceli + arkadaşla derecesiz maç ayrımı kabul ediliyor mu? Rastgele derecesiz maç da gerekli mi? |
| 22 | Arkadaşla oynama | İlk sürümde özel oda bağlantısı/kodu yeterli mi; arkadaş ekleme/listesi ve çevrim içi durum da gerekli mi? |
| 23 | Hesaplı oyuncu ile misafir arkadaş | Hesaplı oyuncu arkadaşına katılmak için “Misafir olarak oyna” moduna geçebilsin mi, yoksa arkadaşının hesap açması mı gereksin? |

Bu kararlar yanıtlandıktan sonra soru havuzunun ilk kapsamı, derecelendirme, teknik mimari, güvenlik, maliyet, doğrulama ve yayın gereksinimleri ayrıntılandırılmalıdır.
