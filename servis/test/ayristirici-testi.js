/* Ayristiriciyi akşamki hata senaryosuyla sinar. */
var Ayristirici = require('../onplan-ayristirici.js');
var hata = 0;
function esit(ad, gercek, beklenen) {
  var ok = JSON.stringify(gercek) === JSON.stringify(beklenen);
  if (!ok) hata++;
  console.log((ok ? '  OK   ' : '  HATA ') + ad +
    (ok ? '' : '\n         beklenen: ' + JSON.stringify(beklenen) +
               '\n         gercek  : ' + JSON.stringify(gercek)));
}

/* 1) Tek nesne */
var a = new Ayristirici();
esit('tek nesne', a.ekle('{"appId":"x"}').map(function(o){return o.appId;}), ['x']);

/* 2) AKSAMKI HATA: ayni veri tekrar taranmamali */
a = new Ayristirici();
a.ekle('{"appId":"a"}');
esit('eski olay TEKRAR islenmemeli', a.ekle('{"appId":"b"}').map(function(o){return o.appId;}), ['b']);

/* 3) Parcali gelen nesne (TCP parcalanmasi) */
a = new Ayristirici();
esit('yarim nesne -> bos', a.ekle('{"appId":"'), []);
esit('tamamlaninca -> tek', a.ekle('c"}').map(function(o){return o.appId;}), ['c']);

/* 4) Tek parcada birden cok nesne */
a = new Ayristirici();
esit('coklu nesne', a.ekle('{"appId":"p"}\n{"appId":"q"}').map(function(o){return o.appId;}), ['p','q']);

/* 5) Ic ice suslu parantez ve dizgedeki suslu */
a = new Ayristirici();
esit('ic ice + dizgede susluparantez',
  a.ekle('{"appId":"r","x":{"y":1},"z":"{sahte}"}').map(function(o){return o.appId;}), ['r']);

/* 6) Gercekci luna-send ciktisi, parcali */
a = new Ayristirici();
var ham = '{\n    "appId": "com.bilal.sade",\n    "subscribed": true,\n    "returnValue": true\n}\n' +
          '{\n    "appId": "com.webos.app.home",\n    "returnValue": true\n}\n';
var toplam = [];
for (var i = 0; i < ham.length; i += 7) toplam = toplam.concat(a.ekle(ham.slice(i, i+7)));
esit('gercekci parcali akis', toplam.map(function(o){return o.appId;}),
     ['com.bilal.sade','com.webos.app.home']);

/* 7) 500 nesne arka arkaya -> tam 500, tekrar yok */
a = new Ayristirici();
var say = 0;
for (var k = 0; k < 500; k++) say += a.ekle('{"appId":"n' + k + '"}').length;
esit('500 nesne, tekrar yok', say, 500);

console.log(hata === 0 ? '\nSONUC: TUM TESTLER GECTI' : '\nSONUC: ' + hata + ' TEST BASARISIZ');
process.exit(hata ? 1 : 0);
