/* ===========================================================================
   Sade baslatma servisi — root olarak calisir, boot'ta init.d ile baslar.

   --boot   : uygulama yoneticisi hazir olana kadar deneyerek Sade'yi acar
   --watch  : tum /dev/input/event* aygitlarini NON-BLOCKING okur, HOME
              tusuna basilinca Sade'yi one alir

   Neden non-blocking: bloklayan okuma ~9-32 aygitta is parcacigi havuzunu
   tuketip HOME'u tasiyan aygiti ac birakiyor.

   Neden tum aygitlar: HOME'u hangi aygitin tasidigi modele gore degisiyor
   (bu TV'de event3, kod 773 — OLCULDU). Tek aygita sabitlemek kirilgan.
   =========================================================================== */
'use strict';
var fs = require('fs');
var cp = require('child_process');
var Ayristirici = require('./onplan-ayristirici.js');
var EkranSuresi = require('./ekran-suresi.js');
var acilmaliMi  = require('./acilma-karari.js');
var HCS         = require('./homeconnect-sagligi.js');
var Tepki       = require('./tepki-mantigi.js');
var kapanmaBul  = require('./kapanma.js');

/* Kuruluma ozel ayarlar: servis-ayar.json (paylasilan pakette servis-kur.sh
   ayarlar.sh'tan uretir; bu TV'deki de lgroot/servis/servis-ayar.json).
   Dosya yoksa ya da bozuksa varsayilan "DOKUNMA": onyukleme politikasina
   ve arka plandaki uygulamalara karisilmiyor. Uygulama kimlikleri beyaz
   liste deseninden geciyor — dosyadan gelen dizgi luna'ya ham gitmesin. */
var SERVIS_AYAR = (function () {
  try { return JSON.parse(fs.readFileSync(__dirname + '/servis-ayar.json', 'utf8')) || {}; }
  catch (e) { return {}; }
})();
function ayarListesi(ad, varsayilan) {
  var v = SERVIS_AYAR[ad];
  if (!Array.isArray(v)) return varsayilan;
  return v.filter(function (x) { return typeof x === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(x); });
}

var APP      = /^[A-Za-z0-9._-]{1,128}$/.test(SERVIS_AYAR.uygulama || '') ? SERVIS_AYAR.uygulama : 'com.bilal.sade';
var HOME_KOD = SERVIS_AYAR.homeKodu > 0 ? Math.floor(SERVIS_AYAR.homeKodu) : 773;   /* bu kumandada olculdu (event3) */
var EV_KEY   = 1;
var BOY      = 16;           /* 32-bit: timeval(8) + type(2) + code(2) + value(4) */
var LOG      = '/tmp/sade-svc.log';
var ARG      = process.argv.slice(2);

/* Gunluk /tmp'de, yani RAM'de (tmpfs) ve TV yeniden baslayana kadar
   buyuyor. 512 KB'yi gecince bir oncekine (.1) devrediliyor: en fazla
   ~1 MB. Boyut her 200 yazmada bir olculuyor (stat maliyeti olmasin). */
var kayitSayac = 0;
function kayit(m) {
  var s = '[' + new Date().toISOString() + '] ' + m + '\n';
  try {
    if (++kayitSayac % 200 === 0 && fs.statSync(LOG).size > 512 * 1024) fs.renameSync(LOG, LOG + '.1');
  } catch (e) {}
  try { fs.appendFileSync(LOG, s); } catch (e) {}
}
try { fs.writeFileSync('/tmp/sade-svc.pid', String(process.pid)); } catch (e) {}

/* Duzgun kapanista HOME'u LG'ye geri ver. Sert cokmede bunu home-bekci.sh
   yakaliyor; her iki durumda da reboot zaten false'a donduruyor. */
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(function (s) {
  process.on(s, function () {
    if (ARG.indexOf('--watch') !== -1) { try { disableHomeYaz(false, 'cikis'); } catch (e) {} }
    try { esKaydet(); } catch (e) {}
    try { fs.unlinkSync('/tmp/sade-svc.pid'); } catch (e) {}
    process.exit(0);
  });
});

var aciliyor = false;

function luna(uri, yuk, geri) {
  cp.execFile('/usr/bin/luna-send', ['-n', '1', '-f', uri, JSON.stringify(yuk)],
    { timeout: 5000 }, function (hata, cikti) {
      if (geri) geri(hata, String(cikti || '').replace(/\s+/g, ' ').slice(0, 120));
    });
}

/* --- LG ana ekranina TEPKI ---
   Tus basisiyla yarismak yerine, LG'nin ekrani GERCEKTEN one geldiginde
   tepki veriyoruz. Ayristirma ve tepki mantigi ayri modullerde ve YERELDE
   TEST EDILDI (servis/test/). Onceki denemede tamponu tuketmeden bastan
   tariyordum ve dongu olusmustu; o hata testle kapatildi. */
var tepki = new Tepki();
var sonOnPlan = null;
var izleyiciCanli = false;   /* on plan aboneligi ayakta mi (bkz. acilma-karari.js) */

function onPlaniIzle() {
  var ayr = new Ayristirici();
  var alt = cp.spawn('/usr/bin/luna-send',
    ['-i', '-f', 'luna://com.webos.applicationManager/getForegroundAppInfo',
     JSON.stringify({ subscribe: true })]);

  alt.stdout.on('data', function (parca) {
    ayr.ekle(parca.toString()).forEach(function (nesne) {
      if (!nesne || typeof nesne.appId !== 'string') return;
      if (nesne.appId !== sonOnPlan) {
        sonOnPlan = nesne.appId;
        /* Kullanici bu uygulamayi EN AZ BIR KEZ one almis demektir —
           otomatik temizlik ona bir daha dokunmasin. Ayrintili gerekce
           KULLANILDI tanimida. */
        if (nesne.appId) KULLANILDI[nesne.appId] = true;
        es.onplanDegisti(nesne.appId || null, Date.now());
        kayit('on plan -> ' + (nesne.appId || '(bos)'));
        dhAyarla(sonOnPlan === APP, 'on plan ' + (sonOnPlan || '(bos)'));
      }
      var karar = tepki.onPlan(nesne.appId, Date.now());
      if (karar === 'ac') {
        kayit('LG ana ekrani one geldi (HOME ya da bosalma sonrasi) -> Sade one aliniyor');
        luna('luna://com.webos.applicationManager/launch', { id: APP },
          function (h, c) { kayit('  tepki: ' + (h ? 'hata' : c)); });
      } else if (karar === 'sigorta') {
        kayit('!! SIGORTA ATTI — cok sik tepki, 60 sn susuluyor');
      }
    });
  });

  alt.on('exit', function (k) {
    izleyiciCanli = false;
    sonOnPlan = null;
    kayit('on plan izleyici dustu (kod ' + k + '), 5 sn sonra yeniden');
    setTimeout(onPlaniIzle, 5000);
  });
  izleyiciCanli = true;
  kayit('on plan izleyici basladi');
}

function uygulamayiAc(sebep) {
  if (aciliyor) return;                  /* ard arda basista tek cagri */

  /* 24 EKIM: zaten on planda olan uygulamayi tekrar launch etmek WAM'de
     web uygulamasini yeniden baslatiyor ve WebView kilitleniyor (on plan
     31 sn bos kaldi). Karar acilma-karari.js'te, testi test/acilma-testi.js. */
  if (!acilmaliMi({ izleyiciCanli: izleyiciCanli, onPlan: sonOnPlan, uygulama: APP })) {
    kayit('zaten onde (' + sebep + ') -> launch atlandi');
    return;
  }

  aciliyor = true;
  setTimeout(function () { aciliyor = false; }, 900);

  luna('luna://com.webos.applicationManager/launch', { id: APP },
    function (hata, cikti) {
      kayit('ac (' + sebep + '): ' + (hata ? 'HATA ' + hata.message : cikti));
    });

}

/* --- boot: uygulama yoneticisi hazir olmayabilir, deneyerek ac --- */
if (ARG.indexOf('--boot') !== -1) {
  var deneme = 0;
  (function dene() {
    deneme++;
    cp.execFile('/usr/bin/luna-send',
      ['-n', '1', '-f', 'luna://com.webos.applicationManager/launch',
       JSON.stringify({ id: APP })],
      { timeout: 5000 },
      function (hata, cikti) {
        var ok = !hata && /"returnValue"\s*:\s*true/.test(String(cikti));
        kayit('boot denemesi ' + deneme + ': ' + (ok ? 'BASARILI' : 'henuz hazir degil'));
        if (!ok && deneme < 20) setTimeout(dene, 3000);
      });
  })();
}

/* --- watch: HOME tusu ---
   ONEMLI: aygitlari BIR KEZ taramak yetmiyor. Soguk acilista servis
   49. saniyede kalkiyor ama Magic Remote'un aygiti DAHA SONRA beliriyor
   (acilista 9 aygit vardi, birkac dakika sonra 32). Bir kez tarayip
   birakinca kumandayi hic dinlemiyorduk — HOME calismamasinin sebebi buydu.
   Cozum: periyodik yeniden tarama, yeni cikan aygitlari da ac. */
if (ARG.indexOf('--watch') !== -1) {
  var acikAygitlar = {};          /* ad -> fd */
  var sonAygitImzasi = '';

  function aygitlariTara() {
    var yeniSayi = 0;
    var liste;
    try { liste = fs.readdirSync('/dev/input'); } catch (e) { return; }
    liste.forEach(function (ad) {
      if (!/^event\d+$/.test(ad)) return;
      if (acikAygitlar.hasOwnProperty(ad)) return;
      try {
        acikAygitlar[ad] = fs.openSync('/dev/input/' + ad,
          fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
        yeniSayi++;
      } catch (e) { /* ENXIO: aygit yok, sessizce atla */ }
    });
    /* Yalnizca aygit KUMESI degisince yaz. hepsiniYenile() 30 sn'de bir
       hepsini kapatip yeniden actigi icin "yeni" sayisi her turda doluydu;
       25 Ekim: gunlugun 2.093 satirinin 1.476'si bu satirdi (arkadasin
       webOS 7 TV'sinin olcumu de ayni seyi gosterdi). */
    var imza = Object.keys(acikAygitlar).sort().join(',');
    if (yeniSayi && imza !== sonAygitImzasi) {
      kayit('input: ' + Object.keys(acikAygitlar).length + ' aygit acik' +
            (sonAygitImzasi ? ' (kume degisti)' : ''));
    }
    sonAygitImzasi = imza;
  }

  /* Yeni ISIM aramak yetmiyor: acilista event3 baska bir cihazdi,
     Magic Remote sonradan baglanip ayni dugumu devralmis olabilir —
     elimizde eski cihazin tutamaci kalir ve hic olay gelmez.
     Bu yuzden belirli araliklarla HEPSINI kapatip yeniden aciyoruz.
     35 ms'lik yoklamaya gore bosluk ihmal edilebilir. */
  function hepsiniYenile() {
    for (var ad in acikAygitlar) {
      if (!acikAygitlar.hasOwnProperty(ad)) continue;
      try { fs.closeSync(acikAygitlar[ad]); } catch (e) {}
    }
    acikAygitlar = {};
    aygitlariTara();
  }

  aygitlariTara();
  setInterval(aygitlariTara, 5000);    /* yeni cikan aygitlar */
  setInterval(hepsiniYenile, 30000);   /* dugum devri ihtimaline karsi */

  var ara = Buffer.alloc(BOY * 64);
  setInterval(function () {
    for (var ad in acikAygitlar) {
      if (!acikAygitlar.hasOwnProperty(ad)) continue;
      var n = 0;
      try { n = fs.readSync(acikAygitlar[ad], ara, 0, ara.length, null); }
      catch (e) { continue; }
      for (var o = 0; o + BOY <= n; o += BOY) {
        if (ara.readUInt16LE(o + 8) === EV_KEY &&
            ara.readUInt16LE(o + 10) === HOME_KOD &&
            ara.readInt32LE(o + 12) === 1) {
          /* 25 EKIM: Sade ZATEN ondeyken HOME'a basilinca korumayi
             yalnizca launch cagrisina koymustum; TEPKI PENCERESI yine
             aciliyordu. LG kendi ekranini one getiriyor, servis onu geri
             itiyor, LG tekrar dayatiyor -> 3 tur cekisme ve uygulama
             cokuyordu. Olculen log:
               zaten onde (home) -> launch atlandi
               on plan -> com.webos.app.home
               LG ana ekrani -> Sade one aliniyor   (x3)
             Zaten evdeysek HOME hicbir sey tetiklememeli: ne launch,
             ne tepki penceresi. */
          if (acilmaliMi({ izleyiciCanli: izleyiciCanli,
                           onPlan: sonOnPlan, uygulama: APP })) {
            tepki.homeBasildi(Date.now());
            uygulamayiAc('home');
          } else {
            /* Bekleyen pencere varsa onu da kapat — yoksa onceki basisin
               hakki LG ekrani gelince atesleniyor. */
            tepki.iptal();
            kayit('zaten onde -> HOME yok sayildi (bekleyen pencere kapatildi)');
          }
        }
      }
    }
  }, 35);
  /* 35 ms (25 Ekim, TV'de olculdu, 9 aygit): 20 ms tek cekirdegin %2.78'i,
     35 ms %1.84, 50 ms %1.26. HOME en kotu 15 ms gec algilaniyor —
     hissedilmez. Aygit elemek ise yaramiyor: dokuzu da HOME bitini
     bildiriyor (/proc/bus/input/devices). */
}

/* --- YEREL KOPRU -------------------------------------------------------
   Uygulamaya yalnizca "public" yetki grubu veriliyor ve settingsservice
   ona TAMAMEN kapali (Faz 0 sondasi: picture / option / kategorisiz,
   abonelikli dahil hepsi "Access denied" dondu, 20/45/90. saniyede de).
   Ama BU SERVIS root olarak calisiyor ve ayni cagri burada calisiyor —
   olculdu: setSystemSettings picture/backlight -> returnValue true.

   25 EKIM, IKINCI BULGU: backlight yazmak yetmiyordu. Panel degeri kabul
   ediyor (geri okununca yeni deger geliyor) ama EKRAN degismiyordu.
   Sebep picture.energySaving = "auto": Enerji Tasarrufu "Otomatik" iken
   paneli ortam isigi sensoru suruyor, backlight gecersiz kaliyor. LG'nin
   kendi menusunde de bu durumda parlaklik cubugu soluk/kapali.
   Kullanicinin istedigi "otomatik parlaklik" anahtari tam olarak bu ayar.

   GUVENLIK — bu bir root surecinde acilan yerel bir ucoktur, dar tutuldu:
     - yalnizca 127.0.0.1'e baglaniyor, LAN'dan erisilemez
     - YALNIZCA iki ayar: picture.backlight ve picture.energySaving.
       Genel komut ucu DEGIL, genel ayar ucu de DEGIL.
     - kabuk yok: execFile + dizi argumanlar, dizgi birlestirme yapilmiyor
     - backlight 0-100'e kistiriliyor, regex yalnizca 1-3 basamak kabul eder
     - energySaving yalnizca "auto" | "off" olabiliyor; istek 0/1 ile
       geliyor, disaridan gelen dizgi hicbir zaman luna'ya gecmiyor
   -------------------------------------------------------------------- */
/* --- GUC: yeniden baslat / tam kapat ------------------------------------
   26 EKIM: gece TV tamamen kapanip sabah soguk acilinca 13 saatlik
   birikim sifirlandi (bos islemci %11 -> %85, kullanilabilir RAM
   ~340 MB -> ~900 MB, takas 263 MB -> 0). Quick Start+ acikken TV hic
   soguk acilmiyor; Bilal bunu Denetim Merkezi'nden istiyor.
   Tam kapat = Quick Start+'i kapat, LG'nin kendi powerOff'u ile kapan
   (kumandayla acilir — Linux 'poweroff' DEGIL, onun sonrasi bilinmiyor),
   sonraki acilista Quick Start+'i geri ac. Isaret dosyasi bu son adim icin. */
var QS_GERI = '/var/lib/webosbrew/sade/quickstart-geri-ac';

function quickStartAyarla(acik, geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.settingsservice/setSystemSettings',
     JSON.stringify({ category: 'option', settings: { quickStartMode: acik ? 'on' : 'off' } })],
    { timeout: 5000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri(!hata && !!(o && o.returnValue));
    });
}

/* Soguk acilista ayar servisi node'dan sonra hazir olabiliyor: 20 sn arayla
   6 deneme. Hepsi tutmazsa isaret kalir, bir sonraki baslangicta yine denenir. */
function quickStartGeriAc(deneme) {
  deneme = deneme || 1;
  if (!fs.existsSync(QS_GERI)) return;
  quickStartAyarla(true, function (ok) {
    if (ok) {
      try { fs.unlinkSync(QS_GERI); } catch (e) {}
      kayit('guc: Quick Start+ geri acildi (deneme ' + deneme + ')');
    } else if (deneme < 6) {
      setTimeout(function () { quickStartGeriAc(deneme + 1); }, 20000);
    } else {
      kayit('guc: Quick Start+ geri ACILAMADI, isaret duruyor');
    }
  });
}

function gucIsi(is, geri) {
  if (is === 'yeniden') {
    kayit('guc: yeniden baslatiliyor (Denetim Merkezi)');
    geri({ tamam: true });
    setTimeout(function () { cp.execFile('/sbin/reboot', [], function () {}); }, 1500);
    return;
  }
  quickStartAyarla(false, function (ok) {
    if (!ok) { geri({ tamam: false, sebep: 'quickstart' }); return; }
    try { fs.writeFileSync(QS_GERI, new Date().toISOString()); } catch (e) {}
    kayit('guc: tam kapatiliyor (Quick Start+ gecici kapali)');
    geri({ tamam: true });
    setTimeout(function () {
      cp.execFile('/usr/bin/luna-send',
        ['-n', '1', '-f', 'luna://com.webos.service.tvpower/power/powerOff',
         JSON.stringify({ reason: 'remoteKey' })],
        { timeout: 8000 },
        function (hata, cikti) {
          var o = kopruJson(cikti);
          if (!hata && o && o.returnValue) return;
          kayit('guc: powerOff reddedildi: ' + String(cikti || hata).slice(0, 160));
          quickStartGeriAc();     /* kapanmadi: ayari eski haline dondur */
        });
    }, 1500);
  });
}

var KOPRU_PORT = 9123;

function kopruJson(ham) {
  var s = String(ham || '');
  var i = s.indexOf('{');
  if (i < 0) return null;
  try { return JSON.parse(s.slice(i)); } catch (e) { return null; }
}

/* Onbellek iki alani birden tutuyor; yazma onu gecersiz kiliyor. */
var kopruOnbellek = null, kopruOnbellekAn = 0;

function kopruAyarYaz(ayarlar, geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.settingsservice/setSystemSettings',
     JSON.stringify({ category: 'picture', settings: ayarlar })],
    { timeout: 5000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri(!hata && !!(o && o.returnValue));
    });
}



/* --- ONYUKLEME (preload) ------------------------------------------------
   webOS acilista uygulamalari onyukluyor ki hizli acilsinlar. Bilal
   "amazon'u ben acmadim" dedi, hakliydi: cmdline'da "reason":"preload"
   yaziyor. Olculdu:

     onyuklu YouTube      121 MB (kullanildiktan sonra 162 MB)
     sicak acilis         150 ms,  bellek egrisi bastan duz
     soguk acilis        1550 ms,  72 -> 123 MB arasi ~8 sn yukleniyor

   Yani onyukleme ~1,4 saniye kazandiriyor. Bu TV'de MemAvailable 236 MB'a
   kadar dustu ve 359 MB takasa yazildi; o noktada homeconnect takilip cihaz
   listesini bosaltti (klima widget'i ekrandan kayboldu). Yani kazanilan sey
   hiz degil KARARLILIK.

   NEDEN SERVISTEN, NEDEN SISTEM DOSYASINDAN DEGIL:
   setPreloadPolicy da setConfigs da GECICI — /var/preferences/configd_db.json
   hic degismiyor, reboot'ta hepsi sifirlaniyor. Kalici yapmanin iki yolu
   vardi; sistem dosyasini duzenlemek yerine her acilista politikayi yeniden
   uygulamayi sectik: sistem dosyasina hic dokunmuyoruz, geri almak icin
   asagidaki listeyi bosaltmak yeterli, firmware guncellemesi de bozmuyor.

   maxPreloadApp ise canlida ISE YARAMIYOR — 0 yapildi, YouTube yine
   onyuklendi. Calisan tek kaldirac uygulama basina isEnabled.

   Listede OLMAYANLAR (bilerek): com.webos.app.home (sistem kabugu),
   com.webos.app.livetv (Bilal istedi), airplay (kullaniyor). */
/* Bu TV'nin listesi servis-ayar.json'da: youtube (121 MB, en buyugu),
   netflix, amazon, alexa, LG tarayicisi, "Search", rehber, HDMI 1-4
   (dort portun DORDU DE bos: hdmiPlugIn=false). HDMI kullanan bir TV'de
   onlari listeye koymak giris degistirmeyi yavaslatabilir — olculmedi. */
var ONYUKLEME_KAPALI = ayarListesi('onyuklemeKapali', []);

function onyuklemeUygula(geri) {
  if (!ONYUKLEME_KAPALI.length) { if (geri) geri(0); return; }
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.service.preloadmanager/getPreloadPolicy', '{}'],
    { timeout: 8000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      var L = (o && o.applications) || [];
      if (!L.length) { kayit('onyukleme: politika okunamadi'); if (geri) geri(0); return; }
      /* Degistirilecekleri sirayla yaz. Eszamanli execFile eski node'da
         uv_close cokmesi yapiyor — bu serviste daha once yasandi. */
      var hedef = L.filter(function (a) {
        return ONYUKLEME_KAPALI.indexOf(a.id) >= 0 && a.isEnabled;
      });
      var n = 0;
      function sonraki(i) {
        if (i >= hedef.length) {
          if (n) kayit('onyukleme kapatildi: ' + n + ' uygulama');
          /* Politikayi kapatmak YENI onyuklemeleri engelliyor ama ZATEN
             bellekte duranlari atmiyor. Soguk acilista LG bizden once
             davranip tarayiciyi ve "Search"i yukluyor; politika sonradan
             gelince onlar orada kaliyordu. Bir kez de temizlik yap. */
          onyuklenmisleriAt(function () { if (geri) geri(n); });
          return;
        }
        var a = {};
        for (var k in hedef[i]) a[k] = hedef[i][k];
        a.isEnabled = false;
        cp.execFile('/usr/bin/luna-send',
          ['-n', '1', '-f', 'luna://com.webos.service.preloadmanager/setPreloadPolicy',
           JSON.stringify({ application: a })],
          { timeout: 8000 },
          function (h2, c2) {
            var r = kopruJson(c2);
            if (!h2 && r && r.returnValue) n++;
            else kayit('onyukleme yazilamadi: ' + hedef[i].id);
            sonraki(i + 1);
          });
      }
      sonraki(0);
    });
}


/* --- EKRAN SURESI ----------------------------------------------------------
   Mantik ekran-suresi.js'te (testli). Burada yalnizca baglanti: on plan
   aboneligi (onPlaniIzle) + guc durumu aboneligi + 30 sn'lik tik +
   5 dakikada bir diske yazma. Gun sinirlari TV'nin yerel saatine gore —
   node'un saat dilimi farki -180 dk olculdu, yani Istanbul. */
var ES_DOSYA = '/var/lib/webosbrew/sade/ekran-suresi.json';
var es = new EkranSuresi.Sayac();
try { es.iceAl(fs.readFileSync(ES_DOSYA, 'utf8')); } catch (e) {}
var esGorulenGuc = {};

function esKaydet() {
  try { fs.writeFileSync(ES_DOSYA + '.yeni', es.disaAktar()); fs.renameSync(ES_DOSYA + '.yeni', ES_DOSYA); }
  catch (e) { kayit('ekran suresi yazilamadi: ' + e.message); }
}

/* tvpower/power/getPowerState aboneligi. Olculen deger: "Screen Saver";
   webOS'un bilinen digerleri "Active", "Active Standby", "Screen Off".
   Ilk kez gorulen her degeri logluyoruz — sayilmayan bir durumu
   "aslinda ekran acikti" diye sonradan fark etmek icin. */
function gucIzle() {
  var ayr = new Ayristirici();
  var alt = cp.spawn('/usr/bin/luna-send',
    ['-i', '-f', 'luna://com.webos.service.tvpower/power/getPowerState',
     JSON.stringify({ subscribe: true })]);
  alt.stdout.on('data', function (parca) {
    ayr.ekle(parca.toString()).forEach(function (n) {
      if (!n || typeof n.state !== 'string') return;
      if (!esGorulenGuc[n.state]) { esGorulenGuc[n.state] = true; kayit('guc durumu goruldu: ' + n.state); }
      if (n.state !== es.guc) es.gucDegisti(n.state, Date.now());
    });
  });
  alt.on('exit', function (k) {
    es.gucDegisti(null, Date.now());     /* bilmiyorsak sayma */
    kayit('guc izleyici dustu (kod ' + k + '), 5 sn sonra yeniden');
    setTimeout(gucIzle, 5000);
  });
}

function esOzet() {
  var g = es.gun(EkranSuresi.tarih(Date.now()));
  g.uygulamalar = g.uygulamalar.map(function (u) {
    return { id: u.id, ad: uygulamaAdi(u.id), sn: u.sn };
  });
  g.guc = es.guc;
  /* Dunun TOPLAMI (karsilastirma degil): elimizde yalnizca gun toplamlari
     var; sabah "dunden az" demek her zaman dogru ve anlamsiz olurdu. */
  var dun = es.gun(EkranSuresi.tarih(Date.now() - 86400000));
  g.dunSn = dun.toplamSn;
  return g;
}

/* --- UYKU ZAMANLAYICI ------------------------------------------------------
   settingsservice time.sleepTimer. Olası degerler (yoklamayla olculdu):
   off, 10, 20, 30, 60, 90, 120, 180, 240 dakika. Kalan sureyi okuyan bir
   metot YOK — bitis anini biz tutuyoruz. Zamanlayici LG menusunden
   kurulduysa bitisi bilmiyoruz; o durumda yalnizca "acik · N dk" diyoruz. */
var UYKU_DEGERLER = ['10', '20', '30', '60', '90', '120', '180', '240'];
var uykuBitis = null;

function ayarYaz(kategori, ayarlar, geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.settingsservice/setSystemSettings',
     JSON.stringify({ category: kategori, settings: ayarlar })],
    { timeout: 6000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri(!hata && !!(o && o.returnValue));
    });
}

function ayarOku(kategori, anahtarlar, geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.settingsservice/getSystemSettings',
     JSON.stringify({ category: kategori, keys: anahtarlar })],
    { timeout: 6000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri((o && o.settings) || null);
    });
}

function uykuDurumu(geri) {
  ayarOku('time', ['sleepTimer'], function (a) {
    var d = a && a.sleepTimer;
    if (!d || d === 'off') uykuBitis = null;
    if (uykuBitis && uykuBitis < Date.now()) uykuBitis = null;
    geri({ dk: (d && d !== 'off') ? Number(d) : 0,
           kalanSn: uykuBitis ? Math.round((uykuBitis - Date.now()) / 1000) : null });
  });
}

/* --- FILM MODU -------------------------------------------------------------
   Resim: picture.pictureMode = "cinema"; ses: sound.soundMode = "movie".
   Acarken ONCEKI degerleri diske yaziyoruz, kapatinca onlara donuyoruz —
   "normal"e degil, kullanicinin gercekte kullandigina.
   Bilinen sinir: resim modu giris ve SDR/HDR basina ayri tutuluyor. HDR
   icerik acilinca TV kendi HDR moduna gecebilir; bu dogrulanmadi. */
var FILM_DOSYA = '/var/lib/webosbrew/sade/film-onceki.json';
var FILM_RESIM = ['cinema', 'filmMaker'];

function filmDurumu(geri) {
  ayarOku('picture', ['pictureMode'], function (r) {
    ayarOku('sound', ['soundMode'], function (s) {
      var rm = r && r.pictureMode, sm = s && s.soundMode;
      geri({ acik: FILM_RESIM.indexOf(rm) >= 0, resim: rm || null, ses: sm || null });
    });
  });
}

function filmAyarla(ac, geri) {
  filmDurumu(function (d) {
    if (ac) {
      if (!d.acik && d.resim) {
        try { fs.writeFileSync(FILM_DOSYA, JSON.stringify({ resim: d.resim, ses: d.ses })); } catch (e) {}
      }
      ayarYaz('picture', { pictureMode: 'cinema' }, function (ok1) {
        ayarYaz('sound', { soundMode: 'movie' }, function (ok2) {
          filmDurumu(function (son) { son.yazildi = ok1 && ok2; geri(son); });
        });
      });
    } else {
      var onceki = { resim: 'normal', ses: 'standard' };
      try { var o = JSON.parse(fs.readFileSync(FILM_DOSYA, 'utf8')); if (o && o.resim) onceki = o; } catch (e) {}
      ayarYaz('picture', { pictureMode: onceki.resim }, function (ok1) {
        ayarYaz('sound', { soundMode: onceki.ses || 'standard' }, function (ok2) {
          filmDurumu(function (son) { son.yazildi = ok1 && ok2; geri(son); });
        });
      });
    }
  });
}


/* --- DIS VERI: PIYASA + TRAFIK ---------------------------------------------
   Tek cekici burada: onbellek, kaynaga karsi nazik davranma (5 dk), hata
   halinde son iyi veriyi koruma. Uygulama yalnizca kopruden okuyor.
   Node 8.12: https.get(url, secenek, geri) imzasi yok (node 10.9'da geldi),
   o yuzden url.parse + secenek nesnesi. */
var https = require('https'), urlMod = require('url');

function httpsJson(adres, geri) {
  var s = urlMod.parse(adres);
  s.headers = { 'User-Agent': 'Mozilla/5.0 (SmartTV; Sade)', 'Accept': 'application/json' };
  s.timeout = 10000;
  var bitti = false;
  function son(h, o) { if (!bitti) { bitti = true; geri(h, o); } }
  var ist = https.get(s, function (c) {
    var g = '';
    c.setEncoding('utf8');
    c.on('data', function (p) { g += p; if (g.length > 2e6) ist.abort(); });
    c.on('end', function () {
      if (c.statusCode !== 200) { son('HTTP ' + c.statusCode); return; }
      /* IBB icerik pazarligi yapiyor: Accept: application/json OLMAZSA
         gercek XML donuyor (25 Ekim, TV'de olculdu). Basligi kaldirma. */
      try { son(null, JSON.parse(g)); } catch (e) { son('json: ' + e.message); }
    });
  });
  ist.on('timeout', function () { ist.abort(); son('zaman asimi'); });
  ist.on('error', function (e) { son(e.message); });
}

/* Piyasa: finans.truncgil.com — tek yanitta bes kalem. Gayriresmi bir
   kaynak; alan adlari degisirse bos doneriz, uydurmayiz.
   ONEMLI: yanit "cache-control: max-age=315360000" (10 yil) ile geliyor —
   zaman damgasi eklemezsek ilk degerde donar. */
var PIYASA_KALEM = [
  { kod: 'altin', alan: 'GRA',   ad: 'Gram altın',  kisa: 'Gram altın' },
  { kod: 'gumus', alan: 'GUMUS', ad: 'Gram gümüş',  kisa: 'Gümüş' },
  { kod: 'usd',   alan: 'USD',   ad: 'Dolar',       kisa: 'Dolar' },
  { kod: 'eur',   alan: 'EUR',   ad: 'Euro',        kisa: 'Euro' },
  { kod: 'bist',  alan: 'XU100', ad: 'BIST 100',    kisa: 'BIST', birimsiz: true }
];
var piyasaOnbellek = null, piyasaAn = 0, piyasaCekiliyor = false;

function piyasaGetir(geri) {
  if (piyasaOnbellek && Date.now() - piyasaAn < 5 * 60000) { geri(piyasaOnbellek); return; }
  if (piyasaCekiliyor) { geri(piyasaOnbellek || { hata: 'cekiliyor' }); return; }
  piyasaCekiliyor = true;
  httpsJson('https://finans.truncgil.com/v4/today.json?_=' + Date.now(), function (h, o) {
    piyasaCekiliyor = false;
    if (h || !o) {
      kayit('piyasa cekilemedi: ' + h);
      geri(piyasaOnbellek || { hata: String(h) });        /* son iyi veri */
      return;
    }
    var kalemler = [];
    PIYASA_KALEM.forEach(function (k) {
      var v = o[k.alan];
      if (!v || typeof v.Selling !== 'number' || !(v.Selling > 0)) return;
      kalemler.push({ kod: k.kod, ad: k.ad, kisa: k.kisa, birimsiz: !!k.birimsiz,
                      deger: v.Selling,
                      degisim: typeof v.Change === 'number' ? v.Change : null });
    });
    if (!kalemler.length) { geri(piyasaOnbellek || { hata: 'alan yok' }); return; }
    /* Update_Date TR saatinde ve saat dilimsiz: "2026-10-25 19:00:04". */
    var ud = String(o.Update_Date || '').replace(' ', 'T');
    piyasaOnbellek = { guncelleme: ud ? ud + '+03:00' : new Date().toISOString(), kalemler: kalemler };
    piyasaAn = Date.now();
    geri(piyasaOnbellek);
  });
}

/* Trafik: IBB trafik endeksi (1-99, 5 dk). Sehir geneli son 24 saat
   TrafficIndexHistory'den (kucuk egri icin 15 dakikaya seyreltiliyor);
   Anadolu ve Avrupa yakasi ayri ayri TrafficIndex_Sc1_Cont'tan
   ({"TI":36,"TI_An":42,"TI_Av":33} — 25 Ekim'de bulundu; ilk surumde
   "kaynakta yaka ayrimi yok" yazmistim, yanlisti). Ikincisi cevap
   vermezse yaka alanlari bos kalir, sehir geneli yine gelir. */
var trafikOnbellek = null, trafikAn = 0, trafikCekiliyor = false;

function trafikGetir(geri) {
  if (trafikOnbellek && Date.now() - trafikAn < 5 * 60000) { geri(trafikOnbellek); return; }
  if (trafikCekiliyor) { geri(trafikOnbellek || { hata: 'cekiliyor' }); return; }
  trafikCekiliyor = true;
  httpsJson('https://api.ibb.gov.tr/tkmservices/api/TrafficData/v1/TrafficIndexHistory/1/5M?_=' + Date.now(),
    function (h, o) {
      trafikCekiliyor = false;
      if (h || !o || !o.length) {
        kayit('trafik cekilemedi: ' + h);
        geri(trafikOnbellek || { hata: String(h || 'bos') });
        return;
      }
      var l = o.filter(function (x) { return typeof x.TrafficIndex === 'number'; });
      if (!l.length) { geri(trafikOnbellek || { hata: 'alan yok' }); return; }
      /* Yanit en yeniden eskiye; egri icin eskiden yeniye, 15 dk adim. */
      var seri = [];
      for (var i = l.length - 1; i >= 0; i -= 3) seri.push(l[i].TrafficIndex);
      var sonuc = { endeks: l[0].TrafficIndex, zaman: l[0].TrafficIndexDate, seri: seri,
                    anadolu: null, avrupa: null };
      httpsJson('https://api.ibb.gov.tr/tkmservices/api/TrafficData/v1/TrafficIndex_Sc1_Cont?_=' + Date.now(),
        function (h2, y) {
          if (!h2 && y && typeof y.TI_An === 'number') { sonuc.anadolu = y.TI_An; sonuc.avrupa = y.TI_Av; }
          trafikOnbellek = sonuc;
          trafikAn = Date.now();
          geri(trafikOnbellek);
        });
    });
}

/* --- GUZERGAH: yol suresi (TomTom Routing, canli trafikle) ----------------
   Guzergahlar servis-ayar.json'da (bu TV: Pendik'ten alti alternatif —
   15 Temmuz, FSM'ye uc yol, Avrasya, Yavuz Sultan Selim). Tanimli guzergah ya da anahtar yoksa uc {tanimsiz:true} doner,
   uygulama widget'i hic gostermez — paket her sehirde calissin.
   Belirli bir yoldan gecmeyi ARA NOKTA ile zorlamak kirilgandi (25 Ekim,
   TV'de olculdu): ara nokta serit yonune gore geri donuslere yol acip rotayi
   50 km'ye uzatti. Calisan yontem kacinilacak alanlar (avoidAreas): ornegin
   E-5 rotasinda TEM koridoru ve FSM girisi yasak. Rotalar kopru ortasina
   94 m / 41 m mesafeden geciyor (dogrulandi).
   1 KASIM: avoidAreas KESIN YASAK DEGIL — trafik agirken TomTom yasak
   alandan yine geciyor ("E-5/15 Temmuz" 117 km'yle YSS'den dolasti).
   Kopruyu garanti eden sey HEDEF: rota artik Bogaz'i gecmiyor, koprunun
   Anadolu girisindeki bati yonu seridinde bitiyor (OSM'den alinan nokta,
   karsi serit 13-35 m otede). Seritte biten rota baska kopruye gidemez;
   yasak alanlar yalnizca yakadaki koridoru (E-5/TEM/O-7) seciyor.
   Kota: 5 dk onbellek, guzergah basina 1 istek -> 6 guzergahla gunde en
   fazla 1.728; ucretsiz katman 2.500. Anahtar dosyasi 0600, yanita girmez. */
var TT_ANAHTAR = (function () {
  try { return fs.readFileSync(__dirname + '/tomtom-anahtar', 'utf8').trim() || null; }
  catch (e) { return null; }
})();
function sayi(x) { return typeof x === 'number' && isFinite(x); }
function noktaMi(p) { return p && p.length === 2 && sayi(p[0]) && sayi(p[1]); }
var GUZERGAHLAR = (Array.isArray(SERVIS_AYAR.guzergahlar) ? SERVIS_AYAR.guzergahlar : [])
  .filter(function (g) {
    return g && typeof g.ad === 'string' && noktaMi(g.nereden) && noktaMi(g.nereye) &&
           (!g.kacin || (Array.isArray(g.kacin) && g.kacin.every(function (d) { return noktaMi(d[0]) && noktaMi(d[1]); }))) &&
           (!g.duraklar || Array.isArray(g.duraklar)) && (!g.kopru || noktaMi(g.kopru));
  }).slice(0, 6);
var guzOnbellek = null, guzAn = 0, guzBekleyen = [];

function rotaSor(g, geri) {
  var govde = JSON.stringify({ avoidAreas: { rectangles: (g.kacin || []).map(function (d) {
    return { southWestCorner: { latitude: d[0][0], longitude: d[0][1] },
             northEastCorner: { latitude: d[1][0], longitude: d[1][1] } };
  }) } });
  var yol = '/routing/1/calculateRoute/' + g.nereden.join(',') + ':' + g.nereye.join(',') +
            '/json?traffic=true&computeTravelTimeFor=all&routeType=fastest&travelMode=car' +
            (g.duraklar ? '&sectionType=traffic&instructionsType=coded' : '') +
            '&key=' + encodeURIComponent(TT_ANAHTAR);
  var bitti = false;
  function son(h, o) { if (!bitti) { bitti = true; geri(h, o); } }
  var ist = https.request({ host: 'api.tomtom.com', method: 'POST', path: yol, timeout: 12000,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(govde) } },
    function (c) {
      var s = '';
      c.setEncoding('utf8');
      c.on('data', function (p) { s += p; if (s.length > 1e6) ist.abort(); });
      c.on('end', function () {
        if (c.statusCode !== 200) { son('HTTP ' + c.statusCode); return; }
        try { son(null, JSON.parse(s)); } catch (e) { son('json'); }
      });
    });
  ist.on('timeout', function () { ist.abort(); son('zaman asimi'); });
  ist.on('error', function (e) { son(e.message); });
  ist.end(govde);
}

/* Haritada cizmek icin rota cizgisi: noktalar arasi en az 120 m (35 km'lik
   rota ~300 nokta). [enlem, boylam] ciftleri, 5 basamak (~1 m). */
function cizgiSeyrelt(rota) {
  var out = [], son = null;
  (rota.legs || []).forEach(function (l) {
    (l.points || []).forEach(function (q) {
      var p = [Math.round(q.latitude * 1e5) / 1e5, Math.round(q.longitude * 1e5) / 1e5];
      if (son) {
        var dy = (p[0] - son[0]) * 111000, dx = (p[1] - son[1]) * 84000;
        if (dx * dx + dy * dy < 120 * 120) return;
      }
      out.push(p); son = p;
    });
  });
  return out;
}

/* KONTROL NOKTALARI: tanimli duraklar rotaya oturtulup aradaki her parca
   icin sure, gecikme ve ortalama hiz. Kaynaklar (25 Ekim olculdu):
   - talimatlarda (instructionsType) her noktaya kadar BIRIKMIS sure ve
     rota uzerindeki mesafe var; durak suresi aradan dogrusal okunuyor;
   - trafik bolumleri (sectionType=traffic) nokta araligi + gecikme veriyor;
     gecikme parcayla ortustugu kadariyla paylastiriliyor.
   Rotaya 800 m'den uzak durak atiliyor (yanlis tanimlanmis, uydurmuyoruz). */
function mesafe(a, b) {
  var r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r;
  return Math.sqrt(x * x + y * y) * 6371000;
}
function durakParcalari(rota, tanim) {
  var pts = [];
  (rota.legs || []).forEach(function (l) { (l.points || []).forEach(function (q) { pts.push([q.latitude, q.longitude]); }); });
  if (pts.length < 2) return null;
  var kum = [0];
  for (var i = 1; i < pts.length; i++) kum.push(kum[i - 1] + mesafe(pts[i - 1], pts[i]));
  var top = kum[kum.length - 1], topSn = rota.summary.travelTimeInSeconds;
  /* (mesafe, birikmis sure) cizelgesi: talimatlardan, bas ve son eklenerek */
  var cz = [[0, 0]];
  ((rota.guidance && rota.guidance.instructions) || []).forEach(function (x) {
    if (sayi(x.routeOffsetInMeters) && sayi(x.travelTimeInSeconds)) cz.push([x.routeOffsetInMeters, x.travelTimeInSeconds]);
  });
  cz.push([top, topSn]);
  cz.sort(function (a, b) { return a[0] - b[0]; });
  function sureAt(d) {
    for (var k = 1; k < cz.length; k++) {
      if (d <= cz[k][0]) {
        var a = cz[k - 1], b = cz[k], f = b[0] > a[0] ? (d - a[0]) / (b[0] - a[0]) : 0;
        return a[1] + (b[1] - a[1]) * f;
      }
    }
    return topSn;
  }
  var duraklar = [];
  tanim.forEach(function (d) {
    if (!d || typeof d.ad !== 'string' || !noktaMi(d.nokta)) return;
    var en = 1e12, ei = 0;
    for (var j = 0; j < pts.length; j++) { var m = mesafe(d.nokta, pts[j]); if (m < en) { en = m; ei = j; } }
    if (en > 800) { kayit('durak rotada degil (' + d.ad + ', ' + Math.round(en) + ' m)'); return; }
    duraklar.push({ ad: d.ad, i: ei, km: kum[ei], sn: sureAt(kum[ei]) });
  });
  duraklar.sort(function (a, b) { return a.i - b.i; });
  if (duraklar.length < 2) return null;
  var bolum = (rota.sections || []).filter(function (s) { return s.sectionType === 'TRAFFIC'; });
  var parca = [];
  for (var p = 0; p + 1 < duraklar.length; p++) {
    var a = duraklar[p], b = duraklar[p + 1], gec = 0, kapali = false;
    bolum.forEach(function (s) {
      var o1 = Math.max(a.i, s.startPointIndex), o2 = Math.min(b.i, s.endPointIndex);
      var boy = Math.max(1, s.endPointIndex - s.startPointIndex);
      if (o2 > o1) {
        gec += (s.delayInSeconds || 0) * (o2 - o1) / boy;
        if (s.magnitudeOfDelay === 4 && s.simpleCategory === 'ROAD_CLOSURE') kapali = true;
      }
    });
    var sn = Math.max(0, b.sn - a.sn), km = (b.km - a.km) / 1000;
    /* Gecikme nokta araligina gore paylastiriliyor; sure ise talimatlardan.
       Ikisi ayni olcekte degil, parcanin gecikmesi kendi suresini asabiliyordu
       (TV'de olculdu: "7 dk, +8") — sureyle sinirla. */
    gec = Math.min(gec, sn);
    parca.push({ dk: Math.round(sn / 60), gecikmeDk: Math.round(gec / 60),
                 normalDk: Math.max(0, Math.round((sn - gec) / 60)),
                 hiz: sn > 0 ? Math.round(km / (sn / 3600)) : null, km: Math.round(km * 10) / 10,
                 kapali: kapali });
  }
  return { duraklar: duraklar.map(function (d) { return { ad: d.ad, km: Math.round(d.km / 100) / 10 }; }),
           parcalar: parca };
}

/* KAPANMALAR: Traffic Incidents API, yalnizca "yol kapali" (kategori 8),
   butun bitis/kopru noktalarini kapsayan tek kutu. Rota cevrimiyle ayni
   5 dk onbellek -> gunde en fazla 288 istek (kotasi rotalardan ayri).
   Hata olursa null: kapanma bilinmiyor, rotalar yine gosterilir. */
function kapanmalariSor(geri) {
  var en0 = 90, en1 = -90, bo0 = 180, bo1 = -180;
  GUZERGAHLAR.forEach(function (g) {
    [g.nereye].concat(g.kopru ? [g.kopru] : []).forEach(function (p) {
      en0 = Math.min(en0, p[0]); en1 = Math.max(en1, p[0]); bo0 = Math.min(bo0, p[1]); bo1 = Math.max(bo1, p[1]);
    });
  });
  var alan = '{incidents{geometry{type,coordinates},properties{iconCategory,events{description},endTime}}}';
  var yol = '/traffic/services/5/incidentDetails?bbox=' + [bo0 - .01, en0 - .01, bo1 + .01, en1 + .01].join(',') +
            '&fields=' + encodeURIComponent(alan) + '&categoryFilter=8&timeValidityFilter=present&language=tr-TR' +
            '&key=' + encodeURIComponent(TT_ANAHTAR);
  var bitti = false;
  function son(o) { if (!bitti) { bitti = true; geri(o); } }
  var ist = https.get({ host: 'api.tomtom.com', path: yol, timeout: 12000 }, function (c) {
    var s = '';
    c.setEncoding('utf8');
    c.on('data', function (p) { s += p; if (s.length > 4e6) ist.abort(); });
    c.on('end', function () {
      if (c.statusCode !== 200) { kayit('kapanmalar alinamadi: HTTP ' + c.statusCode); son(null); return; }
      try { son(JSON.parse(s).incidents || []); } catch (e) { son(null); }
    });
  });
  ist.on('timeout', function () { ist.abort(); son(null); });
  ist.on('error', function (e) { kayit('kapanmalar alinamadi: ' + e.message); son(null); });
}

/* Rotanin son ~100 m'sindeki yonu: kapanmanin bizim seritte mi karsi
   seritte mi oldugunu ayirmak icin (kapanma.js). */
function sonYon(rota) {
  var pts = [];
  (rota.legs || []).forEach(function (l) { (l.points || []).forEach(function (q) { pts.push([q.latitude, q.longitude]); }); });
  if (pts.length < 2) return null;
  var son = pts[pts.length - 1], i = pts.length - 2;
  while (i > 0 && mesafe(pts[i], son) < 100) i--;
  return { son: son, yon: kapanmaBul.yon(pts[i], son) };
}

function guzergahGetir(geri) {
  if (!TT_ANAHTAR || !GUZERGAHLAR.length) { geri({ tanimsiz: true }); return; }
  if (guzOnbellek && Date.now() - guzAn < 5 * 60000) { geri(guzOnbellek); return; }
  guzBekleyen.push(geri);
  if (guzBekleyen.length > 1) return;
  var eski = {};
  ((guzOnbellek && guzOnbellek.yollar) || []).forEach(function (y) { eski[y.ad] = y; });
  var yollar = [], i = 0, olaylar = null;
  kapanmalariSor(function (o) { olaylar = o; sonraki(); });
  function sonraki() {
    if (i >= GUZERGAHLAR.length) {
      guzOnbellek = { baslik: SERVIS_AYAR.guzergahBaslik || null,
                      guncelleme: new Date().toISOString(), yollar: yollar };
      guzAn = Date.now();
      var l = guzBekleyen; guzBekleyen = [];
      l.forEach(function (f) { f(guzOnbellek); });
      return;
    }
    var g = GUZERGAHLAR[i++];
    rotaSor(g, function (h, o) {
      var s = !h && o && o.routes && o.routes[0] && o.routes[0].summary;
      if (s && sayi(s.travelTimeInSeconds)) {
        yollar.push({ ad: g.ad, dk: Math.round(s.travelTimeInSeconds / 60), cizgi: cizgiSeyrelt(o.routes[0]),
                      duraklar: g.duraklar ? durakParcalari(o.routes[0], g.duraklar) : null,
                      normalDk: sayi(s.noTrafficTravelTimeInSeconds) ? Math.round(s.noTrafficTravelTimeInSeconds / 60) : null,
                      gecikmeDk: sayi(s.trafficDelayInSeconds) ? Math.round(s.trafficDelayInSeconds / 60) : null,
                      km: Math.round(s.lengthInMeters / 100) / 10 });
      } else {
        kayit('guzergah alinamadi (' + g.ad + '): ' + h);
        /* son iyi veri; yoksa acikca "alinamadi" */
        yollar.push(eski[g.ad] ? Object.assign({ eski: true }, eski[g.ad]) : { ad: g.ad, hata: true });
      }
      var sy = s && olaylar && sonYon(o.routes[0]);
      if (sy) {
        var kp = kapanmaBul(olaylar, { son: sy.son, yon: sy.yon, kopru: g.kopru });
        if (kp) { yollar[yollar.length - 1].kapali = kp; kayit('kapali: ' + g.ad + (kp.neden ? ' (' + kp.neden + ')' : '')); }
      }
      sonraki();
    });
  }
}

/* --- HARITA DOSEMELERI (TomTom, servis uzerinden) -----------------------------
   Anahtar sayfaya hic inmesin diye doseme servis uzerinden geliyor; ayrica
   bellekte onbellek ve es zamanli istek siniri (TV'nin agini ve TomTom'un
   kotasini korur: ucretsiz 50.000 doseme/gun). Taban harita 1 gun,
   trafik akisi 4 dk taze kabul ediliyor.
   kat: taban | akis · stil: gunduz | gece · z 9..15, x/y dunya sinirlari. */
var dosOnbellek = {}, dosSira = [], DOS_AZAMI = 200;
var dosKuyruk = [], dosEtkin = 0, DOS_ESZAMAN = 6;

function dosemeAl(adres, geri) {
  dosKuyruk.push([adres, geri]);
  (function surdur() {
    while (dosEtkin < DOS_ESZAMAN && dosKuyruk.length) {
      var is = dosKuyruk.shift();
      dosEtkin++;
      (function (adres2, geri2) {
        var bitti = false;
        function son(h, v, tip) { if (bitti) return; bitti = true; dosEtkin--; geri2(h, v, tip); surdur(); }
        var ist = https.get(adres2, function (c) {
          var parca = [], boy = 0;
          c.on('data', function (p) { parca.push(p); boy += p.length; if (boy > 512 * 1024) ist.abort(); });
          c.on('end', function () {
            if (c.statusCode !== 200) { son('HTTP ' + c.statusCode); return; }
            son(null, Buffer.concat(parca), c.headers['content-type'] || 'image/png');
          });
        });
        ist.setTimeout(10000, function () { ist.abort(); son('zaman asimi'); });
        ist.on('error', function (e) { son(e.message); });
      })(is[0], is[1]);
    }
  })();
}

function haritaDosemesi(u, cevap) {
  var q = {};
  (u.split('?')[1] || '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); });
  var z = parseInt(q.z, 10), x = parseInt(q.x, 10), y = parseInt(q.y, 10), n = Math.pow(2, z);
  var kat = q.kat, gece = q.stil === 'gece';
  if (!TT_ANAHTAR || !(z >= 9 && z <= 15) || !(x >= 0 && x < n) || !(y >= 0 && y < n) ||
      (kat !== 'taban' && kat !== 'akis') || !/^\d+$/.test(q.z + q.x + q.y)) {
    cevap.statusCode = TT_ANAHTAR ? 400 : 404; cevap.end('{"hata":"doseme"}'); return;
  }
  var anahtar = kat + (gece ? 'G' : 'D') + '/' + z + '/' + x + '/' + y;
  var omur = kat === 'taban' ? 24 * 3600000 : 4 * 60000;
  var k = dosOnbellek[anahtar];
  function gonder(v, tip) {
    cevap.setHeader('Content-Type', tip);
    cevap.setHeader('Cache-Control', 'max-age=' + Math.floor(omur / 1000));
    cevap.end(v);
  }
  if (k && Date.now() - k.an < omur) { gonder(k.v, k.tip); return; }
  var adres = kat === 'taban'
    ? 'https://api.tomtom.com/map/1/tile/basic/' + (gece ? 'night' : 'main') + '/' + z + '/' + x + '/' + y +
      '.png?tileSize=256&language=tr-TR&key=' + encodeURIComponent(TT_ANAHTAR)
    : 'https://api.tomtom.com/traffic/map/4/tile/flow/' + (gece ? 'relative0-dark' : 'relative0') + '/' + z + '/' + x + '/' + y +
      '.png?tileSize=256&key=' + encodeURIComponent(TT_ANAHTAR);
  dosemeAl(adres, function (h, v, tip) {
    if (h) {
      if (k) { gonder(k.v, k.tip); return; }        /* bayat ama var: bos kare yerine */
      kayit('doseme alinamadi (' + anahtar + '): ' + h);
      cevap.statusCode = 502; cevap.end('{"hata":"doseme"}'); return;
    }
    if (!dosOnbellek[anahtar]) dosSira.push(anahtar);
    dosOnbellek[anahtar] = { v: v, tip: tip, an: Date.now() };
    while (dosSira.length > DOS_AZAMI) delete dosOnbellek[dosSira.shift()];
    gonder(v, tip);
  });
}

/* --- YUKLU UYGULAMALAR VE SIMGELERI ----------------------------------------
   Uygulama listApps'e erisemiyor (yalnizca 'public' ACL); servis root.
   25 Ekim, bu TV'de olculdu: 107 kayit, 16'si visible; yanit ~110 KB.
   Simge yolu folderPath'e gore goreli (largeIcon / icon). Canli TV ve
   LG ana ekrani visible:false ama acilabiliyor — eleme kararini uygulama
   veriyor, servis yalnizca gercegi aktariyor. */
var uygOnbellek = null, uygAn = 0, uygBekleyen = [];

function uygulamalariGetir(geri) {
  if (uygOnbellek && Date.now() - uygAn < 5 * 60000) { geri(uygOnbellek); return; }
  uygBekleyen.push(geri);
  if (uygBekleyen.length > 1) return;          /* zaten soruluyor */
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', 'luna://com.webos.applicationManager/listApps', '{}'],
    { timeout: 10000, maxBuffer: 4 * 1024 * 1024 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      if (o && o.apps && o.apps.length) {
        uygOnbellek = o.apps.filter(function (a) { return a && typeof a.id === 'string'; })
          .map(function (a) {
            /* En buyuk simge: dock karti 148 px. Arkadasin webOS 7 TV'sinde
               bazi uygulamalarin yalnizca 77-96 px'lik "icon"u var. */
            var ik = a.extraLargeIcon || a.largeIcon || a.mediumLargeIcon || a.icon || a.mediumIcon || '';
            if (ik && ik.charAt(0) !== '/' && a.folderPath) ik = a.folderPath + '/' + ik;
            return { id: a.id, ad: a.title || a.id, gorunur: !!a.visible, ikonYol: ik };
          });
        uygAn = Date.now();
      } else {
        kayit('listApps okunamadi: ' + (hata ? hata.message : 'bos yanit'));
      }
      var l = uygBekleyen; uygBekleyen = [];
      l.forEach(function (f) { f(uygOnbellek); });
    });
}

/* --- SISTEM UCU ---------------------------------------------------------
   Uygulamaya /proc da kapali, applicationManager/running da. Ikisi de root
   olan BU SERVISTE calisiyor, olculdu.

   "Bellegi bosalt" iki is yapiyor:
     1) arka plandaki KULLANICI uygulamalarini kapatir
     2) cekirdek onbellegini birakir (/proc/sys/vm/drop_caches = 3)

   NEYI KAPATMIYORUZ — liste kasitli olarak dar:
     - on plandaki uygulama (kullanicinin izledigi sey)
     - com.webos.* (home, livetv, browser, inputcommon, voice — sistemin
       kendisi; bunlari kapatmak TV'yi tuhaf hallere sokuyor)
     - com.bilal.sade (kendimiz)
     - airplay (sistem tarafi)
   Yani yalnizca netflix/youtube gibi arka planda asili kalmis kullanici
   uygulamalari kapaniyor ve hepsi yeniden acilabilir. drop_caches ise
   cekirdek onbellegi — veri kaybi yok, onbellek kendiliginden dolar. */

function sistemMetni(yol) {
  try { return fs.readFileSync(yol, 'utf8'); } catch (e) { return ''; }
}

function bellekOku() {
  var m = sistemMetni('/proc/meminfo');
  function al(ad) {
    var r = new RegExp('^' + ad + ':\\s+(\\d+)', 'm').exec(m);
    return r ? parseInt(r[1], 10) : null;          /* kB */
  }
  return {
    toplam: al('MemTotal'), kullanilabilir: al('MemAvailable'),
    takasToplam: al('SwapTotal'), takasBos: al('SwapFree')
  };
}

/* CPU yuku — SUREKLI orneklenen, 1 dakikalik ortalama.
   Once istegin icinde 500 ms'lik anlik pencere aliyordum; widget "CPU %85"
   gosterdi, oysa TV bostaydi — o anda Sade yeni acilmisti ve acilis
   sicramasini yakalamisti. Widget 60 saniyede bir okunuyor, yani o yalan
   rakam bir dakika boyunca ekranda kaliyor.
   Simdi servis arka planda 10 saniyede bir ornekliyor, /sistem son 6
   ornegin (≈1 dakika) ortalamasini donuyor. Bakiste anlamli olan bu. */
var cpuSon = null, cpuOrnek = [];

function cpuOku() {
  try {
    var s = fs.readFileSync('/proc/stat', 'utf8');
    var m = /^cpu\s+([\d ]+)/m.exec(s);
    if (!m) return null;
    var a = m[1].trim().split(/\s+/).map(Number);
    var toplam = 0;
    for (var i = 0; i < a.length; i++) toplam += a[i];
    return { toplam: toplam, bos: (a[3] || 0) + (a[4] || 0) };  /* idle + iowait */
  } catch (e) { return null; }
}

function cpuOrnekle() {
  var su = cpuOku();
  if (!su) return;
  if (cpuSon && su.toplam > cpuSon.toplam) {
    var dt = su.toplam - cpuSon.toplam, db = su.bos - cpuSon.bos;
    cpuOrnek.push(Math.max(0, Math.min(100, Math.round((1 - db / dt) * 100))));
    while (cpuOrnek.length > 6) cpuOrnek.shift();
  }
  cpuSon = su;
}

function cpuOrtalama() {
  if (!cpuOrnek.length) return null;
  var t = 0;
  for (var i = 0; i < cpuOrnek.length; i++) t += cpuOrnek[i];
  return Math.round(t / cpuOrnek.length);
}

function cekirdekSayisi() {
  try {
    var s = fs.readFileSync('/proc/cpuinfo', 'utf8');
    return (s.match(/^processor\s*:/gm) || []).length || null;
  } catch (e) { return null; }
}

function calismaOku() {
  var u = sistemMetni('/proc/uptime').split(' ')[0];
  var s = parseFloat(u);
  return isNaN(s) ? null : Math.round(s);
}

function calisanlar(geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.applicationManager/running', '{}'],
    { timeout: 5000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri((o && o.running) || []);
    });
}

function onPlandaki(geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.applicationManager/getForegroundAppInfo', '{}'],
    { timeout: 5000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri((o && o.appId) || null);
    });
}

/* 25 EKIM, Bilal: "elle bosaltiyorsam zaten her seyi kapatmak istiyorumdur".
   Haklı — onceki liste com.webos.* ile baslayan HER SEYI koruyordu, yani
   onyuklenmis tarayici (17 MB) ve sesli arama (29 MB) hic kapanmiyordu.
   Liste artik yalnizca gercekten dokunulmamasi gerekenleri tutuyor:
     on plandaki uygulama  — kullanicinin izledigi sey
     com.bilal.sade        — kendimiz
     com.webos.app.home    — sistemin kabugu, kapatmanin karsiligi yok
     airplay               — Bilal AirPlay kullaniyor; kapatinca telefonun
                             TV'yi bulamama ihtimali var, denenmedi
   Geri kalan her sey (tarayici, sesli arama, canli TV, rehber, netflix...)
   kapaniyor ve hepsi yeniden acilabilir. */
var KAPATMA_DISI = [APP, 'com.webos.app.home'].concat(ayarListesi('kapatmaDisi', ['airplay']));

/* Uygulama kimligini okunabilir ada cevirir. Kullanici "com.webos.app.voice"
   gorunce ne oldugunu anlamiyor — Bilal hakli olarak "nedir onlar" diye
   sordu. Ad appinfo.json'dan geliyor, bir kez okunup onbellege aliniyor. */
var ADLAR = {};
var AD_KOK = ['/usr/palm/applications', '/media/system/apps/usr/palm/applications',
              '/mnt/otncabi/usr/palm/applications', '/media/cryptofs/apps/usr/palm/applications',
              '/media/developer/apps/usr/palm/applications'];

function uygulamaAdi(id) {
  if (ADLAR[id] !== undefined) return ADLAR[id];
  var ad = null;
  for (var i = 0; i < AD_KOK.length && !ad; i++) {
    try {
      var s = fs.readFileSync(AD_KOK[i] + '/' + id + '/appinfo.json', 'utf8');
      var m = /"title"\s*:\s*"([^"]+)"/.exec(s);
      if (m) ad = m[1];
    } catch (e) {}
  }
  ADLAR[id] = ad;
  return ad;
}

function kapatilabilirMi(id, onplan) {
  if (!id) return false;
  if (id === onplan) return false;
  return KAPATMA_DISI.indexOf(id) < 0;
}

/* GERCEKTEN onyuklenmis surecleri bulur. SAM, uygulamayi nasil baslattigini
   komut satirina yaziyor: "reason":"preload" onyukleme, "reason":"undefined"
   kullanicinin acmasi demek.

   Bu ayrimi ILK SURUMDE atlamistim ve temizlik Bilal'in actigi YouTube'u da
   kapatti. "Onyukleme artigi" demek, kullanicinin actigi uygulama demek
   DEGIL — ayni kimlik iki sekilde de ayakta olabilir. */
/* Kullanicinin bu oturumda ON PLANA ALDIGI uygulamalar.
   NEDEN VAR: bir uygulama onyuklenmis olarak baslayip (reason=preload)
   sonra kullanici tarafindan acilabiliyor. Surecin komut satiri bir daha
   degismedigi icin "reason" hala preload gorunuyor. Eger kullanici o
   uygulamadan kisa sureligine cikarsa (ornegin rehbere bakarsa) periyodik
   temizlik onu "onyukleme artigi" sanip kapatabilirdi — izledigi dizinin
   yeri giderdi. Bir kez one cikmis olmak muafiyet sagliyor. */
var KULLANILDI = {};

/* Politikaya RAGMEN geri onyuklenen uygulamalar. Periyodik supurge
   YALNIZCA bunlari hedefliyor; genis bir listeyi 5 dakikada bir taramak
   gereksiz risk. Olculdu: com.webos.app.voice ("Search") kapatildiktan
   ~30 sn sonra yine reason=preload ile ayaga kalkiyor; preloadmanager
   politikasi da system.supportVoiceRecognition=false de durdurmadi. */
var INATCILAR = ayarListesi('surekliKapat', []);   /* bu TV: com.webos.app.voice */

/* appId -> toplam RSS (kB). Bir uygulamanin birden fazla sureci olabiliyor
   (WAM ana surec + renderer), hepsini topluyoruz. RSS paylasilan
   kutuphaneleri her surecte sayar, yani gercek kullanimdan bir miktar
   yuksek cikar — bu yuzden arayuzde "yaklasik" diye sunulmali. */
function pidRss(pid) {
  if (!pid) return 0;
  var n = parseInt(pid, 10);
  if (!n) return 0;
  try {
    var m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync('/proc/' + n + '/status', 'utf8'));
    return m ? parseInt(m[1], 10) : 0;
  } catch (e) { return 0; }
}

function uygulamaBellekleri() {
  var m = {}, d;
  try { d = fs.readdirSync('/proc'); } catch (e) { return m; }
  for (var i = 0; i < d.length; i++) {
    if (!/^[0-9]+$/.test(d[i])) continue;
    var c, s;
    try {
      c = fs.readFileSync('/proc/' + d[i] + '/cmdline', 'utf8');
      s = fs.readFileSync('/proc/' + d[i] + '/status', 'utf8');
    } catch (e) { continue; }
    var a = /"appId":"([^"]+)"/.exec(c);
    if (!a) continue;
    var r = /VmRSS:\s+(\d+)/.exec(s);
    if (!r) continue;
    m[a[1]] = (m[a[1]] || 0) + parseInt(r[1], 10);
  }
  return m;
}

function onyuklenmisIdler() {
  var k = {};
  var d;
  try { d = fs.readdirSync('/proc'); } catch (e) { return k; }
  for (var i = 0; i < d.length; i++) {
    if (!/^[0-9]+$/.test(d[i])) continue;
    var c;
    try { c = fs.readFileSync('/proc/' + d[i] + '/cmdline', 'utf8'); } catch (e) { continue; }
    if (c.indexOf('"reason":"preload"') < 0) continue;
    var m = /"appId":"([^"]+)"/.exec(c);
    if (m) k[m[1]] = true;
  }
  return k;
}

/* Onyuklemesi kapatilmis ama hala bellekte duran uygulamalari kapat.
   On plandaki uygulamaya, KAPATMA_DISI listesine ve KULLANICININ ACTIGI
   uygulamalara DOKUNMAZ. */
function onyuklenmisleriAt(geri, kapsam) {
  var kaps = kapsam || ONYUKLEME_KAPALI;
  var onyuklu = onyuklenmisIdler();
  onPlandaki(function (onplan) {
    calisanlar(function (liste) {
      var hedef = liste.filter(function (u) {
        return kaps.indexOf(u.id) >= 0 &&
               onyuklu[u.id] &&                       /* yalnizca reason=preload */
               !KULLANILDI[u.id] &&                   /* kullanici acmadiysa */
               kapatilabilirMi(u.id, onplan);
      }).map(function (u) { return u.id; });
      var kalan = hedef.length, atilan = [];
      if (!kalan) { if (geri) geri([]); return; }
      hedef.forEach(function (id) {
        uygulamaKapat(id, function (ok) {
          if (ok) atilan.push(id);
          if (--kalan === 0) {
            if (atilan.length) kayit('onyukleme artigi atildi: ' + atilan.join(', '));
            if (geri) geri(atilan);
          }
        });
      });
    });
  });
}

function sistemDurumu(geri) {
  onPlandaki(function (onplan) {
    calisanlar(function (liste) {
      var bellekler = uygulamaBellekleri();
      var onyuklu = onyuklenmisIdler();
      var uyg = liste.map(function (u) {
        /* Bellek icin ONCE running'in verdigi PID'ler. cmdline'dan appId
           okumak bazilarinda bos donuyordu (AirPlay, Live TV, Sade —
           bunlarin surec satirinda appId yok), oysa applicationManager
           processid/webprocessid'yi zaten soyluyor. cmdline taramasi
           yedek olarak duruyor: bazi uygulamalarin ek surecleri var. */
        var kb = pidRss(u.processid) + pidRss(u.webprocessid);
        if (!kb) kb = bellekler[u.id] || 0;
        return { id: u.id, ad: uygulamaAdi(u.id),
                 bellekKB: kb || null,
                 onyuklu: !!onyuklu[u.id],
                 onplanda: u.id === onplan,
                 kapatilabilir: kapatilabilirMi(u.id, onplan) };
      });
      geri({
        calisma: calismaOku(),
        bellek: bellekOku(),
        cpu: cpuOrtalama(),
        cekirdek: cekirdekSayisi(),
        onplan: onplan,
        uygulamalar: uyg,
        kapatilabilirSayi: uyg.filter(function (u) { return u.kapatilabilir; }).length
      });
    });
  });
}

/* close DEGIL closeByAppId. close, CAGIRANIN pid'ine bakiyor ve
   "no app matched by pid" donuyor — id parametresini tamamen yok sayiyor.
   Olculdu: close -> returnValue false, closeByAppId -> true. */
function uygulamaKapat(id, geri) {
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', 'luna://com.webos.applicationManager/closeByAppId',
     JSON.stringify({ id: id })],
    { timeout: 5000 },
    function (hata, cikti) {
      var o = kopruJson(cikti);
      geri(!hata && !!(o && o.returnValue));
    });
}

function bellegiBosalt(geri) {
  var oncesi = bellekOku();
  sistemDurumu(function (d) {
    var hedefler = d.uygulamalar
      .filter(function (u) { return u.kapatilabilir; })
      .map(function (u) { return u.id; });
    var kapanan = [], kalan = hedefler.length;
    function bitir() {
      /* Cekirdek onbellegini birak. Veri kaybi yok; onbellek yeniden dolar. */
      try { fs.writeFileSync('/proc/sys/vm/drop_caches', '3\n'); }
      catch (e) { kayit('drop_caches yazilamadi: ' + e.message); }
      /* 3 sn: cekirdek bellegi HEMEN geri vermiyor. 900 ms ile olctugumde
         3 uygulama kapanmasina ragmen yalnizca +8 MB gorunuyordu; birkac
         saniye sonra gercek rakam +215 MB idi. Erken olcum yalan soyler. */
      setTimeout(function () {
        geri({ oncesi: oncesi, sonrasi: bellekOku(), kapanan: kapanan });
      }, 3000);
    }
    if (!kalan) { bitir(); return; }
    hedefler.forEach(function (id) {
      uygulamaKapat(id, function (ok) {
        if (ok) kapanan.push(id);
        if (--kalan === 0) bitir();
      });
    });
  });
}

/* --- KOPRU ANAHTARI ---------------------------------------------------------
   25 EKIM guvenlik denetimi, bulgu #3: kopru 127.0.0.1'de ama TV'deki HER
   web sayfasi ona istek atabiliyordu (LG tarayicisinda acilan bir sayfa
   film modunu acabilir, uygulama kapatabilirdi). Origin'e bakamiyoruz:
   olculdu, Sade'nin XHR'i Origin basligi HIC gondermiyor.
   Cozum: servis bir kez rastgele anahtar uretip saklar, Sade'nin klasorune
   de yazar. Sade onu file:// ile okur (olculdu: calisiyor); http(s) bir
   sayfa file:// okuyamaz, dolayisiyla anahtari bilemez.
   Kalan risk: TV'de kurulu baska bir web uygulamasi da file:// okuyabiliyor
   olabilir — onlar zaten kurdugumuz/guvendigimiz uygulamalar.
   Uygulama yeniden kurulunca klasoru silinir; 5 sn'de bir dosya var mi diye
   bakip yeniden yaziyoruz (tek stat cagrisi, maliyeti yok). */
var crypto = require('crypto');
var ANAHTAR_DOSYA = '/var/lib/webosbrew/sade/kopru-anahtar';
var UYG_ANAHTAR = '/media/developer/apps/usr/palm/applications/' + APP + '/kopru-anahtar.json';

var kopruAnahtari = (function () {
  try {
    var a = fs.readFileSync(ANAHTAR_DOSYA, 'utf8').trim();
    if (/^[0-9a-f]{32}$/.test(a)) return a;
  } catch (e) {}
  var y = crypto.randomBytes(16).toString('hex');
  try { fs.writeFileSync(ANAHTAR_DOSYA, y, { mode: 384 }); }   /* 0600 */
  catch (e) { kayit('kopru anahtari saklanamadi: ' + e.message); }
  return y;
})();

function anahtariUygulamayaYaz() {
  try {
    if (fs.existsSync(UYG_ANAHTAR)) return;
    if (!fs.existsSync(UYG_ANAHTAR.replace(/\/[^/]+$/, ''))) return;   /* uygulama kurulu degil */
    /* 0644: WAM uid 505 ile calisiyor, okuyabilmeli. */
    fs.writeFileSync(UYG_ANAHTAR + '.yeni', JSON.stringify({ anahtar: kopruAnahtari }), { mode: 420 });
    fs.renameSync(UYG_ANAHTAR + '.yeni', UYG_ANAHTAR);
    kayit('kopru anahtari uygulama klasorune yazildi');
  } catch (e) { kayit('kopru anahtari yazilamadi: ' + e.message); }
}

function anahtarGecerli(u, host) {
  /* DNS rebinding'e karsi Host da 127.0.0.1 olmali. */
  if (host !== '127.0.0.1:' + KOPRU_PORT) return false;
  var m = /[?&]k=([0-9a-f]{32})(?:&|$)/.exec(u);
  if (!m) return false;
  try { return crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(kopruAnahtari)); }
  catch (e) { return false; }
}

function kopruBaslat() {
  var http;
  try { http = require('http'); } catch (e) { kayit('kopru: http yok'); return; }

  var s = http.createServer(function (istek, cevap) {
    var u = String(istek.url || '');
    cevap.setHeader('Content-Type', 'application/json; charset=utf-8');
    /* Access-Control-Allow-Origin YOK: Sade'nin okumasi icin gerekmiyor
       (olculdu, WAM uygulamasi baslik olmadan da yaniti okuyor); olmasi
       yalnizca baska sayfalarin yanit okumasina kapi acardi. */
    /* 25 EKIM — "parlaklik simgesi gidip gidip geliyor":
       Node varsayilan olarak baglantiyi 5 sn acik tutuyor (keepAliveTimeout).
       Uygulama 15-60 sn'de bir soruyor, yani Chromium her seferinde
       sunucunun COKTAN KAPATTIGI bir soketi yeniden kullanmaya calisiyor.
       Bu yaris ara ara istegi dusuruyor; okuma null donunce simge
       gizleniyor, sonraki turda geri geliyor. Yoklamali bir istemcide
       keep-alive'in getirisi yok, bedeli bu yaris. Her cevapta kapatiyoruz. */
    cevap.setHeader('Connection', 'close');

    if (!anahtarGecerli(u, String(istek.headers.host || ''))) {
      cevap.statusCode = 403;
      cevap.end('{"hata":"anahtar"}');
      return;
    }

    if (u.indexOf('/uygulamalar') === 0) {
      uygulamalariGetir(function (l) {
        cevap.end(JSON.stringify(l ? { uygulamalar: l.map(function (a) {
          return { id: a.id, ad: a.ad, gorunur: a.gorunur, ikon: !!a.ikonYol };
        }) } : { hata: 'okunamadi' }));
      });
      return;
    }
    if (u.indexOf('/ikon') === 0) {
      /* Yalnizca listApps'te olan bir kimligin, png/jpg simgesi. Yol
         istekten degil sistemin kendi kaydindan geliyor. */
      var mi = /[?&]id=([A-Za-z0-9._-]{1,128})(?:&|$)/.exec(u);
      uygulamalariGetir(function (l) {
        var a = null;
        for (var i = 0; mi && l && i < l.length; i++) if (l[i].id === mi[1]) { a = l[i]; break; }
        if (!a || !/\.(png|jpe?g)$/i.test(a.ikonYol || '')) {
          cevap.statusCode = 404; cevap.end('{"hata":"ikon yok"}'); return;
        }
        fs.readFile(a.ikonYol, function (h, veri) {
          if (h || veri.length > 1024 * 1024) {
            cevap.statusCode = 404; cevap.end('{"hata":"okunamadi"}'); return;
          }
          cevap.setHeader('Content-Type', /\.png$/i.test(a.ikonYol) ? 'image/png' : 'image/jpeg');
          cevap.setHeader('Cache-Control', 'max-age=86400');
          cevap.end(veri);
        });
      });
      return;
    }

    if (u.indexOf('/piyasa') === 0) {
      piyasaGetir(function (d) { cevap.end(JSON.stringify(d)); });
      return;
    }
    if (u.indexOf('/guzergah') === 0) {
      var cizgili = /[?&]cizgi=1(?:&|$)/.test(u);
      guzergahGetir(function (d) {
        /* Widget cizgi istemiyor (~10 KB tasarruf); harita istiyor. */
        if (!cizgili && d && d.yollar) {
          d = { baslik: d.baslik, guncelleme: d.guncelleme, yollar: d.yollar.map(function (y) {
            /* duraklar kucuk (~1 KB) ve Duraklar widget'i istiyor; cizgi ~10 KB, yalnizca harita */
            var k = {}; for (var a in y) if (a !== 'cizgi') k[a] = y[a]; return k;
          }) };
        }
        cevap.end(JSON.stringify(d));
      });
      return;
    }
    if (u.indexOf('/harita') === 0) { haritaDosemesi(u, cevap); return; }
    if (u.indexOf('/trafik') === 0) {
      trafikGetir(function (d) { cevap.end(JSON.stringify(d)); });
      return;
    }

    if (u.indexOf('/ekran') === 0) {
      es.biriktir(Date.now());
      cevap.end(JSON.stringify(esOzet()));
      return;
    }

    if (u.indexOf('/uyku') === 0) {
      /* Yalnizca listedeki degerler ya da 0 (kapat). Disaridan gelen
         dizgi luna'ya ancak bu beyaz listeden gecerse ulasiyor. */
      var mu = /[?&]dk=([0-9]{1,3})(?:&|$)/.exec(u);
      if (mu) {
        var dk = mu[1];
        if (dk !== '0' && UYKU_DEGERLER.indexOf(dk) < 0) {
          cevap.end(JSON.stringify({ hata: 'gecersiz sure' })); return;
        }
        ayarYaz('time', { sleepTimer: dk === '0' ? 'off' : dk }, function (ok) {
          uykuBitis = (ok && dk !== '0') ? Date.now() + Number(dk) * 60000 : null;
          kayit('uyku zamanlayici: ' + (dk === '0' ? 'kapali' : dk + ' dk') + (ok ? '' : ' (YAZILAMADI)'));
          uykuDurumu(function (d) { d.yazildi = ok; cevap.end(JSON.stringify(d)); });
        });
        return;
      }
      uykuDurumu(function (d) { cevap.end(JSON.stringify(d)); });
      return;
    }

    if (u.indexOf('/film') === 0) {
      var mf = /[?&]acik=([01])(?:&|$)/.exec(u);
      if (mf) {
        filmAyarla(mf[1] === '1', function (d) {
          kayit('film modu: ' + (d.acik ? 'acik' : 'kapali') + ' (' + d.resim + ' / ' + d.ses + ')');
          cevap.end(JSON.stringify(d));
        });
        return;
      }
      filmDurumu(function (d) { cevap.end(JSON.stringify(d)); });
      return;
    }

    if (u.indexOf('/guc') === 0) {
      var mg = /[?&]is=(yeniden|kapat)(?:&|$)/.exec(u);
      if (!mg) { cevap.statusCode = 400; cevap.end('{"hata":"is"}'); return; }
      gucIsi(mg[1], function (d) { cevap.end(JSON.stringify(d)); });
      return;
    }

    if (u.indexOf('/sistem') === 0) {
      /* Tek uygulama kapat. Kimlik deseni dar: yalnizca harf, rakam,
         nokta, tire, alt tire — disaridan gelen dizgi baska bir sey
         olamaz. Ayrica kapatilabilirMi suzgecinden de geciyor, yani
         on plandaki uygulama ya da korunan liste asla kapanmiyor. */
      var mk = /[?&]kapat=([A-Za-z0-9._-]{1,64})(?:&|$)/.exec(u);
      if (mk) {
        var hedefId = mk[1];
        onPlandaki(function (op) {
          if (!kapatilabilirMi(hedefId, op)) {
            cevap.end(JSON.stringify({ kapandi: false, sebep: 'korumali' }));
            return;
          }
          var onceB = bellekOku();
          uygulamaKapat(hedefId, function (ok) {
            setTimeout(function () {
              cevap.end(JSON.stringify({ kapandi: ok, id: hedefId,
                                         oncesi: onceB, sonrasi: bellekOku() }));
            }, 2500);
          });
        });
        return;
      }
      if (/[?&]bosalt=1(?:&|$)/.test(u)) {
        bellegiBosalt(function (s) { cevap.end(JSON.stringify(s)); });
      } else {
        sistemDurumu(function (d) { cevap.end(JSON.stringify(d)); });
      }
      return;
    }

    if (u.indexOf('/parlaklik') !== 0) {
      cevap.statusCode = 404;
      cevap.end('{"hata":"bilinmeyen uc"}');
      return;
    }

    /* --- otomatik parlaklik (picture.energySaving) --- */
    var mo = /[?&]otomatik=([01])(?:&|$)/.exec(u);
    if (mo) {
      /* Disaridan gelen deger 0/1; luna'ya giden dizgi BURADA secilir. */
      var ac = mo[1] === '1';
      kopruAyarYaz({ energySaving: ac ? 'auto' : 'off' }, function (tamam) {
        kopruOnbellek = null; kopruOnbellekAn = 0;
        cevap.end(JSON.stringify({ otomatik: ac, yazildi: tamam }));
      });
      return;
    }

    var m = /[?&]deger=([0-9]{1,3})(?:&|$)/.exec(u);
    if (m) {
      var d = parseInt(m[1], 10);
      if (isNaN(d) || d < 0) d = 0;
      if (d > 100) d = 100;
      kopruAyarYaz({ backlight: String(d) }, function (tamam) {
        kopruOnbellek = null; kopruOnbellekAn = 0;
        cevap.end(JSON.stringify({ deger: d, yazildi: tamam }));
      });
      return;
    }

    /* Kisa onbellek: uygulama paneli acikken ard arda okuyor, her okuma
       bir luna-send sureci demek. Parlaklik birkac saniyede bir degismez. */
    if (kopruOnbellek && (Date.now() - kopruOnbellekAn) < 3000) {
      cevap.end(JSON.stringify(kopruOnbellek));
      return;
    }
    cp.execFile('/usr/bin/luna-send',
      ['-n', '1', '-f', 'luna://com.webos.settingsservice/getSystemSettings',
       JSON.stringify({ category: 'picture', keys: ['backlight', 'energySaving'] })],
      { timeout: 5000 },
      function (hata, cikti) {
        var o = kopruJson(cikti), a = (o && o.settings) || null, d = null;
        if (!a) { cevap.end('{"deger":null}'); return; }
        if (a.backlight !== undefined) {
          d = parseInt(a.backlight, 10);
          if (isNaN(d)) d = null;
        }
        /* enerji: "off" ise parlaklik GERCEKTEN elle ayarlanabiliyor.
           "auto" sensore birakiyor; min/med/max sabit kademe — ikisinde de
           backlight yazmasi ekrana yansimiyor. Ham degeri aynen veriyoruz,
           karari uygulama versin. */
        kopruOnbellek = { deger: d, enerji: a.energySaving || null };
        kopruOnbellekAn = Date.now();
        cevap.end(JSON.stringify(kopruOnbellek));
      });
  });

  s.keepAliveTimeout = 0;          /* yukaridaki yarisi kokten keser */
  anahtariUygulamayaYaz();
  setInterval(anahtariUygulamayaYaz, 5000);
  s.on('error', function (e) { kayit('kopru acilamadi: ' + e.message); });
  try {
    s.listen(KOPRU_PORT, '127.0.0.1', function () {
      kayit('yerel kopru 127.0.0.1:' + KOPRU_PORT);
    });
  } catch (e) { kayit('kopru listen hatasi: ' + e.message); }
}

/* --- disableHome: LG'nin kendi HOME filtresini devre disi birak ---
   25 EKIM, LG'nin KENDI kodundan dogrulandi:
     /usr/lib/qt5/qml/KeyFilters/systemUi.js
       function launchHomeApp(key) {
         if (... || settingsService.disableHome || ...) { ...; return; }
         applicationManager.launch("com.webos.app.home", ...);
       }
     .../WebOSCompositor/controllers/StarfishViewStateController.qml
       property bool disableHome: Settings.subscribe("com.webos.service.config",
         "getConfigs", {"configNames":["com.webos.surfacemanager.disableHome"]})

   true iken LG kendi ana ekranini HIC acmiyor, tus tamamen bize kaliyor.
   Onceki yontem LG ile YARISIYORDU; kim kazanacagi zamanlamaya bagliydi ve
   Sade zaten ondeyken kazanan olmuyordu. Artik yaris yok.

   Ayni dosyada HOME_APP_ID = "com.webos.app.home" SABIT KODLU — bu yuzden
   defaultApps.home denemesi bu firmware'de hicbir sey yapmadi.

   KALICI DEGIL: /var/preferences/configd_db.json'da yok, yalnizca bellekte.
   Reboot sonrasi kendiliginden false oluyor, yani HOME asla kalici olarak
   olu kalmiyor. Emniyet kemeri: cikista false yaziyoruz, ayrica
   home-bekci.sh servis olurse false'a cekiyor. */
var DH_URI = 'luna://com.webos.service.config/setConfigs';

var dhSon = null;            /* en son ISTENEN deger */
var dhMesgul = false;        /* yazma ucusta mi */
var dhBekleyen = null;       /* ucus sirasinda gelen son istek */

/* 25 EKIM, SOGUK ACILIS OLAYI:
   disableHome'u servis acilir acilmaz true yapiyordum. Ama "servis ayakta"
   ile "servis tusu gorebiliyor" ayni sey degil: soguk acilista Magic
   Remote'un /dev/input dugumu henuz yoktu, servis sagirdi. LG de devre disi
   oldugu icin HOME TUSU TAMAMEN OLDU. Bekci yalnizca OLU servisi yakaliyor,
   SAGIR servisi yakalamiyor.

   Dogrusu: disableHome yalnizca Sade ON PLANDAYKEN acik olsun.
     Sade onde degil -> false -> HOME'u LG acar, bizim tepkimiz Sade'yi getirir
     Sade onde       -> true  -> HOME hicbir sey yapmaz (istenen davranis)
   Boylece servis sagir olsa bile en kotu ihtimalle LG'nin ekrani gelir.

   AYRICA: yazmalar SIRAYA alinmak zorunda. Acilistaki false ile on plandan
   gelen true ayni anda luna-send dogurunca node cokuyordu:
     uv_close: Assertion `!uv__is_closing(handle)' failed
   Bu surumde eszamanli cocuk surec guvenli degil; tek seferde bir yazma. */
function dhAyarla(istenen, sebep) {
  if (istenen === dhSon) return;
  dhSon = istenen;
  if (dhMesgul) { dhBekleyen = { d: istenen, s: sebep }; return; }
  dhYaz(istenen, sebep);
}

/* 25 EKIM: yazma basarisiz olunca dhSon sifirlaniyordu ("tekrar
   denenebilsin") ama TEKRARI TETIKLEYEN HICBIR SEY YOKTU. Yani
   setConfigs bir kez duserse, bir sonraki on plan degisimine kadar
   disableHome yanlis kalyordu — Sade ondeyken HOME tusu LG'nin ana
   ekranini aciyordu. Logda gercekten yasandi:
     13:55:28  disableHome=true YAZILAMADI (on plan com.bilal.sade)
   Elle tekrar denedim, ayni komut returnValue:true dondu; yani gecici
   bir dusme. Artik kendiliginden tekrar deniyor. */
var dhTekrar = null;

function dhYaz(deger, sebep, deneme) {
  dhMesgul = true;
  cp.execFile('/usr/bin/luna-send',
    ['-n', '1', '-f', DH_URI,
     JSON.stringify({ configs: { 'com.webos.surfacemanager.disableHome': deger } })],
    { timeout: 5000 },
    function (hata) {
      dhMesgul = false;
      if (hata) {
        if (dhSon === deger) dhSon = null;      /* tekrar denenebilsin */
        var d = (deneme || 0) + 1;
        kayit('disableHome=' + deger + ' YAZILAMADI (' + sebep + ', deneme ' + d +
              '): ' + hata.message);
        if (d < 4) {
          if (dhTekrar) clearTimeout(dhTekrar);
          /* 2, 4, 8 sn — gecici bir dusmeyi atlatmaya yeter, inatci bir
             arizada da sonsuz donguye girmez. */
          dhTekrar = setTimeout(function () {
            dhTekrar = null;
            /* Bu arada YENI bir deger istendiyse eskisini geri yazma.
               dhSon yalnizca basarisiz yazmada null'a dusuyor; doluysa
               daha guncel bir istek var demektir. */
            if (dhSon === null) dhAyarla(deger, sebep + ' (tekrar ' + d + ')');
          }, 2000 * Math.pow(2, d - 1));
        }
      } else {
        if (dhTekrar) { clearTimeout(dhTekrar); dhTekrar = null; }
        kayit('disableHome=' + deger + ' (' + sebep + ')');
      }
      if (dhBekleyen) {
        var b = dhBekleyen; dhBekleyen = null;
        if (b.d !== deger) dhYaz(b.d, b.s);
      }
    });
}

/* Yalnizca cikis kancasi icin: surec kapanmadan once yazmanin bitmesi sart. */
function disableHomeYaz(deger, sebep) {
  try {
    cp.execFileSync('/usr/bin/luna-send',
      ['-n', '1', '-f', DH_URI,
       JSON.stringify({ configs: { 'com.webos.surfacemanager.disableHome': deger } })],
      { timeout: 5000 });
    kayit('disableHome=' + deger + ' (' + sebep + ')');
  } catch (e) {
    kayit('disableHome=' + deger + ' YAZILAMADI (' + sebep + '): ' + e.message);
  }
}

/* --- homeconnect (ThinQ) kendi kendine iyilestirme ---
   24 Ekim: IP degisince servis bulut oturumunu kaybetti, uygulamaya BOS
   cihaz listesi dondurmeye basladi, klima widget'i silindi. Normalde
   reboot cozerdi ama Quick Start+ ile TV gunlerce yeniden baslamiyor.
   Karar mantigi homeconnect-sagligi.js'te, 33 birim testi var. */
var HC_BEKLEME = 3600000;       /* en sik saatte bir mudahale */
var hcSonIyilestirme = 0;

function hcPid() {
  var liste;
  try { liste = fs.readdirSync('/proc'); } catch (e) { return null; }
  for (var i = 0; i < liste.length; i++) {
    if (!/^[0-9]+$/.test(liste[i])) continue;
    try {
      if (fs.readFileSync('/proc/' + liste[i] + '/cmdline', 'utf8')
            .indexOf('com.webos.service.homeconnect') !== -1) return liste[i];
    } catch (e) { /* surec kayboldu */ }
  }
  return null;
}

function hcSoketleri(pid) {
  var k = {};
  try {
    fs.readdirSync('/proc/' + pid + '/fd').forEach(function (f) {
      try {
        var m = /^socket:\[([0-9]+)\]$/.exec(fs.readlinkSync('/proc/' + pid + '/fd/' + f));
        if (m) k[m[1]] = 1;
      } catch (e) {}
    });
  } catch (e) {}
  return k;
}

function hcNetTablosu() {
  var s = '';
  ['/proc/net/tcp', '/proc/net/tcp6'].forEach(function (y) {
    try { s += fs.readFileSync(y, 'utf8') + '\n'; } catch (e) {}
  });
  return s;
}

function hcKontrol(sebep) {
  var pid = hcPid();
  if (!pid) { kayit('hc: surec yok (' + sebep + ')'); return; }
  var wan = HCS.wanBaglantisiVar(hcNetTablosu(), hcSoketleri(pid));
  var k = HCS.iyilestirmeKarari({ wanVar: wan, simdi: Date.now(),
                                  sonIyilestirme: hcSonIyilestirme,
                                  bekleme: HC_BEKLEME });
  if (!k.yap) { kayit('hc (' + sebep + '): ' + k.sebep); return; }
  hcSonIyilestirme = Date.now();
  kayit('hc (' + sebep + '): ' + k.sebep + ' -> pid ' + pid + ' yeniden baslatiliyor');
  try { process.kill(Number(pid), 'SIGTERM'); }   /* ls-hubd dinamik servisi geri dogurur */
  catch (e) { kayit('hc: kill basarisiz — ' + e.message); }
}

if (ARG.indexOf('--watch') !== -1) setInterval(function () { hcKontrol('periyodik'); }, 15 * 60000);

/* --- beklemeden uyanma: init.d yalnizca SOGUK boot'ta calisiyor ---
   Duvar saatinde buyuk sicrama = TV uyandi -> uygulamayi one al. */
var sonTik = Date.now();
setInterval(function () {
  var simdi = Date.now();
  var fark = simdi - sonTik;
  sonTik = simdi;
  if (fark > 60000) {
    kayit('UYANMA algilandi (~' + Math.round(fark / 1000) + ' sn) -> one aliniyor');
    var kere = 0;
    var t = setInterval(function () {
      uygulamayiAc('uyanma');
      if (++kere >= 3) clearInterval(t);
    }, 2500);
    /* Ag degisimi en cok uyanmada oluyor; servislerin oturmasi icin bekle. */
    setTimeout(function () { hcKontrol('uyanma'); }, 90000);
  }
}, 1000);

if (ARG.indexOf('--watch') !== -1) {
  kopruBaslat();
  quickStartGeriAc();
  onPlaniIzle();
  /* Acilista HER ZAMAN false: on plan aboneligi ilk degeri getirene kadar
     HOME'u LG tasisin. Sade zaten ondeyse abonelik hemen true'ya cevirir. */
  dhAyarla(false, 'baslangic');

  /* Onyukleme politikasi. 25 sn gecikme: soguk acilista preloadmanager
     bizden sonra ayaga kalkabiliyor, erken yazarsak kendi varsayilanini
     uzerine yaziyor. 30 dakikada bir tekrar: politika bellekte duruyor
     ama servis yeniden baslarsa diye ucuz bir emniyet kemeri. */
  gucIzle();
  setInterval(function () { es.biriktir(Date.now()); }, 30000);
  setInterval(esKaydet, 5 * 60000);

  cpuOrnekle();                                  /* ilk referans */
  setInterval(cpuOrnekle, 10000);                /* 10 sn'de bir ornek */

  setTimeout(function () { onyuklemeUygula(); }, 25000);
  setInterval(function () { onyuklemeUygula(); }, 30 * 60000);

  /* INATCILAR: bazi uygulamalar politikaya ragmen geri onyukleniyor.
     Olculdu — com.webos.app.voice ("Search", LG'nin arama katmani)
     kapatildiktan ~30 sn sonra yine "reason":"preload" ile ayaga
     kalkiyor. preloadmanager politikasi da, system.supportVoiceRecognition
     de durdurmadi (ikisi de gecici ayar; servisler degeri acilista okuyup
     sakliyor olmali).

     Cozum kaba ama durust: 5 dakikada bir, ONYUKLEME_KAPALI listesindeki
     ve GERCEKTEN onyuklenmis (reason=preload) olanlari kapat. Kullanicinin
     KENDI actigi ornek hicbir zaman kapanmaz — onun reason'i preload
     degildir — ve on plandaki uygulamaya da dokunulmaz. Yani mikrofona
     basip aramayi acarsan elinden alinmiyor. */
  setInterval(function () { onyuklenmisleriAt(null, INATCILAR); }, 5 * 60000);
}

/* boot zamanlamasi olcumu — servisin kac. saniyede basladigi */
try {
  fs.writeFileSync('/tmp/t-servis',
    fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
} catch (e) {}

kayit('servis basladi, argumanlar: ' + ARG.join(' '));
