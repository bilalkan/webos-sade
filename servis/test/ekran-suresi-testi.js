/* ekran-suresi.js birim testleri — TV gerekmez. */
'use strict';
var E = require('../ekran-suresi.js');

var gecti = 0, kaldi = 0;
function ol(ad, beklenen, gelen) {
  var a = JSON.stringify(beklenen), b = JSON.stringify(gelen);
  if (a === b) { gecti++; console.log('  OK   ' + ad); }
  else { kaldi++; console.log('  KALDI ' + ad + ' — beklenen ' + a + ', gelen ' + b); }
}

/* Yerel saatle sabit bir gun: 25 Ekim 2026 20:00 */
var T0 = new Date(2026, 9, 25, 20, 0, 0, 0).getTime();
var DK = 60000;
var GUN = E.tarih(T0);

console.log('temel sayim');
(function () {
  var s = new E.Sayac();
  s.gucDegisti('Active', T0);
  s.onplanDegisti('youtube.leanback.v4', T0);
  s.biriktir(T0 + 1 * DK);
  s.biriktir(T0 + 2 * DK);
  ol('ekran acik, 2 dk youtube -> 120 sn', 120, s.gun(GUN).toplamSn);
})();

console.log('\nekran koruyucu SAYILMAZ (olculen gercek durum)');
(function () {
  var s = new E.Sayac();
  s.gucDegisti('Active', T0);
  s.onplanDegisti('com.bilal.sade', T0);
  s.biriktir(T0 + 1 * DK);
  /* koruyucu acildi ama on plan hala Sade — tam olarak TV'de gorulen */
  s.gucDegisti('Screen Saver', T0 + 1 * DK);
  s.biriktir(T0 + 1.5 * DK);
  s.biriktir(T0 + 2 * DK);
  ol('1 dk aktif + 1 dk koruyucu -> 60 sn', 60, s.gun(GUN).toplamSn);
})();

console.log('\nbekleme / ekran kapali / bilinmeyen durum sayilmaz');
(function () {
  ['Active Standby', 'Screen Off', 'Suspend', 'BilinmeyenDurum'].forEach(function (d) {
    var s = new E.Sayac();
    s.gucDegisti(d, T0);
    s.onplanDegisti('netflix', T0);
    s.biriktir(T0 + 1 * DK);
    ol(d + ' -> 0', 0, s.gun(GUN).toplamSn);
  });
})();

console.log('\nscreensaver uygulamasi on plandaysa sayilmaz');
(function () {
  var s = new E.Sayac();
  s.gucDegisti('Active', T0);
  s.onplanDegisti('com.webos.app.screensaver', T0);
  s.biriktir(T0 + 1 * DK);
  ol('screensaver on planda -> 0', 0, s.gun(GUN).toplamSn);
})();

console.log('\ndurum degisikligi ONCEKI duruma yaziliyor');
(function () {
  var s = new E.Sayac();
  s.gucDegisti('Active', T0);
  s.onplanDegisti('youtube.leanback.v4', T0);
  /* Servis 30 sn'de bir tikliyor; testte de oyle (tek parca 3 dk'lik
     aralik 120 sn'lik "surec dondu" korumasina takilirdi). */
  for (var t = 30; t < 180; t += 30) s.biriktir(T0 + t * 1000);
  s.onplanDegisti('netflix', T0 + 3 * DK);       /* 3 dk youtube */
  for (var u = 210; u <= 300; u += 30) s.biriktir(T0 + u * 1000);   /* 2 dk netflix */
  var g = s.gun(GUN);
  ol('youtube 180 sn', 180, g.uygulamalar.filter(function (u) { return u.id === 'youtube.leanback.v4'; })[0].sn);
  ol('netflix 120 sn', 120, g.uygulamalar.filter(function (u) { return u.id === 'netflix'; })[0].sn);
  ol('siralama: en cok ustte', 'youtube.leanback.v4', g.uygulamalar[0].id);
})();

console.log('\nbosluk korumasi: surec donduysa aralik atilir');
(function () {
  var s = new E.Sayac();
  s.gucDegisti('Active', T0);
  s.onplanDegisti('youtube.leanback.v4', T0);
  s.biriktir(T0 + 30 * DK);                     /* 30 dk tek aralik — bekleme sanilir */
  ol('30 dk tek aralik -> 0', 0, s.gun(GUN).toplamSn);
  s.biriktir(T0 + 30.5 * DK);                   /* sonra normal tik */
  ol('ardindan normal 30 sn sayilir', 30, s.gun(GUN).toplamSn);
})();

console.log('\ngece yarisi iki gune bolunur');
(function () {
  var g1 = new Date(2026, 9, 25, 23, 59, 30, 0).getTime();
  var g2 = new Date(2026, 9, 26, 0, 0, 30, 0).getTime();
  var s = new E.Sayac();
  s.gucDegisti('Active', g1);
  s.onplanDegisti('netflix', g1);
  s.biriktir(g2);
  ol('25 Ekim: 30 sn', 30, s.gun(E.tarih(g1)).toplamSn);
  ol('26 Ekim: 30 sn', 30, s.gun(E.tarih(g2)).toplamSn);
})();

console.log('\nkalicilik: son 8 gun tutulur');
(function () {
  var s = new E.Sayac();
  for (var i = 1; i <= 10; i++) {
    s.veri['2026-10-' + (i < 10 ? '0' : '') + i] = { netflix: 60 };
  }
  var s2 = new E.Sayac();
  s2.iceAl(s.disaAktar());
  ol('10 gunden 8 kaldi', 8, Object.keys(s2.veri).length);
  ol('en eski atildi', false, '2026-10-01' in s2.veri);
  s2.iceAl('bozuk json{');
  ol('bozuk dosya veriyi silmez', 8, Object.keys(s2.veri).length);
})();

console.log('\nSONUC: ' + (kaldi ? kaldi + ' TEST KALDI' : 'TUM TESTLER GECTI') + ' (' + gecti + ' gecti)');
process.exit(kaldi ? 1 : 0);
