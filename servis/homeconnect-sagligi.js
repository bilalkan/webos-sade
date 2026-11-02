/* ===========================================================================
   homeconnect (ThinQ) sagligi — saf mantik, test edilebilir.

   24 EKIM OLAYI:
   TV'nin DHCP kirasi kaydi (.113 -> .115). homeconnect bulut oturumunu
   kaybetti ve uygulamaya BASARILI ama BOS cihaz listesi dondurmeye basladi;
   klima ve butun cihaz widget'lari ekrandan silindi. Diskteki cihaz deposu
   (/mnt/lg/user/homeconnect/repo.json) saglamdi — 4 cihaz, klima dahil.
   Yani cihazlar kaybolmamisti, servis takilmisti.

   Normalde bunu bir REBOOT cozerdi. Quick Start+ acik oldugu icin TV
   gunlerce yeniden baslamiyor, dolayisiyla takilan servis TAKILI KALIYOR.
   Elle `kill <pid>` yetti: ls-hubd onu dinamik servis olarak yeniden
   dogurdu ve baglantilar geri geldi.

   TESPIT NEDEN BOYLE:
   Servis root kabugunda calisiyor ve homeconnect root'un luna-send
   cagrilarina BOS donuyor (kimlik/ACL). Yani "liste bos mu" diye
   soramiyoruz. Olcebildigimiz sey su: takiliyken TV'nin internete giden
   KURULU (ESTABLISHED) TCP baglantisi yoktu; yeniden baslatinca geldi.
   Bu yuzden sinyal olarak WAN baglantisinin varligini kullaniyoruz.

   YANLIS POZITIFE KARSI: karar penceresi uzun, ustelik bekleme suresi var.
   Gereksiz bir yeniden baslatmanin zarari dusuk (dinamik servis, temiz
   kalkiyor) ama yine de dakikada bir tekrarlamasini istemiyoruz.
   =========================================================================== */
'use strict';

/* /proc/net/tcp adresleri kucuk-endian hex: "0100007F:8B2A" -> 127.0.0.1 */
function ipCoz(hex) {
  if (typeof hex !== 'string' || hex.length < 8) return null;
  var b = [];
  for (var i = 0; i < 4; i++) b.push(parseInt(hex.substr(i * 2, 2), 16));
  return b[3] + '.' + b[2] + '.' + b[1] + '.' + b[0];
}

/* Yerel = localhost, ozel ag, link-local, tanimsiz. Bunlar "internete
   cikabiliyoruz" kaniti SAYILMAZ. */
function yerelMi(ip) {
  if (!ip) return true;
  var p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(isNaN)) return true;
  if (p[0] === 127 || p[0] === 0 || p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  return false;
}

/* IPv6 (/proc/net/tcp6): 4 adet 32-bit kelime, her biri kucuk-endian.
   Yani adresin ILK bayti, ilk kelimenin SON hex ciftidir.
   TV'de olculdu: bulut baglantilarinin bir kismi IPv6 uzerinden (:443),
   o yuzden yalnizca IPv4'e bakmak yaniltici oluyordu. */
function altiYerelMi(hex) {
  if (typeof hex !== 'string' || hex.length !== 32) return true;
  var w1 = hex.substr(0, 8), w2 = hex.substr(8, 8), w3 = hex.substr(16, 8);
  /* ::ffff:a.b.c.d — IPv4 eslemeli, IPv4 kurallariyla degerlendir */
  if (w1 === '00000000' && w2 === '00000000' && w3.toUpperCase() === 'FFFF0000') {
    return yerelMi(ipCoz(hex.substr(24, 8)));
  }
  /* :: ve ::1 */
  if (w1 === '00000000' && w2 === '00000000' && w3 === '00000000') return true;
  var ilk = parseInt(w1.substr(6, 2), 16);
  if (ilk === 0xFE) return true;                  /* fe80:: link-local */
  if (ilk === 0xFC || ilk === 0xFD) return true;  /* fc00::/7 benzersiz yerel */
  return false;
}

/* /proc/net/tcp ve /proc/net/tcp6 metnini tarar. inodelar verilirse
   YALNIZCA o surecin soketlerine bakar; verilmezse sistem genelinde.
   Sutunlar: sl local_address rem_address st ... inode  (st "01" = ESTABLISHED) */
function wanBaglantisiVar(netTcpMetni, inodelar) {
  if (!netTcpMetni) return false;
  var satirlar = String(netTcpMetni).split('\n');
  for (var i = 0; i < satirlar.length; i++) {
    var a = satirlar[i].trim().split(/\s+/);
    if (a.length < 10) continue;
    if (a[3] !== '01') continue;                 /* ESTABLISHED degil */
    if (inodelar && !inodelar[a[9]]) continue;   /* bu surecin degil */
    var adres = (a[2] || '').split(':')[0];
    var yerel = (adres.length === 32) ? altiYerelMi(adres) : yerelMi(ipCoz(adres));
    if (!yerel) return true;
  }
  return false;
}

/* durum = { wanVar, simdi, sonIyilestirme, bekleme }
   Donus: { yap: bool, sebep: string } */
function iyilestirmeKarari(durum) {
  durum = durum || {};
  if (durum.wanVar) return { yap: false, sebep: 'wan baglantisi var' };
  if (durum.sonIyilestirme &&
      (durum.simdi - durum.sonIyilestirme) < durum.bekleme) {
    return { yap: false, sebep: 'bekleme suresinde' };
  }
  return { yap: true, sebep: 'wan baglantisi yok' };
}

module.exports = { ipCoz: ipCoz, yerelMi: yerelMi, altiYerelMi: altiYerelMi,
                   wanBaglantisiVar: wanBaglantisiVar,
                   iyilestirmeKarari: iyilestirmeKarari };
