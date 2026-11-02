/* ===========================================================================
   luna-send -i ciktisini ayristirir.

   AKSAMKI HATA: tampona ekleyip her seferinde TAMPONUN TAMAMINI bastan
   tariyordum. Eski appId degerleri tekrar tekrar eslesip her biri yeni bir
   komut tetikliyordu -> kendi kendini besleyen dongu.

   DOGRUSU: tam JSON nesnelerini tamponDAN SOKUP CIKAR (tuket), kalanı birak.
   Boylece bir olay bir kez islenir.
   =========================================================================== */
'use strict';

function Ayristirici() {
  this.tampon = '';
}

/* Gelen parcayi ekler, TAMAMLANMIS nesneleri dondurur ve tampondan siler. */
Ayristirici.prototype.ekle = function (parca) {
  this.tampon += parca;
  var cikti = [];
  var i = 0;
  while (true) {
    var bas = this.tampon.indexOf('{', i);
    if (bas < 0) break;
    var derinlik = 0, son = -1, dizgede = false, kacis = false;
    for (var j = bas; j < this.tampon.length; j++) {
      var c = this.tampon[j];
      if (kacis) { kacis = false; continue; }
      if (c === '\\') { kacis = true; continue; }
      if (c === '"') { dizgede = !dizgede; continue; }
      if (dizgede) continue;
      if (c === '{') derinlik++;
      else if (c === '}') { derinlik--; if (derinlik === 0) { son = j; break; } }
    }
    if (son < 0) break;                     /* nesne henuz tamamlanmadi */
    var ham = this.tampon.slice(bas, son + 1);
    try { cikti.push(JSON.parse(ham)); } catch (e) { /* bozuksa at */ }
    i = son + 1;
  }
  /* TUKET: islenen kismi at. Hatanin can alici noktasi burasi. */
  if (i > 0) this.tampon = this.tampon.slice(i);
  /* kontrolsuz buyumeye karsi */
  if (this.tampon.length > 8192) this.tampon = this.tampon.slice(-2048);
  return cikti;
};

module.exports = Ayristirici;
