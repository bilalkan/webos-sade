/* acilma-karari.js birim testleri — TV gerekmez: node test/acilma-testi.js */
'use strict';
var acilmaliMi = require('../acilma-karari.js');
var APP = 'com.bilal.sade';
var LG  = 'com.webos.app.home';

var gecti = 0, kaldi = 0;
function ol(ad, beklenen, durum) {
  var c = acilmaliMi(durum);
  if (c === beklenen) { gecti++; console.log('  OK   ' + ad); }
  else { kaldi++; console.log('  KALDI ' + ad + ' — beklenen ' + beklenen + ', gelen ' + c); }
}

console.log('acilma-karari');

/* --- asil hata: zaten onde --- */
ol('Sade zaten onde -> ACMA',
   false, { izleyiciCanli: true, onPlan: APP, uygulama: APP });

/* --- normal calisma yollari --- */
ol('LG ana ekrani onde -> AC',
   true, { izleyiciCanli: true, onPlan: LG, uygulama: APP });
ol('baska uygulama onde -> AC',
   true, { izleyiciCanli: true, onPlan: 'netflix', uygulama: APP });
ol('on plan bos -> AC',
   true, { izleyiciCanli: true, onPlan: '', uygulama: APP });

/* --- izleyici dustugunde eski davranisa don ---
   HOME'un hic calismamasindansa fazladan bir launch yeg. */
ol('izleyici dustu, son bilinen Sade -> yine de AC',
   true, { izleyiciCanli: false, onPlan: APP, uygulama: APP });
ol('izleyici dustu, on plan bilinmiyor -> AC',
   true, { izleyiciCanli: false, onPlan: null, uygulama: APP });

/* --- bozuk girdi hicbir zaman HOME'u kilitlemesin --- */
ol('on plan null, izleyici canli -> AC',
   true, { izleyiciCanli: true, onPlan: null, uygulama: APP });
ol('durum nesnesi yok -> AC',
   true, undefined);
ol('uygulama adi bos -> AC',
   true, { izleyiciCanli: true, onPlan: APP, uygulama: '' });

/* --- uyanma senaryosu: 3 ardisik cagri, Sade onde --- */
(function () {
  var durum = { izleyiciCanli: true, onPlan: APP, uygulama: APP };
  var acilan = 0;
  for (var i = 0; i < 3; i++) if (acilmaliMi(durum)) acilan++;
  if (acilan === 0) { gecti++; console.log('  OK   uyanmada 3 cagri, hicbiri acmiyor'); }
  else { kaldi++; console.log('  KALDI uyanmada ' + acilan + ' launch sizdi'); }
})();

/* --- uyanmada Sade onde DEGILSE calismaya devam etmeli --- */
(function () {
  var durum = { izleyiciCanli: true, onPlan: 'com.webos.app.livetv', uygulama: APP };
  var acilan = 0;
  for (var i = 0; i < 3; i++) if (acilmaliMi(durum)) acilan++;
  if (acilan === 3) { gecti++; console.log('  OK   uyanmada canli tv onde, 3 cagri da aciyor'); }
  else { kaldi++; console.log('  KALDI uyanmada yalnizca ' + acilan + ' acti'); }
})();

console.log('\nSONUC: ' + (kaldi ? kaldi + ' TEST KALDI' : 'TUM TESTLER GECTI') +
            ' (' + gecti + ' gecti)');
process.exit(kaldi ? 1 : 0);
