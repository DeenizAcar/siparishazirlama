# Sipariş Hazırlama

Cari, marka ve ürün seçerek sipariş sepeti hazırlama uygulaması. Hem web sitesi hem Android uygulaması olarak çalışır.

- **Web:** https://deenizacar.github.io/siparishazirlama/
- **Android APK:** https://deenizacar.github.io/siparishazirlama/apk/

## Ekran

- **Üst panel:** günün tarihi (`Tarih:`).
- **Sekmeler:** en baştaki **+** sekmesi her dokunuşta en sağa yeni bir **Yeni Sipariş** sekmesi açar ve ona geçer.
  Aktif sekmenin iki yanındaki oklar sekmeyi sola / sağa taşır; + sekmesi taşınamaz, hiçbir sekme onun soluna geçemez.
- **Sipariş sekmesi – üst panel:** `Cari :` (cari adı, alt satırda semt / ilçe / il) ve **Seç** düğmesi,
  altında şoför adı ve plaka sahaları. **Seç**, Cari Arama programının ön ekranının aynısını açar; cariye çift dokununca seçilir.
- **Sipariş sekmesi – alt panel:**
  - **Markalar** (Markalar programındaki aktif markalar + en altta **KARIŞIK**), tek seçimli radio.
  - **Ürünler**, Ürünler programındaki sekmelerle aynı sırada; ilk satır seçili gelir.
    Ürüne çift dokununca adet penceresi açılır (en fazla 4 hane) ve ürün sepete atılır. Aynı ürün ikinci kez atılamaz.
  - **Sepet:** ürün adı; ilk sekme dışındaki ürünlerde alt satırda sekme başlığı. Adede çift dokununca adet değiştirilir,
    son kolondaki sil simgesi yalnızca aktif satırda görünür.

Açık siparişler cihazda saklanır; uygulama kapanıp açılınca kaldığı yerden devam eder.

## Veriler nereden gelir?

**Web sürümü**, aynı adreste (deenizacar.github.io) çalışan diğer programların verilerini doğrudan okur:

| Program | Kayıt anahtarı |
|---|---|
| [Cari Arama](https://deenizacar.github.io/cariarama/) | `cariarama.veri.v1` |
| [Markalar](https://deenizacar.github.io/Markalar/) | `mk_marka` |
| [Ürünler](https://deenizacar.github.io/Urunler/) | `urunler:katalog` |

Diğer programlarda yapılan değişiklikler sayfaya dönülünce kendiliğinden görünür (aynı tarayıcıda kullanılmalıdır).

**Android uygulamasında** her uygulamanın verileri ayrı tutulduğu için listeler **Excel'den Aktar** ile alınır:

- Markalar programının Excel dışa aktarımı (`Markalar` sayfası)
- Ürünler programının Excel dışa aktarımı (`Ürünler` sayfası)
- Cari listesi: Cari Kodu, Cari İsmi, Adres, İlçe/Semt, İl, Telefon sütunları

Aynı türden yeni dosya aktarılınca eski liste yenisiyle değiştirilir.

## Geliştirme

```bash
npm install
npm run web        # http://localhost:5190 adresinde web sürümünü açar
npm run apk        # Android APK'yı derler ve site/apk/siparis-hazirlama.apk olarak kaydeder
```

`main` dalına gönderilen her değişiklik GitHub Actions ile otomatik olarak GitHub Pages'te yayınlanır.
APK'yı güncellemek için önce `npm run apk` çalıştırıp çıkan dosyayı da commit edin.

> **Önemli:** `keystore/` klasöründeki imza anahtarı GitHub'a gönderilmez. Bu klasörü güvenli bir
> yere yedekleyin. Anahtar kaybolursa yeni sürümler telefondaki eski sürümün üzerine kurulamaz.
