/* ===========================================================================
   Ekran suresi — saf mantik, test edilebilir.

   NEYI SAYIYORUZ: ekran GERCEKTEN acikken on planda duran uygulamanin
   suresini, gun gun.

   NEDEN IKI KAYNAK: yalnizca on plani izlemek yaniltir. 25 Ekim'de
   olculdu — ekran koruyucu acikken on plan uygulamasi hala com.bilal.sade
   gorunuyor. Yani tek basina on plan, kimsenin bakmadigi saatleri de
   "Sade'de gecen sure" diye yazardi. Bu yuzden guc durumu da izleniyor
   (tvpower/power/getPowerState aboneligi) ve YALNIZCA "Active" iken
   sayiliyor. "Screen Saver", bekleme, ekran kapali — hicbiri sayilmiyor.
   Bilinmeyen bir durum da sayilmiyor: emin olmadigimiz sureyi yazmaktansa
   eksik yazmak daha durust.

   ARALIK KORUMASI: iki olcum arasi 120 sn'den uzunsa o aralik atiliyor.
   Surec donduysa (TV beklemeye gecti, saat sicradi) arada ne oldugunu
   bilmiyoruz; tahmin yurutmuyoruz.

   GECE YARISI: bir aralik gece yarisini asarsa iki gune bolunuyor.
   =========================================================================== */
'use strict';

var BOSLUK_SINIRI_MS = 120000;
var SAKLA_GUN = 8;
var SAYILMAYAN = { 'com.webos.app.screensaver': true };

function tarih(an) {
  var d = new Date(an);
  var a = d.getMonth() + 1, g = d.getDate();
  return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
}

function geceYarisiSonrasi(an) {
  var d = new Date(an);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function Sayac() {
  this.veri = {};          /* { 'YYYY-MM-DD': { appId: saniye } } */
  this.guc = null;
  this.onplan = null;
  this.sonAn = null;
}

Sayac.prototype.saymaliMi = function () {
  return this.guc === 'Active' && !!this.onplan && !SAYILMAYAN[this.onplan];
};

Sayac.prototype._ekle = function (gun, id, sn) {
  if (!(sn > 0)) return;
  if (!this.veri[gun]) this.veri[gun] = {};
  this.veri[gun][id] = (this.veri[gun][id] || 0) + sn;
};

/* sonAn'dan an'a kadar gecen sureyi, SU ANKI durumla (degisiklikten
   ONCEKI durumla) biriktirir. Durum degisikliklerinden once cagrilmali. */
Sayac.prototype.biriktir = function (an) {
  var bas = this.sonAn;
  this.sonAn = an;
  if (bas === null || an <= bas) return;
  if (an - bas > BOSLUK_SINIRI_MS) return;
  if (!this.saymaliMi()) return;
  var id = this.onplan;
  while (bas < an) {
    var sinir = Math.min(an, geceYarisiSonrasi(bas));
    this._ekle(tarih(bas), id, (sinir - bas) / 1000);
    bas = sinir;
  }
};

Sayac.prototype.gucDegisti = function (durum, an) {
  this.biriktir(an);
  this.guc = durum;
};

Sayac.prototype.onplanDegisti = function (id, an) {
  this.biriktir(an);
  this.onplan = id || null;
};

/* Bir gunun ozeti: toplam ve buyukten kucuge uygulamalar (saniye, tam). */
Sayac.prototype.gun = function (gunStr) {
  var g = this.veri[gunStr] || {};
  var l = Object.keys(g).map(function (id) {
    return { id: id, sn: Math.round(g[id]) };
  }).filter(function (u) { return u.sn > 0; });
  l.sort(function (a, b) { return b.sn - a.sn; });
  var t = 0;
  l.forEach(function (u) { t += u.sn; });
  return { tarih: gunStr, toplamSn: t, uygulamalar: l };
};

/* Kalicilik: son SAKLA_GUN gunu tut, eskisini at. */
Sayac.prototype.disaAktar = function () {
  var gunler = Object.keys(this.veri).sort();
  var tut = gunler.slice(-SAKLA_GUN), out = {};
  var self = this;
  tut.forEach(function (g) { out[g] = self.veri[g]; });
  this.veri = out;
  return JSON.stringify(out);
};

Sayac.prototype.iceAl = function (metin) {
  try {
    var o = JSON.parse(metin);
    if (o && typeof o === 'object') this.veri = o;
  } catch (e) {}
};

module.exports = { Sayac: Sayac, tarih: tarih, BOSLUK_SINIRI_MS: BOSLUK_SINIRI_MS };
