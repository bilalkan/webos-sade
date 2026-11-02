# ===========================================================================
# KURULUM AYARLARI — araclar bu dosyayi okur.
#
# Bu dosya varsayilanlari ve aciklamalari tasiyor. Kendi degerlerinizi
# (IP, MAC, TomTom anahtari...) buraya degil ayarlar.yerel.sh'a yazin:
#   cp ayarlar.yerel.ornek.sh ayarlar.yerel.sh && nano ayarlar.yerel.sh
# Yerel dosya en sonda okunur, buradakilerin uzerine yazar ve .gitignore'da:
# anahtariniz, IP ve MAC'iniz git'e ve paylastiginiz pakete girmez.
# Buradaki baska bir degeri degistirmek isterseniz o satiri da yerel
# dosyaya kopyalayin.
# ===========================================================================

# TV'nin IP adresi — yalnizca BIR IPUCU. Araclar once bunu dener,
# tutmazsa TV_MAC'ten bulur, yine olmazsa agi tarar.
TV_IP="192.168.1.100"

# TV'nin MAC adresi — IP kaysa da TV'yi bulmayi saglar.
# Nasil ogrenilir: TV'de Ayarlar > Baglanti > Ag > Kablolu/Kablosuz > Gelismis
# ya da Mac'ten: arp -an | grep <TV_IP>
# Bu alan bir olaydan geliyor: TV'nin DHCP kirasi kaydi ve butun araclar koptu.
# TV hem kablo hem Wi-Fi ile bagliysa iki MAC'i de bosluklu yazin:
#   TV_MAC="aa:bb:cc:dd:ee:ff 11:22:33:44:55:66"
TV_MAC="aa:bb:cc:dd:ee:ff"

# Root SSH anahtari (kalici root kurulduktan sonra olusur)
ROOT_KEY="$HOME/.ssh/lgtv_root_ed25519"

# Uygulama kimligi — degistirmek istersen sade/appinfo.json ile ayni olsun
APP_ID="com.bilal.sade"

# Kumandadaki HOME tusunun kodu. BIZDE 773 CIKTI ama kumandaya gore
# degisebilir — kurulum sirasinda olculecek (bkz. KURULUM.md, adim 6).
HOME_KODU=773

# --- Kok servisin TV'ye ne kadar karisacagi (hepsi istege bagli) -----------
# Varsayilan: HICBIRINE DOKUNMA. Degerler bosluklarla ayrilmis uygulama
# kimlikleri. Kimlikleri gormek icin: araclar/root-ssh.sh ile TV'ye girip
#   luna-send -n 1 luna://com.webos.applicationManager/listApps '{}' </dev/null

# Arka planda kendiliginden ONYUKLENMESINI istemediklerin. RAM kazandirir;
# karsiliginda o uygulama ilk acilista biraz gec gelir (bizde olculdu:
# YouTube onyukluyken 150 ms, soguk 1550 ms; onyuklu YouTube 121 MB yiyor).
# HDMI girislerini (com.webos.app.hdmi1..4) YALNIZCA bos olanlari koy —
# kullandigin bir giriste kanal degistirmek yavaslayabilir (olculmedi).
# Ornek: ONYUKLEME_KAPALI="youtube.leanback.v4 netflix amazon"
ONYUKLEME_KAPALI=""

# Politikaya RAGMEN geri onyuklenenler; servis 5 dk'da bir kapatir.
# Ornek (LG'nin sesli aramasi, bizde 30 sn'de geri geliyordu):
# SUREKLI_KAPAT="com.webos.app.voice"
SUREKLI_KAPAT=""

# TV widget'indaki "arka plani temizle" dugmesinin ASLA kapatmayacaklari.
# Sade ve LG ana ekrani her zaman korunur, buraya yazmana gerek yok.
# AirPlay kapanirsa telefon TV'yi bir sure bulamayabilir.
KAPATMA_DISI="airplay"

# --- Yol durumu widget'i (istege bagli) ------------------------------------
# Canli trafikle yol suresi TomTom'dan gelir. Anahtari kendiniz alin,
# adim adim: belgeler/TOMTOM.md. Ucretsiz katman gunde 2.500 sorgu; Sade
# 5 dk'da bir, guzergah basina 1 sorgu yapar (6 guzergahla gunde en fazla
# 1.728) + kapanmalar icin 288. Kota asilirsa istek reddedilir, ucret cekilmez.
# Anahtar TV'de yalnizca root'un okuyabildigi bir dosyaya yazilir.
# BURAYA DEGIL ayarlar.yerel.sh'a yazin.
TOMTOM_ANAHTAR=""
# Guzergahlar: belgeler/guzergah-ornek.json'u kopyalayip duzenle, yolunu yaz.
# Bos birakilirsa Yol durumu widget'i galeride hic gorunmez.
GUZERGAH_DOSYASI=""

# --- Yerel degerler (git'e girmez) -----------------------------------------
_AYAR_DIZIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$_AYAR_DIZIN/ayarlar.yerel.sh" ] && . "$_AYAR_DIZIN/ayarlar.yerel.sh"
unset _AYAR_DIZIN
