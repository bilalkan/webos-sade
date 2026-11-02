/* ===========================================================================
   HOME tepkisi — durum makinesi (saf mantik, test edilebilir).

   Kurallar:
   1. Her HOME basisi icin EN FAZLA BIR tepki. Pencere icinde LG'nin ekrani
      one gelirse tepki verilir ve bayrak DUSER.
   2. Pencere disinda LG'ye dokunulmaz (kullanici isterse acabilsin).
      ISTISNA (4 Kasim): bir uygulama kapanip on plan BOSALDIKTAN sonra
      BOS_PENCERE icinde LG gelirse bu da tepki sayilir. Olay: AirPlay
      bitti -> on plan bos -> webOS "son girdiye don" ile LG ana ekranini
      acti (caller last_input_handler) ve ekran oyle kaldi. Sade'den
      "LG Ana Ekran"a bilerek gecis bosluktan GECMIYOR (Sade -> LG), ona
      dokunulmaz. Kapanan bir Sade'yi sonsuza dek yeniden acmamak icin
      bu yoldan dakikada en fazla BOS_HAK tepki.
   3. SIGORTA: 10 sn icinde 2'den fazla tepki olursa 60 sn susturulur.
      Akşamki dongu bunu gerektirdi — kod kendi kendini durdurabilmeli.
   =========================================================================== */
'use strict';

function Tepki(ayar) {
  ayar = ayar || {};
  this.PENCERE   = ayar.pencere   || 3500;
  /* SIGORTA ayari: gercek dongu AYNI MILISANIYE icinde yuzlerce kez
     doner (akşamki log bunu gosterdi). Kullanicinin arka arkaya HOME'a
     basmasi ise saniyede 1-3 tepki uretir. Sinirin bu ikisini ayirmasi
     lazim: 1 saniyede 6'dan fazla = dongu. Onceki ayar (10 sn'de 2)
     normal kullanimi cezalandiriyordu. */
  this.SINIR     = ayar.sinir     || 6;
  this.SINIR_SURE= ayar.sinirSure || 1000;
  this.SUS_SURE  = ayar.susSure   || 30000;
  this.LG        = ayar.lg        || 'com.webos.app.home';
  /* LG'nin ana ekrani biz one aldiktan ~340ms SONRA kendini yeniden
     dayatiyor (olculdu). Tek atislik tepki yetmiyor. Basis basina
     SINIRLI sayida israr ediyoruz — sonsuz degil, en fazla TEPKI_HAKKI. */
  this.TEPKI_HAKKI = ayar.tepkiHakki || 3;
  this.BOS_PENCERE = ayar.bosPencere || 3000;
  this.BOS_HAK     = ayar.bosHak     || 3;
  this.BOS_SURE    = ayar.bosSure    || 60000;
  this.bosAni      = 0;
  this.bosGecmis   = [];
  this.pencereSonu = 0;
  this.kalanHak    = 0;
  this.gecmis      = [];
  this.susunca     = 0;
}

Tepki.prototype.homeBasildi = function (t) {
  this.pencereSonu = t + this.PENCERE;
  this.kalanHak = this.TEPKI_HAKKI;
};

/* Bekleyen pencereyi KAPAT. 25 Ekim: kullanici Sade zaten ondeyken HOME'a
   bastiginda yeni pencere acmiyorduk ama ONCEKI basisin penceresi hala
   acik kaliyordu (3.5 sn). LG ekrani o aralikta gelince eski pencere
   atesleniyor ve cekisme basliyordu. "Zaten evdeyiz" dedigimiz an,
   bekleyen tepki hakkinin da anlami kalmiyor. */
Tepki.prototype.iptal = function () {
  this.pencereSonu = 0;
  this.kalanHak = 0;
};

/* Donus: 'ac' (tepki ver) | null (bir sey yapma) | 'sigorta' (kesildi) */
Tepki.prototype.onPlan = function (appId, t) {
  if (t < this.susunca) return null;             /* sigorta atmis, sessiz */
  if (appId === '') { this.bosAni = t; return null; }   /* on plan bosaldi */
  if (appId !== this.LG) { this.bosAni = 0; return null; }
  if (this.bosAni && t - this.bosAni < this.BOS_PENCERE) {
    this.bosAni = 0;
    this.bosGecmis = this.bosGecmis.filter(function (x) { return t - x < this.BOS_SURE; }, this);
    if (this.bosGecmis.length < this.BOS_HAK) {
      this.bosGecmis.push(t);
      this.homeBasildi(t);                        /* HOME basilmis gibi: ayni israr + sigorta */
    }
  }
  if (this.kalanHak <= 0 || t >= this.pencereSonu) return null;

  this.kalanHak--;                                /* hak tukenince durur */
  this.gecmis.push(t);
  this.gecmis = this.gecmis.filter(function (x) { return t - x < this.SINIR_SURE; }, this);
  if (this.gecmis.length > this.SINIR) {
    this.susunca = t + this.SUS_SURE;
    this.gecmis = [];
    return 'sigorta';
  }
  return 'ac';
};

module.exports = Tepki;
