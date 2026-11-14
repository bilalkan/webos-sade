/* ===========================================================================
   Sade — LG webOS ana ekran
   Eski Chromium hedefli (ES5 uyumlu yazildi). Harici kutuphane yok.
   =========================================================================== */
(function () {
  'use strict';

  /* Kuruluma ozel ayarlar: paylasilan pakette yapilandirma.js doldurur.
     Bu TV'de dosya yok; asagidaki varsayilanlar bu evin tercihleri. */
  var AYAR = (typeof window !== 'undefined' && window.SADE_AYAR) || {};

  /* Konum yapilandirma.js'ten geliyor. MAHALLE seviyesinde koordinat kullan,
     sehir merkezi degil: olcumde sehir merkezi Apple Weather'a gore her gun
     sistematik sapma veriyordu, mahalle koordinatinda sapma kendiliginden
     sifirlandi ve duzeltme katsayisina gerek kalmadi. */
  var ENLEM  = AYAR.enlem  || 41.0082;
  var BOYLAM = AYAR.boylam || 28.9784;
  var SEHIR  = AYAR.sehir  || 'İstanbul';
  var NAMAZ_YONTEMI = AYAR.namazYontemi || 13;

  /* BILINEN uygulamalar: simgeleri pakette cizili (icons/<id>.png), adlari
     elle secilmis. TV'de yuklu olmayanlar kok servis cevap verince eleniyor;
     TV'deki diger (gorunur) uygulamalar kendi simgeleriyle sona ekleniyor
     — bkz. yukluleriOku(). yapilandirma.js bu listeyi degistirebilir.
     appId'ler TV'den dogrulandi.
     NOT: com.webos.app.livemenu = "Guide" (rehber); gercek canli TV
          com.webos.app.livetv. */
  var BILINEN = [
    {id: 'youtube.leanback.v4',          ad: 'YouTube'},
    {id: 'netflix',                      ad: 'Netflix'},
    {id: 'amazon',                       ad: 'Prime Video'},
    {id: 'com.wbd.stream',               ad: 'HBO Max'},
    {id: 'com.apple.appletv',            ad: 'Apple TV'},
    {id: 'lg.exxen.com',                 ad: 'EXXEN'},
    {id: 'tabii',                        ad: 'tabii'},
    {id: 'com.ssportplus.app',           ad: 'SSportPlus'},
    {id: 'spotify-beehive',              ad: 'Spotify'},
    {id: 'com.webos.app.livetv',         ad: 'Canlı TV'},
    {id: 'com.webos.app.mediadiscovery', ad: 'Medya Oynatıcı', dock: false},
    {id: 'com.webos.app.igallery',       ad: 'Sanat Galerisi', dock: false},
    /* LG'nin kendi ana ekrani. disableHome=true oldugu icin HOME tusu
       artik oraya goturmuyor; buradan acilabilsin diye listede.
       Tepki mantigiyla cakismiyor: servis yalnizca HOME BASISIYLA acilan
       pencere varken tepki veriyor, listeden acmak pencere acmiyor. */
    {id: 'com.webos.app.home',           ad: 'LG Ana Ekran', dock: false}
  ];
  if (AYAR.uygulamalar && AYAR.uygulamalar.length) {
    BILINEN = AYAR.uygulamalar.filter(function (u) { return u && typeof u.id === 'string'; });
  }
  var UYGULAMALAR = BILINEN.slice();

  /* Dock'ta gosterilecekler (dock:false olanlar yalnizca izgarada) */
  /* Dock icerigi kullanici tarafindan duzenlenebiliyor; secim tarayicinin
     yerel deposunda (bu uygulamaya ozel). Kayit yoksa varsayilana donuyor. */
  var DOCK_ANAHTAR = 'sade.dock';
  function uygulamaBul(id) {
    for (var i = 0; i < UYGULAMALAR.length; i++) {
      if (UYGULAMALAR[i].id === id) return UYGULAMALAR[i];
    }
    return null;
  }
  /* Dock'a kac uygulama sigar — OLCULDU, keyfi degil:
       .dock max-width 1820 - padding 2x24 = 1772 px ic genislik
       .kart-dock 148 px, aralarinda margin-left 20 px
       n * 148 + (n-1) * 20 <= 1772  ->  n <= 10,67  ->  10 kart
     Varsayilan dock da tam 10 (13 uygulama, 3'u dock:false), yani dock
     zaten tavanda; bir tane eklemek tasmaya yol aciyordu.
     style.css'te bu olculer degisirse BURAYI da guncelle. */
  var DOCK_AZAMI = 10;

  function varsayilanDock() {
    if (AYAR.dock && AYAR.dock.length) {
      return AYAR.dock.filter(function (id) { return !!uygulamaBul(id); }).slice(0, DOCK_AZAMI);
    }
    return UYGULAMALAR.filter(function (u) { return u.dock !== false; })
                      .map(function (u) { return u.id; }).slice(0, DOCK_AZAMI);
  }
  function dockIdOku() {
    try {
      var v = JSON.parse(localStorage.getItem(DOCK_ANAHTAR));
      if (v && v.length) {
        /* Silinmis/bilinmeyen id'leri ele — liste bozulmus olabilir */
        var temiz = v.filter(function (id) { return !!uygulamaBul(id); });
        if (temiz.length) return temiz;
      }
    } catch (e) {}
    return varsayilanDock();
  }
  function dockIdYaz(ids) {
    try { localStorage.setItem(DOCK_ANAHTAR, JSON.stringify(ids)); }
    catch (e) { kayit('dock kaydedilemedi: ' + e.message); }
  }
  var DOCK = dockIdOku().map(uygulamaBul);

  var AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
               'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  /* menu cubugu icin kisa biçim: "23 Eki Cum 16:40" */
  var AYLAR_KISA  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  var GUNLER_KISA = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

  function $(s) { return document.querySelector(s); }
  function kayit(m) { if (window.console && console.log) console.log('[sade] ' + m); }

  /* ---------- luna ------------------------------------------------------ */
  function luna(uri, params, geri) {
    try {
      if (typeof PalmServiceBridge !== 'function') { kayit('PalmServiceBridge yok'); return; }
      var k = new PalmServiceBridge();
      k.onservicecallback = function (m) {
        if (!geri) return;
        try { geri(JSON.parse(m)); } catch (e) { geri(null); }
      };
      k.call(uri, JSON.stringify(params || {}));
    } catch (e) { kayit('luna hatasi: ' + e.message); }
  }

  function uygulamaAc(id) {
    kayit('aciliyor: ' + id);
    luna('luna://com.webos.applicationManager/launch', {id: id}, function (y) {
      if (y && y.returnValue === false) kayit('acilamadi: ' + id + ' ' + (y.errorText || ''));
    });
  }

  /* ---------- teshis (tarayici fikri icin motor surumu) ----------------- */
  function teshis() {
    var ua = navigator.userAgent || '';
    var kr = /Chrome\/(\d+)/.exec(ua);
    var y = {
      chromium: kr ? kr[1] : '?',
      flexGap: (function () {
        // flex gap destegi: eski motorlarda yok, tasarimda margin kullaniyoruz
        var d = document.createElement('div');
        d.style.display = 'flex'; d.style.gap = '1px';
        return d.style.gap === '1px';
      })(),
      fetch: typeof fetch === 'function',
      grid: !!(window.CSS && CSS.supports && CSS.supports('display', 'grid'))
    };
    kayit('UA: ' + ua);
    kayit('yetenek: ' + JSON.stringify(y));
    try { localStorage.setItem('sade.teshis', JSON.stringify({ua: ua, y: y})); } catch (e) {}
  }

  /* ---------- ortak: zaman yardimcilari --------------------------------- */
  function ikiHane(n) { return (n < 10 ? '0' : '') + n; }
  function dk(hhmm) {
    var p = /(\d{1,2}):(\d{2})/.exec(hhmm || '');
    return p ? (+p[1]) * 60 + (+p[2]) : null;
  }
  /* sureMetni(sn) asagida (sistem bolumu). Burada bir de dakika alan ayni
     adli fonksiyon vardi; ayni kapsamda sonraki tanim oncekini eziyordu ve
     Cihazlar sayfasi dakikayi saniye sanip 1 sa 14 dk'yi "1 dk" yaziyordu. */

  /* ---------- hava durumu (Open-Meteo, anahtarsiz) ---------------------- */
  var WMO = {
    0:'Açık', 1:'Çoğunlukla açık', 2:'Parçalı bulutlu', 3:'Kapalı',
    45:'Sisli', 48:'Kırağılı sis',
    51:'Hafif çiseleme', 53:'Çiseleme', 55:'Yoğun çiseleme',
    61:'Hafif yağmur', 63:'Yağmurlu', 65:'Kuvvetli yağmur',
    66:'Dondurucu yağmur', 67:'Dondurucu yağmur',
    71:'Hafif kar', 73:'Kar yağışlı', 75:'Yoğun kar', 77:'Kar taneleri',
    80:'Sağanak', 81:'Sağanak yağış', 82:'Kuvvetli sağanak',
    85:'Kar sağanağı', 86:'Yoğun kar sağanağı',
    95:'Gök gürültülü', 96:'Dolu ve fırtına', 99:'Şiddetli fırtına'
  };
  function havaSinifi(k) {
    if (k === 0 || k === 1) return 'gunes';
    if (k === 2) return 'parcali';
    if (k === 3 || k === 45 || k === 48) return 'bulut';
    if ((k >= 71 && k <= 77) || k === 85 || k === 86) return 'kar';
    if (k >= 95) return 'firtina';
    return 'yagmur';
  }

  /* Apple tarzi hava ikonlari: dolu sekiller, degrade bulut, altin gunes,
     mavi damlalar. Ince cizgi ikonlar kucuk boyutta cansiz duruyordu. */
  var ikonSayac = 0;
  var NS = 'http://www.w3.org/2000/svg';

  var RENK = {
    gunes1: '#FFD426', gunes2: '#FFA90A',
    /* acik zeminde gorunur kalmasi icin bulut beyaz degil mavi-gri */
    bulut1: '#DCE6F2', bulut2: '#9FB0C6',
    damla1: '#5AC8FA', damla2: '#0A84FF',
    kar:    '#BFDFFF',
    simsek: '#FFC107'
  };

  /* gece temasinda zemin koyu; bulut aciliyor */
  function bulutTonu() {
    var gece = document.body.className.indexOf('gece') >= 0;
    return gece ? ['#F2F6FB', '#AFBECE'] : [RENK.bulut1, RENK.bulut2];
  }

  function el(ana, tip, ozel) {
    var e = document.createElementNS(NS, tip);
    for (var k in ozel) e.setAttribute(k, ozel[k]);
    ana.appendChild(e);
    return e;
  }

  function degrade(defs, id, r1, r2, x1, y1, x2, y2) {
    var g = el(defs, 'linearGradient', {
      id: id, x1: x1, y1: y1, x2: x2, y2: y2, gradientUnits: 'userSpaceOnUse'
    });
    el(g, 'stop', {offset: '0',  'stop-color': r1});
    el(g, 'stop', {offset: '1',  'stop-color': r2});
    return 'url(#' + id + ')';
  }

  function bulutSekli(ana, dolgu) {
    el(ana, 'circle', {cx: 23,   cy: 34, r: 11,   fill: dolgu});
    el(ana, 'circle', {cx: 33.5, cy: 26, r: 14,   fill: dolgu});
    el(ana, 'circle', {cx: 44,   cy: 34, r: 10.5, fill: dolgu});
    el(ana, 'rect',   {x: 23, y: 34, width: 21, height: 11, rx: 5, fill: dolgu});
  }

  function gunesCiz(ana, dolgu, cx, cy, r, i1, i2, kalin) {
    el(ana, 'circle', {cx: cx, cy: cy, r: r, fill: dolgu});
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + Math.PI / 8;
      el(ana, 'line', {
        x1: cx + Math.cos(a) * i1, y1: cy + Math.sin(a) * i1,
        x2: cx + Math.cos(a) * i2, y2: cy + Math.sin(a) * i2,
        stroke: dolgu, 'stroke-width': kalin, 'stroke-linecap': 'round'
      });
    }
  }

  function ikonCiz(svg, tur) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var n = ++ikonSayac;
    var defs = el(svg, 'defs', {});
    var gD = degrade(defs, 'g' + n, RENK.gunes1, RENK.gunes2, 20, 14, 46, 44);
    var bt = bulutTonu();
    var bD = degrade(defs, 'b' + n, bt[0], bt[1], 32, 12, 32, 46);
    var dD = degrade(defs, 'd' + n, RENK.damla1, RENK.damla2, 32, 50, 32, 62);

    function bulut(kaydir) {
      var g = el(svg, 'g', kaydir ? {transform: kaydir} : {});
      bulutSekli(g, bD);
      return g;
    }
    function damlalar(renk) {
      [23, 32.5, 42].forEach(function (x, i) {
        el(svg, 'line', {
          x1: x, y1: 50 + (i === 1 ? 2 : 0), x2: x - 4, y2: 59 + (i === 1 ? 2 : 0),
          stroke: renk, 'stroke-width': 4.2, 'stroke-linecap': 'round'
        });
      });
    }

    if (tur === 'gunes') {
      gunesCiz(svg, gD, 32, 32, 12.5, 18, 24.5, 4.4);

    } else if (tur === 'gece_acik') {
      el(svg, 'path', {
        d: 'M50 40A22 22 0 0 1 24 14 22 22 0 1 0 50 40Z',
        fill: degrade(defs, 'ga' + n, '#BFD0E6', '#7C91AE', 18, 10, 48, 50)
      });

    } else if (tur === 'gece_parcali') {
      el(svg, 'path', {
        d: 'M44 28A16 16 0 0 1 25 9 16 16 0 1 0 44 28Z',
        fill: degrade(defs, 'gp' + n, '#BFD0E6', '#7C91AE', 14, 6, 40, 34)
      });
      bulut('translate(2,6) scale(0.9)');

    } else if (tur === 'parcali') {
      gunesCiz(svg, gD, 23.5, 21, 9.5, 14, 19, 3.8);
      bulut('translate(3,4) scale(0.94)');

    } else if (tur === 'bulut') {
      bulut(null);

    } else if (tur === 'yagmur') {
      bulut('translate(0,-3) scale(0.94)');
      damlalar(dD);

    } else if (tur === 'kar') {
      bulut('translate(0,-3) scale(0.94)');
      [23, 32.5, 42].forEach(function (x, i) {
        el(svg, 'circle', {cx: x, cy: 53 + (i === 1 ? 2 : 0), r: 3, fill: RENK.kar});
      });

    } else {  /* firtina */
      bulut('translate(0,-4) scale(0.92)');
      el(svg, 'path', {
        d: 'M34 43l-10 13h7l-3 10 12-15h-7l5-8z',
        fill: RENK.simsek
      });
    }
  }

  function ss(iso) {
    var p = /T(\d{2}):(\d{2})/.exec(iso || '');
    return p ? p[1] + ':' + p[2] : '--:--';
  }

  var gunes = {dogus: null, batis: null};

  /* =======================================================================
     Hava: Apple'in kendi kaynak listesindeki modelleri (ECMWF, DWD/ICON,
     Meteo-France, UK Met Office, NOAA/GFS) ayni anda cekip ORTALAMASINI
     aliyoruz. Olcumde tek tek modeller Apple'dan sapiyordu ama harman
     neredeyse birebir tutuyor — Apple da birden cok kaynagi harmanliyor.
     ======================================================================= */
  /* Apple Weather ile 10 gunluk karsilastirma, uygulamanin kendi
     koordinatinda olculdu (mahalle seviyesi):
       5 model ortalamasi  0.534°   <- en iyisi
       ukmo tek 0.80 · mf tek 0.89 · gfs tek 0.91 · ecmwf tek 0.93 · icon tek 1.01
     Tek bir model hicbir zaman harmani gecemedi, hepsi kalsin. */
  var MODELLER = ['ecmwf_ifs025', 'icon_seamless', 'meteofrance_seamless',
                  'ukmo_seamless', 'gfs_seamless'];


  /* ortalama bulut + yagis olasiligindan Turkce durum ve ikon turet */
  function durumCoz(bulut, yagis, gece) {
    if (yagis >= 50) return ['Yağmurlu', 'yagmur'];
    if (yagis >= 30) return ['Hafif yağmur', 'yagmur'];
    if (bulut >= 85) return ['Kapalı', 'bulut'];
    if (bulut >= 55) return ['Çok bulutlu', 'bulut'];
    if (bulut >= 25) return ['Parçalı bulutlu', gece ? 'gece_parcali' : 'parcali'];
    if (bulut >= 10) return ['Az bulutlu',      gece ? 'gece_parcali' : 'parcali'];
    return ['Açık', gece ? 'gece_acik' : 'gunes'];
  }

  /* bir saat icin tum modellerin ortalamasi (bos degerler atlanir) */
  function ortalama(h, alan, i) {
    var top = 0, n = 0;
    for (var m = 0; m < MODELLER.length; m++) {
      var dizi = h[alan + '_' + MODELLER[m]];
      if (!dizi) continue;
      var v = dizi[i];
      if (v === null || v === undefined) continue;
      top += v; n++;
    }
    return n ? top / n : null;
  }

  function geceMi(d) {
    var dk2 = d.getHours() * 60 + d.getMinutes();
    var dg = null, bt = null;
    if (vakitler) {
      vakitler.forEach(function (v) {
        if (v.ad === 'Güneş') dg = v.dakika;
        if (v.ad === 'Akşam') bt = v.dakika;
      });
    }
    if (dg === null || bt === null) return d.getHours() < 7 || d.getHours() >= 19;
    return dk2 < dg || dk2 >= bt;
  }

  /* ---------- hava: onbellek + yedek kaynak (2.20.0) ----------------------
     Acilista ag gec gelince ya da Open-Meteo cevap vermeyince hava kutusu
     gizli kaliyordu ve sonraki deneme 15 dk sonraydi. Artik:
     - her basarili saatlik dizi yerel depoya yaziliyor; acilista once o
       ciziliyor (48 saatlik tahmin ertesi gun bile "su an"i kapsiyor),
     - Open-Meteo dusurse MET Norway (api.met.no: anahtarsiz, CORS acik;
       tvOS Launcher'in yedek sirasi) deneniyor,
     - ikisi de dusurse 30 sn / 2 dk / 5 dk arayla yeniden deneniyor. */
  var HAVA_ANAHTAR = 'sade.hava';
  var HAVA_TEKRAR = [30, 120, 300];
  var havaDeneme = 0, havaZaman = null, havaAn = 0;

  function havaOnbellekYaz(h, kaynak) {
    try {
      localStorage.setItem(HAVA_ANAHTAR, JSON.stringify(
        {yer: ENLEM + ',' + BOYLAM, an: Date.now(), kaynak: kaynak, h: h}));
    } catch (e) {}
  }
  function havaOnbellekOku() {
    try {
      var o = JSON.parse(localStorage.getItem(HAVA_ANAHTAR) || 'null');
      if (o && o.yer === ENLEM + ',' + BOYLAM && o.h && o.h.time) return o;
    } catch (e) {}
    return null;
  }

  /* MET Norway compact -> Open-Meteo bicimi (tek "model" olarak MODELLER[0]
     adiyla; ortalama() eksik modelleri zaten atliyor). Saatler UTC geliyor,
     yerel saate ceviriyoruz. Yagis olasiligi yok; sonraki saatin yagis
     miktarindan kaba bir olasilik turetiyoruz (0,5 mm+ = 60, 0,1 mm+ = 35). */
  function metCevir(v) {
    var ts = v && v.properties && v.properties.timeseries;
    if (!ts || !ts.length) return null;
    var M = MODELLER[0], h = {time: []};
    var sic = h['temperature_2m_' + M] = [];
    var bul = h['cloud_cover_' + M] = [];
    var yag = h['precipitation_probability_' + M] = [];
    for (var i = 0; i < ts.length && h.time.length < 48; i++) {
      var dt = ts[i].data || {}, bir = dt.next_1_hours;
      if (!bir) break;                   // saatlik bolum bitti, 6 saatlik basliyor
      var d = new Date(ts[i].time);
      if (isNaN(d.getTime())) continue;
      var an = (dt.instant && dt.instant.details) || {};
      var mm = (bir.details && bir.details.precipitation_amount) || 0;
      h.time.push(d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' +
                  ikiHane(d.getDate()) + 'T' + ikiHane(d.getHours()) + ':00');
      sic.push(typeof an.air_temperature === 'number' ? an.air_temperature : null);
      bul.push(typeof an.cloud_area_fraction === 'number' ? an.cloud_area_fraction : null);
      yag.push(mm >= 0.5 ? 60 : mm >= 0.1 ? 35 : 0);
    }
    return h.time.length ? h : null;
  }

  function havaDurumu() {
    if (havaZaman) { clearTimeout(havaZaman); havaZaman = null; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ENLEM +
              '&longitude=' + BOYLAM +
              '&hourly=temperature_2m,cloud_cover,precipitation_probability' +
              '&models=' + MODELLER.join(',') +
              '&timezone=auto&forecast_days=2';
    function geldi(h, kaynak) {
      havaDeneme = 0; havaAn = Date.now();
      havaOnbellekYaz(h, kaynak);
      havaCiz(h, kaynak);
    }
    function ikisiDeYok() {
      var sn = HAVA_TEKRAR[Math.min(havaDeneme, HAVA_TEKRAR.length - 1)];
      havaDeneme++;
      kayit('hava: ' + sn + ' sn sonra yeniden denenecek (' + havaDeneme + ')');
      havaZaman = setTimeout(havaDurumu, sn * 1000);
    }
    istek(url, function (v) {
      var h = v && v.hourly;
      if (!h || !h.time) { metDene(); return; }
      geldi(h, 'harman');
    }, 'hava', metDene, true);

    function metDene() {
      kayit('hava: Open-Meteo yok, MET Norway deneniyor');
      istek('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' +
            (+ENLEM).toFixed(4) + '&lon=' + (+BOYLAM).toFixed(4), function (v) {
        var h = metCevir(v);
        if (!h) { ikisiDeYok(); return; }
        geldi(h, 'MET');
      }, 'hava', ikisiDeYok);
    }
  }

  /* Onbellekten cizim: "su an"in saati dizide yoksa (cok eski) cizmez. */
  function havaOnbellektenCiz() {
    var o = havaOnbellekOku();
    if (!o) return false;
    var ok = havaCiz(o.h, o.kaynak + ', önbellek ' +
                     Math.round((Date.now() - o.an) / 60000) + ' dk', true);
    return ok;
  }

  function havaCiz(h, kaynak, onbellekten) {
    var simdi = new Date();
    var bugun = simdi.getDate();

    /* saat etiketleri yerel ("2026-10-23T16:00"); saati metinden okuyoruz
       ki motorun ISO ayristirma davranisina bagli kalmayalim */
    function saatiAl(t) { return parseInt(t.slice(11, 13), 10); }
    function gunuAl(t)  { return parseInt(t.slice(8, 10), 10); }

    /* --- su an --- */
    var simdiIdx = -1;
    for (var i = 0; i < h.time.length; i++) {
      if (gunuAl(h.time[i]) === bugun && saatiAl(h.time[i]) === simdi.getHours()) {
        simdiIdx = i; break;
      }
    }
    if (simdiIdx < 0) {
      if (onbellekten) return false;
      simdiIdx = 0;
    }

    var sic = ortalama(h, 'temperature_2m', simdiIdx);
    if (sic === null) return false;
    var bul = ortalama(h, 'cloud_cover', simdiIdx);
    var yag = ortalama(h, 'precipitation_probability', simdiIdx) || 0;
    var coz = durumCoz(bul, yag, geceMi(simdi));

    $('#hava-derece').textContent = Math.round(sic) + '°';
    $('#hava-durum').textContent  = coz[0];
    $('#hava-sehir').textContent  = SEHIR;
    var ey = $('#ezan-yer'); if (ey) ey.textContent = SEHIR;
    ikonCiz($('#hava-ikon'), coz[1]);

    var mbi = $('#mb-ikon'), mbd = $('#mb-derece'), mbh = $('#mb-hava');
    if (mbi) ikonCiz(mbi, coz[1]);
    if (mbd) mbd.textContent = Math.round(sic) + '°';
    if (mbh) mbh.hidden = false;

    /* --- bugunun en yuksek / dusuk --- */
    var enY = null, enD = null;
    for (var j = 0; j < h.time.length; j++) {
      if (gunuAl(h.time[j]) !== bugun) continue;
      var o = ortalama(h, 'temperature_2m', j);
      if (o === null) continue;
      if (enY === null || o > enY) enY = o;
      if (enD === null || o < enD) enD = o;
    }
    if (enY !== null) {
      $('#hava-yuksek').textContent = '↑ ' + Math.round(enY) + '°';
      $('#hava-dusuk').textContent  = '↓ ' + Math.round(enD) + '°';
    }

    /* --- sonraki 6 saat (ilk 3'u kucuk widget'ta da) --- */
    var kucukSaatler = [];
    var kap = $('#saatlik');
    while (kap.firstChild) kap.removeChild(kap.firstChild);
    var say = 0;
    for (var k = simdiIdx + 1; k < h.time.length && say < 6; k++) {
      var s2 = ortalama(h, 'temperature_2m', k);
      if (s2 === null) continue;
      var b2 = ortalama(h, 'cloud_cover', k);
      var y2 = ortalama(h, 'precipitation_probability', k) || 0;
      var sa = saatiAl(h.time[k]);
      var gc = new Date(simdi.getTime());
      gc.setHours(sa, 0, 0, 0);
      var c2 = durumCoz(b2, y2, geceMi(gc));

      var hucre = document.createElement('div');
      hucre.className = 'sa';
      var us = document.createElement('div');
      us.className = 'sa-saat';
      us.textContent = ikiHane(sa) + ':00';
      var ik = document.createElementNS(NS, 'svg');
      ik.setAttribute('viewBox', '0 0 64 64');
      ik.setAttribute('class', 'sa-ikon');
      ikonCiz(ik, c2[1]);
      var dr = document.createElement('div');
      dr.className = 'sa-derece';
      dr.textContent = Math.round(s2) + '°';
      hucre.appendChild(us); hucre.appendChild(ik); hucre.appendChild(dr);
      kap.appendChild(hucre);
      if (kucukSaatler.length < 3) kucukSaatler.push({ sa: sa, ikon: c2[1], d: Math.round(s2) });
      say++;
    }
    havaKucukCiz(Math.round(sic), coz, enY, enD, kucukSaatler);

    $('#hava-panel').hidden = false;
    kayit('hava (' + kaynak + '): ' + Math.round(sic) + '° bulut%' + Math.round(bul));
    return true;
  }

  /* HAVA 3x1: simge + buyuk derece | durum, sehir ve en yuksek/dusuk | sonraki 3 saat */
  function havaKucukCiz(sic, coz, enY, enD, saatler) {
    var w = $('#hava-kucuk-widget');
    if (!w) return;
    ikonCiz($('#hk-ikon'), coz[1]);
    $('#hk-derece').textContent = sic + '°';
    $('#hk-durum').textContent = coz[0];
    $('#hk-alt').textContent = SEHIR + (enY !== null ? '  ↑' + Math.round(enY) + '°  ↓' + Math.round(enD) + '°' : '');
    var kap = $('#hk-saatler');
    while (kap.firstChild) kap.removeChild(kap.firstChild);
    saatler.forEach(function (s) {
      var h = document.createElement('div'); h.className = 'hk-saat';
      var a = document.createElement('div'); a.className = 's'; a.textContent = ikiHane(s.sa);
      var ik = document.createElementNS(NS, 'svg'); ik.setAttribute('viewBox', '0 0 64 64'); ikonCiz(ik, s.ikon);
      var d = document.createElement('div'); d.className = 'd'; d.textContent = s.d + '°';
      h.appendChild(a); h.appendChild(ik); h.appendChild(d);
      kap.appendChild(h);
    });
    w.hidden = false;
  }

  /* namaz vakti ikonlari */
  function vakitIkonu(svg, tur) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var n = ++ikonSayac;
    var defs = el(svg, 'defs', {});
    var gD = degrade(defs, 'vg' + n, RENK.gunes1, RENK.gunes2, 20, 14, 46, 46);
    var mD = degrade(defs, 'vm' + n, '#9FB4CC', '#6B7F99', 20, 12, 46, 50);

    function ufuk() {
      el(svg, 'line', {x1: 8, y1: 48, x2: 56, y2: 48,
        stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .45});
    }
    function ok(yukari) {
      var y1 = yukari ? 22 : 12, y2 = yukari ? 10 : 24;
      el(svg, 'line', {x1: 32, y1: y1, x2: 32, y2: y2,
        stroke: gD, 'stroke-width': 4, 'stroke-linecap': 'round'});
      var uc = yukari ? y2 : y2;
      var d = yukari ? 1 : -1;
      el(svg, 'line', {x1: 32, y1: uc, x2: 26, y2: uc + 6 * d,
        stroke: gD, 'stroke-width': 4, 'stroke-linecap': 'round'});
      el(svg, 'line', {x1: 32, y1: uc, x2: 38, y2: uc + 6 * d,
        stroke: gD, 'stroke-width': 4, 'stroke-linecap': 'round'});
    }
    function hilal(cx, cy, r) {
      el(svg, 'path', {
        d: 'M' + (cx + r * 0.62) + ' ' + (cy + r * 0.62) +
           'A' + r + ' ' + r + ' 0 0 1 ' + (cx - r * 0.22) + ' ' + (cy - r * 0.86) +
           'A' + r + ' ' + r + ' 0 1 0 ' + (cx + r * 0.62) + ' ' + (cy + r * 0.62) + 'Z',
        fill: mD
      });
    }

    if (tur === 'hilal') {
      hilal(32, 32, 20);

    } else if (tur === 'gece') {
      hilal(30, 34, 18);
      el(svg, 'circle', {cx: 50, cy: 16, r: 2.8, fill: gD});
      el(svg, 'circle', {cx: 43, cy: 26, r: 1.9, fill: gD});

    } else if (tur === 'gunes') {
      gunesCiz(svg, gD, 32, 32, 12, 17.5, 24, 4.2);

    } else if (tur === 'ikindi') {
      gunesCiz(svg, gD, 32, 28, 10.5, 15.5, 21, 3.8);
      ufuk();

    } else {                         /* dogus | batis */
      el(svg, 'path', {
        d: 'M14 44a18 18 0 0 1 36 0z', fill: gD
      });
      ufuk();
      ok(tur === 'dogus');
    }
  }

  /* ---------- ezan vakitleri (Aladhan, Diyanet metodu) ------------------ */
  var VAKIT_ADI = [
    ['Imsak',   'İmsak',  'hilal'],
    ['Sunrise', 'Güneş',  'dogus'],
    ['Dhuhr',   'Öğle',   'gunes'],
    ['Asr',     'İkindi', 'ikindi'],
    ['Maghrib', 'Akşam',  'batis'],
    ['Isha',    'Yatsı',  'gece']
  ];
  var HICRI_AY = ['Muharrem','Safer','Rebiülevvel','Rebiülahir','Cemaziyelevvel',
                  'Cemaziyelahir','Recep','Şaban','Ramazan','Şevval','Zilkade','Zilhicce'];
  var vakitler = null;   // [{ad, saat, dakika, ikon}]
  var hicriKisa = '';

  /* 31 EKIM: TV'de namaz paneli bos kaldi. Acilistaki tek istek "ag"
     hatasi verdi ve bir sonraki deneme 6 saat sonraydi. Artik basarisiz
     istek 30 sn, 2 dk, 5 dk, sonra 15 dk arayla yeniden deneniyor.
     Ayrica Aladhan tarihsiz adresi 302 ile /timings/GG-AA-YYYY'ye
     yonlendiriyor; tarihli adresi dogrudan cagirip o adimi atliyoruz. */
  var ezanDeneme = 0, ezanZaman = null;
  var EZAN_TEKRAR = [30, 120, 300, 900];

  /* 2.20.0: AYLIK ONBELLEK. Vakitler her gun agdan cekiliyordu; acilista ag
     gec gelince ya da Aladhan cevap vermeyince panel 30 sn - 15 dk bos
     kaliyordu. Diyanet vakitleri bir kez hesaplaninca degismiyor, o yuzden
     Aladhan'in aylik takvimini (tek istek, ~40 KB, sade hali ~3 KB) yerel
     depoya yaziyoruz: ay icinde ag hic gerekmiyor. Ayin 20'sinden sonra
     sonraki ay da sessizce cekiliyor, ay basinda ag yoksa bile vakit gelir.
     Konum degisirse onbellek yok sayiliyor. */
  var EZAN_ANAHTAR = 'sade.ezan';
  /* Konum VE hesap yontemi ayni sorguda; onbellegin kimligi de bu. Yontem
     degisirse (pakette yapilandirma.js) eski ayin vakitleri kullanilmaz. */
  var EZAN_SORGU = '?latitude=' + ENLEM + '&longitude=' + BOYLAM + '&method=' + NAMAZ_YONTEMI;
  function ezanAyAdi(yil, ay) { return yil + '-' + ikiHane(ay); }   // ay 1..12
  function ezanOnbellek() {
    try {
      var o = JSON.parse(localStorage.getItem(EZAN_ANAHTAR) || 'null');
      if (o && o.yer === EZAN_SORGU && o.aylar) return o;
    } catch (e) {}
    return null;
  }
  function ezanGunu(d) {
    var o = ezanOnbellek();
    var ay = o && o.aylar[ezanAyAdi(d.getFullYear(), d.getMonth() + 1)];
    return (ay && ay[d.getDate() - 1]) || null;
  }
  function ezanAyCek(yil, ay, tamam, olmadi, sessiz) {
    var url = 'https://api.aladhan.com/v1/calendar/' + yil + '/' + ay + EZAN_SORGU;
    istek(url, function (v) {
      var gunler = [];
      (v.data || []).forEach(function (g) {
        var gr = g.date && g.date.gregorian, hc = g.date && g.date.hijri;
        var no = gr && parseInt(gr.day, 10);
        if (!no || !g.timings) return;
        var t = {};
        VAKIT_ADI.forEach(function (p) { t[p[0]] = (g.timings[p[0]] || '').slice(0, 5); });
        gunler[no - 1] = {t: t, h: hc ? {g: hc.day, a: parseInt(hc.month && hc.month.number, 10),
                                          en: hc.month && hc.month.en, y: hc.year} : null};
      });
      if (!gunler.length) { if (olmadi) olmadi('bos takvim'); return; }
      var o = ezanOnbellek() || {yer: EZAN_SORGU, aylar: {}};
      o.aylar[ezanAyAdi(yil, ay)] = gunler;
      /* en fazla iki ay tut: bu ay ve sonraki */
      var bu = new Date(), tut = {};
      tut[ezanAyAdi(bu.getFullYear(), bu.getMonth() + 1)] = 1;
      var sn = new Date(bu.getFullYear(), bu.getMonth() + 1, 1);
      tut[ezanAyAdi(sn.getFullYear(), sn.getMonth() + 1)] = 1;
      for (var k in o.aylar) if (!tut[k]) delete o.aylar[k];
      try { localStorage.setItem(EZAN_ANAHTAR, JSON.stringify(o)); } catch (e) {}
      kayit('ezan: ' + ezanAyAdi(yil, ay) + ' takvimi saklandi (' + gunler.length + ' gun)');
      if (tamam) tamam();
    }, 'ezan', olmadi, sessiz);
  }

  function ezanUygula(g, kaynak) {
    vakitler = [];
    VAKIT_ADI.forEach(function (p) {
      var s = g.t[p[0]] || '';
      if (dk(s) !== null) vakitler.push({ad: p[1], saat: s, dakika: dk(s), ikon: p[2]});
    });
    var hc = g.h;
    if (hc) {
      var ayAd = HICRI_AY[hc.a - 1] || hc.en || '';
      $('#ezan-hicri').textContent = hc.g + ' ' + ayAd + ' ' + hc.y;
      hicriKisa = hc.g + ' ' + ayAd;
    }
    vakitleriCiz();
    geriSayim();
    $('#ezan-panel').hidden = false;
    kayit('ezan (' + kaynak + '): ' + vakitler.length + ' vakit');
  }

  function ezanVakitleri() {
    if (ezanZaman) { clearTimeout(ezanZaman); ezanZaman = null; }
    var bu = new Date();
    var g = ezanGunu(bu);
    if (g) {
      ezanDeneme = 0;
      ezanUygula(g, 'önbellek');
      var sn = new Date(bu.getFullYear(), bu.getMonth() + 1, 1);
      if (bu.getDate() >= 20 && !ezanGunu(sn)) {
        ezanAyCek(sn.getFullYear(), sn.getMonth() + 1, null, null, true);
      }
      return;
    }
    ezanAyCek(bu.getFullYear(), bu.getMonth() + 1, function () {
      ezanDeneme = 0;
      var g2 = ezanGunu(bu);
      if (g2) ezanUygula(g2, 'ağ');
    }, function () {
      var sn = EZAN_TEKRAR[Math.min(ezanDeneme, EZAN_TEKRAR.length - 1)];
      ezanDeneme++;
      kayit('ezan: ' + sn + ' sn sonra yeniden denenecek (' + ezanDeneme + ')');
      ezanZaman = setTimeout(ezanVakitleri, sn * 1000);
    });
  }

  function siradakiVakit() {
    if (!vakitler || !vakitler.length) return null;
    var s = new Date(), simdi = s.getHours() * 60 + s.getMinutes();
    for (var i = 0; i < vakitler.length; i++) {
      if (vakitler[i].dakika > simdi) {
        return {idx: i, kalan: vakitler[i].dakika - simdi, vakit: vakitler[i]};
      }
    }
    // gun bitti -> yarinin ilk vakti
    return {idx: -1, kalan: (24 * 60 - simdi) + vakitler[0].dakika, vakit: vakitler[0]};
  }

  /* Olcum (2.20.0, 30 sn bosta): saatiGuncelle her 20 sn'de bunu cagiriyor
     ve liste — 6 satir, 12 SVG degrade — her seferinde silinip sifirdan
     kuruluyordu; oysa icerik gunde 6 kez (vakit gecince) degisiyor.
     Gorunen her seyi bir imzaya koyup degismediyse dokunmuyoruz. */
  var vakitImza = '';
  function vakitleriCiz() {
    if (!vakitler) return;
    var liste = $('#vakitler');
    var s = siradakiVakit();
    var imza = vakitler.map(function (v) { return v.saat; }).join(',') + '|' +
               (s ? s.idx : 'x') + '|' + hicriKisa;
    if (imza === vakitImza && liste.childNodes.length === vakitler.length) return;
    vakitImza = imza;
    while (liste.firstChild) liste.removeChild(liste.firstChild);
    /* Yatsi gectikten sonra siradakiVakit() idx:-1 dondurup ertesi gunun
       ilk vaktini (Imsak) hedefliyor. Eskiden bu durumda TUM vakitler
       'gecti' olarak soluklastiriliyordu — altta "Imsak vaktine kalan"
       yazarken ustte Imsak da soluk goruyordun. Artik o saatlerde Imsak
       sirada olarak isaretleniyor. */
    var siradaIdx = s ? (s.idx === -1 ? 0 : s.idx) : -1;
    vakitler.forEach(function (v, i) {
      var li = document.createElement('li');
      if (i === siradaIdx) li.className = 'sirada';
      else if (s && (s.idx === -1 || i < s.idx)) li.className = 'gecti';

      var ik = document.createElementNS(NS, 'svg');
      ik.setAttribute('viewBox', '0 0 64 64');
      ik.setAttribute('class', 'v-ikon');
      vakitIkonu(ik, v.ikon);

      var b = document.createElement('span'); b.className = 'v-saat'; b.textContent = v.saat;
      var a = document.createElement('span'); a.className = 'v-ad';   a.textContent = v.ad;
      li.appendChild(ik); li.appendChild(b); li.appendChild(a);
      liste.appendChild(li);
    });
    if (s) $('#geri-etiket').textContent = s.vakit.ad + ' vaktine kalan';
    namazKucukCiz(s);
  }

  /* NAMAZ 3x1: siradaki vaktin simgesi | "Yatsi 19:35" + sehir · hicri | geri sayim */
  function namazKucukCiz(s) {
    var w = $('#namaz-kucuk-widget');
    if (!w || !s) return;
    vakitIkonu($('#nk-ikon'), s.vakit.ikon);
    var v = $('#nk-vakit');
    v.textContent = '';
    var b = document.createElement('b'); b.textContent = s.vakit.ad; v.appendChild(b);
    v.appendChild(document.createTextNode(s.vakit.saat));
    $('#nk-alt').textContent = SEHIR + (hicriKisa ? ' · ' + hicriKisa : '');
    w.hidden = false;
  }

  /* saniyelik geri sayim: sonraki vakte kalan sure */
  function geriSayim() {
    if (!vakitler || !vakitler.length) return;
    var s = siradakiVakit();
    if (!s) return;
    var simdi = new Date();
    var gecen = simdi.getHours() * 3600 + simdi.getMinutes() * 60 + simdi.getSeconds();
    var hedef = s.vakit.dakika * 60;
    var kalan = hedef - gecen;
    if (kalan < 0) kalan += 24 * 3600;        // yarinin ilk vakti
    var sa = Math.floor(kalan / 3600);
    var dkk = Math.floor((kalan % 3600) / 60);
    var sn = kalan % 60;
    var metin = sa > 0
      ? sa + ':' + ikiHane(dkk) + ':' + ikiHane(sn)
      : ikiHane(dkk) + ':' + ikiHane(sn);
    $('#geri-sayim').textContent = metin;
    var nk = $('#nk-sayim'); if (nk) nk.textContent = metin;
  }

  /* ---------- ortak istek ------------------------------------------------ */
  /* sessiz: hata kayda gecer ama ekrandaki "verisi alinamadi" satirini
     acmaz — yedegi olan ya da arka planda yapilan istekler icin. */
  function istek(url, basarili, etiket, basarisiz, sessiz) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 15000;
    function hata(n) {
      if (!sessiz) {
        var e = $('#veri-hata');
        e.textContent = etiket + ' verisi alınamadı (' + n + ')';
        e.hidden = false;
      }
      kayit(etiket + ' hatasi: ' + n);
      if (basarisiz) basarisiz(n);
    }
    x.onload = function () {
      if (x.status < 200 || x.status >= 300) { hata('HTTP ' + x.status); return; }
      try { basarili(JSON.parse(x.responseText)); $('#veri-hata').hidden = true; }
      catch (e) { hata('ayrıştırma'); }
    };
    x.onerror   = function () { hata('ağ'); };
    x.ontimeout = function () { hata('zaman aşımı'); };
    try { x.send(); } catch (e) { hata(e.message); }
  }

  /* ---------- tema (gun dogumu/batimina gore) --------------------------- */
  /* Tema kipi: 'oto' (gun dogumu/batimi) | 'gunduz' | 'gece'
     Otomatik varsayilan, ama bazen gunduz koyu tema istenir. Secim
     tarayicinin yerel deposunda, bu uygulamaya ozel. */
  var TEMA_ANAHTAR = 'sade.tema';
  var TEMA_SECENEK = [
    { id: 'oto',    ad: 'Otomatik' },
    { id: 'gunduz', ad: 'Açık' },
    { id: 'gece',   ad: 'Koyu' }
  ];
  function temaKipi() {
    try {
      var v = localStorage.getItem(TEMA_ANAHTAR);
      if (v === 'gunduz' || v === 'gece' || v === 'oto') return v;
    } catch (e) {}
    /* Kullanici secmediyse kurulumun varsayilani (yapilandirma.js). */
    return (AYAR.tema === 'gunduz' || AYAR.tema === 'gece') ? AYAR.tema : 'oto';
  }
  function temaKipiYaz(v) {
    try { localStorage.setItem(TEMA_ANAHTAR, v); } catch (e) {}
    temaUygula();
    if (acikPanel === 'ayar') { ayarPaneliCiz(); odakCiz(); }
  }

  function temaUygula() {
    var kip = temaKipi();
    if (kip === 'gunduz' || kip === 'gece') {
      document.body.className = (kip === 'gece') ? 'gece' : 'gunduz';
      return;
    }
    var s = new Date(), simdi = s.getHours() * 60 + s.getMinutes();
    // gun dogumu/batimi: namaz vakitlerindeki Gunes ve Aksam
    var d = null, b = null;
    if (vakitler) {
      vakitler.forEach(function (v) {
        if (v.ad === 'Güneş') d = v.dakika;
        if (v.ad === 'Akşam') b = v.dakika;
      });
    }
    var gece = (d !== null && b !== null) ? (simdi < d || simdi >= b)
                                          : (s.getHours() < 7 || s.getHours() >= 19);
    document.body.className = gece ? 'gece' : 'gunduz';
  }

  /* Gun degisimi nobetcisi.
     Namaz vakitleri 6 saatte bir, hava 15 dakikada bir yenileniyordu; gece
     yarisini 6 saatlik araliga denk gelirse ekranda bir onceki gunun
     vakitleri ve eski hicri tarih 2 saate kadar asili kaliyordu.
     Ayrica TV beklemeye girip uyandiginda setInterval sayaclari kayabiliyor,
     yani sabit aralik tek basina yeterli bir garanti degil.
     Bu yuzden gunu saat her guncellendiginde (20 sn) karsilastiriyoruz:
     tarih atladigi anda iki veriyi de yeniden cekiyoruz. En kotu ihtimalle
     yeni gun 20 saniye gecikmeyle ekrana gelir.
     Geri sayimin kendisi zaten gece yarisini dogru gecirebiliyor
     (siradakiVakit() gun bitince ertesi gunun Imsak'ini hedefliyor). */
  var sonGun = null;
  function gunDegistiMi(s) {
    var bugunkuAd = s.getFullYear() + '-' + s.getMonth() + '-' + s.getDate();
    if (sonGun === null) { sonGun = bugunkuAd; return false; }
    if (sonGun === bugunkuAd) return false;
    sonGun = bugunkuAd;
    return true;
  }

  function saatiGuncelle() {
    var s = new Date();
    if (gunDegistiMi(s)) {
      kayit('gun degisti -> ezan + hava yeniden cekiliyor');
      ezanVakitleri();
      havaDurumu();
    }
    var hhmm = ikiHane(s.getHours()) + ':' + ikiHane(s.getMinutes());
    var tarih = GUNLER[s.getDay()] + ', ' + s.getDate() + ' ' + AYLAR[s.getMonth()];
    $('#saat').textContent = hhmm;
    $('#tarih').textContent = tarih;
    var mz = $('#mb-zaman');
    if (mz) {
      mz.textContent = s.getDate() + ' ' + AYLAR_KISA[s.getMonth()] + ' ' +
                       GUNLER_KISA[s.getDay()] + '  ' + hhmm;
    }
    temaUygula();
    vakitleriCiz();
  }

  /* =======================================================================
     MENU CUBUGU DURUM SIMGELERI
     Her cagri kendi simgesini yonetiyor: servis yanit vermezse (uygulamanin
     izni yetmiyorsa) simge gizleniyor. Yaniltici bir simge gostermektense
     hic gostermemek dogru.
     ======================================================================= */
  var durumBilgi = {ses: null, ag: null, bt: null,
                    parlaklik: null, parEnerji: null};

  function sesOku() {
    luna('luna://com.webos.service.audio/master/getVolume', {}, function (y) {
      var v = y && y.returnValue !== false && y.volumeStatus;
      var e = $('#mb-ses');
      if (!e) return;
      if (!v) { e.hidden = true; durumBilgi.ses = null; kayit('ses servisi kapali'); return; }
      e.hidden = false;
      durumBilgi.ses = v;
      e.classList.toggle('sessiz-mod', !!v.muteStatus);
      e.classList.toggle('kisik', !v.muteStatus && (v.volume || 0) < 30);
    });
  }

  function agOku() {
    luna('luna://com.webos.service.connectionmanager/getstatus', {}, function (y) {
      var e = $('#mb-ag');
      if (!e) return;
      if (!y || y.returnValue === false) { e.hidden = true; durumBilgi.ag = null; return; }
      e.hidden = false;
      var kablolu = y.wired && y.wired.state === 'connected';
      var kablosuz = y.wifi && y.wifi.state === 'connected';
      /* connectionmanager cok daha fazlasini veriyor; onceden yalnizca uc
         alani kullaniyorduk. Panelde gosterilebilecek her seyi sakliyoruz. */
      var k = kablolu ? y.wired : (kablosuz ? y.wifi : null);
      durumBilgi.ag = {
        kablolu: kablolu, kablosuz: kablosuz,
        ad: (y.wifi && y.wifi.ssid) || null,
        ip: (k && k.ipAddress) || null,
        gecit: (k && k.gateway) || null,
        dns: (k && k.dns1) || null,
        maske: (k && k.netmask) || null,
        yontem: (k && k.method) || null,
        arayuz: (k && k.interfaceName) || null,
        ipv6: (k && k.ipv6 && k.ipv6.ipAddress) || null,
        internet: (y.isInternetConnectionAvailable === true) ||
                  (k && k.onInternet === 'yes'),
        cevrimdisi: y.offlineMode === 'enabled',
        sinyal: (kablosuz && y.wifi && (y.wifi.signalLevel || y.wifi.signalBars)) || null,
        frekans: (kablosuz && y.wifi && (y.wifi.frequency || y.wifi.band)) || null
      };
      e.classList.toggle('kablolu', !!kablolu);
      e.classList.toggle('kopuk', !kablolu && !kablosuz);
    });
  }

  /* Bagli bluetooth cihazlari — cikis listesi bunlara bakiyor. */
  function btCihazOku() {
    luna('luna://com.webos.service.bluetooth2/device/getStatus', {}, function (y) {
      if (!y || y.returnValue === false) { durumBilgi.btCihaz = null; return; }
      durumBilgi.btCihaz = (y.devices || []).filter(function (d) {
        return d && d.paired;
      });
      if (acikPanel === 'ses') { sesPaneliCiz(); odakCiz(); }
    });
  }

  function btOku() {
    luna('luna://com.webos.service.bluetooth2/adapter/getStatus', {}, function (y) {
      var e = $('#mb-bt');
      if (!e) return;
      var a2 = y && y.returnValue !== false && y.adapters && y.adapters[0];
      if (!a2) { e.hidden = true; durumBilgi.bt = null; return; }
      e.hidden = false;
      durumBilgi.bt = a2;
      e.classList.toggle('kapali', !a2.powered);
    });
  }

  /* PARLAKLIK — YEREL KOPRU UZERINDEN.
     Uygulamaya settingsservice TAMAMEN kapali (Faz 0 sondasi: picture,
     option, kategorisiz, abonelikli — hepsi "Access denied", 20/45/90.
     saniyede de). Ama root servisimiz ayni cagriyi yapabiliyor; servis
     127.0.0.1:9123'te yalnizca parlaklik okuyan/yazan dar bir uc aciyor.
     Servis calismiyorsa simge gizli kaliyor — yaniltici dugme yok. */
  var KOPRU = 'http://127.0.0.1:9123';

  /* Kopru anahtari: servis onu uygulamanin klasorune yaziyor
     (kopru-anahtar.json). Web sayfalari file:// okuyamadigi icin anahtari
     yalnizca biz biliyoruz; servis anahtarsiz istegi 403 ile geri ceviriyor.
     Uygulama yeni kurulduysa dosya birkac saniye gecikebilir — okuyamazsak
     3 sn sonra tekrar deniyoruz. */
  var kopruAnahtar = null, anahtarAn = 0, anahtarKuyruk = null;

  function anahtarOku(sonra) {
    var x;
    try { x = new XMLHttpRequest(); x.open('GET', 'kopru-anahtar.json', true); }
    catch (e) { sonra(); return; }
    x.onload = function () {
      try {
        var o = JSON.parse(x.responseText);
        if (o && /^[0-9a-f]{32}$/.test(o.anahtar)) kopruAnahtar = o.anahtar;
      } catch (e) {}
      sonra();
    };
    x.onerror = function () { sonra(); };
    try { x.send(); } catch (e) { sonra(); }
  }

  /* Acilista widget'larin hepsi ayni anda soruyor. Okuma surerken gelen
     cagrilar sirada bekliyor — yoksa anahtarsiz cikip 403 yiyorlardi
     (laboratuvarda olculdu: ilk acilista 7 reddedilen istek). */
  function anahtarHazir(sonra) {
    if (kopruAnahtar) { sonra(); return; }
    if (anahtarKuyruk) { anahtarKuyruk.push(sonra); return; }
    if (Date.now() - anahtarAn < 3000) { sonra(); return; }   /* az once okunamadi */
    anahtarAn = Date.now();
    anahtarKuyruk = [sonra];
    anahtarOku(function () {
      var l = anahtarKuyruk; anahtarKuyruk = null;
      l.forEach(function (f) { f(); });
    });
  }

  /* Koprunun herhangi bir ucunu cagirir. Zaman asimi disaridan
     verilebiliyor: bellek bosaltma uygulama kapatiyor, 4 sn yetmiyor. */
  function kopruCagir2(yol, sorgu, geri, zamanAsimi, tekrar) {
    anahtarHazir(function () { kopruGonder(yol, sorgu, geri, zamanAsimi, tekrar); });
  }

  function kopruGonder(yol, sorgu, geri, zamanAsimi, tekrar) {
    var x, kullanilan = kopruAnahtar;
    try { x = new XMLHttpRequest(); } catch (e) { geri(null); return; }
    var bitti = false;
    function son(d) { if (!bitti) { bitti = true; geri(d); } }
    try {
      x.open('GET', KOPRU + yol + (sorgu || '') + (sorgu ? '&' : '?') +
                    'k=' + (kullanilan || '') + '&_=' + Date.now(), true);
      x.timeout = zamanAsimi || 4000;
      x.onload = function () {
        /* Anahtar degismis olabilir: bir kez yeniden okuyup tekrar dene.
           Baska bir cagri anahtari coktan tazelediyse onu silme. */
        if (x.status === 403 && !tekrar) {
          if (kopruAnahtar === kullanilan) { kopruAnahtar = null; anahtarAn = 0; }
          bitti = true;
          kopruCagir2(yol, sorgu, geri, zamanAsimi, true);
          return;
        }
        var o = null;
        try { o = JSON.parse(x.responseText); } catch (e) {}
        son(o);
      };
      x.onerror = function () { son(null); };
      x.ontimeout = function () { son(null); };
      x.send();
    } catch (e) { son(null); }
  }

  /* Suren okuma: ayni uca ikinci istek acilmasin (zaman asimi 15-30 sn,
     durum turu 15 sn). */
  var ucan = {};

  function kopruCagir(sorgu, geri) { kopruCagir2('/parlaklik', sorgu, geri); }

  /* enerji: picture.energySaving ham degeri.
       'off'            -> parlaklik GERCEKTEN elle ayarlanabiliyor
       'auto'           -> ortam isigi sensoru suruyor
       'min'/'med'/'max'-> sabit kademe
     Son ikisinde backlight yazmasi kabul ediliyor ama EKRANA YANSIMIYOR —
     kullanicinin "menu calisiyor da parlaklik degismiyor" dedigi durum
     tam olarak buydu. Yansimayacaksa cubugu kullanilabilir gostermiyoruz. */
  function elleAyarlanirMi() { return durumBilgi.parEnerji === 'off'; }
  /* Anahtar "otomatik mi" degil "ENERJI TASARRUFU devrede mi" demeli:
     min/med/max de tipki auto gibi backlight'i eziyor. Ikisini ayri
     gostermek kullaniciya "kapali gorunen bir anahtar neden calismiyor"
     bilmecesi birakiyordu. */
  function otomatikAcik() {
    return durumBilgi.parEnerji !== null && durumBilgi.parEnerji !== 'off';
  }

  /* Tek bir basarisiz okuma simgeyi GIZLEMESIN. Cihaz listesinde ogrendigimiz
     ders: gecici bos cevap kalici karar verdirmemeli. Ust uste 3 kez
     basarisiz olursa gercekten yok sayiyoruz. */
  var parBosSayac = 0;
  var PAR_BOS_SINIR = 3;

  function parlaklikOku() {
    kopruCagir('', function (o) {
      var e = $('#mb-parlaklik');
      if (!e) return;
      var d = o && typeof o.deger === 'number' ? o.deger : null;
      if (d === null) {
        if (++parBosSayac < PAR_BOS_SINIR) {
          kayit('parlaklik okunamadi (' + parBosSayac + '/' + PAR_BOS_SINIR + ')');
          return;                       /* simgeye dokunma, bir sonraki tura birak */
        }
        e.hidden = true; durumBilgi.parlaklik = null; durumBilgi.parEnerji = null;
        if (acikPanel === 'parlaklik') { parlaklikPaneliCiz(); odakCiz(); }
        return;
      }
      parBosSayac = 0;
      e.hidden = false;
      durumBilgi.parlaklik = d;
      durumBilgi.parEnerji = (o && typeof o.enerji === 'string') ? o.enerji : null;
      if (acikPanel === 'parlaklik') { parlaklikPaneliCiz(); odakCiz(); }
    });
  }

  /* Otomatik parlaklik = picture.energySaving auto|off. Ekrandaki durumu
     hemen cevirip yaziyoruz (ses/parlaklikta oldugu gibi), cevap gelince
     gercege oturtuyoruz. */
  function otomatikCevir() {
    if (durumBilgi.parlaklik === null) return;
    /* Durum BILINMIYORSA dokunma. Eskiden parEnerji null iken ac=true
       cikiyordu, yani "bilmiyorum" hali sessizce "otomatigi AC" komutuna
       donusuyordu. Once oku, kullanici tekrar bassin. */
    if (durumBilgi.parEnerji === null) { parlaklikOku(); return; }
    var ac = (durumBilgi.parEnerji === 'off');
    durumBilgi.parEnerji = ac ? 'auto' : 'off';
    parlaklikPaneliCiz(); odakCiz();
    kopruCagir('?otomatik=' + (ac ? '1' : '0'), function (o) {
      if (!o || o.yazildi === false) {
        kayit('otomatik parlaklik yazilamadi: ' + JSON.stringify(o));
        if (acikPanel === 'parlaklik') {
          panelHata(o ? 'Otomatik parlaklık değiştirilemedi.'
                      : 'Parlaklık servisi yanıt vermiyor.');
        }
      }
      parlaklikOku();
    });
  }

  /* Ses cikisi: /master DEGIL, dogrudan /getSoundOutput.
     Gecerli degerler bu TV'de olculdu: tv_speaker, bt_soundbar, external_arc.
     Yazarken parametre {"soundOutput": ...} — {"output": ...} sema hatasi veriyor. */
  var CIKIS_ADI = {
    tv_speaker:    'TV hoparlörü',
    bt_soundbar:   'Ses çubuğu',
    bt_headset:    'BT kulaklık',
    external_arc:  'HDMI ARC',
    external_optical: 'Optik',
    lineout:       'Hat çıkışı',
    headphone:     'Kulaklık'
  };
  function cikisAdi(k) {
    /* Bagli bluetooth cihazin GERCEK adini goster. Kullanici "bt_soundbar"
       gorunce hangi cihaz oldugunu anlamiyordu — hakliydi, TV hepsine ayni
       kimligi veriyor. */
    if (k === 'bt_soundbar') {
      var d = durumBilgi.btCihaz || [];
      for (var i = 0; i < d.length; i++) {
        if (btSesCihaziMi(d[i]) && btBagliMi(d[i]) && d[i].name) return d[i].name;
      }
    }
    return CIKIS_ADI[k] || k || '—';
  }

  function cikisOku() {
    luna('luna://com.webos.service.audio/getSoundOutput', {}, function (y) {
      if (!y || y.returnValue === false) { durumBilgi.cikis = null; return; }
      durumBilgi.cikis = { su: y.soundOutput || null, son: y.lastSoundOutput || null };
      if (acikPanel === 'ses') { sesPaneliCiz(); odakCiz(); }
    });
  }

  /* Cikis seceneklerini SIRAYLA geziyor: ENTER sonrakine gecirir. */
  /* 25 EKIM: lastSoundOutput'u "secenek" sanmak HATAYDI. O yalnizca TV'nin
     HATIRASI — evde bagli bluetooth cihaz yokken bile bt_soundbar yaziyordu.
     Kullanici secince ses olmayan bir cikisa gitti. Artik bir cikis ancak
     GERCEKTEN kullanilabilirse listeleniyor:
       tv_speaker  : her zaman
       bt_soundbar : yalnizca bagli bir bluetooth ses cihazi varsa
     Dogrulanmadi: external_arc icin guvenilir bir kontrol bulunamadi,
     o yuzden yalnizca SU AN aktif ciksa listeleniyor. */
  /* Bluetooth Class of Device — standart kodlama. Ana sinif bit 8-12'de.
       4 = Ses/Video (kulaklik, hoparlor)    5 = Cevre birimi (kumanda, klavye)
     soundcore Q30 -> 2360324 = 0x240404 -> (>>8)&0x1F = 4  (ses)
     Bu ayrim KRITIK: kumanda da "bagli cihaz" olarak gorunuyor ve onu ses
     cihazi sanmak, ayrica ona "baglantiyi kes" dugmesi koymak TV'nin
     kontrolunu kaybettirir. */
  function btAnaSinif(d) {
    var c = d && d.classOfDevice;
    return (typeof c === 'number') ? ((c >> 8) & 0x1F) : -1;
  }
  function btSesCihaziMi(d) { return btAnaSinif(d) === 4; }
  function btBagliMi(d) {
    return !!(d && d.connectedProfiles && d.connectedProfiles.length);
  }
  function btKumandaMi(d) {
    return btAnaSinif(d) === 5 ||
           !!(d && d.connectedProfiles && d.connectedProfiles.indexOf('hid') >= 0);
  }
  /* Cikis listesi icin: BAGLI bir SES cihazi var mi. Kumandanin bagli
     olmasi bt_soundbar'i secenek yapmaz. */
  function btSesCihaziVar() {
    var d = durumBilgi.btCihaz || [];
    for (var i = 0; i < d.length; i++) {
      if (btSesCihaziMi(d[i]) && btBagliMi(d[i])) return true;
    }
    return false;
  }
  function cikisListesi() {
    var v = durumBilgi.ses, c = durumBilgi.cikis;
    var su = (c && c.su) || (v && v.soundOutput) || null;
    var l = ['tv_speaker'];
    if (btSesCihaziVar() && l.indexOf('bt_soundbar') < 0) l.push('bt_soundbar');
    if (su && l.indexOf(su) < 0) l.push(su);   /* aktif cikis her zaman listede */
    return l;
  }
  function cikisSonraki() {
    var l = cikisListesi();
    if (l.length < 2) { panelHata('Başka ses çıkışı yok.'); return; }
    var c = durumBilgi.cikis;
    var su = (c && c.su) || (durumBilgi.ses && durumBilgi.ses.soundOutput);
    var i = l.indexOf(su);
    cikisSec(l[(i + 1) % l.length]);
  }

  /* 25 EKIM: cikis degistirince YANLIS ses seviyesi gorunuyordu — yeni
     cikisin adi, ESKI cikisin sesi. Sebep yaris: TV her cikis icin AYRI
     ses seviyesi tutuyor ve setSoundOutput cevabi dondugunde gecis henuz
     bitmemis oluyor; hemen yapilan getVolume eski degeri veriyor.
     Cozum: sabit bir gecikme tahmin etmek yerine DEGISIMI DOGRULUYORUZ —
     getVolume'un bildirdigi soundOutput hedefe esitlenene kadar kisa
     araliklarla tekrar okuyoruz. */
  function sesiOturtOku(hedef, kalan) {
    luna('luna://com.webos.service.audio/master/getVolume', {}, function (y) {
      var v = y && y.returnValue !== false && y.volumeStatus;
      if (v && (!hedef || v.soundOutput === hedef || kalan <= 0)) {
        durumBilgi.ses = v;
        var e = $('#mb-ses');
        if (e) {
          e.hidden = false;
          e.classList.toggle('sessiz-mod', !!v.muteStatus);
          e.classList.toggle('kisik', !v.muteStatus && (v.volume || 0) < 30);
        }
        if (acikPanel === 'ses') { sesPaneliCiz(); odakCiz(); }
        return;
      }
      if (kalan > 0) setTimeout(function () { sesiOturtOku(hedef, kalan - 1); }, 300);
      else sesOku();
    });
  }

  function cikisSec(hedef) {
    if (!hedef) return;
    luna('luna://com.webos.service.audio/setSoundOutput', {soundOutput: hedef}, function (y) {
      if (!y || y.returnValue === false) {
        kayit('setSoundOutput reddedildi: ' + JSON.stringify(y));
        if (acikPanel === 'ses') panelHata('Ses çıkışı değiştirilemedi.');
        cikisOku(); sesOku();
        return;
      }
      cikisOku();
      sesiOturtOku(hedef, 8);          /* en fazla 8 x 300 ms = 2,4 sn */
    });
  }

  /* Parlaklik okumasi TV'de bir luna-send sureci dogurtuyor (kopru root
     servisinde fork ediyor). Her 15 sn'de bir buna gerek yok: deger yalnizca
     panel acikken anlamli, geri kalaninda tek isi simgeyi gosterip
     gizlemek. Panel kapaliyken dakikada bir okuyoruz. */
  var durumSayac = 0, durumAn = 0;
  function durumOku() {
    /* 8 KASIM, TV'de fotografla goruldu: 13:05'te ana sayfadaki Duraklar
       21/22 dk (yesil), ayni anda acilan harita 42/45 dk. Sade arka
       plandayken (baska uygulama izlenirken) webOS sayfanin zamanlayicilarini
       donduruyor; "5 dk'da bir" sayaci da donuyor ve Sade one gelince eski
       veri dakikalarca, sayac yetisene kadar ekranda kaliyordu. Iki tur
       arasinda 45 sn'den fazla gectiyse sayfa uyumus demektir: her seyi
       hemen tazele. */
    var simdi = Date.now();
    var uyandi = durumAn && simdi - durumAn > 45000;
    if (uyandi) {
      kayit('uyandi (' + Math.round((simdi - durumAn) / 1000) + ' sn) — veriler tazeleniyor');
      cihazlariOku();
      /* bekleme sirasinda 15 dk'lik hava sayaci kaymis olabilir */
      if (simdi - havaAn > 15 * 60 * 1000) havaDurumu();
    }
    durumAn = simdi;
    sesOku(); agOku(); btOku(); btCihazOku(); cikisOku();
    if (acikPanel === 'parlaklik' || durumBilgi.parlaklik === null ||
        durumSayac % 4 === 0) {
      parlaklikOku();
    }
    /* Sistem okumasi da surec dogurtuyor (luna-send x2) ve calisma
       suresi/RAM saniyede bir degismiyor — dakikada bir yeter. */
    if (sistemBilgi === null || uyandi || durumSayac % 4 === 0) sistemOku();
    /* Widget verileri yalnizca ekranda olan widget'lar icin tazeleniyor
       (ana sayfaya yerlesmis ya da galeri acik). /uyku ve /film TV'de
       luna-send sureci dogurtuyor; kimsenin gormedigi widget icin dakikada
       bir surec acmanin anlami yok. Ilk okuma (veri === null) her zaman
       yapiliyor ki galeri ve yerlestirme bos acilmasin. */
    var dk = uyandi || durumSayac % 4 === 0, bes = uyandi || durumSayac % 20 === 0;
    /* Uygulama kurulup kaldirilmasi seyrek: 10 dk'da bir yeter. */
    if (durumSayac % 40 === 0) yukluleriOku();
    /* 6 KASIM: soguk acilista Sade 25. sn'de, kok servis ~49. sn'de geliyor.
       Aradaki ilk okuma hata donup {hata:true} yaziyordu; sonraki deneme
       1-5 dk sonraydi ve widget o kadar "alinamadi" diye kaliyordu.
       Artik ilk 5 dk icinde hatali olan her turda (15 sn) yeniden soruluyor;
       sonrasinda eski hizina donuyor (servis hic yoksa TV'yi yormasin). */
    var erken = durumSayac < 20;
    if (ekranVeri === null || (erken && ekranVeri.hata) || (dk && widgetGerekli('ekran'))) ekranOku();
    if (uykuVeri === null || (dk && widgetGerekli('uyku'))) uykuOku();
    if (filmVeri === null || (dk && widgetGerekli('film'))) filmOku();
    /* Piyasa ve trafik servis tarafinda 5 dk onbellekli; buradan da 5 dk'da bir. */
    if (piyasaVeri === null || (erken && piyasaVeri.hata) || (bes && (widgetGerekli('piyasa') || widgetGerekli('piyasaGenis')))) piyasaOku();
    if (trafikVeri === null || (erken && trafikVeri.hata) || (bes && (widgetGerekli('trafik') || widgetGerekli('yolGenis')))) trafikOku();
    if (yolVeri === null || (erken && yolVeri.hata) || (bes && (widgetGerekli('yol') || widgetGerekli('yolGenis') ||
                                     widgetGerekli('durak') || widgetGerekli('durakGenis')))) yolOku();
    durumSayac++;
  }

  function parlaklikPaneliCiz() {
    var ic = $('#mb-panel-ic'), bsl = $('#mb-panel-baslik');
    var pv = durumBilgi.parlaklik;
    var elle = elleAyarlanirMi();
    while (ic.firstChild) ic.removeChild(ic.firstChild);
    bsl.textContent = '';
    var bl2 = document.createElement('span'); bl2.textContent = 'Parlaklık';
    var bd = document.createElement('span'); bd.className = 'mb-baslik-deger';
    bd.textContent = (pv === null ? '—' : pv + '%');
    bsl.appendChild(bl2); bsl.appendChild(bd);
    if (pv === null) { kacisSatiri(ic, 'Parlaklık ayarı okunamadı.'); return; }

    /* Otomatik acikken hap ODAKLANABILIR DEGIL — kullanicinin ses cikisi
       icin koydugu kural: yapamayacagi seye imlec gitmesin, bassin da
       hicbir sey olmasin diye bir dugme durmasin. */
    ic.appendChild(kaydirakCiz('par-kaydirak', 'parlaklik', pv, function (s) {
      el(s, 'circle', {cx: 32, cy: 32, r: 11, fill: 'currentColor'});
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        el(s, 'line', {
          x1: 32 + Math.cos(a) * 19, y1: 32 + Math.sin(a) * 19,
          x2: 32 + Math.cos(a) * 27, y2: 32 + Math.sin(a) * 27,
          stroke: 'currentColor', 'stroke-width': 5, 'stroke-linecap': 'round'
        });
      }
    }, elle));

    /* Otomatik: ses panelindeki sessiz anahtariyla ayni kalip — solda
       etiket, sagda yuvarlak toggle, durum RENKLE belli. Simge "A":
       fotograf makinelerinden beri otomatigin standart isareti, 24 px'te
       ince isin cizgilerinden cok daha okunakli. */
    var os = document.createElement('div'); os.className = 'mb-satir';
    var ol2 = document.createElement('span'); ol2.textContent = 'Otomatik';
    os.appendChild(ol2);
    var ob = document.createElement('div');
    ob.className = 'ses-dugme odaklanir yuvarlak-toggle' +
                   (otomatikAcik() ? ' etkin' : '');
    ob.setAttribute('data-is', 'par-oto');
    var osv = document.createElementNS(NS, 'svg');
    osv.setAttribute('viewBox', '0 0 64 64');
    var ot = document.createElementNS(NS, 'text');
    ot.setAttribute('x', '32'); ot.setAttribute('y', '45');
    ot.setAttribute('text-anchor', 'middle');
    ot.setAttribute('font-size', '42');
    ot.setAttribute('font-weight', '600');
    ot.setAttribute('fill', 'currentColor');
    ot.textContent = 'A';
    osv.appendChild(ot);
    ob.appendChild(osv);
    os.appendChild(ob); ic.appendChild(os);

    /* Neden cubugun kapali oldugunu YAZ. Sessiz basarisizlik en kotusu:
       kullanici tam da bunu yasadi — menu calisiyordu, parlaklik degil. */
    if (!elle) {
      var n = document.createElement('div');
      n.className = 'mb-not';
      n.textContent = (durumBilgi.parEnerji === 'auto')
        ? 'Otomatik parlaklık açıkken ortam ışığı belirliyor.'
        : 'Enerji tasarrufu açık; parlaklık buradan değiştirilemiyor.';
      ic.appendChild(n);
    }
  }

  var parZaman = null, parBekleyen = null;
  function parlaklikAyarla(yeni) {
    if (durumBilgi.parlaklik === null) return;
    if (!elleAyarlanirMi()) return;   /* yazilsa bile ekrana yansimaz */
    if (yeni < 0) yeni = 0;
    if (yeni > 100) yeni = 100;
    if (yeni === durumBilgi.parlaklik) return;
    durumBilgi.parlaklik = yeni;
    parlaklikPaneliCiz(); odakCiz();
    parBekleyen = yeni;
    if (parZaman) clearTimeout(parZaman);
    parZaman = setTimeout(function () {
      parZaman = null;
      var h = parBekleyen; parBekleyen = null;
      if (h === null) return;
      /* Istek DUSERSE (cevap hic gelmezse) bir kez daha dene — ayni soket
         yarisi yazmayi da sessizce yutuyordu, yani kullanici kaydiraci
         oynatiyor ama ekran degismiyordu. Reddedilme (yazildi:false)
         tekrarlanmiyor; o gercek bir cevap. */
      function dene(kalan) {
        kopruCagir('?deger=' + h, function (o) {
          if (!o && kalan > 0) { setTimeout(function () { dene(kalan - 1); }, 600); return; }
          if (!o || o.yazildi === false) {
            kayit('parlaklik yazilamadi: ' + JSON.stringify(o));
            if (acikPanel === 'parlaklik') {
              panelHata(o ? 'Parlaklık değiştirilemedi.'
                          : 'Parlaklık servisi yanıt vermiyor.');
            }
          }
          parlaklikOku();   /* ekrani GERCEK degere oturt */
        });
      }
      dene(1);
    }, 250);
  }

  /* Apple Denetim Merkezi hapi. Tek odak hedefi: SOL/SAG degeri degistirir
     (tusla() icinde data-kaydirak'a bakiliyor), YUKARI/ASAGI satirdan cikar.
     Simge dolgunun UZERINDE duruyor; dolgu simgenin altindan cekilince
     (deger cok dusukken) simge rengi metne donuyor, yoksa beyaz zeminde
     beyaz simge kaliyordu. */
  /* =======================================================================
     TV SISTEM DURUMU  (sag bolgenin 3x1 yuvasi)
     Uygulamaya /proc da applicationManager/running de kapali; ikisi de
     root servisimizde calisiyor ve /sistem ucuyla geliyor.
     ======================================================================= */
  var sistemBilgi = null, sistemMesgul = false;
  /* Islemden sonra NE OLDUGUNU yazan gecici satir. Onay penceresi yerine
     bunu sectim: simsek tek basina "neyi kapattin" sorusunu birakiyordu,
     ustelik kapatma geri alinamiyor. Hic degilse ne oldugunu soylesin. */
  var sistemSonuc = null, sistemSonucZaman = null;

  function sureMetni(sn) {
    if (typeof sn !== 'number' || sn < 0) return '—';
    var g = Math.floor(sn / 86400), s = Math.floor((sn % 86400) / 3600),
        d = Math.floor((sn % 3600) / 60);
    if (g) return g + ' gün ' + s + ' sa';
    if (s) return s + ' sa ' + d + ' dk';
    return d + ' dk';
  }

  function sistemOku() {
    kopruCagir2('/sistem', '', function (o) {
      var w = $('#sistem-widget');
      if (!w) return;
      if (!o || !o.bellek || typeof o.bellek.toplam !== 'number') {
        /* Servis susmussa widget hic gorunmesin — bos kutu birakmaktansa
           yok olsun. Parlaklik simgesiyle ayni kural. */
        sistemBilgi = null; w.hidden = true;
        if (bolge === 'widget') bolge = 'raf';
        odakCiz();
        return;
      }
      sistemBilgi = o;
      w.hidden = false;
      sistemWidgetCiz();
      odakCiz();
    });
  }

  function sistemWidgetCiz() {
    var o = sistemBilgi;
    if (!o) return;
    var b = o.bellek;
    var yuzde = b.toplam
      ? Math.round((1 - (b.kullanilabilir || 0) / b.toplam) * 100) : 0;

    var alt = $('#sw-alt');
    if (alt) {
      /* 25 EKIM: once "N uygulama acik", sonra adlari yaziliyordu. Ikisi de
         yanlisti. Sayi yaniltiyordu (kullanici bir tane acmisti, digerleri
         LG'nin onyukledikleriydi); adlar ise kalici gurultu — "Live TV,
         Search" yazisi sade bir launcher'da kimseye bir sey anlatmiyor.
         Gunluk kullanimda onemli olan iki sey var: ne kadardir acik ve
         bellek dar mi. Hangi uygulamalarin kapandigini ogrenmek isteyen
         zaten simsege basiyor, sonuc satiri onlari adiyla soyluyor. */
      /* "Calisma suresi" oneki iki dugme eklenince satiri tasirdi
         ("... CPU ..." diye kirpildi). Sure zaten "6 sa 28 dk" formatinda,
         ne oldugu belli. */
      alt.textContent = sistemSonuc || (sureMetni(o.calisma) +
        (typeof o.cpu === 'number' ? '  ·  CPU %' + o.cpu : ''));
      alt.classList.toggle('sw-sonuc', !!sistemSonuc);
    }
    var dol = $('#sw-ram-dolu');
    if (dol) {
      dol.style.width = yuzde + '%';
      dol.classList.toggle('dar', yuzde >= 85);
    }
    /* Yuzde tek basina soyut kaliyordu — Bilal "kac GB" diye sordu, hakli.
       Gercek rakam yuzdeden daha anlamli: 1,8 GB'lik bir TV'de %60 ile
       %80 arasindaki fark 370 MB demek. CPU da buraya sigdi. */
    var yz = $('#sw-ram-yuzde');
    if (yz) {
      var gbT = b.toplam ? (b.toplam / 1048576) : 0;
      var gbK = b.toplam ? ((b.toplam - (b.kullanilabilir || 0)) / 1048576) : 0;
      yz.textContent = '%' + yuzde + '  ·  ' +
        gbK.toFixed(1).replace('.', ',') + '/' +
        gbT.toFixed(1).replace('.', ',') + ' GB';
    }
    var d = $('#sw-bosalt');
    if (d) d.classList.toggle('mesgul', sistemMesgul);
    ayrintiCiz(o);
  }

  /* --- TEPKI SURESI OLCUMU -------------------------------------------
     Tus basildigi andan EKRANA YANSIDIGI kareye kadar gecen sure.
     Iki ardisik requestAnimationFrame kullaniyoruz: ilki bir sonraki
     karenin hazirligi, ikincisi o kare boyandiktan sonrasi. Yani olculen
     sey "kodum ne kadar surdu" degil, "kullanici ne zaman gordu".
     Son 60 olcum tutuluyor; ortanca ve en kotu birlikte anlamli —
     ortalama, tek bir takilmayi gizler. */
  var tepkiOlcum = [];

  function simdiMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function tepkiOlc() {
    var t0 = simdiMs();
    if (!window.requestAnimationFrame) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        tepkiOlcum.push(simdiMs() - t0);
        while (tepkiOlcum.length > 60) tepkiOlcum.shift();
      });
    });
  }

  function tepkiOzet() {
    if (tepkiOlcum.length < 3) return null;
    var s = tepkiOlcum.slice().sort(function (a, b) { return a - b; });
    return { ortanca: Math.round(s[Math.floor(s.length / 2)]),
             enKotu: Math.round(s[s.length - 1]),
             sayi: s.length };
  }

  /* --- GENISLETILMIS GORUNUM ------------------------------------------ */
  var sistemGenis = false;

  function sistemGenislet() {
    sistemGenis = !sistemGenis;
    var w = $('#sistem-widget'), sv = $('#sw-sevron');
    /* Hangi bolgedeyse o bolge — artik kullanici widget'i sola da koyabilir. */
    var bl = (w && w.parentNode && w.parentNode.classList &&
              w.parentNode.classList.contains('bolge')) ? w.parentNode : null;
    if (w) {
      /* Genis haldeki yuksekligi ayrintiCiz hesapliyor (icerige gore
         2 ya da 3 satir); burada yalnizca daraltmayi geri aliyoruz. */
      if (!sistemGenis) w.setAttribute('data-sat', '1');
      w.classList.toggle('genis', sistemGenis);
    }
    if (bl) bl.classList.toggle('sistem-acik', sistemGenis);
    if (sv) sv.style.transform = sistemGenis ? 'rotate(180deg)' : '';
    sistemWidgetCiz();
    odakCiz();
    if (sistemGenis) sistemOku();          /* acilirken taze veri */
  }

  function mbMetni(kb) {
    if (typeof kb !== 'number' || kb <= 0) return '';
    return Math.round(kb / 1024) + ' MB';
  }

  function ayrintiCiz(o) {
    var k = $('#sw-ayrinti');
    if (!k) return;
    while (k.firstChild) k.removeChild(k.firstChild);
    k.hidden = !sistemGenis;
    if (!sistemGenis) return;

    var tum = (o.uygulamalar || []).slice().sort(function (a, b) {
      return (b.bellekKB || 0) - (a.bellekKB || 0);
    });
    /* Korunanlari TEK satirda topluyoruz. Ayri ayri yazinca listenin
       yarisi basilamayan, soluk satirlardan olusuyordu — ekranda yer
       kapliyor, hicbir sey anlatmiyordu. "Sistem · 3 uygulama · 190 MB"
       ayni bilgiyi tek satirda veriyor ve geri kalan yer gercekten
       kapatilabilenlere kaliyor. */
    var acik = tum.filter(function (u) { return u.kapatilabilir; });
    var korumali = tum.filter(function (u) { return !u.kapatilabilir; });

    var SATIR_SINIR = 5;
    var gosterilen = acik.slice(0, SATIR_SINIR);
    var enBuyuk = 1;
    tum.forEach(function (u) { if ((u.bellekKB || 0) > enBuyuk) enBuyuk = u.bellekKB; });

    if (!acik.length) {
      var bos = document.createElement('div');
      bos.className = 'sw-satir korumali';
      var bt = document.createElement('span');
      bt.className = 'sw-ad'; bt.textContent = 'Kapatılabilecek uygulama yok';
      bos.appendChild(bt); k.appendChild(bos);
    }

    gosterilen.forEach(function (u) {
      var r = document.createElement('div');
      r.className = 'sw-satir odaklanir';
      r.setAttribute('data-is', 'uyg-kapat');
      r.setAttribute('data-uyg', u.id);

      var ad = document.createElement('span');
      ad.className = 'sw-ad'; ad.textContent = u.ad || u.id;
      r.appendChild(ad);

      /* "on yuklu" rozeti: bu uygulamayi SEN acmadin, LG onyukledi.
         Kapatirken bunu bilmek isiyor. */
      if (u.onyuklu) {
        var rz = document.createElement('span');
        rz.className = 'sw-rozet'; rz.textContent = 'ön yüklü';
        r.appendChild(rz);
      }

      /* Cubuk: rakamlar arasi farki OKUMADAN gosteriyor. iOS'un Depolama
         ekranindaki kalip; en buyuk uygulamaya gore oranli. */
      var cb = document.createElement('div'); cb.className = 'sw-cubuk';
      var ic = document.createElement('div');
      ic.style.width = Math.round(((u.bellekKB || 0) / enBuyuk) * 100) + '%';
      cb.appendChild(ic); r.appendChild(cb);

      var mb = document.createElement('span');
      mb.className = 'sw-mb'; mb.textContent = mbMetni(u.bellekKB);
      r.appendChild(mb);
      k.appendChild(r);
    });

    if (korumali.length) {
      var kt = 0;
      korumali.forEach(function (u) { kt += (u.bellekKB || 0); });
      var kr = document.createElement('div');
      kr.className = 'sw-satir korumali';
      var ka = document.createElement('span');
      ka.className = 'sw-ad';
      ka.textContent = 'Sistem · ' + korumali.length + ' uygulama';
      var km = document.createElement('span');
      km.className = 'sw-mb'; km.textContent = mbMetni(kt);
      kr.appendChild(ka); kr.appendChild(km); k.appendChild(kr);
    }

    /* Kart boyunu ICERIGE uydur. Sabit 3 satirda birakinca, iki uygulama
       varken kartin alt yarisi bombos kaliyordu — dolu gorunmesi gereken
       bir kutunun yarisi hava. Olcu: ust satir 110 + ayirici 16 +
       satir basi 50 + olcum 30 + ic bosluk 44. Izgara satiri 159,
       aralik 32 -> 2 satir 350 px, 3 satir 541 px. */
    var satirSayisi = gosterilen.length + (korumali.length ? 1 : 0) +
                      (acik.length ? 0 : 1);
    var gereken = 110 + 16 + satirSayisi * 50 + 30 + 44;
    var w2 = $('#sistem-widget');
    if (w2) w2.setAttribute('data-sat', gereken <= 350 ? '2' : '3');

    var ol = document.createElement('div');
    ol.className = 'sw-olcum';
    var tz = tepkiOzet();
    var par = [];
    if (acik.length > gosterilen.length) par.push('+' + (acik.length - gosterilen.length) + ' daha');
    if (tz) par.push('Tepki ' + tz.ortanca + ' ms (en kötü ' + tz.enKotu + ')');
    if (o.cekirdek) par.push(o.cekirdek + ' çekirdek');
    var b = o.bellek || {};
    if (b.takasToplam) {
      par.push('takas ' + Math.round((b.takasToplam - (b.takasBos || 0)) / 1024) + ' MB');
    }
    ol.textContent = par.join('  ·  ');
    k.appendChild(ol);
  }

  function uygulamaKapatIste(id) {
    if (!id || sistemMesgul) return;
    sistemMesgul = true; sistemWidgetCiz();
    kopruCagir2('/sistem', '?kapat=' + encodeURIComponent(id), function (r) {
      sistemMesgul = false;
      if (r && r.kapandi) {
        var mb = Math.round((((r.sonrasi || {}).kullanilabilir || 0) -
                             ((r.oncesi || {}).kullanilabilir || 0)) / 1024);
        sistemSonuc = (uygAdi(id) || id) + ' kapatıldı' + (mb > 0 ? ' · +' + mb + ' MB' : '');
      } else {
        sistemSonuc = 'Kapatılamadı';
      }
      if (sistemSonucZaman) clearTimeout(sistemSonucZaman);
      sistemSonucZaman = setTimeout(function () {
        sistemSonucZaman = null; sistemSonuc = null; sistemWidgetCiz();
      }, 7000);
      sistemOku();
    }, 15000);
  }

  function uygAdi(id) {
    var l = (sistemBilgi && sistemBilgi.uygulamalar) || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].ad;
    return null;
  }

  function sistemBosalt() {
    if (sistemMesgul) return;
    sistemMesgul = true; sistemWidgetCiz();
    /* 30 sn: uygulama kapatmak + onbellek birakmak uzun suruyor. */
    kopruCagir2('/sistem', '?bosalt=1', function (o) {
      sistemMesgul = false;
      if (o && o.oncesi && o.sonrasi) {
        var mb = Math.round(((o.sonrasi.kullanilabilir || 0) -
                             (o.oncesi.kullanilabilir || 0)) / 1024);
        var kl = o.kapanan || [], k = kl.length;
        var adl = kl.map(function (id) {
          var u = (sistemBilgi && sistemBilgi.uygulamalar || []).filter(
            function (x) { return x.id === id; })[0];
          return (u && u.ad) || id;
        });
        sistemSonuc = (k ? (k <= 2 ? adl.join(', ') + ' kapatıldı'
                                   : k + ' uygulama kapatıldı')
                         : 'önbellek bırakıldı') +
                      (mb > 0 ? ' · +' + mb + ' MB' : '');
        kayit('bellek: ' + k + ' uygulama kapandi, +' + mb + ' MB');
      } else {
        sistemSonuc = 'Boşaltılamadı';
        kayit('bellek bosaltilamadi');
      }
      if (sistemSonucZaman) clearTimeout(sistemSonucZaman);
      sistemSonucZaman = setTimeout(function () {
        sistemSonucZaman = null; sistemSonuc = null; sistemWidgetCiz();
      }, 7000);
      sistemOku();
    }, 30000);
  }

  /* KONTROLSUZ PANEL BIRAKMA. Bir panelde hic odaklanabilir oge yoksa
     panelAc() bolge'yi 'sekme'de birakiyor: kutu ekranda acik kaliyor ama
     imlec menu cubugunda geziniyor, panel eski simgenin altinda asili
     duruyor. Olculdu: Bluetooth paneli eslesmiş cihaz yokken tam olarak
     boyle davraniyordu. Her bos/arizali panel en az su satiri koyuyor. */
  function kacisSatiri(ic, metin) {
    var r = document.createElement('div');
    r.className = 'mb-satir odaklanir';
    r.setAttribute('data-is', 'lg-ayar');
    var a = document.createElement('span'); a.textContent = metin;
    var b = document.createElement('b'); b.textContent = 'LG Ayarları';
    r.appendChild(a); r.appendChild(b); ic.appendChild(r);
  }

  function kaydirakCiz(isim, tur, yuzde, ikonCiz, etkin) {
    var k = document.createElement('div');
    k.className = 'kaydirak' + (etkin ? ' odaklanir' : ' sonuk');
    if (etkin) {
      k.setAttribute('data-is', isim);
      k.setAttribute('data-kaydirak', tur);
    }
    /* TABAN: dolgunun en kucuk gorunur genisligi, hapin yuksekligi kadar
       (64 px). Panel 580 px, yatay dolgu 26+26 = 52 px cikinca 528 px;
       64/528 = %12,2. Neden gerekli: ses %8'ken dolgu simgenin TAM
       ORTASINDAN kesiliyordu — hoparlor simgesinin yarisi mavi, yarisi
       gri kaliyor ve bozuk gorunuyordu. Artik dolgu ya simgeyi tamamen
       orter ya da hic yoktur. iOS'ta da boyle. Gercek deger zaten
       baslikta yuzde olarak yaziyor. */
    var TABAN = 12.2;
    var y = Math.max(0, Math.min(100, yuzde));
    var dolgu = (y > 0 && y < TABAN) ? TABAN : y;
    var d = document.createElement('div');
    d.className = 'kaydirak-dolu';
    d.style.width = dolgu + '%';
    k.appendChild(d);
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 64 64');
    s.setAttribute('class', 'kaydirak-ikon');
    s.style.color = (dolgu >= TABAN) ? '#fff' : 'var(--metin)';
    ikonCiz(s);
    k.appendChild(s);
    return k;
  }

  /* =======================================================================
     MENU PANELLERI
     bolge === 'panel' iken tuslar buraya yonleniyor; GERI/ESC kapatiyor.
     ======================================================================= */
  var acikPanel = null, panelIdx = 0;
  /* Odakli kontrolun data-is'i. Indeks tek basina yetmiyor: panel kendini
     yeniden cizdiginde kontrol LISTESI degisebiliyor ve ayni indeks baska
     bir dugmeye denk geliyor. Somut ornek — otomatik parlaklik kapatilinca
     +/- odaklanabilir hale geliyor, liste 1'den 3'e cikiyor ve indeks 0
     artik "A" anahtari degil "−" dugmesi oluyor; imlec kullanicinin
     basmadigi bir yere kayiyor. Ses panelinde de ayni sey oluyordu:
     bluetooth kulaklik baglaninca "Cikis" satiri odaklanabilir oluyor. */
  var panelSecili = null;

  /* data-is TEK BASINA anahtar olamaz: ayni panelde ayni data-is'ten
     birden fazla kontrol var (her bluetooth cihazi 'bt-cihaz', her tema
     karosu 'tema'). Yalnizca data-is'e bakinca arama hep ILK esleseni
     buluyor ve imlec listede ilerleyemiyordu — ASAGI tusu hicbir sey
     yapmiyor gibi gorunuyordu. Ayirt edici ozellikleri de anahtara kat. */
  function panelAnahtar(e) {
    if (!e) return null;
    return e.getAttribute('data-is') + '|' +
           (e.getAttribute('data-adres') || e.getAttribute('data-tema') || '');
  }

  function panelOdakla(idx) {
    var pk = panelKontrolleri();
    panelIdx = idx;
    panelSecili = panelAnahtar(pk[idx]);
  }

  /* Reddedilen komutu panelde GOSTER. Onceden sadece kayit() ile gunluge
     yaziliyordu: kullanici dugmeye basiyor, hicbir sey olmuyor ve nedenini
     ogrenemiyordu. Sessiz basarisizlik en kotu hata turu. */
  var hataZaman = null;
  function panelHata(metin) {
    var v = $('#mb-panel-hata');
    if (!v) return;
    v.textContent = metin;
    v.hidden = false;
    /* Kendiliginden sonsuz kalmasin: komut bir kez reddedildi, mesaji
       okundu, panel yeniden normale donsun. */
    if (hataZaman) clearTimeout(hataZaman);
    hataZaman = setTimeout(function () { hataZaman = null; hataTemizle(); }, 6000);
  }
  function hataTemizle() {
    var v = $('#mb-panel-hata');
    if (!v) return;
    if (hataZaman) { clearTimeout(hataZaman); hataZaman = null; }
    v.textContent = ''; v.hidden = true;
  }

  function panelKontrolleri() {
    return Array.prototype.slice.call(
      document.querySelectorAll('#mb-panel .odaklanir'));
  }

  /* Panel icinde YONE GORE en yakin kontrolu bul.
     Onceden sol/sag gezer, yukari/asagi kapatirdi — ama Denetim Merkezi'nin
     girisleri DIKEY diziliyor, asagi tusu paneli kapatiyordu. Panel basina
     yon tanimlamak yerine gercek konumdan hesapliyoruz: hangi panel olursa
     olsun, hangi duzende olursa olsun dogru calisir. */
  function yondeEnYakin(liste, suan, yon) {
    if (!suan) return -1;
    var k = suan.getBoundingClientRect();
    var kx = k.left + k.width / 2, ky = k.top + k.height / 2;
    var enIyi = -1, enIyiPuan = Infinity;
    for (var i = 0; i < liste.length; i++) {
      if (liste[i] === suan) continue;
      var r = liste[i].getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var dx = x - kx, dy = y - ky;
      var ileri, yan;
      if (yon === 'sol')        { ileri = -dx; yan = Math.abs(dy); }
      else if (yon === 'sag')   { ileri =  dx; yan = Math.abs(dy); }
      else if (yon === 'yukari'){ ileri = -dy; yan = Math.abs(dx); }
      else                      { ileri =  dy; yan = Math.abs(dx); }
      if (ileri <= 1) continue;                 /* o yonde degil */
      /* SOL/SAG satir degistirmez. Olmadiginda su oluyordu: "+" dugmesinde
         SAG'a basinca imlec ALTTAKI satirin sag kenarindaki yuvarlak
         anahtara atliyordu — kullanici "+" sanip ENTER'a basinca otomatik
         parlaklik aciliyordu. Dikeyde boyle bir kisit YOK, satirdan
         cikabilmek gerekiyor. */
      if (yon === 'sol' || yon === 'sag') {
        if (r.bottom <= k.top + 2 || r.top >= k.bottom - 2) continue;
      }
      var puan = ileri + yan * 2;               /* saptirana ceza */
      if (puan < enIyiPuan) { enIyiPuan = puan; enIyi = i; }
    }
    return enIyi;
  }

  function panelKapat() {
    acikPanel = null; panelIdx = 0; panelSecili = null;
    gucOnay = null;
    hataTemizle();
    var p2 = $('#mb-panel');
    if (p2) p2.hidden = true;
    if (bolge === 'panel') bolge = 'sekme';
    odakCiz();
  }

  /* Paneli odakli simgenin altina hizala, sag kenardan tasirsa iceri cek. */
  function panelKonumla(kaynak) {
    var p2 = $('#mb-panel');
    if (!p2 || !kaynak) return;
    p2.hidden = false;
    var kr = kaynak.getBoundingClientRect();
    var g = p2.offsetWidth;
    var x = Math.round(kr.left + kr.width / 2 - g / 2);
    if (x + g > 1920 - 24) x = 1920 - 24 - g;
    if (x < 24) x = 24;
    p2.style.left = x + 'px';
  }

  function sesYuzde() {
    var v = durumBilgi.ses;
    if (!v) return 0;
    var mx = v.maxVolume || 100;
    return Math.round(((v.volume || 0) / mx) * 100);
  }

  function sesPaneliCiz() {
    var ic = $('#mb-panel-ic');
    var v = durumBilgi.ses;
    $('#mb-panel-baslik').textContent = 'Ses';
    while (ic.firstChild) ic.removeChild(ic.firstChild);
    if (!v) { kacisSatiri(ic, 'Ses servisi yanıt vermiyor.'); return; }

    /* yuzde basligin sagina — kontrol satirini sikistirmasin */
    var bsl = $('#mb-panel-baslik');
    bsl.textContent = '';
    var bl = document.createElement('span'); bl.textContent = 'Ses';
    var bd = document.createElement('span'); bd.className = 'mb-baslik-deger';
    bd.textContent = v.muteStatus ? 'Sessiz' : sesYuzde() + '%';
    bsl.appendChild(bl); bsl.appendChild(bd);

    /* 25 EKIM: hoparlor dugmesi kontrol satirindan CIKARILDI.
       Dort oge (hoparlor, eksi, cubuk, arti) tek satirda sikisiyordu ve
       durumu yalnizca minik bir carpi/dalga farkiyla anlatiyordu — ne
       yaptigi yazmiyordu. Ayrica setMute diye bir metot YOKTU — dogrusu
       master/muteVolume {"mute":bool}.
       25 Ekim, ikinci tur: -/+ dugmeleri de kalkti, yerine parlaklikla
       AYNI hap geldi. Iki panelde iki farkli kaydirak olmasi icin sebep
       yoktu ve hap uzaktan cok daha okunakli. */
    ic.appendChild(kaydirakCiz('ses-kaydirak', 'ses',
      v.muteStatus ? 0 : sesYuzde(), function (s) {
        el(s, 'path', {d: 'M14 25h10l13-10v34L24 39H14z', fill: 'currentColor'});
        if (v.muteStatus) {
          el(s, 'path', {d: 'M45 25l14 14M59 25L45 39', fill: 'none',
            stroke: 'currentColor', 'stroke-width': 4.5, 'stroke-linecap': 'round'});
        } else {
          el(s, 'path', {d: 'M44 24a13 13 0 0 1 0 16', fill: 'none',
            stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round'});
          el(s, 'path', {d: 'M51 18a22 22 0 0 1 0 28', fill: 'none',
            stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round'});
        }
      }, true));

    /* 25 EKIM, ikinci tur: segment seritleri de kotuydu — ikili bir durum
       icin iki pill agir duruyor ve odak hedefi sayisini artiriyordu.
       Panelin tamami artik TEK KALIP: solda etiket, sagda deger, ENTER
       degistirir. Kumandada az tus, ekranda az gurultu. */
    function satir(isim, etiket, deger) {
      var s = document.createElement('div');
      s.className = 'mb-satir odaklanir';
      s.setAttribute('data-is', isim);
      var a = document.createElement('span'); a.textContent = etiket;
      var b = document.createElement('b'); b.textContent = deger;
      s.appendChild(a); s.appendChild(b); ic.appendChild(s);
      return s;
    }

    /* Sessiz: yuvarlak TOGGLE. Durum renkle belli — sessizken dolu vurgu
       zemini + carpili hoparlor, acikken notr zemin + dalgali hoparlor.
       Metin yerine simge, cunku burada durum ANINDA okunmali. */
    var ss = document.createElement('div'); ss.className = 'mb-satir';
    var sl = document.createElement('span'); sl.textContent = 'Sessiz';
    ss.appendChild(sl);
    var sb = document.createElement('div');
    sb.className = 'ses-dugme odaklanir yuvarlak-toggle' + (v.muteStatus ? ' etkin' : '');
    sb.setAttribute('data-is', 'ses-sessiz');
    var sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('viewBox', '0 0 64 64');
    el(sv, 'path', {d: 'M14 25h10l13-10v34L24 39H14z', fill: 'currentColor'});
    if (v.muteStatus) {
      el(sv, 'path', {d: 'M45 25l14 14M59 25L45 39', fill: 'none',
        stroke: 'currentColor', 'stroke-width': 4.5, 'stroke-linecap': 'round'});
    } else {
      el(sv, 'path', {d: 'M44 24a13 13 0 0 1 0 16', fill: 'none',
        stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round'});
      el(sv, 'path', {d: 'M51 18a22 22 0 0 1 0 28', fill: 'none',
        stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round'});
    }
    sb.appendChild(sv);
    ss.appendChild(sb); ic.appendChild(ss);

    /* Cikis: baska secenek YOKSA odaklanabilir bile degil. Boylece basinca
       "hicbir sey olmuyor" — hata mesaji da cikmiyor, cunku ortada hata yok,
       sadece secenek yok. Kulaklik/ses cubugu baglandiginda satir kendiliginden
       odaklanabilir hale geliyor. */
    var c = durumBilgi.cikis;
    var su = (c && c.su) || v.soundOutput || null;
    var secenekler = cikisListesi();
    var cs = satir('cikis', 'Çıkış', cikisAdi(su));
    if (secenekler.length < 2) {
      cs.className = 'mb-satir';
      cs.removeAttribute('data-is');
    }
  }

  /* GECIKME OLCUMU — JS'ten ICMP ping atilamaz. Durust karsiligi: kucuk bir
     HTTP istegini zamanlamak. gstatic/generate_204 bos 204 donduren,
     baglanti denetimi icin yaygin kullanilan bir uc; yuk tasimiyor.
     Uc olcum yapip EN DUSUGU aliyoruz (medyan degil: en dusuk olcum gercek
     gidis-donuse en yakin olan, digerleri sira bekleme gurultusu tasiyor). */
  var gecikmeDurum = null;

  function gecikmeOlc() {
    if (gecikmeDurum === 'olculuyor') return;
    gecikmeDurum = 'olculuyor';
    if (acikPanel === 'ag') { agPaneliCiz(); odakCiz(); }
    var sonuc = [], kalan = 3;
    function tur() {
      if (!kalan) {
        gecikmeDurum = sonuc.length ? Math.round(Math.min.apply(null, sonuc)) : 'yok';
        if (acikPanel === 'ag') { agPaneliCiz(); odakCiz(); }
        return;
      }
      kalan--;
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      var x = new XMLHttpRequest();
      var bitti = false;
      function son(basarili) {
        if (bitti) return; bitti = true;
        if (basarili) {
          var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
          sonuc.push(t1 - t0);
        }
        setTimeout(tur, 60);
      }
      try {
        x.open('GET', 'https://www.gstatic.com/generate_204?_=' + Date.now() + '_' + kalan, true);
        x.timeout = 4000;
        x.onload = function () { son(true); };
        x.onerror = function () { son(false); };
        x.ontimeout = function () { son(false); };
        x.send();
      } catch (e) { son(false); }
    }
    tur();
  }

  function agPaneliCiz() {
    var ic = $('#mb-panel-ic');
    $('#mb-panel-baslik').textContent = 'Ağ';
    while (ic.firstChild) ic.removeChild(ic.firstChild);
    var a4 = durumBilgi.ag;
    if (!a4) { kacisSatiri(ic, 'Ağ servisi yanıt vermiyor.'); return; }
    /* Baslikta baglanti tipi — Apple'da da ustte "nerede oldugun" yazar. */
    var bsl = $('#mb-panel-baslik');
    bsl.textContent = '';
    var bl = document.createElement('span'); bl.textContent = 'Ağ';
    var bd = document.createElement('span'); bd.className = 'mb-baslik-deger';
    bd.textContent = a4.kablolu ? 'Ethernet' : (a4.kablosuz ? 'Wi-Fi' : 'Bağlı değil');
    bsl.appendChild(bl); bsl.appendChild(bd);

    /* 25 EKIM, tasarim gozden gecirmesi: burasi alti satirlik bir
       anahtar/deger TABLOSUYDU — Durum, Ag adi, IP, Ag gecidi, DNS,
       Yontem. Teshis ekrani gibi duruyordu; denetim merkezi "hangi
       agdayim, iyi mi" sorusuna BIR BAKISTA cevap vermeli. Artik
       kahraman satir (simge + ag adi + durum) ustte, teknik detaylar
       altta tek satirda ve soluk. Hicbir bilgi silinmedi, agirligi
       degisti. */
    var bas = document.createElement('div'); bas.className = 'ag-bas';
    var isv = document.createElementNS(NS, 'svg');
    isv.setAttribute('viewBox', '0 0 64 64');
    if (a4.kablolu) {
      el(isv, 'rect', {x: 14, y: 26, width: 36, height: 24, rx: 5,
                       fill: 'none', stroke: 'currentColor', 'stroke-width': 5});
      el(isv, 'path', {d: 'M24 26v-8h16v8', fill: 'none',
                       stroke: 'currentColor', 'stroke-width': 5,
                       'stroke-linecap': 'round'});
    } else {
      /* Ic ice uc yay + nokta. Yaylar (32,46) merkezli; uclari 40 derecede
         kesiliyor ki Wi-Fi yelpazesi gibi dursun, yarim daire gibi degil. */
      var kx = Math.cos(40 * Math.PI / 180), ky = Math.sin(40 * Math.PI / 180);
      [26, 18, 10].forEach(function (r) {
        var x1 = (32 - r * kx).toFixed(1), y1 = (46 - r * ky).toFixed(1);
        var gen = (2 * r * kx).toFixed(1);
        el(isv, 'path', {
          d: 'M' + x1 + ' ' + y1 + 'a' + r + ' ' + r + ' 0 0 1 ' + gen + ' 0',
          fill: 'none', stroke: 'currentColor', 'stroke-width': 5,
          'stroke-linecap': 'round'
        });
      });
      el(isv, 'circle', {cx: 32, cy: 46, r: 4.5, fill: 'currentColor'});
    }
    bas.appendChild(isv);
    var met = document.createElement('div');
    var ad = document.createElement('div'); ad.className = 'ag-ad';
    ad.textContent = a4.ad || (a4.kablolu ? 'Kablolu bağlantı'
                                          : (a4.kablosuz ? 'Wi-Fi' : 'Bağlantı yok'));
    var alt = document.createElement('div'); alt.className = 'ag-alt';
    alt.textContent = a4.cevrimdisi ? 'Çevrimdışı mod'
                    : (a4.internet ? 'Bağlı · İnternet var' : 'Bağlı · İnternet yok')
                    + (a4.frekans ? ' · ' + a4.frekans : '');
    met.appendChild(ad); met.appendChild(alt);
    bas.appendChild(met); ic.appendChild(bas);

    /* Gecikme: dugme, olcum, sonuc — hepsi tek satirda */
    var gs = document.createElement('div'); gs.className = 'mb-satir odaklanir';
    gs.setAttribute('data-is', 'gecikme');
    var ge = document.createElement('span'); ge.textContent = 'Gecikme';
    var gd = document.createElement('b');
    gd.textContent = (gecikmeDurum === 'olculuyor') ? 'ölçülüyor…'
                   : (gecikmeDurum === 'yok') ? 'ölçülemedi'
                   : (typeof gecikmeDurum === 'number') ? gecikmeDurum + ' ms'
                   : 'ölç';
    gs.appendChild(ge); gs.appendChild(gd); ic.appendChild(gs);

    /* Teknik detay: soluk, IKI satir halinde. Tek satira sigmiyor —
       olculdu: 580 px panelden 52 px ic bosluk dusunce 528 px kaliyor,
       "Gateway" ile tek satir 562 px. Kelimeyi "GW"ye kisaltmak yerine
       satirlari ANLAMLI boldum: adres bilgisi ustte, ad cozumleme ve
       yontem altta (330 + 216 px, uzun IP'lerde bile 404 px). Kendi
       haline birakilan satir kaydirmasi "DHCP"yi tek basina alt satira
       atiyordu, duzensiz duruyordu. */
    function detaySatiri(ogeler) {
      var var_ = ogeler.filter(function (c) { return c[1] !== undefined; });
      if (!var_.length) return;
      var dd = document.createElement('div'); dd.className = 'ag-detay';
      var_.forEach(function (c, i) {
        if (i) dd.appendChild(document.createTextNode('  ·  '));
        if (c[1] === null) {
          var tek = document.createElement('b'); tek.textContent = c[0];
          dd.appendChild(tek);
        } else {
          dd.appendChild(document.createTextNode(c[0] + ' '));
          var v2 = document.createElement('b'); v2.textContent = c[1];
          dd.appendChild(v2);
        }
      });
      ic.appendChild(dd);
    }
    detaySatiri([
      a4.ip    ? ['IP', a4.ip]           : [null, undefined],
      a4.gecit ? ['Gateway', a4.gecit]   : [null, undefined]
    ]);
    detaySatiri([
      a4.dns    ? ['DNS', a4.dns] : [null, undefined],
      a4.yontem ? [a4.yontem === 'dhcp' ? 'DHCP' : a4.yontem, null] : [null, undefined]
    ]);
  }

  /* Bluetooth cihazina baglan / baglantiyi kes. a2dp = ses profili.
     YALNIZCA ses cihazlari icin cagriliyor — kumandaya (hid) asla, cunku
     onun baglantisini kesmek TV'nin kontrolunu kaybettirir. */
  function btBagla(adres, kes) {
    if (!adres) return;
    var yol = kes ? 'disconnect' : 'connect';
    luna('luna://com.webos.service.bluetooth2/a2dp/' + yol, {address: adres}, function (y) {
      if (!y || y.returnValue === false) {
        kayit('a2dp/' + yol + ' reddedildi: ' + JSON.stringify(y));
        if (acikPanel === 'bt') {
          panelHata(kes ? 'Bağlantı kesilemedi.' : 'Cihaza bağlanılamadı.');
        }
      }
      btCihazOku(); btOku(); cikisOku();
    });
  }

  function btPaneliCiz() {
    var ic = $('#mb-panel-ic'), bsl = $('#mb-panel-baslik');
    var b4 = durumBilgi.bt;
    while (ic.firstChild) ic.removeChild(ic.firstChild);
    bsl.textContent = '';
    var t1 = document.createElement('span'); t1.textContent = 'Bluetooth';
    var t2 = document.createElement('span'); t2.className = 'mb-baslik-deger';
    t2.textContent = b4 ? (b4.powered ? 'Açık' : 'Kapalı') : '—';
    bsl.appendChild(t1); bsl.appendChild(t2);
    if (!b4) { kacisSatiri(ic, 'Bluetooth servisi kapalı.'); return; }

    /* 25 EKIM: AC/KAPA DUGMESI KALDIRILDI.
       Iki sebep, ikisi de TV'den olculdu:
       1) Komut etkisiz — setState(false) sonrasi adapter hala powered:true.
          Sondada setState'i MEVCUT degerle test etmistim; "OK" dondu ama
          mevcut degeri yazmak bir sey degistirmedigi icin o OK gercek bir
          izin kaniti degildi. Ayni tuzaga dorduncu kez dusmusum.
       2) Calissa bile ZARARLI: Magic Remote (LGE MR21) Bluetooth/BLE
          uzerinden baglaniyor. Bluetooth'u kapatmak kumandayi dusururdu,
          yani kullanici TV'nin kontrolunu kaybederdi. TV'nin komutu kabul
          etmemesinin sebebi de buyuk ihtimalle bu.
       Durum artik yalnizca BILGI olarak gosteriliyor. */
    var gs = document.createElement('div'); gs.className = 'mb-satir';
    var ge = document.createElement('span'); ge.textContent = 'Bu TV';
    var gv = document.createElement('b');
    /* "[LG] webOS TV OLED55B16LA" sabit genislikteki panele sigmiyor ve
       zaten her kelimesi malum. Model yetiyor. */
    gv.textContent = String(b4.name || '—').replace(/^\[LG\]\s*webOS TV\s*/i, '');
    gs.appendChild(ge); gs.appendChild(gv); ic.appendChild(gs);

    if (!b4.powered) { kacisSatiri(ic, 'Bluetooth kapalı.'); return; }

    var ds = durumBilgi.btCihaz || [];
    var ses = [], digerBagli = [];
    ds.forEach(function (d) {
      if (btSesCihaziMi(d)) ses.push(d);
      else if (btBagliMi(d)) digerBagli.push(d);
    });

    if (!ses.length && !digerBagli.length) {
      /* Eslestirme bu uygulamadan yapilamiyor (sifre ekrani gerekiyor),
         o yuzden tek dogru cikis LG'nin kendi Bluetooth ayarlari. */
      kacisSatiri(ic, 'Eşleşmiş cihaz yok');
      return;
    }

    /* Ses cihazlari: baglanabilir */
    ses.forEach(function (d) {
      var bagli = btBagliMi(d);
      var r = document.createElement('div');
      r.className = 'mb-satir odaklanir';
      r.setAttribute('data-is', 'bt-cihaz');
      r.setAttribute('data-adres', d.address || '');
      r.setAttribute('data-bagli', bagli ? '1' : '');
      var ad = document.createElement('span'); ad.textContent = d.name || d.address;
      var dg = document.createElement('b'); dg.textContent = bagli ? 'Bağlı' : 'Bağla';
      r.appendChild(ad); r.appendChild(dg); ic.appendChild(r);
    });

    /* Bagli ama ses olmayanlar (kumanda gibi): yalnizca BILGI, dugme yok */
    digerBagli.forEach(function (d) {
      var r = document.createElement('div'); r.className = 'mb-satir';
      var ad = document.createElement('span'); ad.textContent = d.name || d.address;
      var dg = document.createElement('b');
      dg.textContent = btKumandaMi(d) ? 'Kumanda' : 'Bağlı';
      r.appendChild(ad); r.appendChild(dg); ic.appendChild(r);
    });
    /* Yalnizca kumanda bagliysa panelde secilecek bir sey kalmiyordu. */
    if (!ses.length) kacisSatiri(ic, 'Ses cihazı eşleştir');
  }


  function ayarPaneliCiz() {
    var ic = $('#mb-panel-ic'), bsl = $('#mb-panel-baslik');
    bsl.textContent = '';
    var t = document.createElement('span'); t.textContent = 'Denetim Merkezi';
    bsl.appendChild(t);
    while (ic.firstChild) ic.removeChild(ic.firstChild);

    /* Apple Denetim Merkezi dili: dar metin satiri yerine IKON + ETIKET
       KAROSU. Uzaktan bakinca ne oldugu simgeden anlasiliyor, metni
       okumak gerekmiyor. */
    function karo(isim, metin, ciz) {
      var d = document.createElement('div');
      d.className = 'dm-karo odaklanir';
      d.setAttribute('data-is', isim);
      var sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('viewBox', '0 0 64 64');
      sv.setAttribute('class', 'dm-ikon');
      ciz(sv);
      var ad = document.createElement('div');
      ad.className = 'dm-ad'; ad.textContent = metin;
      d.appendChild(sv); d.appendChild(ad);
      return d;
    }

    var kutu = document.createElement('div'); kutu.className = 'dm-karolar';

    /* Dock: alt kenarda uc kart */
    kutu.appendChild(karo('ayar-dock', 'Dock\u2019u düzenle', function (sv) {
      /* 34 pikselde okunakli olmasi icin kartlar buyuk ve az: ikisi dolu,
         biri bos — "siralanabilir kartlar" hissi. */
      [6, 25, 44].forEach(function (x, i) {
        el(sv, 'rect', {x: x, y: 18, width: 14, height: 20, rx: 5,
                        fill: i === 2 ? 'none' : 'currentColor',
                        stroke: 'currentColor', 'stroke-width': 3.5});
      });
      el(sv, 'path', {d: 'M8 48h48', stroke: 'currentColor', 'stroke-width': 4,
                      'stroke-linecap': 'round', fill: 'none', opacity: '.5'});
    }));

    /* LG Ayarlari: iki yatay surgu — menu cubugundaki ayar simgesiyle ayni dil */
    kutu.appendChild(karo('lg-ayar', 'LG Ayarları', function (sv) {
      el(sv, 'path', {d: 'M10 24h44M10 42h44', stroke: 'currentColor',
                      'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none'});
      el(sv, 'circle', {cx: 24, cy: 24, r: 6, fill: 'var(--panel-zemin)',
                        stroke: 'currentColor', 'stroke-width': 4});
      el(sv, 'circle', {cx: 42, cy: 42, r: 6, fill: 'var(--panel-zemin)',
                        stroke: 'currentColor', 'stroke-width': 4});
    }));
    ic.appendChild(kutu);

    /* Gorunum: macOS Sistem Ayarlari'ndaki gibi UC ONIZLEME KAROSU.
       Metin yerine temanin kendisini gosteriyor; secili olanin etrafinda
       halka var. TV mesafesinden bir bakista okunuyor, okumak gerekmiyor. */
    var kip = temaKipi();
    var bas = document.createElement('div');
    bas.className = 'tema-baslik'; bas.textContent = 'Görünüm';
    ic.appendChild(bas);

    var kar = document.createElement('div'); kar.className = 'tema-karolar';
    TEMA_SECENEK.forEach(function (o) {
      var d = document.createElement('div');
      d.className = 'tema-oge odaklanir' + (o.id === kip ? ' secili' : '');
      d.setAttribute('data-is', 'tema');
      d.setAttribute('data-tema', o.id);

      var on = document.createElement('div');
      on.className = 'tema-onizleme ' + o.id;
      var cb = document.createElement('span'); cb.className = 'to-cubuk';
      var kt = document.createElement('span'); kt.className = 'to-kart';
      on.appendChild(cb); on.appendChild(kt);

      var ad = document.createElement('div');
      ad.className = 'tema-ad'; ad.textContent = o.ad;

      d.appendChild(on); d.appendChild(ad);
      kar.appendChild(d);
    });
    ic.appendChild(kar);

    /* Guc: soguk acilis birikimi sifirliyor (26 Ekim olcumu, servis
       gucIsi). Ikinci basista calisiyor; ilk basis karoyu "emin misin"e
       ceviriyor, 4 sn icinde tekrar basilmazsa geri donuyor. */
    var gb = document.createElement('div');
    gb.className = 'tema-baslik'; gb.textContent = 'Güç';
    ic.appendChild(gb);
    var guc = document.createElement('div'); guc.className = 'dm-karolar';
    guc.appendChild(karo('guc-yeniden', 'Yeniden başlat', function (sv) {
      el(sv, 'path', {d: 'M46 20a19 19 0 1 0 5 13', stroke: 'currentColor', 'stroke-width': 4,
                      'stroke-linecap': 'round', fill: 'none'});
      el(sv, 'path', {d: 'M48 8v13H35', stroke: 'currentColor', 'stroke-width': 4,
                      'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'});
    }));
    guc.appendChild(karo('guc-kapat', 'Tam kapat', function (sv) {
      el(sv, 'path', {d: 'M21 18a18 18 0 1 0 22 0', stroke: 'currentColor', 'stroke-width': 4,
                      'stroke-linecap': 'round', fill: 'none'});
      el(sv, 'path', {d: 'M32 9v22', stroke: 'currentColor', 'stroke-width': 4,
                      'stroke-linecap': 'round', fill: 'none'});
    }));
    if (gucOnay) {
      var oy = guc.querySelector('[data-is="' + gucOnay + '"]');
      if (oy) { oy.classList.add('onay'); oy.querySelector('.dm-ad').textContent = 'Emin misin? Tekrar bas'; }
    }
    ic.appendChild(guc);
  }

  var gucOnay = null, gucOnayZaman = null;
  function gucIsi(is) {
    function yenidenCiz() { if (acikPanel === 'ayar') { ayarPaneliCiz(); odakCiz(); } }
    if (gucOnayZaman) { clearTimeout(gucOnayZaman); gucOnayZaman = null; }
    if (gucOnay !== is) {
      gucOnay = is;
      yenidenCiz();
      gucOnayZaman = setTimeout(function () { gucOnay = null; gucOnayZaman = null; yenidenCiz(); }, 4000);
      return;
    }
    gucOnay = null;
    var d = document.querySelector('#mb-panel [data-is="' + is + '"]');
    if (d) d.querySelector('.dm-ad').textContent = is === 'guc-yeniden' ? 'Yeniden başlıyor…' : 'Kapanıyor…';
    kopruCagir2('/guc', '?is=' + (is === 'guc-yeniden' ? 'yeniden' : 'kapat'), function (y) {
      if (y && y.tamam) return;
      yenidenCiz();
      panelHata(y && y.sebep === 'quickstart' ? 'Quick Start+ kapatılamadı, TV kapanmadı.'
                                              : 'Servis yanıt vermedi.');
    }, 8000);
  }

  function panelAc(hangi, kaynak) {
    acikPanel = hangi; panelIdx = 0; panelSecili = null;
    hataTemizle();
    if (hangi === 'ses') sesPaneliCiz();
    else if (hangi === 'ag') agPaneliCiz();
    else if (hangi === 'bt') btPaneliCiz();
    else if (hangi === 'ayar') ayarPaneliCiz();
    else if (hangi === 'parlaklik') { parlaklikPaneliCiz(); parlaklikOku(); }
    panelKonumla(kaynak);
    /* Panel acikken odak HER ZAMAN panelde. Onceden kontrolu olmayan panelde
       odak menu cubugunda kaliyordu: panel eski simgenin altinda asili
       duruyor, kullanici altinda gezinip duruyordu (tvOS Launcher'da ayni
       hata kullanicidan issue olarak gelmis: "Geri ile cikamiyorum").
       Kontrol yoksa odakCiz bir kacis satiri ekliyor. */
    bolge = 'panel';
    odakCiz();
  }

  /* --- ses komutlari ---
     Klimadaki dersin aynisi: cevap beklerken basis DUSURMEK yerine
     gondermeyi geciktiriyoruz. Her basis ekrana aninda yansir, cihaza
     yalnizca son deger gider. Yoksa + tusuna ust uste basmak tepkisiz
     hissettiriyordu. */
  var sesZaman = null, sesBekleyen = null;
  function sesAyarla(yeni) {
    var v = durumBilgi.ses;
    if (!v) return;
    var mx = v.maxVolume || 100;
    if (yeni < 0) yeni = 0;
    if (yeni > mx) yeni = mx;
    if (yeni === v.volume) return;
    v.volume = yeni;
    if (v.muteStatus) v.muteStatus = false;   /* ses acilinca sessiz kalkar */
    sesPaneliCiz(); odakCiz();
    sesBekleyen = yeni;
    if (sesZaman) clearTimeout(sesZaman);
    sesZaman = setTimeout(function () {
      sesZaman = null;
      var hedef = sesBekleyen; sesBekleyen = null;
      if (hedef === null) return;
      luna('luna://com.webos.service.audio/master/setVolume', {volume: hedef}, function (y) {
        if (!y || y.returnValue === false) {
          kayit('setVolume reddedildi: ' + JSON.stringify(y));
          if (acikPanel === 'ses') panelHata('Ses değiştirme bu uygulamaya kapalı.');
        }
        sesOku();
      });
    }, 250);
  }

  /* 25 EKIM: "sessizden cikis" ses getirmiyordu. Sebep: muteStatus false
     yapiliyordu ama SES SEVIYESI 0'da kaliyordu, yani hala sessizdi.
     TV'den okunan gercek durum: muteStatus false, volume 0.
     Artik sessizlik "muteStatus VEYA volume 0" olarak tanimli ve geri
     donuste ses de eski degerine ceviriliyor. */
  var sesHatirla = null;

  function sesSessizMi() {
    var v = durumBilgi.ses;
    return !!v && (!!v.muteStatus || (v.volume || 0) === 0);
  }

  function sesSessiz() {
    var v = durumBilgi.ses;
    if (!v) return;
    var mx = v.maxVolume || 100;

    if (sesSessizMi()) {
      var geri = sesHatirla;
      if (!geri || geri <= 0) geri = Math.max(1, Math.round(mx / 10));
      if (geri > mx) geri = mx;
      v.muteStatus = false; v.volume = geri;
      sesPaneliCiz(); odakCiz();
      luna('luna://com.webos.service.audio/master/muteVolume', {mute: false}, function (y) {
        if (!y || y.returnValue === false) {
          kayit('setMute(false) reddedildi');
          if (acikPanel === 'ses') panelHata('Sessize alma bu uygulamaya kapalı.');
          sesOku(); return;
        }
        luna('luna://com.webos.service.audio/master/setVolume', {volume: geri}, function () {
          sesOku();
        });
      });
      return;
    }

    sesHatirla = v.volume || null;
    v.muteStatus = true;
    sesPaneliCiz(); odakCiz();
    luna('luna://com.webos.service.audio/master/muteVolume', {mute: true}, function (y) {
      if (!y || y.returnValue === false) {
        kayit('setMute(true) reddedildi');
        if (acikPanel === 'ses') panelHata('Sessize alma bu uygulamaya kapalı.');
      }
      sesOku();
    });
  }

  function panelIsi(is) {
    if (is === 'ses-sessiz') sesSessiz();
    else if (is === 'tema') {
      var te = panelKontrolleri()[panelIdx];
      temaKipiYaz(te && te.getAttribute('data-tema'));
    }
    else if (is === 'cikis') cikisSonraki();
    else if (is === 'gecikme') gecikmeOlc();
    else if (is === 'bt-cihaz') {
      var bd = panelKontrolleri()[panelIdx];
      if (bd) btBagla(bd.getAttribute('data-adres'), !!bd.getAttribute('data-bagli'));
    }
    else if (is === 'par-oto') otomatikCevir();
    else if (is === 'lg-ayar') { panelKapat(); uygulamaAc('com.palm.app.settings'); }
    else if (is === 'ayar-dock') { panelKapat(); gorunumDegistir('ayarlar', true); }
    else if (is === 'guc-yeniden' || is === 'guc-kapat') gucIsi(is);
  }

  /* --- menu cubugu ogeleri (sekmeler + durum simgeleri tek serit) --- */
  function sekmeSayisi() { return document.querySelectorAll('.sekme').length; }
  function menuOgeleri() {
    var t = Array.prototype.slice.call(document.querySelectorAll('.sekme'));
    var d = Array.prototype.slice.call(
      document.querySelectorAll('.menubar-sag .odaklanir'))
      .filter(function (x) { return !x.hidden; });
    return t.concat(d);
  }

  /* Menu cubugu ogesinin KIMLIGI (sekme: data-gorunum, simge: data-is).
     sekmeIdx tek basina yetmiyordu: parlaklik simgesi servis cevap verince
     beliriyor (gizliyken listede yok), sagindaki simgelerin indeksi bir
     kayiyor ve odak kullanicinin durdugu simgeden komsusuna zipliyordu.
     sekmeEsitle() liste degistiyse sekmeIdx'i ayni ogeye yeniden baglar;
     sekmeIdx'i taze listeden hesaplayan yerler sekmeyeGit() kullanir. */
  var sekmeListe = null;
  function sekmeAnahtar(e) {
    return e ? (e.getAttribute('data-gorunum') || e.getAttribute('data-is') || '') : '';
  }
  function sekmeEsitle() {
    var mo = menuOgeleri(), yeni = mo.map(sekmeAnahtar);
    if (sekmeListe && sekmeListe.join('|') !== yeni.join('|')) {
      var k = sekmeListe[sekmeIdx], i = k ? yeni.indexOf(k) : -1;
      if (i >= 0) sekmeIdx = i;
    }
    sekmeListe = yeni;
    return mo;
  }
  function sekmeyeGit(idx) {
    sekmeListe = menuOgeleri().map(sekmeAnahtar);
    sekmeIdx = idx;
  }

  function menuIsi(is, kaynak) {
    if (is === 'ses' || is === 'ag' || is === 'bt' || is === 'parlaklik') {
      panelAc(is, kaynak); return;
    }
    if (is === 'ayar') { panelAc('ayar', kaynak); }
  }

  /* ---------- kartlar + odak -------------------------------------------- */
  /* Simge sirasi: paketteki cizim -> TV'nin kendi simgesi (kok servis) ->
     bas harf. Paket disi uygulamalarda ilk adim atlaniyor (bosuna 404). */
  function kopruIkonAdresi(id) {
    if (!yukluBilgi || !kopruAnahtar || !yukluBilgi[id] || !yukluBilgi[id].ikon) return null;
    return KOPRU + '/ikon?id=' + encodeURIComponent(id) + '&k=' + kopruAnahtar;
  }
  function ikonYukle(img, u, olmazsa) {
    var aday = [];
    if (!u.disari) aday.push('icons/' + u.id + '.png');
    var kp = kopruIkonAdresi(u.id);
    if (kp) aday.push(kp);
    var i = 0;
    img.alt = '';
    img.onerror = function () { if (++i < aday.length) img.src = aday[i]; else olmazsa(); };
    if (aday.length) img.src = aday[0]; else setTimeout(olmazsa, 0);
  }

  function kartYap(u) {
    var k = document.createElement('div');
    k.className = 'kart-dock';
    k.setAttribute('data-id', u.id);
    var img = new Image();
    k.appendChild(img);
    ikonYukle(img, u, function () {
      if (img.parentNode) k.removeChild(img);
      var h = document.createElement('span');
      h.className = 'harf';
      h.textContent = (u.ad || '?').charAt(0).toUpperCase();
      k.appendChild(h);
    });
    return k;
  }

  var gorunum = 'ev', bolge = 'raf';
  var rafIdx = 0, izgaraIdx = 0, sekmeIdx = 0;
  /* Ev (cihaz) sayfasi odagi: hangi kart / kartin kacinci satiri / satirin
     kacinci kontrolu. Kartlar yan yana oldugu icin satir sonunda sag-sol
     komsu karta geciyor. */
  var cihazKartIdx = 0, cihazSatirIdx = 0, cihazSutIdx = 0;

  /* Izgara sutun sayisi CSS'ten okunur. Sabit yazilmisti (8) ama CSS
     repeat(6, 190px) kullaniyor; asagi tusu gorsel satirla uyusmuyordu. */
  function izgaraSutun() {
    var g = $('#izgara');
    if (!g || !window.getComputedStyle) return 6;
    var t = getComputedStyle(g).gridTemplateColumns || '';
    /* Izgara gorunur oldugunda tarayici kullanilmis degerleri verir
       ("190px 190px ..."), gizliyken yazdigimiz kisa yazimi geri dondurur
       ("repeat(6, 190px)"). Ikisini de anlayalim. */
    var r = /repeat\(\s*(\d+)/.exec(t);
    if (r) return +r[1];
    var n = t.split(/\s+/).filter(function (x) { return x && x !== 'none'; }).length;
    return n > 0 ? n : 6;
  }

  function kartlar(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel + ' .kart-dock'));
  }

  function rafiKaydir() {
    var ic = $('#raf-ic'), ks = kartlar('#raf-ic');
    if (!ks[rafIdx]) return;
    var gorunurGenislik = $('#raf').clientWidth;
    var k = ks[rafIdx];
    var x = parseFloat(ic.getAttribute('data-x')) || 0;   // pozitif = kaydirma miktari
    if (k.offsetLeft < x) x = k.offsetLeft;
    else if (k.offsetLeft + k.offsetWidth > x + gorunurGenislik)
      x = k.offsetLeft + k.offsetWidth - gorunurGenislik;
    if (x < 0) x = 0;
    ic.setAttribute('data-x', x);
    ic.style.transform = 'translateX(' + (-x) + 'px)';
  }

  /* --- Ev (cihaz) sayfasi odak modeli ---
     Her kart icinde `.odak-satir` kapsayicilari, her satirda `.odaklanir`
     kontroller var. Yukari/asagi kart icinde satir degistirir; sag/sol satir
     icinde ilerler ve satir bitince yandaki karta gecer. */
  /* Hangi konteynerin satir/sutun modeliyle gezildigi. Ev sayfasi ve
     Ayarlar sayfasi ayni mekanizmayi paylasiyor — ikinci bir gezinme
     sistemi yazmaya gerek yok. */
  var satirKap = '#cihazlar';

  function cihazKartlari() {
    return Array.prototype.slice.call(document.querySelectorAll(satirKap + ' .odak-kart'))
      .filter(function (k) { return k.querySelector('.odaklanir'); });
  }
  function cihazSatirlari(kart) {
    if (!kart) return [];
    return Array.prototype.slice.call(kart.querySelectorAll('.odak-satir'))
      .filter(function (r) { return r.querySelector('.odaklanir'); });
  }
  function cihazKontrolleri(satir) {
    if (!satir) return [];
    return Array.prototype.slice.call(satir.querySelectorAll('.odaklanir'));
  }
  function cihazOdakVar() { return cihazKartlari().length > 0; }

  function cihazOdakSinirla() {
    var ks = cihazKartlari();
    if (!ks.length) { cihazKartIdx = cihazSatirIdx = cihazSutIdx = 0; return; }
    if (cihazKartIdx >= ks.length) cihazKartIdx = ks.length - 1;
    var rs = cihazSatirlari(ks[cihazKartIdx]);
    if (!rs.length) { cihazSatirIdx = cihazSutIdx = 0; return; }
    if (cihazSatirIdx >= rs.length) cihazSatirIdx = rs.length - 1;
    var cs = cihazKontrolleri(rs[cihazSatirIdx]);
    if (cihazSutIdx >= cs.length) cihazSutIdx = Math.max(0, cs.length - 1);
  }

  function cihazOdakElemani() {
    var ks = cihazKartlari();
    if (!ks.length) return null;
    var rs = cihazSatirlari(ks[cihazKartIdx]);
    if (!rs.length) return null;
    return cihazKontrolleri(rs[cihazSatirIdx])[cihazSutIdx] || null;
  }

  /* Bir kontrolun uzerinde ENTER'a basilinca ne olacagi — hem kumanda
     hem fare tiklamasi buradan geciyor, davranis tek yerde. */
  function kontroluCalistir(el2) {
    if (!el2) return;
    var is = el2.getAttribute('data-is');
    if (is && is.indexOf('dock-') === 0) { ayarIsi(is, el2); return; }
    if (is === 'guc' || is === 'eksi' || is === 'arti') { klimaIs(is); return; }
    if (is === 'bosalt') { sistemBosalt(); return; }
    if (is && is.indexOf('uyku-') === 0) { uykuAyarla(Number(is.slice(5))); return; }
    if (is === 'film') { filmCevir(); return; }
    if (is === 'genislet') { sistemGenislet(); return; }
    if (is === 'harita') { harita.gorunum = 0; haritaAc(); return; }
    if (is === 'harita-durak') { harita.gorunum = 2; haritaAc(); return; }
    if (is === 'uyg-kapat') { uygulamaKapatIste(el2.getAttribute('data-uyg')); return; }
    if (is === 'kaynak') {
      var kaynak = el2.getAttribute('data-kaynak');
      var deger  = el2.getAttribute('data-deger');
      if (kaynak && deger !== null && klimaKaynak(kaynak) !== deger) {
        klimaUygula(kaynak, deger);
      }
    }
  }

  /* Uygulama adini odaktaki simgenin tam ustune tasir.
     getBoundingClientRect kullaniyoruz: dock kaydirilmis da olsa, simge
     buyurken de dogru sonucu verir — olcek donusumunun yatay merkezi
     sabit oldugu icin buyume sirasinda etiket titremez. */
  function etiketiYerlestir(aktif) {
    var et = $('#secili-ad');
    if (!et) return;
    var ks = kartlar('#raf-ic'), k = ks[rafIdx];
    if (!aktif || !k || !DOCK[rafIdx]) { et.classList.remove('gorunur'); return; }
    et.textContent = DOCK[rafIdx].ad;
    var sarmal = et.offsetParent || et.parentNode;
    var kr = k.getBoundingClientRect(), sr = sarmal.getBoundingClientRect();
    var merkez = kr.left + kr.width / 2 - sr.left;
    et.style.transform = 'translateX(' + Math.round(merkez) + 'px) translateX(-50%)';
    et.classList.add('gorunur');
  }

  /* Yalnizca odaktaki oge buyur (komsularin da buyumesi dagnik duruyordu) */
  var DOCK_OLCEK = [1.22];   // yalnizca odaktaki buyur

  function odakCiz() {
    /* Sekmeler ve menu cubugu durum simgeleri tek yatay serit; sekmeIdx
       ikisini birden indeksliyor. */
    var mo = sekmeEsitle();
    /* Parlaklik simgesi servis susunca GIZLENIYOR; liste kisaliyor ve
       sekmeIdx listenin disinda kalabiliyordu — menu cubugunda odak
       kayboluyordu. panelIdx ile ayni hata sinifi, ayni cozum. */
    if (sekmeIdx > mo.length - 1) sekmeIdx = Math.max(0, mo.length - 1);
    mo.forEach(function (s, i) {
      s.classList.toggle('odak', bolge === 'sekme' && i === sekmeIdx);
    });
    /* 25 EKIM: panel yeniden cizilince kontrol sayisi degisebiliyor ve
       panelIdx listenin disinda kaliyordu — odak hicbir ogede olmuyor,
       ok tuslari hicbir sey yapmiyor, panel DONMUS gibi hissettiriyordu.
       Once odakli kontrolu KIMLIGINDEN bul (liste degisse de yerinde
       kalsin), bulunamazsa indeksi listeye kirp. */
    var pk2 = panelKontrolleri(), pbul = -1;
    /* Panel yeniden cizilince kontrolsuz kalabiliyor. Tek giris noktasi
       burasi; her panel cizicisine ayri ayri koymak yerine burada yakala. */
    if (acikPanel && !pk2.length && $('#mb-panel-ic')) {
      kacisSatiri($('#mb-panel-ic'), 'Ayarlar');
      pk2 = panelKontrolleri();
    }
    if (panelSecili) {
      for (var pi = 0; pi < pk2.length; pi++) {
        if (panelAnahtar(pk2[pi]) === panelSecili) { pbul = pi; break; }
      }
    }
    if (pbul >= 0) panelIdx = pbul;
    else if (panelIdx > pk2.length - 1) panelIdx = Math.max(0, pk2.length - 1);
    /* Kontrol kayboldiysa kimligi de guncelle — yoksa panelSecili bayat
       kalir ve o kontrol geri geldiginde odak kendiliginden oraya ziplar. */
    panelSecili = panelAnahtar(pk2[panelIdx]);
    pk2.forEach(function (s, i) {
      s.classList.toggle('odak', bolge === 'panel' && i === panelIdx);
    });

    var dockAktif = (gorunum === 'ev' && bolge === 'raf');
    kartlar('#raf-ic').forEach(function (k, i) {
      var uzaklik = Math.abs(i - rafIdx);
      k.classList.toggle('odak', dockAktif && uzaklik === 0);
      var olcek = (dockAktif && uzaklik < DOCK_OLCEK.length) ? DOCK_OLCEK[uzaklik] : 1;
      k.style.transform = 'scale(' + olcek + ')';
    });
    kartlar('#izgara').forEach(function (k, i) {
      k.classList.toggle('odak', gorunum === 'uygulamalar' && bolge === 'izgara' && i === izgaraIdx);
    });

    /* ana sayfadaki klima widget'i */
    var go2 = galeriOgeleri();
    if (galeriIdx > go2.length - 1) galeriIdx = Math.max(0, go2.length - 1);
    go2.forEach(function (e2, i) {
      e2.classList.toggle('odak', gorunum === 'widget' && bolge === 'galeri' && i === galeriIdx);
    });
    /* Sekme cubuguna cikinca galeri en basa donsun (yerlesim sayfasi
       acikken kaydirma korunuyor). */
    if (gorunum === 'widget') galeriKaydir(bolge === 'sekme' ? null : go2[galeriIdx]);
    Array.prototype.forEach.call(document.querySelectorAll('#wy-secenek .wy-dugme'), function (e2, i) {
      e2.classList.toggle('odak', bolge === 'wsayfa' && i === wSayfaIdx);
    });

    var kAktif = (gorunum === 'ev' && bolge === 'widget');
    var kk = evKontrolleri();
    if (evOdakIdx > kk.length - 1) evOdakIdx = Math.max(0, kk.length - 1);
    kk.forEach(function (e2, i) { e2.classList.toggle('odak', kAktif && i === evOdakIdx); });

    /* Ev sayfasindaki cihaz kontrolleri */
    var cAktif = ((gorunum === 'ev-cihaz' || gorunum === 'ayarlar') && bolge === 'cihaz');
    var secili = cAktif ? cihazOdakElemani() : null;
    Array.prototype.slice.call(document.querySelectorAll('.odak-kart .odaklanir'))
      .forEach(function (e2) { e2.classList.toggle('odak', e2 === secili); });

    if (gorunum === 'ev') {
      rafiKaydir();          /* once kaydir, sonra etiketi yerine koy */
      etiketiYerlestir(dockAktif);
    } else if (gorunum === 'ayarlar') {
      ayarlariKaydir();
      var acik = $('#ayar-aciklama');
      if (acik) acik.textContent = ayarAciklamasi(secili);
    }
  }

  /* odakIceri=false iken odak ust menude kalir (sekmeler arasinda gezinmeye
     devam edebilmek icin). Kullanici asagi tusuyla zaten inebiliyor. */
  function gorunumDegistir(y, odakIceri) {
    gorunum = y;
    document.querySelectorAll('.gorunum').forEach(function (g) {
      g.classList.toggle('etkin', g.id === 'gorunum-' + y);
    });
    /* Cihaz ayrintilari galerinin alt sayfasi; sekme cubugunda "Widget"
       etkin gorunmeye devam etsin. */
    var sekmeY = (y === 'ev-cihaz') ? 'widget' : y;
    document.querySelectorAll('.sekme').forEach(function (s) {
      s.classList.toggle('etkin', s.getAttribute('data-gorunum') === sekmeY);
    });
    if (y === 'widget') {
      /* Ana sayfada olmayanlar yoklanmiyor; galeri bayat onizleme gostermesin. */
      ['ekran', 'uyku', 'film', 'piyasa', 'trafik', 'yol'].forEach(widgetVerisiTazele);
      galeriCiz();
    }
    /* Satir/sutun modeli hangi konteyneri gezecek */
    if (y === 'ayarlar') { satirKap = '#ayarlar-liste'; ayarlariCiz(); }
    else if (y === 'ev-cihaz') satirKap = '#cihazlar';

    if (odakIceri) {
      if (y === 'ev') bolge = 'raf';
      else if (y === 'widget') bolge = galeriOgeleri().length ? 'galeri' : 'sekme';
      else if (y === 'ev-cihaz' || y === 'ayarlar') {
        cihazKartIdx = cihazSatirIdx = cihazSutIdx = 0;
        bolge = cihazOdakVar() ? 'cihaz' : 'sekme';
      } else bolge = 'izgara';
    }
    odakCiz();
  }

  /* Kumanda yonlendirmesi.
     Bolgeler:  sekme -> klima -> raf        (ana sayfa)
                sekme -> izgara              (tum uygulamalar)
                sekme -> cihaz               (Ev)
     Klima widget'i yoksa sekme dogrudan rafa iner. */
  function asagiHedef() {
    if (gorunum === 'ev') return evWidgetVar() ? 'widget' : 'raf';
    if (gorunum === 'widget') return galeriOgeleri().length ? 'galeri' : 'sekme';
    if (gorunum === 'ev-cihaz' || gorunum === 'ayarlar') {
      return cihazOdakVar() ? 'cihaz' : 'sekme';
    }
    return 'izgara';
  }

  function tusla(e) {
    var kod = e.keyCode;
    /* Yon ve onay tuslari: ekrana yansima suresini olc. */
    if (kod === 37 || kod === 38 || kod === 39 || kod === 40 || kod === 13) tepkiOlc();

    /* Harita acikken tum tuslar onun. */
    if (harita.acik) { haritaTusu(kod); e.preventDefault(); return; }

    /* GERI: panel -> gorunum -> ana sayfa. EN USTTE HICBIR SEY YAPMIYOR.
       25 EKIM: eskiden burada webOS.platformBack() cagriliyordu, yani
       uygulamadan cikiyor ve arkada LG ekrani kaliyordu. Kullanici LG ana
       ekranina TEK YOLUN uygulama listesindeki girdi olmasini istedi —
       yanlislikla disari dusmek istemiyor. */
    if (kod === 461 || kod === 27) {
      if (acikPanel) { panelKapat(); e.preventDefault(); return; }
      if (wSayfa) { wSayfaKapat(); e.preventDefault(); return; }
      if (gorunum === 'ev-cihaz') {          /* cihaz ayrintilari -> galeri */
        gorunumDegistir('widget', true);
        e.preventDefault(); return;
      }
      if (gorunum === 'ayarlar') {
        sekmeIdx = 0; gorunumDegistir('ev', true);
        e.preventDefault(); return;
      }
      if (gorunum !== 'ev') {
        sekmeIdx = 0; gorunumDegistir('ev', true);
        e.preventDefault(); return;
      }
      if (bolge !== 'raf') { bolge = 'raf'; odakCiz(); e.preventDefault(); return; }
      e.preventDefault();          /* ana sayfadayiz: GERI hicbir sey yapmaz */
      return;
    }

    /* --- acik panel her seyin onunde --- */
    if (bolge === 'panel') {
      var pk = panelKontrolleri();
      /* Hap odaktayken SOL/SAG odak tasimaz, DEGERI degistirir. Kumandanin
         dogal hareketi bu; LG'nin kendi ses cubugu da boyle. YUKARI/ASAGI
         satirdan cikmaya devam ediyor. */
      var ko = pk[panelIdx] && pk[panelIdx].getAttribute('data-kaydirak');
      if (ko && (kod === 37 || kod === 39)) {
        var art = (kod === 39) ? 5 : -5;
        if (ko === 'ses') {
          var vv = durumBilgi.ses;
          var mx = (vv && vv.maxVolume) || 100;
          sesAyarla(Math.round(((vv ? sesYuzde() : 0) + art) * mx / 100));
        } else {
          parlaklikAyarla((durumBilgi.parlaklik || 0) + art);
        }
        e.preventDefault(); return;
      }
      var yon = (kod === 37) ? 'sol' : (kod === 39) ? 'sag'
              : (kod === 38) ? 'yukari' : (kod === 40) ? 'asagi' : null;
      if (yon) {
        var hedef = yondeEnYakin(pk, pk[panelIdx], yon);
        if (hedef >= 0) { panelOdakla(hedef); odakCiz(); }
        else if (yon === 'yukari') panelKapat();   /* en ustte yukari = cik */
        /* diger yonlerde sinirdaysa hicbir sey yapma — panel kapanmasin */
      } else if (kod === 13) {
        panelIsi(pk[panelIdx] && pk[panelIdx].getAttribute('data-is'));
      }
      e.preventDefault(); return;
    }

    if (bolge === 'sekme') {
      /* Sol/sag gezinirken sayfa ANINDA degisir, odak ust menude kalir —
         ayri bir onay tusuna gerek yok. Sekmelerin sagindaki durum
         simgelerine gecince sayfa degismez, ENTER onlarin panelini acar. */
      var ogeler = sekmeEsitle(), ts = sekmeSayisi();
      if (sekmeIdx > ogeler.length - 1) sekmeIdx = ogeler.length - 1;
      /* Oklar YALNIZCA odagi gezdirir — sayfa degismez. (Bir ara sag/sol
         gezerken sayfayi da degistiriyordu; kullanici "menuler kaysin
         istemiyorum" dedi, geri alindi.)
         ENTER sekmede: sayfayi degistirir ama odak ust menude KALIR;
         asagi inmek icin asagi tusu var.
         ENTER durum simgesinde: panelini acar. */
      if (kod === 37 && sekmeIdx > 0) { sekmeIdx--; odakCiz(); }
      else if (kod === 39 && sekmeIdx < ogeler.length - 1) { sekmeIdx++; odakCiz(); }
      else if (kod === 40) { bolge = asagiHedef(); odakCiz(); }
      else if (kod === 13) {
        if (sekmeIdx < ts) gorunumDegistir(ogeler[sekmeIdx].getAttribute('data-gorunum'), false);
        else menuIsi(ogeler[sekmeIdx].getAttribute('data-is'), ogeler[sekmeIdx]);
      }
      else odakCiz();
      e.preventDefault(); return;
    }

    /* --- yerlesim sayfasi (galeride ENTER) --- */
    if (bolge === 'wsayfa') {
      var dg = Array.prototype.slice.call(document.querySelectorAll('#wy-secenek .wy-dugme'));
      var sy = (kod === 37) ? 'sol' : (kod === 39) ? 'sag'
             : (kod === 38) ? 'yukari' : (kod === 40) ? 'asagi' : null;
      if (sy) {
        var sh = yondeEnYakin(dg, dg[wSayfaIdx], sy);
        if (sh >= 0) { wSayfaIdx = sh; wHaritaCiz(); odakCiz(); }
      } else if (kod === 13) { wSecenekUygula(); }
      e.preventDefault(); return;
    }

    /* --- widget galerisi --- */
    if (bolge === 'galeri') {
      var go = galeriOgeleri();
      var gy = (kod === 37) ? 'sol' : (kod === 39) ? 'sag'
             : (kod === 38) ? 'yukari' : (kod === 40) ? 'asagi' : null;
      if (gy) {
        var gh = yondeEnYakin(go, go[galeriIdx], gy);
        if (gh >= 0) { galeriIdx = gh; odakCiz(); }
        else if (gy === 'yukari') { bolge = 'sekme'; odakCiz(); }
      } else if (kod === 13 && go[galeriIdx]) {
        var gw = go[galeriIdx].getAttribute('data-wid');
        if (gw === '_cihazlar') gorunumDegistir('ev-cihaz', true);
        else wSayfaAc(gw);
      }
      e.preventDefault(); return;
    }

    /* --- ana sayfa: widget'lar (klima + sistem) --- */
    if (bolge === 'widget') {
      var kk = evKontrolleri();
      var su = kk[evOdakIdx];
      var wy = (kod === 37) ? 'sol' : (kod === 39) ? 'sag'
             : (kod === 38) ? 'yukari' : (kod === 40) ? 'asagi' : null;
      if (wy) {
        /* DIKEY hareket widget'in ICINDE kalir. Yoksa sistem widget'i
           genisletilip liste acildiginda, listenin son satirinda ASAGI
           basmak imleci SOL taraftaki klimaya atiyordu — geometrik olarak
           en yakin aday oydu. Widget'tan dikey cikis = dock ya da menu
           cubugu. YATAY hareket ise widget'lar arasi gecisin kendisi,
           orada kisit yok. */
        var aday = kk;
        if (wy === 'yukari' || wy === 'asagi') {
          var wk = su && su.closest ? su.closest('.widget') : null;
          if (wk) {
            aday = kk.filter(function (x) {
              return x.closest && x.closest('.widget') === wk;
            });
          }
        }
        var wh = yondeEnYakin(aday, su, wy);
        if (wh >= 0) { evOdakIdx = kk.indexOf(aday[wh]); odakCiz(); }
        else if (wy === 'yukari') { bolge = 'sekme'; odakCiz(); }
        else if (wy === 'asagi') { bolge = 'raf'; odakCiz(); }
      } else if (kod === 13) { kontroluCalistir(su); }
      e.preventDefault(); return;
    }

    /* --- ana sayfa: dock --- */
    if (bolge === 'raf') {
      if (kod === 37) { rafIdx = Math.max(0, rafIdx - 1); odakCiz(); }
      else if (kod === 39) { rafIdx = Math.min(DOCK.length - 1, rafIdx + 1); odakCiz(); }
      else if (kod === 38) { bolge = evWidgetVar() ? 'widget' : 'sekme'; odakCiz(); }
      else if (kod === 13 && DOCK[rafIdx]) uygulamaAc(DOCK[rafIdx].id);
      e.preventDefault(); return;
    }

    /* --- Ev: cihaz kontrolleri --- */
    if (bolge === 'cihaz') {
      var ks = cihazKartlari();
      var rs = cihazSatirlari(ks[cihazKartIdx]);
      var cs = cihazKontrolleri(rs[cihazSatirIdx]);
      if (kod === 37) {
        if (cihazSutIdx > 0) cihazSutIdx--;
        else if (cihazKartIdx > 0) {           /* satir basindaysa soldaki karta gec */
          cihazKartIdx--; cihazOdakSinirla();
          var r2 = cihazSatirlari(cihazKartlari()[cihazKartIdx]);
          cihazSutIdx = Math.max(0, cihazKontrolleri(r2[cihazSatirIdx]).length - 1);
        }
        odakCiz();
      } else if (kod === 39) {
        if (cihazSutIdx < cs.length - 1) cihazSutIdx++;
        else if (cihazKartIdx < ks.length - 1) { cihazKartIdx++; cihazSutIdx = 0; }
        cihazOdakSinirla(); odakCiz();
      } else if (kod === 38) {
        if (cihazSatirIdx > 0) { cihazSatirIdx--; cihazOdakSinirla(); }
        else bolge = 'sekme';
        odakCiz();
      } else if (kod === 40) {
        if (cihazSatirIdx < rs.length - 1) { cihazSatirIdx++; cihazOdakSinirla(); }
        odakCiz();
      } else if (kod === 13) {
        kontroluCalistir(cihazOdakElemani());
      }
      e.preventDefault(); return;
    }

    /* --- tum uygulamalar izgarasi --- */
    if (bolge === 'izgara') {
      var toplam = kartlar('#izgara').length, sut = izgaraSutun();
      if (kod === 37) { izgaraIdx = Math.max(0, izgaraIdx - 1); odakCiz(); }
      else if (kod === 39) { izgaraIdx = Math.min(toplam - 1, izgaraIdx + 1); odakCiz(); }
      else if (kod === 40) {
        /* son satirdaysa sutunu koru, oldugu yerde kal */
        if (izgaraIdx + sut < toplam) izgaraIdx += sut;
        odakCiz();
      } else if (kod === 38) {
        if (izgaraIdx < sut) bolge = 'sekme'; else izgaraIdx -= sut;
        odakCiz();
      } else if (kod === 13) {
        var k2 = kartlar('#izgara')[izgaraIdx];
        if (k2) uygulamaAc(k2.getAttribute('data-id'));
      }
      e.preventDefault(); return;
    }
  }

  /* =======================================================================
     EV: ThinQ cihazlari (TV'nin kendi homeconnect servisi uzerinden)
     SU ASAMADA SADECE OKUMA — hicbir kontrol komutu gonderilmiyor.
     ======================================================================= */
  var CIHAZ_ADI = {
    DEVICE_AIR_CONDITIONER: 'Klima',
    DEVICE_REFRIGERATOR:    'Buzdolabı',
    DEVICE_WASHER:          'Çamaşır Makinesi',
    DEVICE_DISH_WASHER:     'Bulaşık Makinesi',
    DEVICE_DRYER:           'Kurutma Makinesi'
  };
  var MOD_ADI  = {COOL:'Serin', AIR_DRY:'Nem Al', FAN:'Fan', HEAT:'Isıt', AUTO:'Oto'};
  /* state.washer'in kabul ettigi degerler cihazdan okundu (vr listesi).
     Kart eskiden burayi hic okumuyor, yalnizca baglanti durumunu yazip
     calisan makineye "Hazır" diyordu. */
  var YIKAMA_ADI = {
    POWER_OFF:'Kapalı', INITIAL:'Hazır', PAUSE:'Duraklatıldı',
    DETECTING:'Tartılıyor', RUNNING:'Yıkanıyor', RINSING:'Durulanıyor',
    SPINNING:'Sıkılıyor', END:'Bitti', RESERVED:'Ertelendi',
    DRYING:'Kurutuyor', COOL_DOWN:'Soğutuyor', RINSE_HOLD:'Durulamada bekliyor',
    REFRESHING:'Tazeleniyor', STEAM_SOFTENING:'Buharla yumuşatıyor', ERROR:'Hata'
  };
  var CALISIYOR = {RUNNING:1, RINSING:1, SPINNING:1, DRYING:1,
                   COOL_DOWN:1, REFRESHING:1, STEAM_SOFTENING:1, DETECTING:1};
  var FAN_ADI  = {LOW:'Düşük', MID:'Orta', HIGH:'Yüksek', AUTO:'Oto'};

  var cihazlar = null;
  /* Gecici bos listeye tolerans — bkz. cihazlariOku(). 3 x 60 sn = 3 dk. */
  var bosSayac = 0, BOS_SINIR = 3;

  /* Son gorulen cihaz listesi. 6 KASIM: acilista homeconnect bos liste
     donunce Sade'nin elinde "daha once gordugu" liste olmuyordu (yeni
     acilmis sayfa); klima/camasir widget'lari "evde yok" sayilip
     gizleniyordu. Artik son liste diskte; acilista "Baglaniyor…" diye
     cizilip gercek cevap gelince yerini aliyor. Bos cevaba tolerans
     (BOS_SINIR) bu listeye de uygulaniyor. */
  var CIHAZ_ANAHTAR = 'sade.cihazlar';
  function cihazOnbellekYaz(l) {
    try { localStorage.setItem(CIHAZ_ANAHTAR, JSON.stringify(l)); } catch (e) {}
  }
  function cihazOnbellekOku() {
    var l = null;
    try { l = JSON.parse(localStorage.getItem(CIHAZ_ANAHTAR) || 'null'); } catch (e) {}
    if (!l || !l.length || !l.every(function (c) { return c && c.deviceType; })) return null;
    return l.map(function (c) {
      var k = {}; for (var a in c) if (c.hasOwnProperty(a)) k[a] = c[a];
      k.status = 'baglaniyor';
      return k;
    });
  }
  function baglantiYazisi(c) {
    return c && c.status === 'baglaniyor' ? 'Bağlanıyor…' : 'Erişilemiyor';
  }

  function kaynakDeger(c, ad) {
    var r = c.resources && c.resources[ad];
    if (!r) return null;
    return (r.value !== undefined) ? r.value : (r.v !== undefined ? r.v : null);
  }

  function cihazIkonu(svg, tip) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var n = ++ikonSayac;
    var defs = el(svg, 'defs', {});
    var g1 = degrade(defs, 'c' + n, '#8FA3BC', '#5E7490', 10, 10, 54, 54);
    var ci = {fill: 'none', stroke: g1, 'stroke-width': 4,
              'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
    function p(d) { var o = {}; for (var k in ci) o[k] = ci[k]; o.d = d; el(svg, 'path', o); }
    if (tip === 'DEVICE_AIR_CONDITIONER') {
      /* Hava cikisi dalgalari. Onceki hali elle, goz karariyla yazilmisti
         ve uc dalga birbirini tutmuyordu: genislikler 9/9/6, y'ler
         44/46/44, ustelik kutu x=32'de ortaliyken dalgalarin merkezi
         34'teydi. Artik tek olcuden ureliyor:
           dalga genisligi 10, aralik 5  ->  toplam 3*10 + 2*5 = 40
           baslangic = 32 - 40/2 = 12    ->  12..22, 27..37, 42..52
         Egri de simetrik: (0,0)'dan (10,0)'a, kontroller (2.5,-4) ve
         (7.5,4) — orta noktaya gore nokta simetrik, yani gercek bir S. */
      el(svg, 'rect', {x: 8, y: 16, width: 48, height: 20, rx: 6,
        fill: 'none', stroke: g1, 'stroke-width': 4});
      [12, 27, 42].forEach(function (x) {
        p('M' + x + ' 46c2.5-4 7.5 4 10 0');
      });
    } else if (tip === 'DEVICE_DISH_WASHER') {
      /* Bulasik: govde + ust panel cizgisi + iki dalga (su). Camasirin
         yuvarlak kapagiyla karismasin diye kapak yok. */
      el(svg, 'rect', {x: 12, y: 8, width: 40, height: 48, rx: 7,
        fill: 'none', stroke: g1, 'stroke-width': 4});
      p('M12 20h40');
      [34, 43].forEach(function (y) { p('M21 ' + y + 'c3.5-4 7.5 4 11 0s7.5-4 11 0'); });
    } else if (tip === 'DEVICE_REFRIGERATOR') {
      el(svg, 'rect', {x: 16, y: 8, width: 32, height: 48, rx: 6,
        fill: 'none', stroke: g1, 'stroke-width': 4});
      p('M16 28h32'); p('M24 18v6'); p('M24 36v6');
    } else {
      el(svg, 'rect', {x: 12, y: 10, width: 40, height: 44, rx: 7,
        fill: 'none', stroke: g1, 'stroke-width': 4});
      el(svg, 'circle', {cx: 32, cy: 34, r: 11, fill: 'none', stroke: g1, 'stroke-width': 4});
      p('M20 20h6');
    }
  }

  function cihazKarti(c) {
    var tip = c.deviceType || '';
    var k = document.createElement('div');
    k.className = 'cihaz odak-kart';

    var ust = document.createElement('div'); ust.className = 'cihaz-ust';
    var ik = document.createElementNS(NS, 'svg');
    ik.setAttribute('viewBox', '0 0 64 64'); ik.setAttribute('class', 'cihaz-ikon');
    cihazIkonu(ik, tip);
    var yazi = document.createElement('div');
    var ad = document.createElement('div'); ad.className = 'cihaz-ad';
    ad.textContent = c.alias || CIHAZ_ADI[tip] || 'Cihaz';
    var alt = document.createElement('div'); alt.className = 'cihaz-alt';
    alt.textContent = (c.status === 'connected') ? 'Bağlı' : baglantiYazisi(c);
    yazi.appendChild(ad); yazi.appendChild(alt);
    ust.appendChild(ik); ust.appendChild(yazi);

    if (tip === 'DEVICE_AIR_CONDITIONER') {
      var guc = kaynakDeger(c, 'opr.aircon');
      /* Yazi yerine guc simgesi: durum RENKTEN anlasiliyor.
         Acik = dolu vurgu rengi, kapali = notr gri. Kirmizi kullanmadik;
         TV'de hata gibi okunuyor, oysa klimanin kapali olmasi normal. */
      var rozet = document.createElement('div');
      rozet.className = 'cihaz-guc odaklanir ' +
                        (guc === 'POWER_ON' ? 'guc-acik' : 'guc-kapali');
      rozet.setAttribute('data-is', 'guc');
      rozet.setAttribute('title', guc === 'POWER_ON' ? 'Açık' : 'Kapalı');
      var gsv = document.createElementNS(NS, 'svg');
      gsv.setAttribute('viewBox', '0 0 64 64');
      el(gsv, 'path', {d: 'M32 10v22', fill: 'none', stroke: 'currentColor',
                       'stroke-width': 6, 'stroke-linecap': 'round'});
      el(gsv, 'path', {d: 'M20.5 18.5a17 17 0 1 0 23 0', fill: 'none',
                       stroke: 'currentColor', 'stroke-width': 6, 'stroke-linecap': 'round'});
      rozet.appendChild(gsv);
      ust.classList.add('odak-satir');
      ust.appendChild(rozet);
    }
    k.appendChild(ust);

    if (tip === 'DEVICE_AIR_CONDITIONER') {
      var oda = kaynakDeger(c, 'temperature.aircon');
      var hedef = kaynakDeger(c, 'temperature.target.aircon');

      var sat = document.createElement('div'); sat.className = 'hedef odak-satir';
      var eks = document.createElement('button');
      eks.className = 'hedef-dugme odaklanir'; eks.setAttribute('data-is', 'eksi');
      eks.textContent = '−';
      var orta = document.createElement('div');
      var et = document.createElement('div'); et.className = 'hedef-etiket';
      et.textContent = 'Hedef sıcaklık';
      var dg = document.createElement('div'); dg.className = 'hedef-deger';
      dg.textContent = derece(hedef) + '°';
      orta.appendChild(et); orta.appendChild(dg);
      var art = document.createElement('button');
      art.className = 'hedef-dugme odaklanir'; art.setAttribute('data-is', 'arti');
      art.textContent = '+';
      sat.appendChild(eks); sat.appendChild(orta); sat.appendChild(art);
      k.appendChild(sat);

      if (oda !== null) {
        var bil = document.createElement('div'); bil.className = 'cihaz-bilgi';
        var b1 = document.createElement('span'); b1.textContent = 'Oda sıcaklığı';
        var b2 = document.createElement('span'); b2.textContent = oda + '°';
        bil.appendChild(b1); bil.appendChild(b2);
        k.appendChild(bil);
      }

      function secenekSatiri(etiket, kaynakAdi, secenekler, adlar, mevcut) {
        var s2 = document.createElement('div'); s2.className = 'secenekler';
        var e2 = document.createElement('div'); e2.className = 'sec-etiket';
        e2.textContent = etiket;
        var kutu = document.createElement('div'); kutu.className = 'sec-kutu odak-satir';
        secenekler.forEach(function (o) {
          var d = document.createElement('div');
          d.className = 'sec-oge odaklanir' + (o === mevcut ? ' secili' : '');
          d.setAttribute('data-is', 'kaynak');
          d.setAttribute('data-kaynak', kaynakAdi);
          d.setAttribute('data-deger', o);
          d.textContent = adlar[o] || o;
          kutu.appendChild(d);
        });
        s2.appendChild(e2); s2.appendChild(kutu);
        return s2;
      }
      k.appendChild(secenekSatiri('Mod', 'oprmode.aircon',
                                  ['COOL','AIR_DRY','FAN','HEAT','AUTO'],
                                  MOD_ADI, kaynakDeger(c, 'oprmode.aircon')));
      k.appendChild(secenekSatiri('Fan', 'state.airflow',
                                  ['LOW','MID','HIGH','AUTO'],
                                  FAN_ADI, kaynakDeger(c, 'state.airflow')));

    } else if (tip === 'DEVICE_REFRIGERATOR') {
      [['Buzdolabı', 'temperature.fridge'], ['Dondurucu', 'temperature.freezer']]
        .forEach(function (p2) {
          var v = kaynakDeger(c, p2[1]);
          var bil = document.createElement('div'); bil.className = 'cihaz-bilgi';
          var a = document.createElement('span'); a.textContent = p2[0];
          var b = document.createElement('span'); b.textContent = (v === null ? '--' : v) + '°';
          bil.appendChild(a); bil.appendChild(b); k.appendChild(bil);
        });
    } else {
      function bilgiSatiri(etiket, deger) {
        var b3 = document.createElement('div'); b3.className = 'cihaz-bilgi';
        var y1 = document.createElement('span'); y1.textContent = etiket;
        var y2 = document.createElement('span'); y2.textContent = deger;
        b3.appendChild(y1); b3.appendChild(y2); k.appendChild(b3);
      }
      var dur = kaynakDeger(c, 'state.washer');
      if (c.status !== 'connected') {
        bilgiSatiri('Durum', baglantiYazisi(c));
      } else if (dur !== null) {
        bilgiSatiri('Durum', YIKAMA_ADI[dur] || dur);
        if (CALISIYOR[dur]) {
          /* kalan sure iki ayri kaynakta: saat ve dakika */
          var sa = kaynakDeger(c, 'time.remain.hour2');
          var dkk = kaynakDeger(c, 'time.remain.minute2');
          if (sa !== null || dkk !== null) {
            bilgiSatiri('Kalan süre', sureMetni((sa || 0) * 3600 + (dkk || 0) * 60));
          }
        }
      } else {
        bilgiSatiri('Durum', 'Hazır');
      }
    }
    return k;
  }

  /* =======================================================================
     KLIMA KONTROLU
     Luna imzasi: opt MUTLAKA args.option icinde olmali, yoksa servis
     "9001 missing argument <option>" donuyor (serviceMain.js checkerMapSet).
     ======================================================================= */
  var HEDEF_ALT = 18, HEDEF_UST = 30, HEDEF_ADIM = 1;   // cihaz 0.5 kabul ediyor,
                                                        // kumandada 1 daha kullanisli
  /* Arka arkaya basista cihaza yalnizca SON deger gitsin diye gonderme
     geciktirilir. Onceki surumde bir "mesgul" kilidi vardi ve cevap
     beklenirken gelen basislar sessizce dusuyordu: ekran 19 gosterirken
     cihaza 21 gidiyordu, 60 sn sonraki okumada ekran geri sicriyordu. */
  var KLIMA_BEKLE = 450;
  var klimaZaman = null, klimaBekleyen = null, klimaGonderiyor = false;

  function klimaBul() {
    if (!cihazlar) return null;
    for (var i = 0; i < cihazlar.length; i++) {
      if (cihazlar[i].deviceType === 'DEVICE_AIR_CONDITIONER') return cihazlar[i];
    }
    return null;
  }

  function derece(v) {
    if (v === null || v === undefined) return '--';
    return (v % 1 === 0) ? String(v) : v.toFixed(1);
  }

  /* Tek bir komut gonderir. Basarisiz olsa bile `bitti` cagrilir ki
     siradaki komut asili kalmasin. */
  function klimaKomut(resourceId, value, bitti) {
    var c = klimaBul();
    if (!c) { if (bitti) bitti(false); return; }
    kayit('klima -> ' + resourceId + ' = ' + value);
    luna('luna://com.webos.service.homeconnect/set',
         {type: 'operate', option: {deviceId: c.deviceId, resourceId: resourceId, value: value}},
         function (y) {
           var ok = !!(y && y.returnValue !== false);
           if (!ok) kayit('klima reddetti: ' +
                          ((y && (y.errorText || y.errorMessage)) || 'yanit yok'));
           if (bitti) bitti(ok);
         });
  }

  /* Bekleyen degerleri sirayla gonderir. Servis ayni anda gelen istekleri
     "1308 baska yerde kullanimda" ile reddedebildigi icin ard arda degil,
     biri bitince digeri. */
  function klimaGonder() {
    klimaZaman = null;
    if (klimaGonderiyor || !klimaBekleyen) return;
    var sira = [], r;
    for (r in klimaBekleyen) {
      if (Object.prototype.hasOwnProperty.call(klimaBekleyen, r)) {
        sira.push([r, klimaBekleyen[r]]);
      }
    }
    klimaBekleyen = null;
    if (!sira.length) return;
    klimaGonderiyor = true;
    var hepsiOk = true;
    (function sonraki(i) {
      if (i >= sira.length) {
        klimaGonderiyor = false;
        /* Yeni bir basis siraya girdiyse dogrulamayi ona birak. */
        if (!klimaZaman && !klimaBekleyen) {
          setTimeout(function () { if (!klimaZaman && !klimaGonderiyor) cihazlariOku(); }, 1200);
        }
        if (!hepsiOk) cihazlariOku();   /* reddedildiyse ekrani gercege cek */
        return;
      }
      klimaKomut(sira[i][0], sira[i][1], function (ok) {
        if (!ok) hepsiOk = false;
        sonraki(i + 1);
      });
    })(0);
  }

  function klimaKaynak(ad) { var c = klimaBul(); return c ? kaynakDeger(c, ad) : null; }

  /* Ekrani hemen guncelle, gondermeyi KLIMA_BEKLE kadar ertele.
     Boylece kumandada art arda basilan her basis ekrana yansir ama
     cihaza tek ve son deger gider. */
  function klimaUygula(resourceId, value) {
    var c = klimaBul();
    if (!c || !c.resources || !c.resources[resourceId]) return;
    c.resources[resourceId].value = value;
    klimaWidgetCiz(); cihazWidgetleriCiz();
    if (gorunum === 'ev-cihaz') cihazlariCiz();

    if (!klimaBekleyen) klimaBekleyen = {};
    klimaBekleyen[resourceId] = value;
    if (klimaZaman) clearTimeout(klimaZaman);
    klimaZaman = setTimeout(klimaGonder, KLIMA_BEKLE);
  }

  function klimaIs(is) {
    var c = klimaBul();
    if (!c) return;
    if (is === 'guc') {
      var acik = klimaKaynak('opr.aircon') === 'POWER_ON';
      klimaUygula('opr.aircon', acik ? 'POWER_OFF' : 'POWER_ON');
      return;
    }
    var h = klimaKaynak('temperature.target.aircon');
    if (h === null) return;
    var yeni = (is === 'arti') ? h + HEDEF_ADIM : h - HEDEF_ADIM;
    if (yeni < HEDEF_ALT) yeni = HEDEF_ALT;
    if (yeni > HEDEF_UST) yeni = HEDEF_UST;
    if (yeni === h) return;
    klimaUygula('temperature.target.aircon', yeni);
  }

  /* --- ana sayfadaki kucuk widget --- */
  var evOdakIdx = 0;
  /* Ana sayfadaki TUM widget kontrolleri. Eskiden yalnizca klima vardi ve
     odak "klima bolgesi" diye adlandirilmisti; artik sag yuvada sistem
     widget'i da var, ikisi tek bir gezinme alani. Yon hesabi panellerle
     ayni fonksiyona (yondeEnYakin) birakiliyor — boylece sol bolgeden sag
     bolgeye gecis kendiliginden calisiyor. */
  function evKontrolleri() {
    /* Yalnizca ana sayfa BOLGELERINDEKI widget'lar — depodaki (yerlesmemis)
       widget'larin dugmeleri gezinmeye girmesin. */
    return Array.prototype.slice.call(
      document.querySelectorAll('.bolge .widget .odaklanir'))
      .filter(function (e2) {
        var w = e2.closest ? e2.closest('.widget') : null;
        return !w || !w.hidden;
      });
  }
  function evWidgetVar() { return evKontrolleri().length > 0; }

  function klimaKontrolleri() {
    return Array.prototype.slice.call(
      document.querySelectorAll('#klima-widget .odaklanir'));
  }
  function klimaVar() {
    var w = $('#klima-widget');
    return !!(klimaBul() && w && !w.hidden);
  }

  function klimaWidgetCiz() {
    var w = $('#klima-widget');
    if (!w) return;
    var c = klimaBul();
    if (!c) {                       /* klima yoksa widget hic gorunmesin */
      w.hidden = true;
      if (bolge === 'widget' && !evWidgetVar()) { bolge = 'raf'; }
      return;
    }
    if (w.hidden) { w.hidden = false; cihazIkonu($('#kw-ikon'), 'DEVICE_AIR_CONDITIONER'); }

    var acik   = kaynakDeger(c, 'opr.aircon') === 'POWER_ON';
    var hedef  = kaynakDeger(c, 'temperature.target.aircon');
    var oda    = kaynakDeger(c, 'temperature.aircon');
    var mod    = kaynakDeger(c, 'oprmode.aircon');
    var bagli  = (c.status === 'connected');

    $('#kw-hedef').textContent = derece(hedef);
    $('#kw-guc').classList.toggle('acik', acik);
    w.classList.toggle('pasif', !acik);

    var parcalar = [];
    if (!bagli) parcalar.push(baglantiYazisi(c));
    else if (acik) parcalar.push(MOD_ADI[mod] || 'Açık');
    else parcalar.push('Kapalı');
    if (oda !== null && oda !== undefined) parcalar.push('Oda ' + derece(oda) + '°');
    $('#kw-alt').textContent = parcalar.join(' · ');
  }

  /* Kartlari yeniden kurar ve kumanda odagini korur.
     (Onceden her okumada odak basa donuyordu.) */
  var ilkCihazOdagiBekliyor = false;

  function cihazlariCiz() {
    var dm = $('#cihaz-durum'), kap = $('#cihazlar');
    if (!dm || !kap) return;
    var liste = cihazlar || [];
    while (kap.firstChild) kap.removeChild(kap.firstChild);
    liste.forEach(function (c) { kap.appendChild(cihazKarti(c)); });
    kap.classList.toggle('tekli', liste.length === 1);
    dm.hidden = liste.length > 0;
    if (!liste.length) dm.textContent = 'Kayıtlı cihaz bulunamadı.';
    cihazOdakSinirla();
    if (ilkCihazOdagiBekliyor && gorunum === 'ev-cihaz' &&
        bolge === 'sekme' && cihazOdakVar()) {
      ilkCihazOdagiBekliyor = false;
      bolge = 'cihaz';
    }
    odakCiz();
  }

  function cihazlariOku() {
    var dm = $('#cihaz-durum');
    if (!dm) return;
    luna('luna://com.webos.service.homeconnect/get', {type: 'iotList'}, function (y) {
      if (!y || y.returnValue === false) {
        /* Hata metni onceden gizli kalabiliyordu: cihaz bulunduktan sonra
           servis dusunce dm.hidden true kaliyordu. */
        dm.hidden = false;
        dm.textContent = !y
          ? 'Cihaz servisinden yanıt alınamadı.'
          : 'Cihaz servisi bu uygulamaya kapalı (' + (y.errorText || 'yetki yok') + ')';
        if (y) kayit('homeconnect reddetti: ' + JSON.stringify(y).slice(0, 160));
        /* Kesin ret = bu kurulumda cihaz yok (yanitsizlik degil). */
        if (y) cihazBilgisiGeldi(null);
        return;
      }
      var gelen = (y.response && y.response.iotList) || [];

      /* 24 EKIM: TV'nin IP'si degisince homeconnect bulut oturumunu
         kaybetti ve BASARILI ama BOS liste dondurmeye basladi. Tek bir bos
         cevaba bakip widget'i silmek yanlis: cihaz gercekten gitmis gibi
         gorunuyor, oysa servis kendine geliyor. Ustelik Quick Start+ ile TV
         reboot etmedigi icin bu durum saatlerce surebiliyor.
         Artik: daha once cihaz gorduysek, arka arkaya BOS_SINIR bos cevaba
         kadar eski listeyi "erisilemiyor" olarak tutuyoruz. */
      if (!gelen.length && cihazlar && cihazlar.length && bosSayac < BOS_SINIR) {
        bosSayac++;
        kayit('bos cihaz listesi (' + bosSayac + '/' + BOS_SINIR + '), eski liste korunuyor');
        cihazlar = cihazlar.map(function (c) {
          var k = {}; for (var a in c) if (c.hasOwnProperty(a)) k[a] = c[a];
          k.status = c.status === 'baglaniyor' ? 'baglaniyor' : 'unavailable';
          return k;
        });
        klimaWidgetCiz(); cihazWidgetleriCiz();
        cihazlariCiz();
        return;
      }
      bosSayac = 0;

      var klimalar = [], digerleri = [];
      gelen.forEach(function (c) {
        (c.deviceType === 'DEVICE_AIR_CONDITIONER' ? klimalar : digerleri).push(c);
      });
      cihazlar = klimalar.concat(digerleri);
      kayit('cihaz sayisi: ' + cihazlar.length);
      if (cihazlar.length) cihazOnbellekYaz(cihazlar);
      klimaWidgetCiz(); cihazWidgetleriCiz();    /* once gorunurluk, sonra odak boyamasi */
      cihazBilgisiGeldi(gelen);
      cihazlariCiz();
    });
  }

  /* webOS uygulamayi launch parametresiyle acabiliyor:
       ares-launch -p '{"gorunum":"ev-cihaz"}' com.bilal.sade
     Hem test icin sayfaya dogrudan gitmeyi saglar, hem ileride kisayol
     tanimlanabilir. Gecersiz deger gelirse ana sayfada kalir. */
  /* ======================================================================
     YETENEK SONDASI — hangi luna cagrilari BU UYGULAMAYA acik?

     Neden uygulamanin icinde: paneller luna'yi uygulamanin kimligiyle
     cagiriyor. Root kabugundan yapilan deneme BASKA bir ACL'i olcer, yani
     yaniltir. Sonuc localStorage'a yaziliyor, oradan diskten okunabiliyor:
       /mnt/lg/user/var/lib/wam/Default/Local Storage/leveldb/*.log

     Calistirma:  ares-launch -p '{"sonda":true}' com.bilal.sade
     Normal acilista CALISMAZ.

     YAZMA TESTLERI HICBIR SEYI DEGISTIRMIYOR: mevcut deger geri yaziliyor.
     Ses 19 ise setVolume(19) gonderiliyor — izin varsa returnValue:true
     doner, yoksa reddedilir, ve ses hic degismez.
     Geri alinamayan cagrilar (wifi/connect, bluetooth esleme) SONDAYA
     DAHIL DEGIL; onlarin varligi ikiliden okunur.
     ====================================================================== */
  function sondaCalistir() {
    var sonuc = { zaman: new Date().toISOString(), test: [] };
    var kuyruk = [];

    function yaz() {
      try { localStorage.setItem('sade.sonda', JSON.stringify(sonuc)); } catch (e) {}
    }
    function ekle(ad, tip, uri, yuk) {
      kuyruk.push({ ad: ad, tip: tip, uri: uri, yuk: yuk });
    }
    /* GEC TEST: settingsservice ilk saniyelerde reddediyor olabilir.
       Kullanici simgeyi GORUYOR ama panel "okunamadi" diyor — bu ancak
       okuma BAZEN basariliysa mumkun. Ayni cagriyi 20/45/90. saniyede
       tekrarlayip kaydediyoruz. */
    function gecTest(sn) {
      setTimeout(function () {
        luna('luna://com.webos.settingsservice/getSystemSettings',
             {category: 'picture', keys: ['backlight']}, function (y) {
          var d;
          if (!y) d = 'cevap yok';
          else if (y.returnValue === false) d = 'RED: ' + (y.errorText || '?');
          else d = 'OK deger=' + (y.settings && y.settings.backlight);
          sonuc.test.push({ ad: 'settings backlight @' + sn + 'sn', tip: 'gec', sonuc: d });
          yaz();
        });
      }, sn * 1000);
    }

    function sirayiIsle(i) {
      if (i >= kuyruk.length) {
        sonuc.bitti = true; yaz(); kayit('sonda bitti');
        gecTest(20); gecTest(45); gecTest(90);
        return;
      }
      var k = kuyruk[i];
      var zamanAsimi = setTimeout(function () {
        sonuc.test.push({ ad: k.ad, tip: k.tip, sonuc: 'cevap yok' });
        yaz(); sirayiIsle(i + 1);
      }, 4000);
      luna(k.uri, k.yuk, function (y) {
        clearTimeout(zamanAsimi);
        var d;
        if (!y) d = 'cevap yok';
        else if (y.returnValue === false) d = 'RED: ' + (y.errorText || y.errorCode || '?');
        else d = 'OK';
        sonuc.test.push({ ad: k.ad, tip: k.tip, sonuc: d });
        yaz(); sirayiIsle(i + 1);
      });
    }

    /* Once oku, sonra mevcut degerleri geri yazarak izni test et */
    luna('luna://com.webos.service.audio/master/getVolume', {}, function (sy) {
      var v = sy && sy.volumeStatus;
      luna('luna://com.webos.settingsservice/getSystemSettings',
           {category: 'picture', keys: ['backlight']}, function (py) {
        var bl = py && py.settings && py.settings.backlight;
        luna('luna://com.webos.service.bluetooth2/adapter/getStatus', {}, function (by) {
          var ad2 = by && by.adapters && by.adapters[0];

          ekle('audio getVolume',        'oku',  'luna://com.webos.service.audio/master/getVolume', {});
          /* DOGRU YOL: /master DEGIL. api-permissions.d'den okundu. */
          ekle('audio getSoundOutput',   'oku',  'luna://com.webos.service.audio/getSoundOutput', {});
          ekle('wifi getstatus',         'oku',  'luna://com.webos.service.wifi/getstatus', {});
          ekle('wifi getNetworks',       'oku',  'luna://com.webos.service.wifi/getNetworks', {});
          ekle('wifi getprofilelist',    'oku',  'luna://com.webos.service.wifi/getprofilelist', {});
          ekle('wifi findnetworks',      'oku',  'luna://com.webos.service.wifi/findnetworks', {});
          /* settingsservice REDDEDIYOR gibi gorunuyor ama panel calisiyor.
             Hangi bicimin gectigini bulmak icin varyasyonlar: */
          ekle('settings picture/backlight', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'picture', keys: ['backlight']});
          ekle('settings picture/backlight ABONE', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'picture', keys: ['backlight'], subscribe: true});
          ekle('settings picture (keysiz)', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'picture'});
          ekle('settings option/backlight', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'option', keys: ['backlight']});
          ekle('settings kategorisiz backlight', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {keys: ['backlight']});
          ekle('settings picture/brightness', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'picture', keys: ['brightness']});
          ekle('settings general/localeInfo', 'oku', 'luna://com.webos.settingsservice/getSystemSettings',
               {category: 'general', keys: ['localeInfo']});
          ekle('connectionmanager',      'oku',  'luna://com.webos.service.connectionmanager/getstatus', {});
          ekle('bluetooth adapter',      'oku',  'luna://com.webos.service.bluetooth2/adapter/getStatus', {});
          ekle('bluetooth device',       'oku',  'luna://com.webos.service.bluetooth2/device/getStatus', {});
          ekle('homeconnect iotList',    'oku',  'luna://com.webos.service.homeconnect/get', {type: 'iotList'});

          if (v && typeof v.volume === 'number') {
            ekle('audio setVolume (ayni deger)', 'yaz',
                 'luna://com.webos.service.audio/master/setVolume', {volume: v.volume});
          }
          /* setMute HIC test edilmemisti — "setVolume ile ayni gruptadir"
             diye varsaymistim. Mevcut degeri yaziyoruz, hicbir sey degismez. */
          if (v && typeof v.muteStatus === 'boolean') {
            ekle('audio setMute (ayni deger)', 'yaz',
                 'luna://com.webos.service.audio/master/muteVolume', {mute: v.muteStatus});
          }
          if (v && v.soundOutput) {
            ekle('audio setSoundOutput (ayni deger)', 'yaz',
                 'luna://com.webos.service.audio/setSoundOutput', {output: v.soundOutput});
          }
          if (bl !== undefined && bl !== null) {
            ekle('settings backlight yaz (ayni deger)', 'yaz',
                 'luna://com.webos.settingsservice/setSystemSettings',
                 {category: 'picture', settings: {backlight: String(bl)}});
          }
          if (ad2 && typeof ad2.powered === 'boolean') {
            ekle('bluetooth setState (ayni deger)', 'yaz',
                 'luna://com.webos.service.bluetooth2/adapter/setState', {powered: ad2.powered});
          }

          sonuc.baslangic = {
            ses: v ? v.volume : null, cikis: v ? v.soundOutput : null,
            parlaklik: bl, btAcik: ad2 ? ad2.powered : null
          };
          kayit('sonda basladi: ' + kuyruk.length + ' cagri');
          yaz();
          sirayiIsle(0);
        });
      });
    });
  }

  function baslangicGorunumu() {
    var p = null;
    try {
      if (window.PalmSystem && PalmSystem.launchParams) {
        p = JSON.parse(PalmSystem.launchParams);
      }
    } catch (e) { p = null; }
    if (p && p.sonda) { sondaCalistir(); return; }
    /* ares-launch -p '{"harita":true}' (ya da "istanbul"): haritayi dogrudan
       ac — ana sayfada Yol/Trafik widget'i olmasa da denenebilsin. */
    if (p && p.harita) {
      harita.gorunum = p.harita === 'istanbul' ? 1 : p.harita === 'duraklar' ? 2 : 0;
      kayit('baslatma parametresi -> harita');
      haritaAc();
      return;
    }
    var y = p && p.gorunum;
    if (!y) return;
    if (!document.getElementById('gorunum-' + y)) { kayit('bilinmeyen gorunum: ' + y); return; }
    var sek = Array.prototype.slice.call(document.querySelectorAll('.sekme'));
    for (var i = 0; i < sek.length; i++) {
      if (sek[i].getAttribute('data-gorunum') === y) { sekmeyeGit(i); break; }
    }
    kayit('baslatma parametresi -> ' + y);
    /* Cihazlar asenkron geliyor; gorunumDegistir bu anda odaklanacak kontrol
       bulamayip sekmede kaliyor. Bayragi birakiyoruz, liste gelince
       cihazlariCiz() odagi iceri alacak. Yalnizca ilk cizimde, yoksa
       kullanici bilerek yukari ciktiysa odagini calardi. */
    if (y === 'ev-cihaz') ilkCihazOdagiBekliyor = true;
    gorunumDegistir(y, true);
  }

  /* =======================================================================
     AYARLAR SAYFASI — dock duzenleme
     Liste tek bir .odak-kart, her uygulama bir .odak-satir. Satirlar once
     dock sirasina gore, sonra dock disindakiler.
     ======================================================================= */
  function okDugmesi(isim, yon, olmaz) {
    var d = document.createElement('div');
    d.className = 'ayar-dugme odaklanir' + (olmaz ? ' olmaz' : '');
    d.setAttribute('data-is', isim);
    var sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('viewBox', '0 0 64 64');
    el(sv, 'path', {d: yon === 'sol' ? 'M40 14L22 32l18 18' : 'M24 14l18 18-18 18',
                    fill: 'none', stroke: 'currentColor', 'stroke-width': 6,
                    'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
    d.appendChild(sv);
    return d;
  }

  /* --- odaga gore ayar aciklamasi ---------------------------------------
     Fikir ammar027/lumen-webos'un ayarlar ekranindan: satirin ne yaptigini
     satira sikistirmak yerine ustteki tek satirda anlatmak. Satirlar temiz
     kaliyor, aciklamaya da bol yer kaliyor.

     Bizde ozellikle bir seyi cozuyor: uygulama dock'ta DEGILKEN ok
     dugmeleri gorunur ama etkisiz birakiliyor (satirlarin sutun sayisi
     degismesin, odak satir degistirince kaymasin diye). Kullanici bunun
     neden tiklanmadigini bilemiyordu — artik yaziyor. */
  var AYAR_VARSAYILAN = 'Dock’ta görünecek uygulamaları seç ve sırala.';

  function ayarAciklamasi(secili) {
    if (!secili) return AYAR_VARSAYILAN;
    var is = secili.getAttribute('data-is');
    if (is === 'dock-sifirla') return 'Dock’u varsayılan uygulamalara döndürür.';

    var appId = secili.getAttribute('data-app');
    if (!appId) return AYAR_VARSAYILAN;
    var ad = appId, i;
    for (i = 0; i < UYGULAMALAR.length; i++) {
      if (UYGULAMALAR[i].id === appId) { ad = UYGULAMALAR[i].ad; break; }
    }
    var sira = -1;
    for (i = 0; i < DOCK.length; i++) if (DOCK[i].id === appId) { sira = i; break; }

    if (is === 'dock-ac') {
      if (sira >= 0) {
        return DOCK.length <= 1
          ? 'Dock boş kalamaz — önce başka bir uygulama ekle.'
          : ad + ' dock\u2019tan çıkarılır. Tüm Uygulamalar\u2019da kalır.';
      }
      return DOCK.length >= DOCK_AZAMI
        ? 'Dock dolu (' + DOCK.length + '/' + DOCK_AZAMI +
          '). Önce bir uygulamayı çıkar, sonra ' + ad + ' eklenebilir.'
        : ad + ' dock\u2019un sonuna eklenir (' +
          (DOCK.length + 1) + '/' + DOCK_AZAMI + ').';
    }
    if (is === 'dock-sol' || is === 'dock-sag') {
      if (sira < 0) return ad + ' dock’ta değil — önce ekle, sonra sıralayabilirsin.';
      if (secili.classList.contains('olmaz')) {
        return ad + (is === 'dock-sol' ? ' zaten ilk sırada.' : ' zaten son sırada.');
      }
      return ad + ' bir ' + (is === 'dock-sol' ? 'sola' : 'sağa') +
             ' taşınır — şu an ' + (sira + 1) + '. sırada.';
    }
    return AYAR_VARSAYILAN;
  }

  function ayarlariCiz() {
    var kap = $('#ayarlar-liste');
    if (!kap) return;
    while (kap.firstChild) kap.removeChild(kap.firstChild);

    var dockIds = DOCK.map(function (u) { return u.id; });
    var sirali = DOCK.slice();
    UYGULAMALAR.forEach(function (u) {
      if (dockIds.indexOf(u.id) < 0) sirali.push(u);
    });

    var kart = document.createElement('div');
    kart.className = 'ayar-kart odak-kart';
    /* Kart sabit kaliyor (yuvarlak kosesi, zemini bozulmasin); satirlar
       ONUN ICINDE kayiyor. Karti kaydirinca alt dolgusu kirpiliyor ve
       kose kesik gorunuyordu. */
    var ic2 = document.createElement('div');
    ic2.className = 'ayar-ic';

    sirali.forEach(function (u) {
      var dockta = dockIds.indexOf(u.id);
      var sat = document.createElement('div');
      sat.className = 'ayar-satir odak-satir' + (dockta < 0 ? ' disarda' : '');

      var ik = document.createElement('div'); ik.className = 'ayar-ikon';
      var img = new Image();
      ik.appendChild(img);
      (function (img, ik) {
        ikonYukle(img, u, function () { if (img.parentNode) ik.removeChild(img); });
      })(img, ik);

      var ad = document.createElement('div'); ad.className = 'ayar-ad';
      ad.textContent = u.ad;
      var yer = document.createElement('div'); yer.className = 'ayar-yer';
      yer.textContent = dockta < 0 ? '—' : String(dockta + 1);

      var dg = document.createElement('div'); dg.className = 'ayar-dugmeler';
      /* Dock disindaysa ok dugmeleri anlamsiz: gorunur ama soluk ve etkisiz.
         Gizlemek yerine soluk birakiyoruz ki satirlarin sutun sayisi
         degismesin ve odak satir degistirince kaymasin. */
      var ilk = (dockta === 0), son = (dockta === DOCK.length - 1);
      var sol = okDugmesi('dock-sol', 'sol', dockta < 0 || ilk);
      var sag = okDugmesi('dock-sag', 'sag', dockta < 0 || son);
      var ac  = document.createElement('div');
      /* Dock doluyken "Ekle" soluk: gorunur ve odaklanilabilir kaliyor
         (sutun sayisi sabit kalsin) ama yapilamayacagi belli oluyor. */
      var dockDolu = (dockta < 0 && DOCK.length >= DOCK_AZAMI);
      ac.className = 'ayar-dugme odaklanir' + (dockta >= 0 ? ' acik' : '')
                   + (dockDolu ? ' olmaz' : '');
      ac.setAttribute('data-is', 'dock-ac');
      ac.textContent = dockta >= 0 ? 'Dock\u2019ta' : 'Ekle';

      sol.setAttribute('data-app', u.id);
      sag.setAttribute('data-app', u.id);
      ac.setAttribute('data-app', u.id);
      dg.appendChild(sol); dg.appendChild(sag); dg.appendChild(ac);

      sat.appendChild(ik); sat.appendChild(ad); sat.appendChild(yer); sat.appendChild(dg);
      ic2.appendChild(sat);
    });

    /* en altta: varsayilana don */
    var son2 = document.createElement('div');
    son2.className = 'ayar-satir odak-satir';
    var bos = document.createElement('div'); bos.className = 'ayar-ikon';
    var ad2 = document.createElement('div'); ad2.className = 'ayar-ad';
    ad2.textContent = 'Dock\u2019u varsayılana döndür';
    var dg2 = document.createElement('div'); dg2.className = 'ayar-dugmeler';
    var sif = document.createElement('div');
    sif.className = 'ayar-dugme odaklanir';
    sif.setAttribute('data-is', 'dock-sifirla');
    sif.textContent = 'Sıfırla';
    dg2.appendChild(sif);
    son2.appendChild(bos); son2.appendChild(ad2); son2.appendChild(dg2);
    ic2.appendChild(son2);
    kart.appendChild(ic2);
    kap.appendChild(kart);
    cihazOdakSinirla();
  }

  /* Odakli satir gorunur kalsin: liste sabit yukseklikte ve tasan kismi
     kirpiliyor, bu yuzden kart dikeyde kaydiriliyor. (Dock'taki yatay
     kaydirmanin dikey karsiligi.) */
  function ayarlariKaydir() {
    var kap = $('#ayarlar-liste');
    if (!kap) return;
    var kart = kap.firstChild;
    var ic2 = kart && kart.firstChild;
    if (!ic2) return;
    var satirlar = Array.prototype.slice.call(ic2.querySelectorAll('.odak-satir'));
    var s2 = satirlar[cihazSatirIdx];
    if (!s2) return;
    var pencere = kart.clientHeight;              /* kartin ic yuksekligi */
    var enFazla = Math.max(0, ic2.offsetHeight - pencere);
    var y = parseFloat(kap.getAttribute('data-y')) || 0;
    var ust = s2.offsetTop, alt = ust + s2.offsetHeight;
    if (ust < y) y = ust;
    else if (alt > y + pencere) y = alt - pencere;
    if (y < 0) y = 0;
    if (y > enFazla) y = enFazla;
    kap.setAttribute('data-y', y);
    ic2.style.transform = 'translateY(' + (-y) + 'px)';
  }

  /* Dock degisti: kaydet, dock'u yeniden kur, listeyi tazele, odagi koru. */
  function dockGuncelle(ids) {
    dockIdYaz(ids);
    DOCK = ids.map(uygulamaBul).filter(Boolean);
    if (rafIdx > DOCK.length - 1) rafIdx = Math.max(0, DOCK.length - 1);
    var ic = $('#raf-ic');
    if (ic) {
      while (ic.firstChild) ic.removeChild(ic.firstChild);
      ic.setAttribute('data-x', '0');
      DOCK.forEach(function (u) { ic.appendChild(kartYap(u)); });
    }
    ayarlariCiz();
    odakCiz();
  }

  function ayarIsi(is, el2) {
    var id = el2 && el2.getAttribute('data-app');
    var ids = DOCK.map(function (u) { return u.id; });
    var i = ids.indexOf(id);
    if (is === 'dock-sifirla') { dockGuncelle(varsayilanDock()); return; }
    if (is === 'dock-ac') {
      if (i >= 0) {
        if (ids.length <= 1) return;        /* dock bos kalmasin */
        ids.splice(i, 1);
      } else if (uygulamaBul(id)) {
        /* Dock tavanda — sessizce eklemek yerine hic ekleme. Neden ekleyemedigi
           ayarAciklamasi() ile ustteki satirda yaziyor. */
        if (ids.length >= DOCK_AZAMI) return;
        ids.push(id);
      }
      dockGuncelle(ids);
      return;
    }
    if (i < 0) return;                       /* dock disinda ok anlamsiz */
    if (is === 'dock-sol' && i > 0) {
      ids[i] = ids[i - 1]; ids[i - 1] = id;
      cihazSatirIdx = Math.max(0, cihazSatirIdx - 1);
      dockGuncelle(ids);
    } else if (is === 'dock-sag' && i < ids.length - 1) {
      ids[i] = ids[i + 1]; ids[i + 1] = id;
      cihazSatirIdx = cihazSatirIdx + 1;
      dockGuncelle(ids);
    }
  }

  /* ---------- baslat ----------------------------------------------------- */
  /* =======================================================================
     WIDGET YERLESIMI VE GALERI
     Ana sayfa iki bolge (sol/sag), her biri 3 satir. Hangi widget'in nerede
     duracagi kullanicinin tercihi; localStorage'da tutuluyor. Galeri (eski
     "Ev" sekmesi) tum widget'lari gruplu ve canli onizlemeli gosteriyor,
     ENTER yerlesim sayfasini aciyor.
     ======================================================================= */
  var WIDGET = {
    hava:      { sec: '#hava-panel',       ad: 'Hava durumu', boy: 'büyük', sat: 2, grup: 'Bilgi' },
    namaz:     { sec: '#ezan-panel',       ad: 'Namaz vakitleri', boy: 'büyük', sat: 2, grup: 'Bilgi' },
    havaKucuk: { sec: '#hava-kucuk-widget', ad: 'Hava durumu',     sat: 1, grup: 'Bilgi' },
    namazKucuk: { sec: '#namaz-kucuk-widget', ad: 'Namaz vakitleri', sat: 1, grup: 'Bilgi' },
    piyasaGenis: { sec: '#piyasa-genis-widget', ad: 'Piyasalar', boy: 'büyük', sat: 2, grup: 'Bilgi' },
    piyasa:    { sec: '#piyasa-widget',    ad: 'Piyasalar',        sat: 1, grup: 'Bilgi' },
    trafik:    { sec: '#trafik-widget',    ad: 'Trafik',           sat: 1, grup: 'Bilgi' },
    yolGenis:  { sec: '#yol-genis-widget', ad: 'Yol durumu', boy: 'büyük', sat: 2, grup: 'Bilgi',
                 kosul: function () { return !(yolVeri && yolVeri.tanimsiz); } },
    yol:       { sec: '#yol-widget',       ad: 'Yol durumu',       sat: 1, grup: 'Bilgi',
                 kosul: function () { return !(yolVeri && yolVeri.tanimsiz); } },
    durakGenis: { sec: '#durak-genis-widget', ad: 'Duraklar', boy: 'büyük', sat: 2, grup: 'Bilgi', kosul: durakVarMi },
    durak:     { sec: '#durak-widget',     ad: 'Duraklar',         sat: 1, grup: 'Bilgi', kosul: durakVarMi },
    sistem:    { sec: '#sistem-widget',    ad: 'TV',               sat: 1, grup: 'TV', ortaYok: true },
    ekran:     { sec: '#ekran-widget',     ad: 'Ekran süresi',     sat: 1, grup: 'TV' },
    uyku:      { sec: '#uyku-widget',      ad: 'Uyku zamanlayıcı', sat: 1, grup: 'TV' },
    film:      { sec: '#film-widget',      ad: 'Film modu',        sat: 1, grup: 'TV' },
    klima:     { sec: '#klima-widget',     ad: 'Klima',            sat: 1, grup: 'Ev', tip: 'DEVICE_AIR_CONDITIONER' },
    camasir:   { sec: '#camasir-widget',   ad: 'Çamaşır makinesi', sat: 1, grup: 'Ev', tip: 'DEVICE_WASHER' },
    buzdolabi: { sec: '#buzdolabi-widget', ad: 'Buzdolabı',        sat: 1, grup: 'Ev', tip: 'DEVICE_REFRIGERATOR' },
    bulasik:   { sec: '#bulasik-widget',   ad: 'Bulaşık makinesi', sat: 1, grup: 'Ev', tip: 'DEVICE_DISH_WASHER' }
  };
  /* Sira galerideki sirayi ve yogun dizmeyi belirliyor: 3x2'ler once,
     3x1'ler yanlarindaki bosluga alt alta oturuyor. */
  var WIDGET_SIRA = ['hava', 'namaz', 'piyasaGenis', 'yolGenis', 'durakGenis',
                     'havaKucuk', 'namazKucuk', 'piyasa', 'trafik', 'yol', 'durak',
                     'sistem', 'ekran', 'uyku', 'film',
                     'klima', 'camasir', 'buzdolabi', 'bulasik'];
  /* Bilgi = dis dunya, TV = bu TV, Ev = evdeki cihazlar. */
  var GRUPLAR = ['Bilgi', 'TV', 'Ev'];
  var YERLESIM_ANAHTAR = 'sade.yerlesim';
  /* Ilk acilis yerlesimi: yapilandirma.js'te verilmediyse bu evin ana
     sayfasi. Evde olmayan bir cihazin widget'i (ornegin klimasiz bir ev)
     cihaz listesi gelince ayni boydaki bir yedekle degisiyor — bos satir
     kalmasin. Yedekler her TV'de calisan widget'lar. */
  var VARSAYILAN_YERLESIM = (AYAR.varsayilanYerlesim && AYAR.varsayilanYerlesim.sol &&
                             AYAR.varsayilanYerlesim.sag)
    ? AYAR.varsayilanYerlesim
    : { sol: ['hava', 'klima'], sag: ['namaz', 'sistem'], orta: [] };
  var CIHAZ_YEDEK = ['ekran', 'uyku', 'film'];
  var yerlesimKayitli = false;   /* kullanici bir kez degistirdi mi */
  var cihazBilgisi = false;      /* cihaz servisi kesin bir cevap verdi mi (liste ya da ret) */
  var BOLGE_SATIR = 3;
  /* Orta bolge: saatin altinda, yan bolgelerin UCUNCU satiriyla ayni hizada
     tek satir (552 px). Yalnizca 1 satirlik widget; TV widget'i da degil —
     genisleyince dock'un ustune tasar. */
  var BOLGELER = ['sol', 'orta', 'sag'];
  var BOLGE_KAPASITE = { sol: BOLGE_SATIR, orta: 1, sag: BOLGE_SATIR };
  var BOLGE_AD = { sol: 'Sol', orta: 'Orta', sag: 'Sağ' };
  var BOLGE_YON = { sol: 'Sola', orta: 'Ortaya', sag: 'Sağa' };
  function bolgeyeUyar(id, b) { return !(b === 'orta' && (WIDGET[id].sat > 1 || WIDGET[id].ortaYok)); }
  var yerlesim = null;

  function yerlesimKopya(y) { return { sol: y.sol.slice(), sag: y.sag.slice(), orta: (y.orta || []).slice() }; }

  /* Yalnizca GORUNEN widget'lar yer kaplar. Cihazi bulunmayan widget
     kayitta kaliyor (homeconnect bazen saatlerce bos liste donuyor; cihaz
     geri gelince yerine donsun) ama ne doluluk sayacinda ne de "X yerine"
     onerilerinde sayiliyor. Laboratuvarda olculen eski durum: klimasiz
     evde galeri "6/6 dolu" deyip gorunmeyen klimanin yerini oneriyordu. */
  function bolgeDoluluk(l) {
    var s = 0;
    for (var i = 0; i < l.length; i++) if (widgetMevcut(l[i])) s += WIDGET[l[i]].sat;
    return s;
  }

  /* Bozuk ya da eski bir kayit uygulamayi bozmasin: bilinmeyen kimlik,
     ikinci kez gecen kimlik ve bolgeye sigmayan widget atiliyor. */
  function yerlesimDogrula(y) {
    if (!y || !y.sol || !y.sag) return null;
    var gorulen = {};
    function temizle(l, b) {
      var out = [], s = 0;
      (l || []).forEach(function (id) {
        if (!WIDGET[id] || gorulen[id] || !bolgeyeUyar(id, b)) return;
        var sat = widgetMevcut(id) ? WIDGET[id].sat : 0;
        if (s + sat > BOLGE_KAPASITE[b]) return;
        gorulen[id] = true; out.push(id); s += sat;
      });
      return out;
    }
    /* eski kayitlarda orta yok: bos */
    return { sol: temizle(y.sol, 'sol'), sag: temizle(y.sag, 'sag'), orta: temizle(y.orta, 'orta') };
  }

  function varsayilanYerlesim() {
    var y = yerlesimKopya(VARSAYILAN_YERLESIM);
    if (cihazBilgisi) {
      var kullanilan = y.sol.concat(y.sag, y.orta);
      BOLGELER.forEach(function (b) {
        y[b] = y[b].map(function (id) {
          if (!WIDGET[id] || widgetMevcut(id)) return id;
          var yedek = CIHAZ_YEDEK.filter(function (z) {
            return kullanilan.indexOf(z) < 0 && WIDGET[z].sat === WIDGET[id].sat;
          })[0];
          if (yedek) kullanilan.push(yedek);
          return yedek || null;
        }).filter(function (id) { return !!id; });
      });
    }
    return yerlesimDogrula(y) || { sol: [], sag: [] };
  }

  function yerlesimOku() {
    var y = null;
    try { y = JSON.parse(localStorage.getItem(YERLESIM_ANAHTAR) || 'null'); } catch (e) {}
    var d = yerlesimDogrula(y);
    yerlesimKayitli = !!d;
    yerlesim = d || varsayilanYerlesim();
  }

  function yerlesimYaz() {
    yerlesimKayitli = true;
    try { localStorage.setItem(YERLESIM_ANAHTAR, JSON.stringify(yerlesim)); } catch (e) {}
  }

  /* Cihaz gorunmezken bosalan satira baska bir widget kondu, sonra cihaz
     geri geldi: bolge tasar. Kullanicinin bilerek koydugu kalir, geri
     gelen cihaz widget'i cikar. */
  function yerlesimSigdir() {
    var degisti = false;
    BOLGELER.forEach(function (b) {
      var l = yerlesim[b];
      while (bolgeDoluluk(l) > BOLGE_KAPASITE[b]) {
        var i = l.length - 1;
        while (i >= 0 && !WIDGET[l[i]].tip) i--;
        if (i < 0) i = l.length - 1;
        kayit('yerlesim: ' + l[i] + ' sigmadi, cikarildi');
        l.splice(i, 1);
        degisti = true;
      }
    });
    if (degisti && yerlesimKayitli) yerlesimYaz();
  }

  /* Cihaz servisinden cevap geldi (liste ya da ret: null). Kullanici
     yerlesimi hic degistirmediyse varsayilan, evde gercekten olan cihazlara
     gore HER guncellemede yeniden kuruluyor — cihaz sonradan gelirse yerine
     doner.
     25 EKIM, TV'de olculdu: acilis aninda homeconnect BASARILI ama BOS
     liste dondu, klima "yok" sanilip yerine Ekran suresi kondu; bir dakika
     sonra klima "connected". Bu yuzden tek bos cevap kesin bilgi degil:
     art arda iki bos cevap (60 sn arayla) gerekiyor. Ret kesin bilgidir. */
  var bosArdArda = 0;
  function cihazBilgisiGeldi(liste) {
    if (liste && !liste.length) { if (++bosArdArda < 2) return; }
    else bosArdArda = 0;
    cihazBilgisi = true;
    var once = JSON.stringify(yerlesim);
    if (!yerlesimKayitli) yerlesim = varsayilanYerlesim();
    /* Yalnizca degisiklik ya da tasma varsa yeniden yerlestir: yerlesimUygula
       acik TV widget'ini kapatiyor, her 60 sn'de bir kapanmasin. */
    var tasiyor = BOLGELER.some(function (b) { return bolgeDoluluk(yerlesim[b]) > BOLGE_KAPASITE[b]; });
    if (JSON.stringify(yerlesim) !== once || tasiyor) yerlesimUygula();
  }

  function widgetGerekli(id) {
    return gorunum === 'widget' || !!(yerlesim && widgetNerede(id));
  }

  /* Yeni yerlesen widget bir sonraki 5 dk'lik turu beklemesin. */
  function widgetVerisiTazele(id) {
    if (id === 'ekran') ekranOku();
    else if (id === 'uyku') uykuOku();
    else if (id === 'film') filmOku();
    else if (id === 'piyasa' || id === 'piyasaGenis') piyasaOku();
    else if (id === 'trafik') trafikOku();
    else if (id === 'yol' || id === 'yolGenis' || id === 'durak' || id === 'durakGenis') { yolOku(); trafikOku(); }
  }

  function widgetNerede(id) {
    if (yerlesim.sol.indexOf(id) >= 0) return 'sol';
    if (yerlesim.sag.indexOf(id) >= 0) return 'sag';
    if (yerlesim.orta.indexOf(id) >= 0) return 'orta';
    return null;
  }

  /* Widget elemanlarini tercihe gore bolgelere tasir. Yerlesmemis olanlar
     gorunmez depoda bekliyor; veri cizimleri onlara da yaziyor, yani
     eklendigi an guncel gorunuyor. */
  function yerlesimUygula() {
    var depo = $('#widget-depo'), sol = $('#bolge-sol'), sag = $('#bolge-sag'), orta = $('#bolge-orta');
    if (!depo || !sol || !sag) return;
    if (sistemGenis) sistemGenislet();      /* genis haldeyken tasima yapma */
    yerlesimSigdir();
    WIDGET_SIRA.forEach(function (id) {
      var e = $(WIDGET[id].sec);
      if (e && widgetNerede(id) === null && e.parentNode !== depo) depo.appendChild(e);
    });
    yerlesim.sol.forEach(function (id) { var e = $(WIDGET[id].sec); if (e) sol.appendChild(e); });
    yerlesim.sag.forEach(function (id) { var e = $(WIDGET[id].sec); if (e) sag.appendChild(e); });
    if (orta) yerlesim.orta.forEach(function (id) { var e = $(WIDGET[id].sec); if (e) orta.appendChild(e); });
  }

  /* --- cihaz widget'lari ------------------------------------------------ */
  function cihazBul(tip) {
    if (!cihazlar) return null;
    for (var i = 0; i < cihazlar.length; i++) {
      if (cihazlar[i].deviceType === tip) return cihazlar[i];
    }
    return null;
  }

  var ikonCizildi = {};
  function cihazIkonuBirKez(svgSec, tip) {
    if (ikonCizildi[svgSec]) return;
    var s = $(svgSec);
    if (s) { cihazIkonu(s, tip); ikonCizildi[svgSec] = true; }
  }

  /* ThinQ durum degerleri. Bu TV'de gorulen: POWER_OFF. Digerleri LG'nin
     ThinQ sozlugunden; tanimadigimiz bir deger gelirse BUYUK_HARF_ALT
     cizgiyi okunur hale getirip gosteriyoruz — yanlis ceviri yapmaktansa. */
  var DURUM_ADI = {
    POWER_OFF: 'Kapalı', INITIAL: 'Hazır', STANDBY: 'Hazır', PAUSE: 'Duraklatıldı',
    DETECTING: 'Yük algılanıyor', RUNNING: 'Yıkanıyor', WASHING: 'Yıkanıyor',
    RINSING: 'Durulanıyor', SPINNING: 'Sıkılıyor', DRYING: 'Kurutuluyor',
    COOLING: 'Soğutuluyor', END: 'Bitti', COMPLETE: 'Bitti', ERROR: 'Hata'
  };
  function durumAdi(d) {
    if (!d) return '';
    if (DURUM_ADI[d]) return DURUM_ADI[d];
    var s = String(d).toLowerCase().replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function kalanSure(c) {
    var sa = Number(kaynakDeger(c, 'time.remain.hour2')) || 0;
    var dk = Number(kaynakDeger(c, 'time.remain.minute2')) || 0;
    if (!sa && !dk) return null;
    return sa + ':' + (dk < 10 ? '0' : '') + dk;
  }

  function yikamaWidgetCiz(wsec, ad, tip, durumKaynak, kursKaynak) {
    var w = $(wsec);
    if (!w) return;
    var c = cihazBul(tip);
    if (!c) { w.hidden = true; return; }
    w.hidden = false;
    cihazIkonuBirKez('#cw-' + ad + '-ikon', tip);
    var alt = $('#cw-' + ad + '-alt'), sag = $('#cw-' + ad + '-sag');
    var bagli = c.status === 'connected';
    w.classList.toggle('pasif', !bagli);
    w.classList.remove('uyari');
    if (!bagli) { alt.textContent = baglantiYazisi(c); sag.innerHTML = ''; return; }
    var d = kaynakDeger(c, durumKaynak);
    var kurs = kursKaynak ? kaynakDeger(c, kursKaynak) : null;
    var kalan = kalanSure(c);
    var calisiyor = d && d !== 'POWER_OFF' && d !== 'END' && d !== 'COMPLETE';
    alt.textContent = (kurs && calisiyor ? durumAdi(kurs) + ' · ' : '') + (durumAdi(d) || 'Kapalı');
    sag.innerHTML = (calisiyor && kalan)
      ? '<div class="cw-buyuk">' + kalan + '</div><div class="cw-kucuk">kaldı</div>'
      : '';
  }

  function eksiIsareti(v) {
    var n = Number(v);
    if (isNaN(n)) return '—';
    return (n < 0 ? '−' + Math.abs(n) : String(n)) + '°';
  }

  function buzdolabiWidgetCiz() {
    var w = $('#buzdolabi-widget');
    if (!w) return;
    var c = cihazBul('DEVICE_REFRIGERATOR');
    if (!c) { w.hidden = true; return; }
    w.hidden = false;
    cihazIkonuBirKez('#cw-buzdolabi-ikon', 'DEVICE_REFRIGERATOR');
    var alt = $('#cw-buzdolabi-alt'), sag = $('#cw-buzdolabi-sag');
    var bagli = c.status === 'connected';
    w.classList.toggle('pasif', !bagli);
    if (!bagli) { w.classList.remove('uyari'); alt.textContent = baglantiYazisi(c); sag.innerHTML = ''; return; }
    var kapak = kaynakDeger(c, 'door.main');
    var acik = kapak === 'OPEN';
    w.classList.toggle('uyari', acik);
    alt.textContent = acik ? 'Kapak açık' : 'Kapak kapalı';
    sag.innerHTML =
      '<div class="cw-ikili">' +
      '<div><div class="cw-buyuk">' + eksiIsareti(kaynakDeger(c, 'temperature.fridge')) + '</div>' +
      '<div class="cw-kucuk">soğutucu</div></div>' +
      '<div><div class="cw-buyuk">' + eksiIsareti(kaynakDeger(c, 'temperature.freezer')) + '</div>' +
      '<div class="cw-kucuk">dondurucu</div></div></div>';
  }

  var galeriImza = '';
  function cihazWidgetleriCiz() {
    yikamaWidgetCiz('#camasir-widget', 'camasir', 'DEVICE_WASHER', 'state.washer', 'washer.course');
    yikamaWidgetCiz('#bulasik-widget', 'bulasik', 'DEVICE_DISH_WASHER', 'state.dishwasher', null);
    buzdolabiWidgetCiz();
    /* Galeri aciksa ve cihaz KUMESI degistiyse yeniden ciz. Her yenilemede
       cizmek, kullanici gezinirken onizlemeleri titretirdi. */
    var imza = WIDGET_SIRA.filter(widgetMevcut).join(',');
    if (gorunum === 'widget' && imza !== galeriImza && !wSayfa) galeriCiz();
  }

  /* --- galeri ------------------------------------------------------------- */
  /* tip: evde o LG cihazi olmali. kosul: verinin kendisi "burada yok"
     diyorsa (ornegin guzergah tanimsiz) widget hic gorunmez. */
  function widgetMevcut(id) {
    var w = WIDGET[id];
    if (w.kosul && !w.kosul()) return false;
    return !w.tip || !!cihazBul(w.tip);
  }

  var onizlemeSayac = 0;
  function onizlemeKlonu(id) {
    var asil = $(WIDGET[id].sec);
    if (!asil) return document.createElement('div');
    var k = asil.cloneNode(true);
    k.removeAttribute('hidden');
    k.removeAttribute('id');
    k.classList.remove('genis');
    /* id'leri SILME, yeniden adlandir: SVG ikonlarin renk gecisleri
       url(#gN) ile id'ye bagli. Asil kopyaya bagli kalirsa ve asil depoda
       (display:none) duruyorsa Chromium gecisi cizmiyor — ikon bos cikiyor. */
    var ek = '-on' + (++onizlemeSayac);
    Array.prototype.forEach.call(k.querySelectorAll('[id]'), function (x) {
      x.setAttribute('id', x.getAttribute('id') + ek);
    });
    Array.prototype.forEach.call(k.querySelectorAll('[fill^="url(#"],[stroke^="url(#"]'), function (x) {
      ['fill', 'stroke'].forEach(function (a) {
        var v = x.getAttribute(a);
        if (v && v.indexOf('url(#') === 0) x.setAttribute(a, v.replace(/\)$/, ek + ')'));
      });
    });
    /* Onizleme bir resim gibi davranmali: icindeki dugmeler odaklanmasin. */
    Array.prototype.forEach.call(k.querySelectorAll('.odaklanir, .odak'), function (x) {
      x.classList.remove('odaklanir'); x.classList.remove('odak');
    });
    Array.prototype.forEach.call(k.querySelectorAll('.sw-ayrinti'), function (x) { x.hidden = true; });
    k.setAttribute('data-sat', String(WIDGET[id].sat));
    k.style.height = (WIDGET[id].sat === 2 ? 350 : 159) + 'px';
    return k;
  }

  var galeriIdx = 0;

  function galeriCiz() {
    var k = $('#wg-icerik'), kap = $('#wg-kapasite');
    if (!k) return;
    var odakId = null;
    var eskiler = galeriOgeleri();
    if (eskiler[galeriIdx]) odakId = eskiler[galeriIdx].getAttribute('data-wid');
    while (k.firstChild) k.removeChild(k.firstChild);

    var dolu = 0, kapasite = 0;
    BOLGELER.forEach(function (b) { dolu += bolgeDoluluk(yerlesim[b]); kapasite += BOLGE_KAPASITE[b]; });
    if (kap) kap.innerHTML = 'Ana sayfa <b>' + dolu + ' / ' + kapasite + '</b> satır dolu';

    GRUPLAR.forEach(function (g) {
      var idler = WIDGET_SIRA.filter(function (id) { return WIDGET[id].grup === g && widgetMevcut(id); });
      if (!idler.length) return;
      var b = document.createElement('div'); b.className = 'wg-bolum';
      var et = document.createElement('div'); et.className = 'wg-etiket'; et.textContent = g;
      b.appendChild(et);
      var iz = document.createElement('div'); iz.className = 'wg-izgara';
      idler.forEach(function (id) {
        var o = document.createElement('div');
        o.className = 'wg-oge wg-secilir' + (WIDGET[id].sat === 2 ? ' cift' : '');
        o.setAttribute('data-wid', id);
        var on = document.createElement('div'); on.className = 'wg-onizleme';
        on.style.height = Math.round((WIDGET[id].sat === 2 ? 350 : 159) * 0.7) + 'px';
        on.appendChild(onizlemeKlonu(id));
        o.appendChild(on);
        var a = document.createElement('div'); a.className = 'wg-alt';
        var ad = document.createElement('b');
        ad.textContent = WIDGET[id].ad + (WIDGET[id].boy ? ' · ' + WIDGET[id].boy : '');
        var dr = document.createElement('span');
        var yer = widgetNerede(id);
        dr.className = yer ? 'wg-yer' : 'wg-ekle';
        dr.textContent = yer ? 'Ana sayfada · ' + BOLGE_AD[yer] : 'Ekle';
        a.appendChild(ad); a.appendChild(dr);
        o.appendChild(a);
        iz.appendChild(o);
      });
      b.appendChild(iz);
      if (g === 'Ev') {
        var bg = document.createElement('div');
        bg.className = 'wg-baglanti wg-secilir';
        bg.setAttribute('data-wid', '_cihazlar');
        bg.textContent = 'Cihaz ayrıntıları';
        b.appendChild(bg);
      }
      k.appendChild(b);
    });

    galeriImza = WIDGET_SIRA.filter(widgetMevcut).join(',');
    var yeni = galeriOgeleri();
    galeriIdx = 0;
    for (var i = 0; i < yeni.length; i++) {
      if (yeni[i].getAttribute('data-wid') === odakId) { galeriIdx = i; break; }
    }
  }

  function galeriOgeleri() {
    return Array.prototype.slice.call(document.querySelectorAll('#wg-icerik .wg-secilir'));
  }


  /* Galeri ekrana sigmazsa odakli ogeyi gorunur tut. Pencere: baslik ile
     ekran alti arasi. Icerik transform ile kayiyor, kesilen kisim
     .wg-pencere'nin overflow'u ile gizleniyor. */
  var galeriKayma = 0;
  function galeriKaydir(o) {
    var ic = $('#wg-icerik'), pen = $('#wg-pencere');
    if (!ic || !pen) return;
    if (!o || gorunum !== 'widget') {
      if (!o) { galeriKayma = 0; ic.style.transform = ''; }
      return;
    }
    /* 30: icerigin pencere icindeki ust payi. 64: alt guvenli bosluk —
       1:1 olculdu, payi olmadan son oge ekranin tam kenarina (1080) oturuyordu. */
    var gorunur = pen.clientHeight - 30 - 64;
    var ust = o.offsetTop, alt = ust + o.offsetHeight;
    if (alt - galeriKayma > gorunur) galeriKayma = alt - gorunur;
    /* Yukari cikarken 70 px pay: ogenin ustundeki bolum etiketi (BILGI/TV/EV)
       de gorunsun; -34 px'te etiket yarim kesiliyordu. */
    if (ust - galeriKayma < 0) galeriKayma = Math.max(0, ust - 70);
    ic.style.transform = galeriKayma ? 'translateY(' + (-galeriKayma) + 'px)' : '';
  }

  /* =======================================================================
     PIYASALAR — veri kok servisten (/piyasa): tek cekici, onbellek ve
     kaynaga karsi nazik davranma orada. Uygulama yalnizca ciziyor.
     ======================================================================= */
  var piyasaVeri = null;

  /* Intl tr-TR'ye guvenmiyoruz: TV'deki kucuk ICU'da yerel ayar eksik
     olabiliyor. Binlik nokta, ondalik virgul — elle. */
  function trSayi(n, ondalik) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    var s = Math.abs(n).toFixed(ondalik), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + p.join(',');
  }
  function piyasaDeger(k) {
    return trSayi(k.deger, k.deger >= 1000 ? 0 : 2);
  }
  function piyasaDegisim(k) {
    if (typeof k.degisim !== 'number' || isNaN(k.degisim)) return '—';
    return (k.degisim > 0 ? '+' : k.degisim < 0 ? '−' : '') + '%' + trSayi(Math.abs(k.degisim), 2);
  }
  function piyasaYon(k) {
    return (typeof k.degisim !== 'number' || !k.degisim) ? 'yok' : (k.degisim > 0 ? 'art' : 'eks');
  }

  function piyasaOku() {
    if (ucan.piyasa && Date.now() - ucan.piyasa < 60000) return;
    ucan.piyasa = Date.now();
    kopruCagir2('/piyasa', '', function (o) {
      ucan.piyasa = 0;
      if (o && o.kalemler && o.kalemler.length) piyasaVeri = o;
      else if (!piyasaVeri) piyasaVeri = { hata: true };
      piyasaCiz();
    }, 15000);
  }

  function piyasaCiz() {
    var kk = $('#piyasa-widget'), gg = $('#piyasa-genis-widget');
    var v = piyasaVeri;
    if (kk) kk.hidden = false;
    if (gg) gg.hidden = false;
    var kucuk = $('#py-kucuk'), liste = $('#py-liste'), zm = $('#py-zaman');
    if (!kucuk || !liste) return;
    while (kucuk.firstChild) kucuk.removeChild(kucuk.firstChild);
    while (liste.firstChild) liste.removeChild(liste.firstChild);
    if (!v || v.hata || !v.kalemler) {
      /* Veri yoksa durust bos durum — sifir ya da eski rakam gostermiyoruz. */
      var b1 = document.createElement('div'); b1.className = 'py-bos';
      b1.textContent = v ? 'Piyasa verisi alınamadı' : 'Piyasalar yükleniyor…';
      kucuk.appendChild(b1);
      liste.appendChild(b1.cloneNode(true));
      if (zm) zm.textContent = '';
      return;
    }
    var bul = {};
    v.kalemler.forEach(function (k) { bul[k.kod] = k; });

    /* Kucuk: en cok bakilan uc kalem. */
    ['altin', 'usd', 'eur'].forEach(function (kod) {
      var k = bul[kod]; if (!k) return;
      var s = document.createElement('div'); s.className = 'py-sutun';
      s.innerHTML = '<div class="py-ad"></div><div class="py-deger"></div><div class="py-degisim"></div>';
      s.querySelector('.py-ad').textContent = k.kisa || k.ad;
      var dg = s.querySelector('.py-deger');
      dg.textContent = piyasaDeger(k);
      if (!k.birimsiz) { var sm = document.createElement('small'); sm.textContent = '₺'; dg.appendChild(sm); }
      var dy = s.querySelector('.py-degisim');
      dy.textContent = piyasaDegisim(k);
      dy.className = 'py-degisim py-' + piyasaYon(k);
      kucuk.appendChild(s);
    });

    /* Buyuk: hepsi, Apple Borsa'daki satir + renkli hap. */
    ['altin', 'gumus', 'usd', 'eur', 'bist'].forEach(function (kod) {
      var k = bul[kod]; if (!k) return;
      var r = document.createElement('div'); r.className = 'py-satir';
      r.innerHTML = '<span class="py-ad"></span><span class="py-deger"></span><span class="py-hap"></span>';
      r.querySelector('.py-ad').textContent = k.ad;
      r.querySelector('.py-deger').textContent = piyasaDeger(k) + (k.birimsiz ? '' : ' ₺');
      var hp = r.querySelector('.py-hap');
      hp.textContent = piyasaDegisim(k);
      hp.className = 'py-hap ' + piyasaYon(k);
      liste.appendChild(r);
    });
    if (zm && v.guncelleme) {
      var d = new Date(v.guncelleme);
      if (!isNaN(d.getTime())) {
        zm.textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
                         (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + ' itibarıyla';
      }
    }
  }

  /* =======================================================================
     TRAFIK — IBB trafik endeksi (1-99, Istanbul geneli), kok servisten
     (/trafik). Avrupa/Anadolu ayrimi kaynakta yok; uydurmuyoruz.
     Esikler bizim: IBB'nin resmi bir "akici/yogun" siniri yayinlamiyor.
     ======================================================================= */
  var trafikVeri = null;

  function trafikDuzey(e) {
    if (e < 30) return { ad: 'Akıcı', sinif: 'tr-akici' };
    if (e < 60) return { ad: 'Orta', sinif: 'tr-orta' };
    return { ad: 'Yoğun', sinif: 'tr-yogun' };
  }

  function trafikOku() {
    if (ucan.trafik && Date.now() - ucan.trafik < 60000) return;
    ucan.trafik = Date.now();
    kopruCagir2('/trafik', '', function (o) {
      ucan.trafik = 0;
      if (o && typeof o.endeks === 'number') trafikVeri = o;
      else if (!trafikVeri) trafikVeri = { hata: true };
      trafikCiz();
    }, 15000);
  }

  function trafikCiz() {
    var w = $('#trafik-widget');
    if (!w) return;
    w.hidden = false;
    var alt = $('#tr-alt'), sag = $('#tr-sag'), yaka = $('#tr-yaka'), v = trafikVeri;
    var dolu = $('#tr-dolu'), sayi = $('#tr-sayi');
    while (sag.firstChild) sag.removeChild(sag.firstChild);
    while (yaka.firstChild) yaka.removeChild(yaka.firstChild);
    w.classList.remove('tr-akici'); w.classList.remove('tr-orta'); w.classList.remove('tr-yogun');
    if (!v || v.hata) {
      alt.textContent = v ? 'Veri alınamadı' : 'Yükleniyor…';
      sayi.textContent = '';
      if (dolu) dolu.style.strokeDashoffset = '238.76';
      return;
    }
    var d = trafikDuzey(v.endeks);
    w.classList.add(d.sinif);
    /* Halka: endeks 0-100 -> cevrenin o kadari dolu (2*pi*38 = 238.76). */
    sayi.textContent = String(v.endeks);
    if (dolu) dolu.style.strokeDashoffset = (238.76 * (1 - Math.max(0, Math.min(100, v.endeks)) / 100)).toFixed(1);
    /* "Istanbul · Orta" — duzey sozcugu duzey renginde. Saat yazmiyoruz:
       LG yazi tipiyle 1:1 olculdu, yer yok ve endeks 5 dk'da bir yenileniyor. */
    alt.textContent = 'İstanbul · ';
    var db = document.createElement('b'); db.textContent = d.ad; alt.appendChild(db);
    [['Anadolu', v.anadolu], ['Avrupa', v.avrupa]].forEach(function (k) {
      if (typeof k[1] !== 'number') return;
      var s = document.createElement('span'); s.textContent = k[0];
      var b = document.createElement('b'); b.textContent = String(k[1]);
      s.appendChild(b); yaka.appendChild(s);
    });

    /* Son 24 saat: 15 dk'lik egri, en sagda simdiki an. Olcek sabit
       0-100 — gunden gune karsilastirilabilsin diye otomatik
       olceklemiyoruz (gece 1'lik bir egri yoksa "yogun" gibi gorunurdu). */
    var seri = (v.seri || []).filter(function (x) { return typeof x === 'number'; });
    if (seri.length > 1) {
      var G = 144, Y = 64, n = seri.length, nok = [];
      for (var i = 0; i < n; i++) {
        nok.push((i / (n - 1) * G).toFixed(1) + ',' + (Y - 3 - seri[i] / 100 * (Y - 6)).toFixed(1));
      }
      var son = nok[n - 1].split(',');
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'tr-egri');
      svg.setAttribute('viewBox', '0 0 ' + (G + 6) + ' ' + Y);
      var cz = document.createElementNS(ns, 'polyline');
      cz.setAttribute('points', nok.join(' '));
      svg.appendChild(cz);
      var nk = document.createElementNS(ns, 'circle');
      nk.setAttribute('cx', son[0]); nk.setAttribute('cy', son[1]); nk.setAttribute('r', '5');
      svg.appendChild(nk);
      sag.appendChild(svg);
    }
    yakaCiz();
  }

  /* =======================================================================
     YOL DURUMU — kok servis /guzergah (TomTom, canli trafik). Guzergahlar
     servis-ayar.json'da; tanimsizsa widget hic gorunmez.
     ======================================================================= */
  var yolVeri = null;

  function yolOku() {
    if (ucan.yol && Date.now() - ucan.yol < 60000) return;
    ucan.yol = Date.now();
    kopruCagir2('/guzergah', '', function (o) {
      ucan.yol = 0;
      var oncekiTanimsiz = !!(yolVeri && yolVeri.tanimsiz);
      if (o && (o.tanimsiz || (o.yollar && o.yollar.length))) yolVeri = o;
      else if (!yolVeri) yolVeri = { hata: true };
      yolCiz();
      /* gorunurluk degistiyse galeri ve yerlesim ogrensin */
      if (!!yolVeri.tanimsiz !== oncekiTanimsiz) {
        if (gorunum === 'widget' && !wSayfa) galeriCiz();
        yerlesimUygula();
      }
    }, 30000);
  }

  function yolDuzey(y) {
    if (y && y.kapali) return 'kapali';
    if (!y || typeof y.gecikmeDk !== 'number') return 'yok';
    /* Trafiksiz sure 0'a yuvarlandi ama gecikme var: en kotu sikisma
       (Duraklar gorunumunde "8 dk +8" parcalar gri cikiyordu). */
    if (!y.normalDk) return y.gecikmeDk > 0 ? 'yogun' : 'yok';
    var r = y.gecikmeDk / y.normalDk;
    return r < .15 ? 'akici' : r < .4 ? 'orta' : 'yogun';
  }
  function gecikmeMetni(y) {
    return typeof y.gecikmeDk === 'number' ? (y.gecikmeDk > 0 ? '+' + y.gecikmeDk : '0') : '—';
  }

  /* "E-5 · 15 Temmuz" -> levha "E-5" + hedef "15 Temmuz". Levha rengi
     Turkiye'deki tabela gibi: devlet yolu (E-5 = D-100) mavi, otoyol
     (TEM = O-4) yesil; tanimadigimiz ad gri. */
  function yolParca(ad) {
    var p = String(ad || '').split(' · ');
    var yol = p[0], hedef = p.slice(1).join(' · ');
    var renk = /^(E-?5|D-?\d)/i.test(yol) ? 'mavi' : /^(TEM|O-?\d)/i.test(yol) ? 'yesil' : 'gri';
    return { yol: yol, hedef: hedef, renk: renk };
  }
  function levha(ad) {
    var pr = yolParca(ad), s = document.createElement('span');
    s.className = 'levha ' + pr.renk; s.textContent = pr.yol;
    return s;
  }
  function dakikaYaz(el2, y) {
    /* Kapanma (servis: kapanma.js) sureyi gecersiz kiliyor: TomTom kapali
       kopruye de ara sokaklardan bir sure buluyordu (1 Kasim, maraton). */
    if (y.kapali) { el2.textContent = 'Kapalı'; el2.classList.add('kapali-dk'); return; }
    el2.textContent = y.hata ? '—' : String(y.dk);
    if (!y.hata) { var sm = document.createElement('small'); sm.textContent = 'dk'; el2.appendChild(sm); }
  }
  /* "Maraton · 15:30'a kadar"; neden ya da bitis yoksa eksik parcasiz */
  function kapaliMetni(y) {
    var k = y.kapali, d = k.bitis ? new Date(k.bitis) : null, z = '';
    if (d && !isNaN(d.getTime())) z = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + "'a kadar";
    return [k.neden, z].filter(Boolean).join(' · ') || 'Yol kapalı';
  }
  function varisMetni(y) {
    if (y.kapali) return kapaliMetni(y);
    if (y.hata || typeof y.dk !== 'number') return '';
    var v = new Date(Date.now() + y.dk * 60000);
    return 'Varış ' + (v.getHours() < 10 ? '0' : '') + v.getHours() + ':' + (v.getMinutes() < 10 ? '0' : '') + v.getMinutes();
  }

  function yolCiz() {
    var kk = $('#yol-widget'), gg = $('#yol-genis-widget');
    var v = yolVeri;
    if (kk) kk.hidden = !widgetMevcut('yol');
    if (gg) gg.hidden = !widgetMevcut('yolGenis');
    var kucuk = $('#yl-kucuk'), genis = $('#yl-genis');
    if (!kucuk || !genis) return;
    while (kucuk.firstChild) kucuk.removeChild(kucuk.firstChild);
    while (genis.firstChild) genis.removeChild(genis.firstChild);
    var zm = $('#yl-zaman'), yon = $('#yl-yon');
    if (!v || v.hata || v.tanimsiz || !v.yollar) {
      var b = document.createElement('div'); b.className = 'yl-bos';
      b.textContent = v ? 'Yol bilgisi alınamadı' : 'Yol durumu yükleniyor…';
      kucuk.appendChild(b); genis.appendChild(b.cloneNode(true));
      if (zm) zm.textContent = '';
      return;
    }
    if (yon) yon.textContent = v.baslik || ' ';
    /* Iki kart da 2 guzergah sigdiriyor (kucuk 2x52 px satir; buyukte 3. blok
       alttaki Anadolu/Avrupa yakasina biniyordu). Guzergah dosyasinda 6 Bogaz
       gecisi var — hepsini basinca kart tasip galeride komsu kartlarin ustune
       cikiyordu (14 Kasim). Durak widget'i gibi dosyadaki ilk ikisi; hepsi
       haritada. */
    var yollar = v.yollar.slice(0, 2);
    var en = 1;
    yollar.forEach(function (y) { if (y.dk > en) en = y.dk; });
    yollar.forEach(function (y) {
      var d = y.hata ? 'yok' : yolDuzey(y), pr = yolParca(y.ad);

      /* kucuk: [levha] hedef ........ 66 dk  +20 dk (renkli metin, hap degil) */
      var r = document.createElement('div'); r.className = 'yl-satir';
      r.appendChild(levha(y.ad));
      var ad = document.createElement('span'); ad.className = 'yl-ad'; ad.textContent = pr.hedef; r.appendChild(ad);
      var dk = document.createElement('span'); dk.className = 'yl-dk'; dakikaYaz(dk, y); r.appendChild(dk);
      var fk = document.createElement('span'); fk.className = 'yl-fark ' + d;
      fk.textContent = (y.hata || !(y.gecikmeDk > 0)) ? '' : '+' + y.gecikmeDk + ' dk';
      r.appendChild(fk);
      kucuk.appendChild(r);

      /* buyuk: [levha] hedef ..... 66 dk / Varis 23:26 · normalde 43 dk ..... +20 dk / cubuk */
      var bl = document.createElement('div'); bl.className = 'yl-blok';
      var ust = document.createElement('div'); ust.className = 'yl-blok-ust';
      ust.appendChild(levha(y.ad));
      var ad2 = document.createElement('span'); ad2.className = 'yl-ad'; ad2.textContent = pr.hedef; ust.appendChild(ad2);
      var bdk = document.createElement('span'); bdk.className = 'yl-dk'; dakikaYaz(bdk, y); ust.appendChild(bdk);
      bl.appendChild(ust);
      var alt2 = document.createElement('div'); alt2.className = 'yl-blok-alt';
      var nt = document.createElement('span');
      nt.textContent = y.hata ? 'Alınamadı' : [varisMetni(y), y.normalDk && !y.kapali ? 'normalde ' + y.normalDk + ' dk' : ''].filter(Boolean).join(' · ');
      alt2.appendChild(nt);
      var fk2 = document.createElement('span'); fk2.className = 'yl-fark ' + d;
      fk2.textContent = (y.hata || !(y.gecikmeDk > 0)) ? '' : '+' + y.gecikmeDk + ' dk';
      alt2.appendChild(fk2);
      bl.appendChild(alt2);
      var cb = document.createElement('div'); cb.className = 'yl-cubuk';
      var normal = Math.max(0, (y.dk || 0) - Math.max(0, y.gecikmeDk || 0));
      var n1 = document.createElement('div'); n1.className = 'yl-normal'; n1.style.width = (normal / en * 100) + '%';
      var n2 = document.createElement('div'); n2.className = 'yl-fazla ' + d; n2.style.width = (Math.max(0, y.gecikmeDk || 0) / en * 100) + '%';
      cb.appendChild(n1); cb.appendChild(n2);
      bl.appendChild(cb);
      genis.appendChild(bl);
    });
    if (zm && v.guncelleme) {
      var t = new Date(v.guncelleme);
      if (!isNaN(t.getTime())) {
        zm.textContent = (t.getHours() < 10 ? '0' : '') + t.getHours() + ':' +
                         (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
      }
    }
    yakaCiz();
    durakWidgetCiz();
  }

  /* =======================================================================
     DURAKLAR widget'i: haritadaki kontrol noktali gorunumun kucuk hali.
     Mini hat parcalari gercek uzunlukla orantili (widget'ta ad yazmiyoruz,
     8 durak adi 544 px'e sigmaz — adlar haritada; burada en yavas parca).
     ======================================================================= */
  function durakVarMi() {
    if (yolVeri && yolVeri.tanimsiz) return false;
    if (yolVeri && yolVeri.yollar) return yolVeri.yollar.some(function (y) { return !!(y.duraklar && y.duraklar.parcalar); });
    return true;                               /* henuz yuklenmedi */
  }

  function miniHat(y, noktali) {
    var hat = document.createElement('div'); hat.className = 'dw-hat';
    var ds = y.duraklar.duraklar, ps = y.duraklar.parcalar, top = ds[ds.length - 1].km || 1;
    var x = ds.map(function (s) { return s.km / top * 100; });
    /* Yakin duraklar (Bostanci-Kozyatagi 1,7 km) ust uste binmesin: en az %8. */
    var ARA = 8;
    for (var i = 1; i < x.length; i++) if (x[i] < x[i - 1] + ARA) x[i] = x[i - 1] + ARA;
    x[x.length - 1] = Math.min(x[x.length - 1], 100);
    for (var j = x.length - 2; j >= 0; j--) if (x[j] > x[j + 1] - ARA) x[j] = x[j + 1] - ARA;
    ps.forEach(function (pc, k) {
      var b = document.createElement('div');
      b.className = 'dw-parca ' + (pc.kapali ? 'kapali' : yolDuzey(pc));
      b.style.left = x[k] + '%'; b.style.width = 'calc(' + (x[k + 1] - x[k]) + '% - 3px)';
      hat.appendChild(b);
    });
    hat.konum = x;   /* 3x1'de parca sureleri kendi parcasinin ustune hizalaniyor */
    if (noktali) {
      x.forEach(function (px) {
        var n = document.createElement('div'); n.className = 'dw-nokta'; n.style.left = px + '%';
        hat.appendChild(n);
      });
    }
    return hat;
  }

  function enYavas(y) {
    var ds = y.duraklar.duraklar, ps = y.duraklar.parcalar, en = -1, ek = -1;
    ps.forEach(function (pc, k) { if (pc.gecikmeDk > ek) { ek = pc.gecikmeDk; en = k; } });
    if (en < 0 || ek <= 0) return null;
    return { nereden: ds[en].ad, nereye: ds[en + 1].ad, p: ps[en] };
  }

  function durakWidgetCiz() {
    var kk = $('#durak-widget'), gg = $('#durak-genis-widget');
    if (kk) kk.hidden = !widgetMevcut('durak');
    if (gg) gg.hidden = !widgetMevcut('durakGenis');
    var kucuk = $('#dw-kucuk'), genis = $('#dw-genis'), zm = $('#dw-zaman');
    if (!kucuk || !genis) return;
    while (kucuk.firstChild) kucuk.removeChild(kucuk.firstChild);
    while (genis.firstChild) genis.removeChild(genis.firstChild);
    var v = yolVeri;
    var yollar = ((v && v.yollar) || []).filter(function (y) { return y.duraklar && y.duraklar.parcalar && !y.hata; });
    if (!yollar.length) {
      var b = document.createElement('div'); b.className = 'yl-bos';
      b.textContent = v ? 'Durak bilgisi alınamadı' : 'Yükleniyor…';
      kucuk.appendChild(b); genis.appendChild(b.cloneNode(true));
      if (zm) zm.textContent = '';
      return;
    }
    if (zm) zm.textContent = ($('#yl-zaman') || {}).textContent || '';
    yollar.slice(0, 2).forEach(function (y) {
      var d = yolDuzey(y);
      /* 3x1:       6   4   3   5  21  18   6        <- parca sureleri (dk)
              [E-5] ━━ ━━ ━━ ━━ ━━━ ━━ ━━     71 dk
                    Pendik          Zincirlikuyu  +31 dk
         31 Ekim, Bilal: "en yavas" yazisi gereksiz; bas/son durak ve
         parca sureleri istendi. Sureler kendi parcasinin ortasinda. */
      var ds2 = y.duraklar.duraklar, ps2 = y.duraklar.parcalar;
      var r = document.createElement('div'); r.className = 'dw-satir';
      r.appendChild(levha(y.ad));
      var mh = miniHat(y, false);
      r.appendChild(mh);
      var dk = document.createElement('span'); dk.className = 'yl-dk'; dakikaYaz(dk, y); r.appendChild(dk);
      var ust = document.createElement('div'); ust.className = 'dw-ustsatir';
      var hy = levha(y.ad); hy.style.visibility = 'hidden'; ust.appendChild(hy);
      var sr = document.createElement('div'); sr.className = 'dw-sureler';
      ps2.forEach(function (pc, k) {
        var sp = document.createElement('span');
        sp.className = 'dw-sure';
        sp.style.left = ((mh.konum[k] + mh.konum[k + 1]) / 2) + '%';
        sp.textContent = pc.kapali ? '×' : String(pc.dk);
        sr.appendChild(sp);
      });
      ust.appendChild(sr);
      var bosluk = document.createElement('span'); bosluk.className = 'dw-sag-bos'; ust.appendChild(bosluk);
      var alt = document.createElement('div'); alt.className = 'dw-alt';
      var bas = document.createElement('span'); bas.className = 'dw-uc'; bas.textContent = ds2[0].ad;
      var son = document.createElement('span'); son.className = 'dw-uc son'; son.textContent = ds2[ds2.length - 1].ad;
      alt.appendChild(bas); alt.appendChild(son);
      var fk2 = document.createElement('span'); fk2.className = 'yl-fark ' + d;
      fk2.textContent = y.gecikmeDk > 0 && !y.kapali ? '+' + y.gecikmeDk + ' dk' : '';
      var blk = document.createElement('div'); blk.className = 'dw-kblok';
      var alts = document.createElement('div'); alts.className = 'dw-altsatir';
      var hayalet = levha(y.ad); hayalet.style.visibility = 'hidden';   /* hatla ayni sol hiza */
      alts.appendChild(hayalet); alts.appendChild(alt); alts.appendChild(fk2);
      blk.appendChild(ust); blk.appendChild(r); blk.appendChild(alts);
      kucuk.appendChild(blk);

      /* 3x2: [levha] hedef ... 52 dk +14 / noktali hat / en yavas parca */
      var bl = document.createElement('div'); bl.className = 'dw-blok';
      var ust = document.createElement('div'); ust.className = 'dw-blok-ust';
      ust.appendChild(levha(y.ad));
      var ad = document.createElement('span'); ad.className = 'yl-ad'; ad.textContent = yolParca(y.ad).hedef; ust.appendChild(ad);
      var bdk = document.createElement('span'); bdk.className = 'yl-dk'; dakikaYaz(bdk, y); ust.appendChild(bdk);
      var fk = document.createElement('span'); fk.className = 'yl-fark ' + d;
      fk.textContent = y.gecikmeDk > 0 ? '+' + y.gecikmeDk + ' dk' : ''; ust.appendChild(fk);
      bl.appendChild(ust);
      bl.appendChild(miniHat(y, true));
      var nt = document.createElement('div'); nt.className = 'dw-not';
      var ey = enYavas(y);
      if (ey) {
        nt.appendChild(document.createTextNode('En yavaş: ' + ey.nereden + ' → ' + ey.nereye + ' '));
        var eb = document.createElement('b'); eb.className = yolDuzey(ey.p);
        eb.textContent = '+' + ey.p.gecikmeDk + ' dk' + (ey.p.hiz ? ' · ' + ey.p.hiz + ' km/sa' : '');
        nt.appendChild(eb);
      } else {
        nt.textContent = 'Tüm hat akıcı';
      }
      bl.appendChild(nt);
      genis.appendChild(bl);
    });
  }

  /* Buyuk widget'in alt satiri: IBB endeksleri, her biri duzey renginde nokta. */
  function yakaCiz() {
    var y = $('#yl-yaka');
    if (!y) return;
    while (y.firstChild) y.removeChild(y.firstChild);
    var t = trafikVeri;
    if (!t || t.hata) return;
    [['İstanbul', t.endeks], ['Anadolu', t.anadolu], ['Avrupa', t.avrupa]].forEach(function (k) {
      if (typeof k[1] !== 'number') return;
      var s = document.createElement('span');
      var i2 = document.createElement('i'); i2.className = trafikDuzey(k[1]).sinif; s.appendChild(i2);
      s.appendChild(document.createTextNode(k[0]));
      var b = document.createElement('b'); b.textContent = String(k[1]);
      s.appendChild(b);
      y.appendChild(s);
    });
  }

  /* =======================================================================
     TRAFIK HARITASI — tam ekran. Katmanlar: TomTom taban haritasi, canli
     trafik akisi, ustte bizim guzergahlar (gecikme rengiyle). Dosemeler
     kok servisten (/harita) geliyor; anahtar sayfaya inmiyor. Kapaninca
     butun <img>'ler atiliyor — TV'de bellek ancak haritayi acikken tutsun.
     Kumanda: SOL/SAG gorunum, GERI ya da ENTER kapatir.
     ======================================================================= */
  var harita = { acik: false, gorunum: 0, veri: null, zamanlayici: null, gorunumler: null };
  var HARITA_ADLAR = ['Güzergâhlar', 'Tüm İstanbul', 'Duraklar'];

  function merkator(lat, lon, z) {
    var n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180);
    return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }

  /* Gorunum: {z, olcek, merkez (dunya pikseli), odak (ekran noktasi)}.
     Guzergah gorunumu cizgilerin kutusunu, soldaki kartin sagindaki alana
     (600..1840 x 90..990) sigdiran en yakin zum; olcek 1..1.35 arasi. */
  function haritaGorunumu(i) {
    var cizgiler = ((harita.veri && harita.veri.yollar) || []).map(function (y) { return y.cizgi || []; })
                     .filter(function (c) { return c.length > 1; });
    if (i === 1 || !cizgiler.length) {
      return { z: 11, olcek: 1, merkez: merkator(41.03, 29.03, 11), odak: [1060, 560] };
    }
    /* Kullanilabilir alan: soldaki kartin sagi, alttaki gorunum secicinin
       ustu (600..1840 x 90..950). Olcek 0.85..1.35: biraz kucultmek bir zum
       geri gitmekten daha net (laboratuvarda olculdu: z11 x1.35 bulanik). */
    var ALAN_G = 1240, ALAN_Y = 860;
    for (var z = 14; z >= 9; z--) {
      var x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
      cizgiler.forEach(function (c) {
        c.forEach(function (pt) {
          var q = merkator(pt[0], pt[1], z);
          if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
          if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
        });
      });
      var w = (x1 - x0) * 1.08, h = (y1 - y0) * 1.08;
      if (w * 0.85 <= ALAN_G && h * 0.85 <= ALAN_Y) {
        var olcek = Math.max(0.85, Math.min(1.35, ALAN_G / w, ALAN_Y / h));
        return { z: z, olcek: olcek, merkez: [(x0 + x1) / 2, (y0 + y1) / 2], odak: [1220, 520] };
      }
    }
    return { z: 11, olcek: 1, merkez: merkator(41.03, 29.03, 11), odak: [1060, 560] };
  }

  function ekranNoktasi(g, lat, lon) {
    var q = merkator(lat, lon, g.z);
    return [(q[0] - g.merkez[0]) * g.olcek + g.odak[0], (q[1] - g.merkez[1]) * g.olcek + g.odak[1]];
  }

  function dosemeleriCiz(g, katman, kat, taze) {
    var kap = $(katman);
    if (!kap || !kopruAnahtar) return;
    while (kap.firstChild) kap.removeChild(kap.firstChild);
    var stil = document.body.className.indexOf('gece') >= 0 ? 'gece' : 'gunduz';
    var wx0 = g.merkez[0] - g.odak[0] / g.olcek, wy0 = g.merkez[1] - g.odak[1] / g.olcek;
    var n = Math.pow(2, g.z), boy = 256 * g.olcek;
    var tx0 = Math.floor(wx0 / 256), tx1 = Math.floor((wx0 + 1920 / g.olcek) / 256);
    var ty0 = Math.floor(wy0 / 256), ty1 = Math.floor((wy0 + 1080 / g.olcek) / 256);
    for (var tx = tx0; tx <= tx1; tx++) {
      for (var ty = ty0; ty <= ty1; ty++) {
        if (ty < 0 || ty >= n) continue;
        var img = new Image();
        img.alt = '';
        img.style.left = Math.floor((tx * 256 - wx0) * g.olcek) + 'px';
        img.style.top = Math.floor((ty * 256 - wy0) * g.olcek) + 'px';
        img.style.width = img.style.height = Math.ceil(boy) + 1 + 'px';   /* +1: dikis cizgisi olmasin */
        img.onerror = function () { this.style.visibility = 'hidden'; };
        img.src = KOPRU + '/harita?kat=' + kat + '&stil=' + stil + '&z=' + g.z +
                  '&x=' + (((tx % n) + n) % n) + '&y=' + ty + '&k=' + kopruAnahtar + (taze ? '&t=' + taze : '');
        kap.appendChild(img);
      }
    }
  }

  /* Kart ve cizim sirasi: en hizli once; kapali ve alinamayan sona. */
  function siraAnahtari(y) { return y.hata ? 2e9 : y.kapali ? 1e9 + y.dk : y.dk; }

  function cizgileriCiz(g) {
    var svg = $('#hr-cizgi');
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var ns = 'http://www.w3.org/2000/svg';
    function el(ad, oz) { var e = document.createElementNS(ns, ad); for (var a in oz) e.setAttribute(a, oz[a]); svg.appendChild(e); return e; }
    var yollar = (harita.veri && harita.veri.yollar) || [];
    /* Yavas olan once, en hizli en son: ortak koridorda (E-5, TEM)
       ustte kalan cizgi en hizli rotanin rengi olsun. */
    var sirali = yollar.filter(function (y) { return y.cizgi && y.cizgi.length > 1; })
      .sort(function (a, b) { return siraAnahtari(b) - siraAnahtari(a); });
    sirali.forEach(function (y) {
      var nok = y.cizgi.map(function (pt) { var s = ekranNoktasi(g, pt[0], pt[1]); return s[0].toFixed(1) + ',' + s[1].toFixed(1); }).join(' ');
      el('polyline', { points: nok, 'class': 'kilif' });
      el('polyline', { points: nok, 'class': 'yol ' + (y.hata ? 'yok' : yolDuzey(y)) });
    });
    /* Etiketler BITIS noktasinda, hedefe gore gruplu: alti rotanin uc
       tanesi FSM'de bitiyor ve hepsi Pendik'ten ayni koridorla cikiyor —
       rota ortasina konan etiketler ust uste biniyordu. Bitisler Bogaz'in
       Anadolu kiyisinda; solu (deniz ve Avrupa yakasi) bos, etiket oraya. */
    var gruplar = [], gIdx = {};
    sirali.slice().reverse().forEach(function (y) {
      var h = yolParca(y.ad).hedef || y.ad;
      if (!(h in gIdx)) { gIdx[h] = gruplar.length; gruplar.push({ hedef: h, son: y.cizgi[y.cizgi.length - 1], yollar: [] }); }
      gruplar[gIdx[h]].yollar.push(y);
    });
    var bas0 = sirali.length ? sirali[0].cizgi[0] : null;
    if (bas0) { var b0 = ekranNoktasi(g, bas0[0], bas0[1]); el('circle', { cx: b0[0], cy: b0[1], r: 9, 'class': 'uc' }); }
    gruplar.forEach(function (gr) {
      var s = ekranNoktasi(g, gr.son[0], gr.son[1]);
      el('circle', { cx: s[0], cy: s[1], r: 9, 'class': 'uc' });
      /* Tek rota: "15 Temmuz 41 dk"; ortak hedef: "FSM: TEM 53 · O-7 54 · E-5 58 dk" */
      var metin = gr.yollar.length === 1
        ? gr.hedef + ' ' + (gr.yollar[0].kapali ? 'kapalı' : gr.yollar[0].hata ? '—' : gr.yollar[0].dk + ' dk')
        : gr.hedef + ': ' + gr.yollar.map(function (y) {
            return yolParca(y.ad).yol + ' ' + (y.kapali ? 'kapalı' : y.hata ? '—' : y.dk);
          }).join(' · ') + ' dk';
      var gen = metin.length * 11.5 + 28;
      var ex = s[0] - 16 - gen;
      el('rect', { x: ex, y: s[1] - 20, width: gen, height: 40, rx: 20, 'class': 'etiket-zemin' });
      var tx = el('text', { x: ex + 14, y: s[1] + 8, 'class': 'etiket' });
      tx.textContent = metin;
    });
  }

  function haritaKartiCiz() {
    var k = $('#hr-kart');
    if (!k) return;
    while (k.firstChild) k.removeChild(k.firstChild);
    var v = harita.veri;
    var bas = document.createElement('h3'); bas.textContent = 'Trafik'; k.appendChild(bas);
    var alt = document.createElement('div'); alt.className = 'hr-alt';
    var zm = '';
    if (v && v.guncelleme) {
      var d = new Date(v.guncelleme);
      if (!isNaN(d.getTime())) zm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    }
    alt.textContent = [v && v.baslik, zm].filter(Boolean).join(' · ') || 'Yükleniyor…';
    k.appendChild(alt);
    /* Alti alternatif: en hizlidan yavasa. Hata verenler sona. */
    ((v && v.yollar) || []).slice().sort(function (a, b) {
      return siraAnahtari(a) - siraAnahtari(b);
    }).forEach(function (y) {
      var d2 = y.hata ? 'yok' : yolDuzey(y);
      var r = document.createElement('div'); r.className = 'hr-yol';
      r.appendChild(levha(y.ad));
      var ad = document.createElement('span'); ad.className = 'ad'; ad.textContent = yolParca(y.ad).hedef; r.appendChild(ad);
      var dk = document.createElement('span'); dk.className = 'dk'; dakikaYaz(dk, y); r.appendChild(dk);
      k.appendChild(r);
      if (!y.hata) {
        var nt = document.createElement('div'); nt.className = 'hr-yol-not';
        nt.appendChild(document.createTextNode([varisMetni(y), y.normalDk && !y.kapali ? 'normalde ' + y.normalDk + ' dk' : ''].filter(Boolean).join(' · ')));
        if (y.gecikmeDk > 0 && !y.kapali) {
          var fk = document.createElement('b'); fk.className = 'yl-fark ' + d2; fk.textContent = '+' + y.gecikmeDk + ' dk';
          nt.appendChild(fk);
        }
        k.appendChild(nt);
      }
    });
    var t = trafikVeri;
    if (t && !t.hata) {
      var ya = document.createElement('div'); ya.className = 'hr-yaka';
      [['İstanbul', t.endeks], ['Anadolu', t.anadolu], ['Avrupa', t.avrupa]].forEach(function (x) {
        if (typeof x[1] !== 'number') return;
        var s = document.createElement('span'); s.textContent = x[0];
        var b = document.createElement('b'); b.textContent = String(x[1]); s.appendChild(b);
        ya.appendChild(s);
      });
      k.appendChild(ya);
    }
  }

  function haritaGorunumCiz() {
    var gk = $('#hr-gorunum');
    if (!gk) return;
    gk.innerHTML = '';
    HARITA_ADLAR.forEach(function (ad, i) {
      var s = document.createElement('span'); s.textContent = ad;
      if (i === harita.gorunum) s.className = 'secili';
      gk.appendChild(s);
    });
    var ip = document.createElement('span'); ip.className = 'ipucu'; ip.textContent = '◀ ▶ · Geri: kapat';
    gk.appendChild(ip);
  }

  /* KONTROL NOKTALI GORUNUM: haritasiz; her guzergah metro hatti gibi duz
     bir cizgi, duraklar arasi parcalar canli trafigin renginde. Duraklar
     yolun gercek uzunluguyla orantili diziliyor ama adlar cakismasin diye
     aralarinda en az 170 px kaliyor. Bu gorunumde harita dosemesi yuklenmez. */
  function duraklariCiz() {
    var kap = $('#hr-duraklar');
    if (!kap) return;
    while (kap.firstChild) kap.removeChild(kap.firstChild);
    var v = harita.veri;
    function el(sinif, ust, metin) {
      var e = document.createElement('div'); if (sinif) e.className = sinif;
      if (metin !== undefined) e.textContent = metin;
      ust.appendChild(e); return e;
    }
    var bas = el('hd-bas', kap);
    var h3 = document.createElement('h3'); h3.textContent = 'Duraklar'; bas.appendChild(h3);
    var zm = '';
    if (v && v.guncelleme) {
      var dz = new Date(v.guncelleme);
      if (!isNaN(dz.getTime())) zm = (dz.getHours() < 10 ? '0' : '') + dz.getHours() + ':' + (dz.getMinutes() < 10 ? '0' : '') + dz.getMinutes();
    }
    el('', bas, [v && v.baslik, zm].filter(Boolean).join(' · ') || 'Yükleniyor…');
    var yollar = ((v && v.yollar) || []).filter(function (y) { return y.duraklar && y.duraklar.parcalar; });
    if (!yollar.length) { el('hd-bas', kap, '').style.top = '200px'; return; }
    var X0 = 40, X1 = 1688, ARA = 170;
    yollar.slice(0, 2).forEach(function (y, yi) {
      var bant = el('hd-yol', kap); bant.style.top = (210 + yi * 400) + 'px';
      var d = y.hata ? 'yok' : yolDuzey(y), pr = yolParca(y.ad);
      var ust = el('hd-ust', bant);
      ust.appendChild(levha(y.ad));
      el('hd-hedef', ust, pr.hedef);
      var dk = el('hd-dk', ust); dakikaYaz(dk, y);
      el('yl-fark ' + d, ust, (!y.hata && y.gecikmeDk > 0) ? '+' + y.gecikmeDk + ' dk' : '');
      el('hd-varis', ust, varisMetni(y));

      var hat = el('hd-hat', bant);
      var ds = y.duraklar.duraklar, ps = y.duraklar.parcalar;
      var top = ds[ds.length - 1].km || 1, x = ds.map(function (s) { return X0 + (s.km / top) * (X1 - X0); });
      for (var i = 1; i < x.length; i++) if (x[i] < x[i - 1] + ARA) x[i] = x[i - 1] + ARA;
      x[x.length - 1] = Math.min(x[x.length - 1], X1);
      for (var j = x.length - 2; j >= 0; j--) if (x[j] > x[j + 1] - ARA) x[j] = x[j + 1] - ARA;
      ps.forEach(function (pc, k) {
        var pd = pc.kapali ? 'kapali' : yolDuzey(pc);
        var bar = el('hd-parca ' + pd, hat);
        bar.style.left = (x[k] + 10) + 'px'; bar.style.width = Math.max(0, x[k + 1] - x[k] - 20) + 'px';
        var et = el('hd-etiket', hat); et.style.left = ((x[k] + x[k + 1]) / 2) + 'px';
        var b = document.createElement('b'); b.textContent = pc.dk + ' dk'; et.appendChild(b);
        if (pc.gecikmeDk > 0) { var f = document.createElement('span'); f.className = 'yl-fark ' + pd; f.textContent = '+' + pc.gecikmeDk; et.appendChild(f); }
        if (pc.hiz) el('', et, pc.hiz + ' km/sa');   /* km/s = kilometre/saniye okunur */
      });
      ds.forEach(function (s, k) {
        var nk = el('hd-durak', hat); nk.style.left = x[k] + 'px';
        var ad = el('hd-ad' + (k === 0 || k === ds.length - 1 ? ' uc' : ''), hat, s.ad); ad.style.left = x[k] + 'px';
      });
    });
  }

  function haritaYenile() {
    if (!harita.acik) return;
    var dur = harita.gorunum === 2, dk = $('#hr-duraklar'), kart = $('#hr-kart');
    if (dk) dk.hidden = !dur;
    if (kart) kart.hidden = dur;
    if (dur) {
      ['#hr-taban', '#hr-akis', '#hr-cizgi'].forEach(function (s) {
        var k = $(s); if (k) while (k.firstChild) k.removeChild(k.firstChild);
      });
      duraklariCiz();
      haritaGorunumCiz();
      return;
    }
    var g = haritaGorunumu(harita.gorunum);
    dosemeleriCiz(g, '#hr-taban', 'taban', 0);
    /* akis 4 dk'da bir tazelenir; adresteki t WAM onbellegini de asiyor */
    dosemeleriCiz(g, '#hr-akis', 'akis', Math.floor(Date.now() / 240000));
    cizgileriCiz(g);
    haritaKartiCiz();
    haritaGorunumCiz();
  }

  function haritaVerisiOku(sonra) {
    kopruCagir2('/guzergah', '?cizgi=1', function (o) {
      if (o && o.yollar) harita.veri = o;
      if (sonra) sonra();
    }, 30000);
  }

  function haritaAc() {
    if (yolVeri && yolVeri.tanimsiz) { kayit('harita: guzergah/anahtar tanimsiz'); return; }
    var h = $('#harita');
    if (!h) return;
    harita.acik = true;
    h.hidden = false;
    haritaYenile();                 /* once eldeki veriyle (kart "yukleniyor") */
    haritaVerisiOku(function () { haritaYenile(); });
    trafikOku();
    clearInterval(harita.zamanlayici);
    harita.zamanlayici = setInterval(function () {
      haritaVerisiOku(function () { haritaYenile(); });
    }, 240000);
    kayit('harita acildi');
  }

  function haritaKapat() {
    var h = $('#harita');
    harita.acik = false;
    clearInterval(harita.zamanlayici);
    ['#hr-taban', '#hr-akis', '#hr-cizgi', '#hr-duraklar'].forEach(function (s) {
      var k = $(s); if (k) while (k.firstChild) k.removeChild(k.firstChild);
    });
    if (h) h.hidden = true;
    odakCiz();
  }

  function haritaTusu(kod) {
    if (kod === 461 || kod === 27 || kod === 13) { haritaKapat(); return; }
    if (kod === 37 || kod === 39) {
      var yeni = kod === 39 ? Math.min(HARITA_ADLAR.length - 1, harita.gorunum + 1) : Math.max(0, harita.gorunum - 1);
      if (yeni !== harita.gorunum) { harita.gorunum = yeni; haritaYenile(); }
    }
  }


  /* =======================================================================
     EKRAN SURESI — olcum kok serviste (/ekran): on plandaki uygulama +
     ekranin GERCEKTEN acik olup olmadigi. Uygulama yalnizca ciziyor.
     ======================================================================= */
  var ekranVeri = null;

  function ekranOku() {
    if (ucan.ekran && Date.now() - ucan.ekran < 60000) return;
    ucan.ekran = Date.now();
    kopruCagir2('/ekran', '', function (o) {
      ucan.ekran = 0;
      ekranVeri = (o && typeof o.toplamSn === 'number') ? o : (ekranVeri || { hata: true });
      ekranCiz();
    });
  }

  function ekranCiz() {
    var w = $('#ekran-widget');
    if (!w) return;
    w.hidden = false;
    var alt = $('#es-alt'), cb = $('#es-cubuk'), sag = $('#es-sag'), ad = w.querySelector('.kw-ad');
    var v = ekranVeri;
    while (cb.firstChild) cb.removeChild(cb.firstChild);
    while (sag.firstChild) sag.removeChild(sag.firstChild);
    if (!v || v.hata) {
      ad.textContent = 'Ekran süresi';
      alt.textContent = v ? 'Ölçüm alınamadı' : 'Ölçülüyor…';
      return;
    }
    var top = v.toplamSn || 0;
    ad.textContent = top ? sureMetni(top) : 'Ekran süresi';
    var l = (v.uygulamalar || []).slice(0, 3);
    /* "en cok X" sagdaki listede zaten yaziyor; yerine dunun toplami (baglam). */
    alt.textContent = 'Bugün';
    if (v.dunSn > 0) {
      /* ayri span: orta bolgede (552 px) gizleniyor, liste daralmasin */
      var dn = document.createElement('span'); dn.className = 'es-dun';
      dn.textContent = ' · dün ' + sureMetni(v.dunSn); alt.appendChild(dn);
    }
    var kalan = top;
    l.forEach(function (u, i) {
      kalan -= u.sn;
      var d = document.createElement('div');
      d.className = 'es-r' + i;
      d.style.width = (top ? (u.sn / top) * 100 : 0) + '%';
      cb.appendChild(d);
      var s = document.createElement('div'); s.className = 'es-lejant';
      s.innerHTML = '<i class="es-r' + i + '"></i><span></span><b></b>';
      s.querySelector('span').textContent = u.ad || u.id;
      s.querySelector('b').textContent = sureMetni(u.sn);
      sag.appendChild(s);
    });
    if (kalan > 0 && top) {
      var d2 = document.createElement('div'); d2.className = 'es-r3';
      d2.style.width = (kalan / top) * 100 + '%';
      cb.appendChild(d2);
    }
  }


  /* =======================================================================
     UYKU ZAMANLAYICI — settingsservice time.sleepTimer (kok koprusu).
     Kalan sureyi TV soylemiyor; servis bitis anini tutuyor.
     ======================================================================= */
  var uykuVeri = null;

  function uykuOku() {
    kopruCagir2('/uyku', '', function (o) {
      if (o && typeof o.dk === 'number') {
        uykuVeri = o;
        uykuVeri.okunduAn = Date.now();
      }
      uykuCiz();
    });
  }

  function uykuCiz() {
    var w = $('#uyku-widget');
    if (!w) return;
    w.hidden = false;
    var v = uykuVeri, alt = $('#uz-alt');
    var dk = v ? v.dk : 0;
    w.classList.toggle('acik', dk > 0);
    if (!v) alt.textContent = 'Okunuyor…';
    else if (!dk) alt.textContent = 'Kapalı';
    else if (typeof v.kalanSn === 'number') {
      var bitis = new Date(v.okunduAn + v.kalanSn * 1000);
      alt.textContent = (bitis.getHours() < 10 ? '0' : '') + bitis.getHours() + ':' +
        (bitis.getMinutes() < 10 ? '0' : '') + bitis.getMinutes() + '’de kapanacak';
    } else {
      /* LG menusunden kurulmus: bitisi bilmiyoruz, uydurmuyoruz. */
      alt.textContent = 'Açık · ' + dk + ' dk';
    }
    Array.prototype.forEach.call(w.querySelectorAll('.sure-dugme'), function (b) {
      b.classList.toggle('secili', Number(b.getAttribute('data-dk')) === dk);
    });
  }

  function uykuAyarla(n) {
    var simdiki = uykuVeri ? uykuVeri.dk : 0;
    var hedef = (simdiki === n) ? 0 : n;          /* acik olana basmak kapatir */
    uykuVeri = { dk: hedef, kalanSn: hedef ? hedef * 60 : null, okunduAn: Date.now() };
    uykuCiz();
    kopruCagir2('/uyku', '?dk=' + hedef, function (o) {
      if (!o || o.yazildi === false) kayit('uyku zamanlayici yazilamadi: ' + JSON.stringify(o));
      uykuOku();
    }, 10000);
  }

  /* =======================================================================
     FILM MODU — picture.pictureMode=cinema + sound.soundMode=movie.
     Kapatinca servis ONCEKI ayarlara donuyor (normal'e degil).
     ======================================================================= */
  var filmVeri = null, filmMesgul = false;
  var RESIM_ADI = { normal: 'Standart', cinema: 'Sinema', filmMaker: 'FilmMaker', vivid: 'Canlı',
                    eco: 'Eko', sports: 'Spor', game: 'Oyun', expert1: 'Uzman 1', expert2: 'Uzman 2' };

  function filmOku() {
    kopruCagir2('/film', '', function (o) {
      if (o && typeof o.acik === 'boolean') filmVeri = o;
      filmCiz();
    });
  }

  function filmCiz() {
    var w = $('#film-widget');
    if (!w) return;
    w.hidden = false;
    var v = filmVeri, alt = $('#fm-alt'), d = $('#fm-dugme');
    var acik = !!(v && v.acik);
    w.classList.toggle('acik', acik);
    if (d) d.classList.toggle('acik', acik);
    if (!v) { alt.textContent = 'Okunuyor…'; return; }
    alt.textContent = acik ? 'Açık · sinema görüntü ve ses'
                           : (RESIM_ADI[v.resim] || v.resim ? 'Kapalı · ' + (RESIM_ADI[v.resim] || v.resim) : 'Kapalı');
  }

  function filmCevir() {
    if (filmMesgul || !filmVeri) return;
    filmMesgul = true;
    var ac = !filmVeri.acik;
    filmVeri.acik = ac; filmCiz();                /* hemen yansit */
    kopruCagir2('/film', '?acik=' + (ac ? 1 : 0), function (o) {
      filmMesgul = false;
      if (o && typeof o.acik === 'boolean') filmVeri = o;
      else kayit('film modu yazilamadi');
      filmCiz();
    }, 20000);
  }

  /* --- yerlesim sayfasi --------------------------------------------------- */
  var wSayfa = null, wSayfaIdx = 0, wSecenekListesi = [];

  /* Secenekler, her biri SONUC yerlesimini ureten bir fonksiyon tasiyor —
     haritanin onizlemesi ve uygulama ayni kaynaktan geliyor. */
  function wSecenekler(id) {
    var l = [], sat = WIDGET[id].sat, yer = widgetNerede(id);
    function sigar(b) { return bolgeyeUyar(id, b) && bolgeDoluluk(yerlesim[b]) + sat <= BOLGE_KAPASITE[b]; }
    if (yer) {
      BOLGELER.forEach(function (b) {
        if (b === yer || !sigar(b)) return;
        l.push({ metin: BOLGE_YON[b] + ' taşı', hedef: id,
          uygula: function (y) { y[yer].splice(y[yer].indexOf(id), 1); y[b].push(id); return y; } });
      });
      /* Komsu = GORUNEN komsu. Gizli cihaz widget'i (klima, cihaz yokken)
         kayitta duruyor; onunla yer degistirmek ekranda hicbir sey yapmiyordu. */
      var gorunen = yerlesim[yer].filter(widgetMevcut), gi = gorunen.indexOf(id);
      if (gi > 0) {
        l.push({ metin: 'Yukarı al', hedef: id, uygula: function (y) {
          var k = gorunen[gi - 1];
          y[yer].splice(y[yer].indexOf(id), 1); y[yer].splice(y[yer].indexOf(k), 0, id); return y; } });
      }
      if (gi < gorunen.length - 1) {
        l.push({ metin: 'Aşağı al', hedef: id, uygula: function (y) {
          var k = gorunen[gi + 1];
          y[yer].splice(y[yer].indexOf(id), 1); y[yer].splice(y[yer].indexOf(k) + 1, 0, id); return y; } });
      }
      l.push({ metin: 'Ana sayfadan kaldır', hedef: null, uygula: function (y) {
        y[yer].splice(y[yer].indexOf(id), 1); return y; } });
    } else {
      BOLGELER.forEach(function (b) {
        if (sigar(b)) {
          l.push({ metin: (b === 'orta' ? 'Ortaya' : BOLGE_AD[b] + ' tarafa') + ' ekle', hedef: id,
            uygula: function (y) { y[b].push(id); return y; } });
        }
      });
      /* Hepsi doluysa: AYNI BOYDAKI bir widget'in yerine. Boy farkli
         olursa ya tasar ya delik kalir; ikisi de kotu. */
      if (!l.length) {
        BOLGELER.forEach(function (b) {
          if (!bolgeyeUyar(id, b)) return;
          yerlesim[b].forEach(function (eski) {
            if (WIDGET[eski].sat !== sat || !widgetMevcut(eski)) return;
            l.push({ metin: WIDGET[eski].ad + ' yerine', hedef: id, eski: eski,
              uygula: function (y) { y[b][y[b].indexOf(eski)] = id; return y; } });
          });
        });
      }
    }
    l.push({ metin: 'Vazgeç', vazgec: true, hedef: null, uygula: function (y) { return y; } });
    return l;
  }

  function wNotMetni(id) {
    var yer = widgetNerede(id);
    if (yer) return yer === 'orta' ? 'Ana sayfada, saatin altında.' : 'Ana sayfada, ' + (yer === 'sol' ? 'sol' : 'sağ') + ' tarafta.';
    var bos = BOLGELER.some(function (b) {
      return bolgeyeUyar(id, b) && bolgeDoluluk(yerlesim[b]) + WIDGET[id].sat <= BOLGE_KAPASITE[b];
    });
    return bos ? 'Ana sayfada yer var.'
               : 'Ana sayfa dolu. Aynı boydaki bir widget’ın yerine koyabilirsin.';
  }

  function wHaritaCiz() {
    var h = $('#wy-harita');
    if (!h) return;
    while (h.firstChild) h.removeChild(h.firstChild);
    var saat = document.createElement('div'); saat.className = 'wy-saat';
    var sa = $('#saat'); saat.textContent = sa ? sa.textContent : '';
    h.appendChild(saat);
    var s = wSecenekListesi[wSayfaIdx];
    var sonuc = s ? s.uygula(yerlesimKopya(yerlesim)) : yerlesim;
    var CW = 150, RH = 64, G = 8, P = 18, OW = 136;
    /* orta: yan bolgelerin 3. satiri hizasinda, aralarinda */
    [['sol', P, CW, 0], ['sag', 520 - P - CW, CW, 0], ['orta', (520 - OW) / 2, OW, 2]].forEach(function (bx) {
      var r = bx[3];
      (sonuc[bx[0]] || []).forEach(function (id) {
        /* gizli cihaz widget'i ana sayfada yer kaplamiyor, haritada da yok */
        if (!widgetMevcut(id)) return;
        var c = document.createElement('div');
        var hedef = s && s.hedef === id;
        c.className = 'wy-hucre' + (hedef ? ' hedef' : '');
        c.style.left = bx[1] + 'px';
        c.style.top = (P + r * (RH + G)) + 'px';
        c.style.width = bx[2] + 'px';
        c.style.height = (WIDGET[id].sat * RH + (WIDGET[id].sat - 1) * G) + 'px';
        var ic = document.createElement('div');
        ic.textContent = WIDGET[id].ad;
        if (hedef && s.eski) {
          var st = document.createElement('s'); st.textContent = WIDGET[s.eski].ad;
          ic.appendChild(st);
        }
        c.appendChild(ic);
        h.appendChild(c);
        r += WIDGET[id].sat;
      });
    });
  }

  function wSayfaCiz() {
    var p = $('#wy-sayfa');
    if (!p || !wSayfa) return;
    var id = wSayfa;
    wSecenekListesi = wSecenekler(id);
    if (wSayfaIdx > wSecenekListesi.length - 1) wSayfaIdx = 0;
    p.innerHTML =
      '<div class="wy-bas"><h3></h3><span class="wy-boy"></span></div>' +
      '<div class="wy-not"></div>' +
      '<div class="wy-harita" id="wy-harita"></div>' +
      '<div class="wy-secenek" id="wy-secenek"></div>';
    p.querySelector('h3').textContent = WIDGET[id].ad + (WIDGET[id].boy ? ' · ' + WIDGET[id].boy : '');
    p.querySelector('.wy-boy').textContent = '3 × ' + WIDGET[id].sat;
    p.querySelector('.wy-not').textContent = wNotMetni(id);
    var sc = p.querySelector('#wy-secenek');
    wSecenekListesi.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'wy-dugme' + (s.vazgec ? ' vazgec' : '');
      d.textContent = s.metin;
      sc.appendChild(d);
    });
    wHaritaCiz();
  }

  function wSayfaAc(id) {
    wSayfa = id; wSayfaIdx = 0;
    $('#wy-perde').hidden = false; $('#wy-sayfa').hidden = false;
    wSayfaCiz();
    bolge = 'wsayfa';
    odakCiz();
  }

  function wSayfaKapat() {
    wSayfa = null;
    $('#wy-perde').hidden = true; $('#wy-sayfa').hidden = true;
    bolge = 'galeri';
    odakCiz();
  }

  function wSecenekUygula() {
    var s = wSecenekListesi[wSayfaIdx];
    if (!s || s.vazgec) { wSayfaKapat(); return; }
    yerlesim = yerlesimDogrula(s.uygula(yerlesimKopya(yerlesim))) || yerlesim;
    yerlesimYaz();
    yerlesimUygula();
    kayit('yerlesim: sol=' + yerlesim.sol.join(',') + ' orta=' + yerlesim.orta.join(',') + ' sag=' + yerlesim.sag.join(','));
    if (s.hedef) widgetVerisiTazele(s.hedef);
    galeriCiz();
    wSayfaKapat();
  }

  /* --- yuklu uygulamalar (kok servis /uygulamalar) ------------------------
     Servis yoksa ya da okuyamazsa hicbir sey degismiyor: sabit liste kalir.
     Okursa: bilinenlerden TV'de OLMAYANLAR elenir (gorunurluge bakmadan —
     canli TV ve LG ana ekrani visible:false ama acilabiliyor), TV'deki
     diger GORUNUR uygulamalar dock disi olarak sona eklenir; Ayarlar'daki
     dock duzenleyici onlari da sunar. */
  var yukluBilgi = null;
  var BU_UYGULAMA = (window.PalmSystem && String(PalmSystem.identifier || '').split(' ')[0]) ||
                    'com.bilal.sade';

  function yukluleriOku() {
    kopruCagir2('/uygulamalar', '', function (o) {
      if (!o || !o.uygulamalar || !o.uygulamalar.length) return;
      var ilkBilgi = !yukluBilgi;
      var b = {};
      o.uygulamalar.forEach(function (a) { if (a && a.id) b[a.id] = a; });
      yukluBilgi = b;
      var yeni = BILINEN.filter(function (u) { return !!b[u.id]; });
      var var_ = {};
      yeni.forEach(function (u) { var_[u.id] = true; });
      o.uygulamalar.forEach(function (a) {
        if (!a.gorunur || var_[a.id] || a.id === BU_UYGULAMA) return;
        var_[a.id] = true;
        yeni.push({ id: a.id, ad: a.ad || a.id, dock: false, disari: true });
      });
      var imza = function (l) { return l.map(function (u) { return u.id; }).join(','); };
      /* Liste ayniysa yeniden cizme — tek istisna: ilk bilgi geldi ve paketteki
         simgesi olmadigi icin bas harfe dusmus kart var (paylasilan pakette
         marka logolari yok); TV'nin simgesiyle yeniden cizilsin. */
      var harfVar = !!document.querySelector('#raf-ic .harf, #izgara .harf');
      if (imza(yeni) === imza(UYGULAMALAR) && !(ilkBilgi && harfVar)) return;
      kayit('yuklu uygulamalar: ' + yeni.length + ' (' +
            (BILINEN.length - BILINEN.filter(function (u) { return !!b[u.id]; }).length) + ' bilinen yuklu degil)');
      UYGULAMALAR = yeni;
      uygulamalariYenidenKur(ilkBilgi && harfVar);
    }, 12000);
  }

  function uygulamalariYenidenKur(zorla) {
    var eskiDock = zorla ? '' : DOCK.map(function (u) { return u.id; }).join(',');
    DOCK = dockIdOku().map(uygulamaBul).filter(Boolean);
    if (rafIdx > DOCK.length - 1) rafIdx = Math.max(0, DOCK.length - 1);
    var ic = $('#raf-ic'), izgara = $('#izgara');
    if (ic && DOCK.map(function (u) { return u.id; }).join(',') !== eskiDock) {
      while (ic.firstChild) ic.removeChild(ic.firstChild);
      ic.setAttribute('data-x', '0');
      DOCK.forEach(function (u) { ic.appendChild(kartYap(u)); });
    }
    if (izgara) {
      while (izgara.firstChild) izgara.removeChild(izgara.firstChild);
      UYGULAMALAR.forEach(function (u) { izgara.appendChild(kartYap(u)); });
      if (izgaraIdx > UYGULAMALAR.length - 1) izgaraIdx = Math.max(0, UYGULAMALAR.length - 1);
    }
    if (gorunum === 'ayarlar') ayarlariCiz();
    odakCiz();
  }

  function baslat() {
    teshis();
    var ic = $('#raf-ic'), izgara = $('#izgara');
    ic.setAttribute('data-x', '0');
    DOCK.forEach(function (u) { ic.appendChild(kartYap(u)); });
    UYGULAMALAR.forEach(function (u) { izgara.appendChild(kartYap(u)); });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var k = t.closest('.kart-dock');
      if (k) { uygulamaAc(k.getAttribute('data-id')); return; }
      /* Magic Remote isaretcisi: galeri ogesi ve yerlestirme dugmesi de
         kumandadaki ENTER ile ayni yoldan gitsin (eskiden tiklama bagli
         degildi; isaretciyle galeride hicbir widget acilamiyordu). */
      var wd = t.closest('#wy-secenek .wy-dugme');
      if (wd) {
        var dl = Array.prototype.slice.call(document.querySelectorAll('#wy-secenek .wy-dugme'));
        wSayfaIdx = Math.max(0, dl.indexOf(wd));
        wSecenekUygula();
        return;
      }
      var gs = t.closest('#wg-icerik .wg-secilir');
      if (gs && !wSayfa) {
        galeriIdx = Math.max(0, galeriOgeleri().indexOf(gs));
        bolge = 'galeri'; odakCiz();
        var gw2 = gs.getAttribute('data-wid');
        if (gw2 === '_cihazlar') gorunumDegistir('ev-cihaz', true);
        else wSayfaAc(gw2);
        return;
      }
      var s = t.closest('.sekme');
      if (s) { gorunumDegistir(s.getAttribute('data-gorunum')); return; }
      /* Kontroller: fare/dokunma da kumandayla ayni yoldan gecsin ve
         odak tiklanan ogeye tasinsin (sonraki ok tusu oradan devam eder). */
      var c = t.closest('.odaklanir');
      if (!c) return;
      if (c.closest('.menubar-sag')) {
        bolge = 'sekme';
        sekmeyeGit(Math.max(0, menuOgeleri().indexOf(c)));
        odakCiz();
        menuIsi(c.getAttribute('data-is'), c);
        return;
      }
      if (c.closest('#mb-panel')) {
        bolge = 'panel';
        /* panelOdakla: yalnizca panelIdx'i yazinca odakCiz eski panelSecili
           kimligini bulup indeksi GERI aliyordu; Magic Remote ile "Koyu"
           tiklaninca odakta duran "Acik" uygulaniyordu. */
        panelOdakla(Math.max(0, panelKontrolleri().indexOf(c)));
        odakCiz();
        panelIsi(c.getAttribute('data-is'));
        return;
      }
      if (c.closest('#klima-widget')) {
        bolge = 'widget';
        evOdakIdx = Math.max(0, evKontrolleri().indexOf(c));
      } else if (c.closest('.odak-kart')) {
        var kart = c.closest('.odak-kart'), satir = c.closest('.odak-satir');
        satirKap = c.closest('#ayarlar-liste') ? '#ayarlar-liste' : '#cihazlar';
        bolge = 'cihaz';
        cihazKartIdx  = Math.max(0, cihazKartlari().indexOf(kart));
        cihazSatirIdx = Math.max(0, cihazSatirlari(kart).indexOf(satir));
        cihazSutIdx   = Math.max(0, cihazKontrolleri(satir).indexOf(c));
      }
      odakCiz();
      kontroluCalistir(c);
    });
    document.addEventListener('keydown', tusla);

    saatiGuncelle();
    setInterval(saatiGuncelle, 20000);
    setInterval(geriSayim, 1000);
    havaOnbellektenCiz();
    havaDurumu();      setInterval(havaDurumu, 15 * 60 * 1000);
    ezanVakitleri();   setInterval(ezanVakitleri, 6 * 60 * 60 * 1000);

    yerlesimOku();
    yerlesimUygula();

    cihazlar = cihazOnbellekOku();
    if (cihazlar) {
      kayit('onbellekten ' + cihazlar.length + ' cihaz, baglaniyor');
      klimaWidgetCiz(); cihazWidgetleriCiz();
      cihazBilgisiGeldi(cihazlar);
      cihazlariCiz();
    }
    cihazlariOku();
    setInterval(cihazlariOku, 60000);

    durumOku();
    setInterval(durumOku, 15000);
    /* One gelince 15 sn'lik turu bekleme: hemen bir tur (uyandi kurali
       uzun aradan sonra her seyi tazeler). webOS ikisinden birini yolluyor. */
    function oneGeldi() {
      if (document.hidden || document.webkitHidden) return;
      if (durumAn && Date.now() - durumAn > 45000) durumOku();
    }
    document.addEventListener('visibilitychange', oneGeldi);
    document.addEventListener('webkitvisibilitychange', oneGeldi);
    document.addEventListener('webOSRelaunch', oneGeldi);

    baslangicGorunumu();
    odakCiz();
    kayit('baslatildi — dock ' + DOCK.length + ' / toplam ' + UYGULAMALAR.length);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
})();
