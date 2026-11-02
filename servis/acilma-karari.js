/* ===========================================================================
   "Uygulamayi acmali miyim?" — saf karar (test edilebilir).

   24 EKIM, gercek olay:
     18:36:31.5  ac (home)                      <- Sade ZATEN ondeydi
     18:36:31.8  on plan -> com.webos.app.home
     18:36:31.8  LG ana ekrani -> Sade one aliniyor
     18:36:32.4  on plan -> (bos)               <- WebView kilitlendi
     18:37:03.6  on plan -> com.bilal.sade      <- 31 sn sonra kendine geldi

   Sebep: zaten on planda calisan bir web uygulamasini tekrar
   applicationManager/launch ile acmak. WAM uygulamayi YENIDEN BASLATIYOR,
   WebView kilitleniyor ve ekran bos kaliyor.

   Ayni tuzak uc yerden tetikleniyordu:
     1. HOME tusu          (Sade ondeyken basilirsa)
     2. uyanma algilama    (2.5 sn arayla 3 kez -- Quick Start+ ile uyandiginda
                            Sade zaten onde oldugu icin HER uyanmada)
     3. LG ana ekranina tepki  (burada Sade onde degil, sorunsuz)

   Kural: on plani GUVENILIR sekilde biliyorsak ve zaten bizim uygulamamizsa
   dokunma. Bilmiyorsak (izleyici dusmusse) eski davranisa don -- HOME'un
   hic calismamasindansa fazladan bir launch yeg.
   =========================================================================== */
'use strict';

/* durum = { izleyiciCanli: bool, onPlan: string|null, uygulama: string } */
function acilmaliMi(durum) {
  if (!durum || !durum.uygulama) return true;
  if (!durum.izleyiciCanli) return true;      /* on plani bilmiyoruz */
  if (typeof durum.onPlan !== 'string') return true;
  return durum.onPlan !== durum.uygulama;
}

module.exports = acilmaliMi;
