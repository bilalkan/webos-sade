/* ===========================================================================
   "Bu rotanin gectigi kopru/tunel kapali mi?" — saf karar (test edilebilir).

   1 KASIM, Istanbul Maratonu: 15 Temmuz iki yonde kapaliydi ama widget
   "15 Temmuz 41 dk" gosteriyordu. TomTom hedef kapali yolun ustunde olsa
   da oraya ara sokaklardan bir rota ciziyor — rota sonucu kapanmayi
   SOYLEMIYOR. Kapanma ayri bir kaynakta: Traffic Incidents API,
   iconCategory 8 ("Kapali", "Kopru kapali", "Maraton" olaylari).

   Eslestirme: kapanma cizgisinin bir parcasi, rotanin bitis noktasina
   (koprunun Anadolu girisi) ya da kopru noktasina ESIK metreden yakin
   VE ayni yonde (aci farki < ACI) olmali. Yon sart: gidis ve donus
   seritleri 13-35 m arayla duruyor; karsi yondeki kapanma (Avrupa ->
   Anadolu) bizim rotayi kapatmiyor.
   =========================================================================== */
'use strict';

var ESIK = 60, ACI = 70;

/* [enlem, boylam] -> yerel duzlem (m), Istanbul enleminde yeterli */
function xy(p, o) {
  return [(p[1] - o[1]) * 111320 * Math.cos(o[0] * Math.PI / 180), (p[0] - o[0]) * 110540];
}
function yon(a, b) {     /* kuzeyden saat yonunde derece */
  var v = xy(b, a);
  return (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360;
}
function aciFarki(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
function parcaMesafe(p, a, b) {
  var A = xy(a, p), B = xy(b, p), dx = B[0] - A[0], dy = B[1] - A[1];
  var t = (dx || dy) ? -(A[0] * dx + A[1] * dy) / (dx * dx + dy * dy) : 0;
  t = Math.max(0, Math.min(1, t));
  var x = A[0] + t * dx, y = A[1] + t * dy;
  return Math.sqrt(x * x + y * y);
}

/* olaylar: Incidents API "incidents" dizisi (koordinatlar [boylam, enlem]).
   rota: { son: [en, boy], yon: derece, kopru: [en, boy] | undefined }
   Donus: null ya da { neden: 'Maraton', bitis: ISO | null } */
function kapanmaBul(olaylar, rota) {
  var noktalar = [rota.son].concat(rota.kopru ? [rota.kopru] : []);
  for (var i = 0; i < (olaylar || []).length; i++) {
    var o = olaylar[i], pr = o && o.properties, g = o && o.geometry;
    if (!pr || pr.iconCategory !== 8 || !g || !g.coordinates) continue;
    var c = g.type === 'Point' ? [g.coordinates, g.coordinates] : g.coordinates;
    for (var k = 0; k + 1 < c.length; k++) {
      var a = [c[k][1], c[k][0]], b = [c[k + 1][1], c[k + 1][0]];
      var tutar = noktalar.some(function (n) { return parcaMesafe(n, a, b) <= ESIK; });
      if (!tutar) continue;
      if (g.type !== 'Point' && aciFarki(yon(a, b), rota.yon) > ACI) continue;
      var nd = (pr.events || []).map(function (e) { return e && e.description; })
        .filter(function (d) { return d && !/^(Kapal[ıi]|K[öo]pr[üu] kapal[ıi]|T[üu]nel kapal[ıi])$/i.test(d); });
      return { neden: nd[0] || null, bitis: pr.endTime || null };
    }
  }
  return null;
}

kapanmaBul.yon = yon;
module.exports = kapanmaBul;
