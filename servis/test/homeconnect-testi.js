/* homeconnect-sagligi.js birim testleri — TV gerekmez.
   Ornek veriler 24 Ekim'de TV'den GERCEKTEN okundu. */
'use strict';
var H = require('../homeconnect-sagligi.js');

var gecti = 0, kaldi = 0;
function ol(ad, beklenen, gelen) {
  var a = JSON.stringify(beklenen), b = JSON.stringify(gelen);
  if (a === b) { gecti++; console.log('  OK   ' + ad); }
  else { kaldi++; console.log('  KALDI ' + ad + ' — beklenen ' + a + ', gelen ' + b); }
}

console.log('ipCoz — kucuk-endian hex cozumleme');
ol('0100007F -> 127.0.0.1', '127.0.0.1', H.ipCoz('0100007F'));
ol('0A02000A -> 10.0.2.10', '10.0.2.10', H.ipCoz('0A02000A'));  /* TV'den */
ol('0B02000A -> 10.0.2.11', '10.0.2.11', H.ipCoz('0B02000A'));  /* TV'den */
ol('08080808 -> 8.8.8.8', '8.8.8.8', H.ipCoz('08080808'));
ol('bozuk girdi -> null', null, H.ipCoz('xx'));

console.log('\nyerelMi');
ol('127.0.0.1 yerel', true,  H.yerelMi('127.0.0.1'));
ol('10.0.2.10 yerel', true,  H.yerelMi('10.0.2.10'));
ol('10.0.0.5 yerel', true,  H.yerelMi('10.0.0.5'));
ol('172.16.0.1 yerel', true,  H.yerelMi('172.16.0.1'));
ol('172.32.0.1 YEREL DEGIL', false, H.yerelMi('172.32.0.1'));  /* /12 siniri */
ol('169.254.1.1 yerel', true,  H.yerelMi('169.254.1.1'));
ol('8.8.8.8 yerel degil', false, H.yerelMi('8.8.8.8'));
ol('null yerel sayilir', true,  H.yerelMi(null));

/* --- 24 Ekim, homeconnect TAKILIYKEN okunan tablo (hepsi yerel) --- */
var TAKILI =
'  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n' +
'   0: 0100007F:1F90 0100007F:8B2A 01 00000000:00000000 00:00000000 00000000     0        0 12001\n' +
'   1: 0100007F:1F91 0100007F:A4FF 01 00000000:00000000 00:00000000 00000000     0        0 12002\n' +
'   2: 0C02000A:C350 0A02000A:FA2D 01 00000000:00000000 00:00000000 00000000     0        0 12003\n';

/* --- saglikli: bulut baglantisi var --- */
var SAGLIKLI = TAKILI +
'   3: 7301000A:D431 22DC4A68:01BB 01 00000000:00000000 00:00000000 00000000     0        0 12004\n';

/* --- dinleme/bekleme durumlari tepki uretmemeli --- */
var SADECE_DINLEME =
'  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n' +
'   0: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 12010\n' +
'   1: 7301000A:D432 22DC4A68:01BB 06 00000000:00000000 00:00000000 00000000     0        0 12011\n';

console.log('\nwanBaglantisiVar');
ol('takiliyken (hepsi yerel) -> false', false, H.wanBaglantisiVar(TAKILI));
ol('saglikliyken -> true',            true,  H.wanBaglantisiVar(SAGLIKLI));
ol('yalnizca LISTEN/TIME_WAIT -> false', false, H.wanBaglantisiVar(SADECE_DINLEME));
ol('bos metin -> false',              false, H.wanBaglantisiVar(''));
ol('null -> false',                   false, H.wanBaglantisiVar(null));

console.log('\nwanBaglantisiVar — surece gore suzme (inode)');
ol('wan soketi BIZIM surecin -> true',
   true,  H.wanBaglantisiVar(SAGLIKLI, { '12004': 1 }));
ol('wan soketi BASKA surecin -> false',
   false, H.wanBaglantisiVar(SAGLIKLI, { '12001': 1, '12003': 1 }));
ol('surecin hic soketi yok -> false',
   false, H.wanBaglantisiVar(SAGLIKLI, {}));

/* --- IPv6: TV'den 24 Ekim'de okunan GERCEK uzak adresler --- */
var ALTI =
'  sl  local_address  rem_address  st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n' +
'   0: 0000000000000000FFFF00000100007F:1F90 0000000000000000FFFF00000100007F:8B2A 01 0 0 0 0 0 0 0 0 13001\n';
var ALTI_WAN =
'  sl  local_address  rem_address  st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n' +
'   0: 2A05D018000000000000000000000001:D431 18D0052A83B66C07000000000D020287:01BB 01 0 0 0 0 0 0 0 0 13002\n';
var ALTI_YEREL =
'  sl  local_address  rem_address  st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n' +
'   0: 000080FE00000000000000000D020287:D431 000080FE000000000000000099108009:01BB 01 0 0 0 0 0 0 0 0 13003\n';

console.log('\nIPv6 (/proc/net/tcp6)');
ol('::ffff:127.0.0.1 -> yerel, wan yok', false, H.wanBaglantisiVar(ALTI));
ol('2a05:d018:... (AWS, TVden) -> WAN', true,  H.wanBaglantisiVar(ALTI_WAN));
ol('fe80:: link-local -> yerel', false, H.wanBaglantisiVar(ALTI_YEREL));
ol('altiYerelMi: ::1 -> yerel', true,
   H.altiYerelMi('00000000000000000000000001000000'));
ol('altiYerelMi: bozuk uzunluk -> yerel say', true, H.altiYerelMi('ABC'));
ol('IPv4 ve IPv6 birlikte, WAN yalnizca v6da -> true',
   true, H.wanBaglantisiVar(TAKILI + ALTI_WAN));

console.log('\niyilestirmeKarari');
var SAAT = 3600000;
ol('baglanti varsa dokunma',
   { yap: false, sebep: 'wan baglantisi var' },
   H.iyilestirmeKarari({ wanVar: true, simdi: 1000, sonIyilestirme: 0, bekleme: SAAT }));
ol('baglanti yok, ilk kez -> iyilestir',
   { yap: true, sebep: 'wan baglantisi yok' },
   H.iyilestirmeKarari({ wanVar: false, simdi: 1000, sonIyilestirme: 0, bekleme: SAAT }));
ol('baglanti yok ama 10 dk once denendi -> bekle',
   { yap: false, sebep: 'bekleme suresinde' },
   H.iyilestirmeKarari({ wanVar: false, simdi: 600000, sonIyilestirme: 1, bekleme: SAAT }));
ol('baglanti yok, bekleme doldu -> tekrar iyilestir',
   { yap: true, sebep: 'wan baglantisi yok' },
   H.iyilestirmeKarari({ wanVar: false, simdi: SAAT + 2, sonIyilestirme: 1, bekleme: SAAT }));
ol('bos durum nesnesi -> iyilestir (guvenli varsayilan degil ama zararsiz)',
   { yap: true, sebep: 'wan baglantisi yok' },
   H.iyilestirmeKarari(undefined));

/* --- gercek senaryo: saatlerce takili kalsa bile saatte BIR kez dener --- */
(function () {
  var son = 0, denemeler = [], t;
  for (t = 0; t <= 6 * SAAT; t += 5 * 60000) {        /* 6 saat, 5 dk'da bir */
    var k = H.iyilestirmeKarari({ wanVar: false, simdi: t,
                                  sonIyilestirme: son, bekleme: SAAT });
    if (k.yap) { denemeler.push(t / SAAT); son = t; }
  }
  if (denemeler.length === 7) {
    gecti++; console.log('  OK   6 saat takili: ' + denemeler.length + ' deneme (saatte bir)');
  } else {
    kaldi++; console.log('  KALDI 6 saatte ' + denemeler.length + ' deneme: ' + denemeler.join(','));
  }
})();

console.log('\nSONUC: ' + (kaldi ? kaldi + ' TEST KALDI' : 'TUM TESTLER GECTI') +
            ' (' + gecti + ' gecti)');
process.exit(kaldi ? 1 : 0);
