/* ===========================================================================
   KISISEL AYARLAR — kurulumdan once BURAYI DUZENLE
   Yalnizca konum zorunlu; geri kalan her alan bos birakilabilir, o zaman
   Sade kendisi karar verir (asagida her alanin varsayilani yazili).
   =========================================================================== */
window.SADE_AYAR = {

  /* Hava durumu ve namaz vakitleri bu koordinattan hesaplanir.
     Kendi konumunu bul: https://www.openstreetmap.org adresinde evini
     ara, URL'deki #map=.../ENLEM/BOYLAM degerlerini al.

     NOT: Ne kadar hassas olursan tahmin o kadar isabetli olur. Sehir
     merkezi yerine kendi mahalleni kullanmak olcülebilir fark yaratiyor
     (bizde sahil/ic kesim farki gece sicakliginda 1 dereceydi). */
  enlem:  41.0082,
  boylam: 28.9784,
  sehir:  'İstanbul',

  /* Namaz vakti hesaplama yontemi (Aladhan API):
       13 = Diyanet Isleri Baskanligi (Turkiye)
       Diger ulkeler: https://aladhan.com/calculation-methods */
  namazYontemi: 13,

  /* --- Istege bagli ------------------------------------------------------ */

  /* Ana ekranin ILK acilistaki yerlesimi. Sonra Widget sekmesinden
     degistirilir ve TV'de saklanir; bu alan yalnizca ilk acilisi belirler.
     Uc bolge: sol ve sag 3'er satir, orta (saatin alti) 1 satir.
     Boylar: hava, namaz, piyasaGenis, yolGenis, durakGenis = 2 satir
     (ortaya konamaz); digerleri 1 satir. sistem (TV) de ortaya konamaz.
     Kimlikler: hava, namaz, havaKucuk, namazKucuk, piyasaGenis, piyasa,
                trafik, yolGenis, yol, durakGenis, durak, sistem, ekran,
                uyku, film, klima, camasir, buzdolabi, bulasik
     yol/durak widget'lari yalnizca servis-ayar.json'da guzergah ve
     TomTom anahtari varsa gorunur (KURULUM.md).
     Evde olmayan bir LG cihazin widget'i (ornegin klima) otomatik olarak
     ayni boydaki bir yedekle (ekran suresi / uyku / film modu) degisir.
     NOT: piyasa ve trafik Turkiye'ye ozel kaynaklardan gelir (truncgil,
     IBB); trafik yalnizca Istanbul icin anlamli.
     Bos (null) birakilirsa: */
  varsayilanYerlesim: null,   /* { sol: ['hava', 'klima'], orta: [], sag: ['namaz', 'sistem'] } */

  /* Uygulama listesi. null = TV'de yuklu olanlar kendiliginden gelir
     (kok servis kuruluysa; simgeler de TV'nin kendi simgeleri). Kendi
     listeni vermek istersen: [{ id: 'netflix', ad: 'Netflix' }, ...]
     — dock'ta gorunmesin istediklerine dock: false ekle. */
  uygulamalar: null,

  /* Ilk acilista dock'ta hangi uygulamalar, hangi sirayla (en fazla 10).
     null = bilinen listedeki dock'a uygun olanlar. Sonra Ayarlar'dan
     degistirilir. Ornek: ['youtube.leanback.v4', 'netflix', 'com.webos.app.livetv'] */
  dock: null,

  /* Tema: 'oto' (gun dogumu/batimina gore), 'gunduz' (acik) ya da
     'gece' (koyu). Denetim Merkezi'nden degistirilebilir. */
  tema: 'oto'
};
