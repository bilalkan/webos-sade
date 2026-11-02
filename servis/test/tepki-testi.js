var Tepki = require('../tepki-mantigi.js');
var hata = 0;
function esit(ad, g, b) {
  var ok = JSON.stringify(g) === JSON.stringify(b);
  if (!ok) hata++;
  console.log((ok ? '  OK   ' : '  HATA ') + ad + (ok ? '' : '  (beklenen ' + JSON.stringify(b) + ', gercek ' + JSON.stringify(g) + ')'));
}
var LG = 'com.webos.app.home', BIZ = 'com.bilal.sade';

/* 1) Normal akis */
var t = new Tepki(); var z = 1000;
t.homeBasildi(z);
esit('pencere icinde LG -> ac', t.onPlan(LG, z + 200), 'ac');

/* 2) ISRAR SINIRLI: LG geri gelirse 3 kez denenir, sonra DURUR.
      Sinirsiz olsaydi aksamki dongu olurdu. */
t = new Tepki(); z = 1000;
t.homeBasildi(z);
var israr = [];
for (var q = 0; q < 6; q++) israr.push(t.onPlan(LG, z + 100 + q*400));
esit('basis basina en fazla 3 israr', israr, ['ac','ac','ac',null,null,null]);

/* 3) Bizim uygulamamiz one gelince tepki yok */
t = new Tepki(); t.homeBasildi(1000);
esit('kendi uygulamamiz -> yok', t.onPlan(BIZ, 1100), null);

/* 4) Pencere disinda LG acilirsa dokunma */
t = new Tepki(); t.homeBasildi(1000);
esit('pencere disi -> yok', t.onPlan(LG, 1000 + 5000), null);

/* 5) NORMAL KULLANIM: saniyede bir basis sigortaya TAKILMAMALI
      (onceki ayar burada patliyordu — kullanici 3 kez bastiginda kesiliyordu) */
t = new Tepki(); z = 1000;
var r1 = [];
for (var i = 0; i < 6; i++) { t.homeBasildi(z + i*1000); r1.push(t.onPlan(LG, z + i*1000 + 200)); }
esit('saniyede bir basis serbest', r1, ['ac','ac','ac','ac','ac','ac']);

/* 6) GERCEK DONGU: ayni milisaniyede yuzlerce -> kesilmeli */
t = new Tepki(); z = 1000;
var r2 = [], kesildi = false;
for (var d = 0; d < 30; d++) {
  t.homeBasildi(z);                    /* dongu: surekli yeniden tetikleniyor */
  var k2 = t.onPlan(LG, z);            /* ayni milisaniye */
  if (k2 === 'sigorta') kesildi = true;
  r2.push(k2);
}
esit('ayni ms dongusu kesiliyor', kesildi, true);
esit('kesildikten sonra sessiz', r2.slice(-5), [null,null,null,null,null]);

/* 7) Sigorta suresi dolunca normale doner */
t = new Tepki(); z = 1000;
for (var j = 0; j < 20; j++) { t.homeBasildi(z); t.onPlan(LG, z); }
t.homeBasildi(z + 40000);
esit('sigorta sonrasi normale doner', t.onPlan(LG, z + 40200), 'ac');


/* --- 25 EKIM: bekleyen pencerenin iptali ---
   Gercek log: 1. basis pencereyi acti, 2. basiste "zaten onde" dedik ama
   ESKI pencere acik kaldi ve LG ekrani gelince atesledi. */
(function () {
  var t = new Tepki();
  var T0 = 1000;
  t.homeBasildi(T0);                       /* 1. basis: pencere acik, 3 hak */
  var once = t.onPlan('com.webos.app.home', T0 + 500);
  if (once !== 'ac') { console.log('  KALDI iptal-oncesi: pencere acikken tepki vermeliydi'); hata++; }
  else console.log('  OK   iptal oncesi: acik pencere tepki veriyor');

  t.iptal();                               /* "zaten onde" -> kapat */
  var sonra = t.onPlan('com.webos.app.home', T0 + 900);
  if (sonra !== null) { console.log('  KALDI iptal sonrasi tepki verdi: ' + sonra); hata++; }
  else console.log('  OK   iptal sonrasi: LG ekrani gelse de tepki YOK');

  /* iptal kalici olmamali: yeni basis yine calismali */
  t.homeBasildi(T0 + 2000);
  var yeni = t.onPlan('com.webos.app.home', T0 + 2100);
  if (yeni !== 'ac') { console.log('  KALDI iptal sonrasi yeni basis calismadi'); hata++; }
  else console.log('  OK   iptal sonrasi yeni basis normal calisiyor');
})();

/* --- 4 KASIM: uygulama kapaninca LG'nin kendiliginden gelmesi ---
   Gercek log (UTC): 13:10:13.6 on plan -> (bos)
                     13:10:14.7 on plan -> com.webos.app.home  (last_input)
   HOME basilmadi; ekran LG'de kaldi. */
(function () {
  var t = new Tepki(), z = 100000;
  t.onPlan('airplay', z); t.onPlan('', z + 9000);
  esit('bosalma -> 1.1 sn sonra LG -> ac', t.onPlan(LG, z + 10100), 'ac');
  esit('LG 340 ms sonra yeniden dayatir -> israr', t.onPlan(LG, z + 10440), 'ac');

  t = new Tepki();
  t.onPlan(BIZ, z); 
  esit('Sade -> LG Ana Ekran (bilerek) -> dokunma', t.onPlan(LG, z + 500), null);

  t = new Tepki();
  t.onPlan('', z);
  esit('bosalmadan 5 sn sonra LG -> dokunma', t.onPlan(LG, z + 5000), null);

  t = new Tepki();
  t.onPlan('', z); t.onPlan('youtube.leanback.v4', z + 300);
  esit('bos -> baska uygulama -> LG -> dokunma', t.onPlan(LG, z + 800), null);

  t = new Tepki();
  t.onPlan('', z); t.onPlan(LG, z + 1000);
  t.onPlan(BIZ, z + 1500);
  esit('tepki verdikten sonra pencere disi LG -> dokunma', t.onPlan(LG, z + 9000), null);

  /* Sade kendisi coker de tekrar tekrar kapanirsa: dakikada en fazla 3 */
  t = new Tepki(); var r = [];
  for (var k = 0; k < 5; k++) {
    var b = z + k * 8000;
    t.onPlan(BIZ, b); t.onPlan('', b + 2000); r.push(t.onPlan(LG, b + 3000));
  }
  esit('coken Sade: dakikada en fazla 3 kez geri acilir', r, ['ac','ac','ac',null,null]);
  var b2 = z + 5 * 8000 + 60000;
  t.onPlan('', b2); 
  esit('bir dakika sonra yeniden hak var', t.onPlan(LG, b2 + 1000), 'ac');
})();

console.log(hata === 0 ? '\nSONUC: TUM TESTLER GECTI' : '\nSONUC: ' + hata + ' BASARISIZ');
process.exit(hata ? 1 : 0);
