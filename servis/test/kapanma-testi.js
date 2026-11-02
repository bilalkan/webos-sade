/* kapanma.js birim testleri — TV gerekmez: node test/kapanma-testi.js */
'use strict';
var kapanmaBul = require('../kapanma.js');

var gecti = 0, kaldi = 0;
function ol(ad, beklenen, gelen) {
  var a = JSON.stringify(beklenen), b = JSON.stringify(gelen);
  if (a === b) { gecti++; console.log('  OK   ' + ad); }
  else { kaldi++; console.log('  KALDI ' + ad + ' — beklenen ' + a + ', gelen ' + b); }
}
function olay(kat, koord, olaylar, bitis) {
  return { geometry: { type: 'LineString', coordinates: koord.map(function (p) { return [p[1], p[0]]; }) },
           properties: { iconCategory: kat, endTime: bitis || null,
                         events: (olaylar || ['Kapalı']).map(function (d) { return { description: d }; }) } };
}

console.log('kapanma');
/* 15 Temmuz Anadolu girisi, bati yonu serit (OSM 44173957): kuzeybatiya */
var SON = [41.03828, 29.042], ONCE = [41.03661, 29.04343];
var ROTA = { son: SON, yon: kapanmaBul.yon(ONCE, SON), kopru: [41.0456, 29.0342] };
var BATI = [[41.0366, 29.0434], [41.0393, 29.041]];          /* bizim serit, ayni yon */
var DOGU = [[41.0393, 29.0412], [41.0366, 29.0436]];         /* karsi serit, ~20 m, ters yon */

ol('olay yok', null, kapanmaBul([], ROTA));
ol('ayni yonde kapali', { neden: null, bitis: null }, kapanmaBul([olay(8, BATI)], ROTA));
ol('maraton nedeni ve bitis', { neden: 'Maraton', bitis: '2026-11-01T12:30:00Z' },
   kapanmaBul([olay(8, BATI, ['Kapalı', 'Maraton'], '2026-11-01T12:30:00Z')], ROTA));
ol('karsi yon kapali -> acik', null, kapanmaBul([olay(8, DOGU)], ROTA));
ol('kapanma degil (kuyruk, kat 6)', null, kapanmaBul([olay(6, BATI, ['Trafik durağan'])], ROTA));
ol('uzakta kapali (300 m)', null, kapanmaBul([olay(8, [[41.0410, 29.0460], [41.0440, 29.0430]])], ROTA));
ol('koprunun ustunde kapali', { neden: null, bitis: null },
   kapanmaBul([olay(8, [[41.0400, 29.0402], [41.0510, 29.0287]], ['Köprü kapalı'])], ROTA));
ol('kopru tanimsiz, yalniz bitis bakilir', null,
   kapanmaBul([olay(8, [[41.0430, 29.0380], [41.0480, 29.0310]])], { son: SON, yon: ROTA.yon }));
ol('bozuk olay atlanir', null, kapanmaBul([null, {}, { properties: { iconCategory: 8 } }], ROTA));

console.log(gecti + ' gecti, ' + kaldi + ' kaldi');
process.exit(kaldi ? 1 : 0);
