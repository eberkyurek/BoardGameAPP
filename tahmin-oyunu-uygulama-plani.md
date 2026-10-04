# 2 Takımlı Tahmin Oyunu — Uygulama Planı Taslağı

**Son güncelleme:** 4 Ekim 2026  
**Durum:** Karar toplama ve planlama aşaması. 16–23 numaralı sorular yanıtlandı, plan yeniden değerlendirildi (8. bölüm). Geliştirme başlamadı.  
**Belgenin kapsamı:** Şu ana kadar onaylanan gereksinimler, önerilen uygulama aşamaları, açık kararlar ve öngörülen sorunlar.

> Bu belge tamamlanmış bir teknik şartname değildir. Kullanıcının talebi doğrultusunda açık kararlar sorulmadan kesinleştirilmeyecek. Öneriler, onaylanmış kararlar olarak değerlendirilmeyecek.

## 1. Ürün fikri ve hedef

Oyuncular, verilen sayısal hedefe yaklaşmak için bir veya birden fazla isim yazar. Sistem, cevapların veri setindeki sayısal değerlerini toplar ve hedefe en yakın tarafı belirler. Tek bir doğru cevap listesi yoktur; karşılaştırma aynı veri sürümü ve kurallarla yapılır.

Örnek soru fikirleri:

- Nüfuslarının toplamı 400 milyon olan 5 ülke söyleyin.
- Spotify'daki aylık dinleyici veya dinlenme toplamı belirli bir hedefe yaklaşan 5 sanatçı ya da grup söyleyin.

Bu örnekler henüz yayımlanacak soru havuzu değildir. Özellikle müzik örneğinde kullanılacak ölçütün aylık dinleyici mi, dinlenme sayısı mı olduğu ve veriye nasıl ulaşılacağı henüz kararlaştırılmadı.

## 2. Onaylanan ürün gereksinimleri

### Platform ve dil

- İlk sürüm web üzerinden çalışacak.
- Gelecekte web, Android ve iOS uygulamaları aynı sistemde birlikte çalışabilmeli ve oyuncular birbiriyle karşılaşabilmeli.
- İlk aşamada Türkçeye odaklanılacak; sistem İngilizce desteğine de hazırlanacak.
- Teknoloji yığını, barındırma hizmeti ve mobil uygulama geliştirme yöntemi henüz seçilmedi.

### Hesaplar, profiller ve eşleşme

- Hesap oluşturma, giriş yapma ve kişisel profile erişme bulunacak.
- Giriş yöntemleri: Google ile giriş, e-postaya gelen tek kullanımlık kod ve Meta hesabı ile giriş. E-posta + şifre olmayacak.
- Apple ile giriş mobil sürüme geçildiğinde eklenecek; ilk sürümde öncelik değil.
- Rakipler kullanıcı adı, avatar, derece, oynanan maç ve galibiyet sayısını görebilecek; e-posta hesap sahibine özel kalacak.
- Avatar için hazır karakterler sunulacak, isteyen oyuncu kendi görselini yükleyebilecek.
- Hesaplı oyuncular için kalıcı puan ve derecelendirme kavramları olacak; hesaplama yöntemleri henüz belirlenmedi.
- Hesaplı oyuncuların rastgele maçları da arkadaş maçları da dereceyi etkileyecek. Ayrı bir derecesiz rastgele maç türü olmayacak.
- Oyuncular rastgele rakiplerle veya istedikleri arkadaşlarıyla oynayabilecek.
- Arkadaşla oynama ilk sürümde özel oda bağlantısı veya oda kodu paylaşılarak yapılacak. Arkadaş listesi ve çevrim içi durum sonraki sürümlere kalacak.
- Misafir olarak oyun oynanabilecek.
- Misafirler ve hesaplı oyuncular aynı havuzda eşleşecek ve birbirleriyle oynayabilecek.
- Misafirin puanları uygulamayı kapattığında silinecek; hesaplı oyuncunun puanı saklanacak ve liderlik tablosu gibi özelliklerde kullanılacak.
- Eşleşmede öncelik çevrim içi oyuncularda olacak. Çevrim içi rakip bulunamazsa, aynı soruları daha önce oynamış bir oyuncunun kaydı rakip olarak kullanılacak; bot hesaplar da kullanılabilecek.
- Hesaplı oyuncunun misafire, kayda veya bota karşı oynadığı maçlar da kalıcı puanını ve derecesini etkileyecek.
- Oyuncuya rakibinin kayıt veya bot olduğu gösterilmeyecek.
- Kayıt maçlarında rakibin kilitleme ve sonraki soruya geçme zamanları kayıttaki sürelerden alınacak.
- Derece, bakarak cevap verme engellenemeyeceği için ciddi bir rekabet ölçütü olarak konumlanmayacak.
- Misafir maçlarına ait teknik kayıtların saklanma kapsamı ve süresi henüz belirlenmedi.

### Kategoriler ve sorular

- Sorular kategori ve etiketlerle yönetilebilecek.
- Örnek kategoriler: Genel, popüler kültür, müzik, coğrafya, spor ve sinema.
- Prototipte yalnızca **Genel** kategorisi kullanılacak.
- Arka planda hangi sorunun hangi alanla ilişkili olduğu izlenebilmeli.
- İlk veri seti, soru havuzunun büyüklüğü ve soru seçme yöntemi henüz belirlenmedi.

### Tasarım yaklaşımı

- Arayüz ciddi bir üslupta olmayacak; eğlenceli bir tasarım dili kullanılacak.
- Referans palet: [Coolors renk paleti](https://coolors.co/palette/61a0af-96c9dc-f06c9b-f9b9b7-f5d491).
- Palet renkleri: `#61A0AF`, `#96C9DC`, `#F06C9B`, `#F9B9B7`, `#F5D491`.
- Renklerin arayüzdeki görevleri ve hiyerarşisi henüz belirlenmedi.

## 3. Kesinleşen oyun kararları

| Konu | Onaylanan karar |
|---|---|
| Takım büyüklüğü | Oyun 1'e 1 oynanacak. |
| Normal maç uzunluğu | Her normal maç 5 sorudan oluşacak. |
| Maç beraberliği | Beş soru sonunda skor eşitse, beraberlik bozulana kadar ek soru gelecek. 10 ek sorudan sonra hâlâ eşitse kazanan yazı turayla belirlenecek; rastgele seçilen bir oyuncu yazı veya tura seçecek. |
| Cevap sayısı | Soruya göre değişebilecek; çoklu cevaplar öncelikli olacak. |
| Cevap girişi | Her cevap için ayrı metin kutusu bulunacak. |
| Süre | Sorudaki bütün kutular için toplam 120 saniye verilecek. Süre web ve mobilde bütün oyuncular için aynı olacak. |
| Yetki | Süre, puan ve veri değerleri sunucu tarafından yönetilecek. |
| Dolgu cevaplar | Sorular alt sınır içerecek (ör. “nüfusu en az 1 milyon olan”); sınırın altındaki veya geçerli varlık listesinde bulunmayan cevap geçersiz sayılacak. |
| Yakınlık | Hedefin altında ve üstünde kalmak eşit değerlendirilecek. |
| Soru galibiyeti | Kazanan 1, kaybeden 0 puan alacak. |
| Eşit uzaklık | Geçerli listeler eşit uzaklıktaysa iki taraf da 0,5 puan alacak. |
| Eksik veya geçersiz liste | İlgili oyuncu 0 puan alacak. Rakibin listesi geçerliyse rakip doğrudan 1 puan alacak; iki liste de geçersizse ikisi de 0 alacak. |
| Sürenin dolması | Kilitlenmemiş cevaplar süre sonunda kutulardaki hâliyle otomatik kilitlenip değerlendirilecek. |
| Tanınamayan metin | Hiçbir kayda bağlanamayan ve aday seçilmeyen cevap geçersiz sayılacak; oyuncuya süre bitmeden uyarı gösterilecek. |
| Tekrarlanan cevap | Aynı oyuncunun aynı ismi kendi listesinde tekrar kullanması engellenecek. |
| Gizlilik | Oyuncular cevaplama aşamasında rakibin cevaplarını göremeyecek. |
| Kilitleme | “Cevabı kilitle” seçeneği bulunacak; kilitleme sonrasında cevaplar düzenlenemeyecek. |
| Erken sonuç | İki taraf da kilitlediğinde kalan süre beklenmeden cevaplar açılacak. |
| Sonuç içeriği | Her ismin sayısal değeri, listenin toplamı ve hedeften uzaklığı gösterilecek. |
| Sorular arası geçiş | Sonuç ekranından sonraki soruya 30 saniye sonunda otomatik geçilecek. |
| Erken geçiş | İki oyuncu da “Sıradaki soru” dediğinde 30 saniyenin bitmesi beklenmeyecek. |

### Yakınlık hesabı

Geçerli cevap listeleri için:

```text
Liste toplamı = Cevapların sayısal değerlerinin toplamı
Hedeften uzaklık = |Liste toplamı - Hedef değer|
```

Hedeften uzaklığı daha küçük olan taraf soruyu kazanır. Örneğin 400 milyonluk hedefte 390 milyon ve 410 milyon eşit uzaklıktadır.

Eksik veya geçersiz liste 0 puan alır. Rakibin listesi geçerliyse rakip, hedeften uzaklığına bakılmaksızın 1 puan alır.

### Temel maç akışı

1. Oyuncular eşleşir.
2. Soru ve istenen sayıda cevap kutusu gösterilir.
3. Bütün cevaplar için toplam 120 saniyelik süre işler.
4. Oyuncular cevaplarını yazabilir, düzeltme adaylarını seçebilir ve cevaplarını kilitleyebilir.
5. İki taraf da kilitlerse sonuç hemen açılır.
6. Sonuç ekranında cevap değerleri, toplamlar, uzaklıklar ve soru puanları gösterilir.
7. Sonraki soru varsa 30 saniye sonunda veya iki taraf da hazır olduğunda ilerlenir.
8. Beş sorunun ardından eşitlik varsa ek sorularla devam edilir; eşitlik bozulduğunda maç sona erer. 10 ek soru da eşit biterse rastgele seçilen bir oyuncu yazı veya tura seçer ve kazananı yazı tura belirler.

Süre dolduğunda kilitlenmemiş cevaplar otomatik kilitlenir. Bağlantı kopması ve hareketsizlik durumları sonraki karar aşamasında netleştirilecek.

## 4. Yazım düzeltmesi ve cevap tanıma

### Kullanıcının belirlediği davranış

- Öncelik, sistemin yazım farklılıklarını kendi kendine otomatik düzeltmesidir; oyuncu aday seçmese de `ramstein` doğru sanatçıya bağlanmalıdır.
- Adaylar kullanıcıya gösterilir. Aday listesinin ipucu vermesi kabul edildi.
- Kullanıcı bir aday seçerse, seçtiği aday cevap olarak kabul edilir.
- Kullanıcı seçim yapmazsa sistem yazılan metni kendisi düzeltir; düzeltemezse cevap geçersiz sayılır.
- Düzeltme ve aday seçimi, mevcut 120 saniyelik süre içinde yapılır.
- Hiçbir kayda bağlanamayan metin korunur ama cevap geçersiz sayılır; oyuncuya süre bitmeden uyarı gösterilir.

Örnek ihtiyaçlar:

- `pink` yazımının `P!nk` olarak anlaşılabilmesi.
- `ramstein` yazımının `Rammstein` olarak anlaşılabilmesi.
- Aynı ismin farklı yazımlarının tekrar kontrolünde ele alınması.

### Henüz kararlaştırılmayan ayrıntılar

- Otomatik düzeltmenin hangi eşleşmelerde uygulanacağı.
- Belirsiz isimlerde kullanıcı seçim yapmazsa izlenecek kesin davranış.
- Düzeltmenin hangi aşamada tetikleneceği ve adayların nasıl sıralanacağı.
- Türkçe ve İngilizce adlar, alternatif isimler, noktalama ve özel karakterlerin işlenmesi.
- Kullanılacak teknik yöntem: sözlük, alternatif adlar, benzerlik hesabı veya bir model kullanımı henüz seçilmedi.

**Temel risk:** Bir metni kabul etmek, o metne hesaplanabilir bir değer bulunabildiği anlamına gelmez. Yanlış ülke veya sanatçıyla eşleştirme oyuncunun cevabını istemeden değiştirebilir.

## 5. Veri ve kaynak yönetimi

### Onaylanan yaklaşım

- Oyuncuların soru kaynaklarını görmesi gerekmiyor.
- Veri setinin kaynakları yönetim tarafında net ve izlenebilir olacak.
- Kaynaklar güncellenebilir ve değiştirilebilir olacak.
- Güvenilirlik sıralaması veri alanına göre tanımlanacak.
- Veriler kontrol edilerek yayımlanacak.
- Başlamış bir maç boyunca kullanılan veri sürümü sabit kalacak.
- Yeni sürüm yayımlanması geçmiş maçların sonucunu değiştirmeyecek.

### Veri kaynağı, tarihi ve kapsamı

- Lisans sorunu olan platform verileri yerine Wikipedia gibi açık kaynaklar kullanılacak.
- Veri tarihi, içinde bulunulan yılın 1 Ocak'ı olacak (2026 için 1 Ocak 2026). Kaynak tam o günün değerini vermiyorsa 1 Ocak itibarıyla yayımlanmış en güncel değer kullanılacak. Yıl değiştiğinde veri güncellenecek.
- “Ülke” tanımı BM'nin 193 üye devleti ile iki gözlemci devleti (Filistin ve Vatikan) kapsayacak; toplam 195 ülke. KKTC, Kosova ve Tayvan kapsam dışında.
- Açık kaynaklarda güncel ve eksiksiz bulunmayan ölçütler (ör. takipçi, dinleyici) kategori bazında kontrol edilecek; bu, kullanılabilecek kategorileri sınırlayabilir.
- Soru havuzu, soruları şablonlardan üreten bir soru yazma motoruyla oluşturulacak.

### Kaynak sıralaması için önerilen ayrıntılı çerçeve

Alan bazlı sıralama ilkesi kabul edildi. Aşağıdaki kaynak türleri, gerçek kaynaklar seçilirken değerlendirilecek çerçevedir:

| Öncelik | Kaynak türü | Önerilen kullanım |
|---|---|---|
| 1 | Veriyi üreten kurum veya ilgili platformun doğrudan verisi | Öncelikli kaynak |
| 2 | Kaynaklarını ve yöntemini açıklayan güvenilir derleme | Birincil kaynak uygun değilse alternatif |
| 3 | Kaynak gösteren ve editoryal denetimi olan referans | İnceleme ve onay sonrasında kullanım |
| Kapsam dışı önerisi | Kaynağı belirsiz listeler ve doğrulanmamış yapay zekâ çıktıları | Sayısal cevap verisi olarak kullanılmaması |

Kaynağın güvenilirliğine ek olarak, aynı sorudaki verilerin tarih, kapsam ve ölçüm tanımı açısından uyumu kontrol edilmeli. Somut kaynaklar, güncelleme sıklıkları ve kullanım koşulları henüz değerlendirilmedi.

### Önerilen yayın akışı

```text
Yeni veri veya kaynak → Taslak → Kontrol ve onay → Yeni sürümün yayımlanması
```

Bu akışı destekleyen yönetim ekranları, veri alanları, roller ve otomasyon düzeyi henüz kararlaştırılmadı.

## 6. Önerilen uygulama aşamaları

Bu tablo geliştirme sırasının taslağıdır. Süre, bütçe, teknoloji ve ayrıntılı kabul koşulları henüz kesinleştirilmedi.

| Aşama | Hedef | Beklenen sonuç |
|---|---|---|
| 1. Oyun kuralları | Puan, süre, cevap doğrulama ve istisnaları netleştirmek | Aynı girdilere her zaman aynı sonucu veren oyun kuralları |
| 2. Hesap ve eşleşme | Kayıt, profil, misafirlik ve arkadaşla oynama akışını belirlemek | Oyuncunun nasıl maça gireceğinin açık olması |
| 3. Soru ve veri yönetimi | İlk soru havuzunu, kaynakları ve yönetim araçlarını belirlemek | Kontrol edilmiş, güncellenebilir oyun içeriği |
| 4. Ekranlar ve tasarım | Ana sayfa, oyun, sonuç ve profil ekranlarını tasarlamak | Eğlenceli ve tutarlı kullanıcı deneyimi |
| 5. Teknik mimari | Web ve gelecekteki mobil uygulamalar için ortak sistemi belirlemek | Hesap, eşleşme, oyun ve verinin nasıl birlikte çalışacağının tanımlanması |
| 6. Geliştirme ve doğrulama | Prototipten oynanabilir ilk sürüme ilerlemek | Oyun akışının ve hata senaryolarının test edilmesi |
| 7. Yayın ve işletim | Barındırma, maliyet, izleme, yedekleme ve destek süreçlerini belirlemek | Gerçek oyuncularla işletilebilen ilk sürüm |

## 7. Yanıtlanan sorular: 16–23

Bu sorular 4 Ekim 2026'da yanıtlandı. Kararlar 2., 3. ve 4. bölümlere işlendi.

| No | Konu | Karar |
|---|---|---|
| 16 | Geçersiz listeye karşı puan | Geçerli listeye sahip oyuncu doğrudan 1 puan alır. İki liste de geçersizse ikisi de 0 alır. |
| 17 | Sürenin dolması | Kutulardaki mevcut cevaplar otomatik kilitlenip değerlendirilir. Eksik veya geçersiz liste yine 0 puan alır. |
| 18 | Tanınamayan metin | Yazılan metin korunur ama cevap geçersiz sayılır; oyuncuya süre bitmeden uyarı gösterilir. |
| 19 | Kayıt ve giriş | Google ile giriş, e-postaya tek kullanımlık kod ve Meta hesabı ile giriş. Apple ile giriş mobil sürümde eklenecek. |
| 20 | Profilin görünürlüğü | Önerilen kapsam kabul edildi. Avatar için hem hazır karakterler hem görsel yükleme olacak. |
| 21 | Maç türleri | Arkadaş maçları da dereceyi etkileyecek. Derecesiz rastgele maç olmayacak. |
| 22 | Arkadaşla oynama | Oda bağlantısı veya oda kodu. Arkadaş listesi ilk sürümde yok. |
| 23 | Hesaplı oyuncu ile misafir arkadaş | Geçersiz kaldı: misafir ve hesaplı havuzları birleştirildiği için ayrı bir “Misafir olarak oyna” seçeneğine gerek yok (bkz. 8. bölüm). |

### Bu kararlardan doğan açık noktalar

- **Meta ile giriş (19):** Meta'nın tüketici uygulamaları için sunduğu giriş ürünü Facebook Login'dir. Instagram ve WhatsApp hesabıyla doğrudan oturum açma seçeneğinin bulunup bulunmadığı teknik mimari aşamasında doğrulanacak.
- **Apple ile giriş (19):** App Store kuralları, üçüncü taraf girişi sunan iOS uygulamalarında eşdeğer bir seçenek olarak Apple ile girişi isteyebilir. iOS sürümü planlanırken zorunluluk olarak ele alınacak.
- **Dereceli arkadaş maçları (21):** Anlaşmalı maçlarla derece şişirmeye açık. Önlemler (aynı rakiple tekrar eden maçların etkisinin azaltılması gibi) derecelendirme yöntemiyle birlikte kararlaştırılacak.
- **Görsel yükleme (20):** Depolama, boyutlandırma ve uygunsuz içerik denetimi gerektirir; yöntemi güvenlik ve yönetim araçları başlıklarında belirlenecek.

## 8. Yeniden değerlendirme: 4 Ekim 2026

Plan, eksikler ve sonradan sorun yaratabilecek konular açısından gözden geçirildi. Kararlar ilgili bölümlere işlendi.

| Konu | Karar |
|---|---|
| Bakarak cevap verme | Engellenemez; derece daha az ciddiye alınacak. |
| Dolgu cevap stratejisi | Sorulara alt sınır konacak (ör. nüfusu en az 1 milyon). Aynı kural, takipçi gibi ölçütlerde tanınmayan kişilerin yazılmasını da engeller. |
| Rakip bulamama | Misafir ve hesaplı havuzları birleştirildi. Önce çevrim içi rakip, yoksa önceki bir oyuncunun kaydı veya bot. Bu maçlar da puanı etkiler; rakibin kayıt veya bot olduğu gösterilmez. |
| Erken prototip | Kabul edildi ve hazırlandı: `prototype/` klasörü (çalıştırma ve kapsam için `prototype/README.md`). Prototipte kullanılan teknoloji nihai teknoloji kararı değildir. |
| Tek hatanın soruyu kaybettirmesi | Kural korunuyor. Süre herkes için 120 saniyeye çıkarıldı. |
| Otomatik düzeltme çelişkisi | Sistem kendisi düzeltir; düzeltemezse cevap geçersiz. |
| Sonsuz uzatma | 10 ek sorudan sonra yazı tura; seçme hakkı rastgele bir oyuncuya verilir. |
| Aday listesinin ipucu vermesi | Kabul edildi. |
| Soru havuzunun ezberlenmesi | Soru yazma motoru. |
| Veri lisansı | Wikipedia gibi açık kaynaklar. Açık kaynakta bulunmayan ölçütler kategorileri sınırlayabilir. |
| Veri tarihi | İçinde bulunulan yılın 1 Ocak'ı itibarıyla yayımlanmış en güncel değer; yılda bir güncelleme. |
| “Ülke” tanımı | BM'nin 193 üye devleti ve iki gözlemci devlet (Filistin, Vatikan). |
| Sunucu otoritesi | Karar olarak kabul edildi. |
| Takım yapısı | 1'e 1. |

### Bu kararlardan doğan açık noktalar

- **Açık kaynağın kapsamı:** Wikipedia metinleri atıf ve aynı lisansla paylaşım koşuluna bağlıdır; yapılandırılmış veri için Wikidata daha uygun olabilir. Hangi kategorilerin açık kaynakla karşılanabildiği soru motoru tasarlanırken kontrol edilecek.

### Tanımlanan ama henüz çözülmeyen konular

- **KVKK ve yaş sınırı:** Aydınlatma metni, açık rıza, verinin yurt dışında barındırılması ve asgari yaş.
- **İçerik denetimi:** Yüklenen avatarların ve kullanıcı adlarının denetlenmesi.
- **Hesap birleştirme:** Aynı kişinin Google, e-posta kodu ve Meta ile girdiğinde tek hesapta toplanması.
- **Teknoloji seçiminin sırası:** Web ve mobilin ortak çalışması hedefi, bu kararın tasarım aşamasından önce verilmesini gerektirebilir.

## 9. Sonraki karar başlıkları

Aşağıdaki konular nihai uygulama planı için daha sonra birlikte ele alınacak; henüz kapsam veya yöntem seçilmedi.

- **Soru havuzu:** İlk veri alanları, soru sayısı, hedeflerin belirlenmesi, cevap sayıları, zorluk ve tekrarları önleme.
- **Cevap kapsamı:** Geçerli varlık listeleri; ülke, bölge, sanatçı ve grup tanımları; iki rakibin aynı ismi kullanması.
- **Puan ve derece:** Maç içi skor, kalıcı puan ve beceri derecesinin ilişkisi; başlangıç derecesi ve güncelleme yöntemi.
- **Eşleşme:** Rakip seçme ölçütleri, bekleme süresi, rakip bulunamaması ve davet odalarının davranışı.
- **Kesintiler:** Bağlantı kopması, yeniden bağlanma, sayfa yenileme, maçı terk etme ve hareketsizlik.
- **Yönetim araçları:** Soruların, kaynakların, veri sürümlerinin ve alternatif isimlerin yönetimi; hata bildirimleri.
- **Tasarım:** Renk hiyerarşisi, yazı tipi, karakterler, animasyonlar, sesler, küçük ekranlar ve erişilebilirlik.
- **Dil:** Türkçe ve İngilizce soru metinleri, varlık isimleri ve alternatif yazımların ilişkisi.
- **Teknik mimari:** Ortak sunucu, API, gerçek zamanlı iletişim, veri tabanı, kimlik doğrulama ve istemci sorumlulukları.
- **Güvenlik ve gizlilik:** Oturumlar, yetkiler, kötüye kullanım önlemleri, veri saklama ve hesap silme.
- **Doğrulama:** Kural testleri, eşzamanlı oyun, zamanlama, yeniden bağlanma ve mobil tarayıcı kontrolleri.
- **Yayın ve işletim:** Hedef oyuncu sayısı, bütçe, barındırma, yedekleme, izleme, destek ve yayın takvimi.

## 10. Öngörülen sorunlar ve karar ihtiyaçları

| Sorun | Olası etkisi | Durum |
|---|---|---|
| Farklı tarihlere veya tanımlara ait verilerin toplanması | Sonuçların tutarsız veya tartışmalı olması | Kaynak ve veri kontrolünün ayrıntıları belirlenecek. |
| Maç sırasında veri değişmesi | İki oyuncunun farklı verilere göre değerlendirilmesi | Maç boyunca sabit veri sürümü kabul edildi. |
| Yanlış otomatik düzeltme | Oyuncunun kastetmediği bir cevabın değerlendirilmesi | Belirsiz eşleşme kuralları netleştirilecek. |
| İsim önerilerinin cevap hatırlatması | Oyunun zorluğunun değişmesi | Aday gösterimi istendi; ayrıntılı davranışı belirlenecek. |
| Eksik listeyle hedefe daha yakın çıkılması | Az cevap yazmanın avantaj sağlaması | Eksik veya geçersiz listeye 0 puan kabul edildi. |
| Çok küçük değerli dolgu cevaplar | Çok cevaplı sorunun fiilen tek cevaplı soruya dönüşmesi | Sorulara alt sınır konması kabul edildi. |
| Bakarak cevap verme | Derecenin bilgiyi yansıtmaması | Engellenemeyeceği kabul edildi; derece daha az ciddiye alınacak. |
| Aynı varlığın farklı yazımlarla tekrar edilmesi | Aynı değerin birden fazla sayılması | Tekrar yasak; alternatif isimlerle birlikte kontrolü tasarlanacak. |
| Az oyunculu dönemde rakip bulunamaması | Bekleme süresinin artması ve oyuncu kaybı | Havuzlar birleştirildi; çevrim içi rakip yoksa kayıt veya bot kullanılacak. |
| Arkadaş maçlarıyla derece artırma | Rekabet sıralamasının kötüye kullanılması | Arkadaş maçları dereceli kabul edildi; kötüye kullanım önlemleri derecelendirme yöntemiyle birlikte belirlenecek. |
| Süre sonunda gelen veya yinelenen işlemler | Haksız puan, çift işlem veya farklı ekran durumları | Sunucunun süre ve puanı yönetmesi önerildi; mimari aşamasında kararlaştırılacak. |
| Bağlantı kopması veya maçı terk etme | Rakibin beklemesi ve maç sonucunun belirsizliği | Yeniden bağlanma ve hükmen sonuç kuralları belirlenecek. |
| İki tarafın da sürekli cevap vermemesi veya dengi oyuncuların sürekli berabere kalması | Beraberliği bozmak için sonsuz ek soru döngüsü | 10 ek sorudan sonra yazı tura kabul edildi; hareketsizlik kuralları belirlenecek. |
| Kaynak erişiminin kesilmesi veya kullanım koşullarının uygun olmaması | Veri güncellemelerinin sürdürülememesi | Somut kaynaklar seçilirken araştırılacak. |

## 11. Bir sonraki adım

16–23 numaralı sorular yanıtlandı. Sırada 8. bölümdeki açık noktalar ve 9. bölümdeki başlıklar var: soru havuzu, derecelendirme, kesinti kuralları, ekranlar ve teknik mimari kararlaştırılacak. Nihai plan; onaylanan kapsamı, aşamaların bağımlılıklarını, tamamlanma koşullarını, maliyet ve takvim değerlendirmesini içerecek.
