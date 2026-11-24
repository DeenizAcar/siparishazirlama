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

**Android uygulaması** veriyi aynı telefondaki Cari Arama, Markalar ve Ürünler uygulamalarından canlı okur.
Her birinde `VeriPaylasim` adlı bir paylaşım noktası vardır. Bu nokta yalnızca Sipariş Hazırlama'ya cevap verir:
çağıranın paket adı ve imza parmak izi kontrol edilir. Okuma, `android/.../KaynakPlugin.java` ile yapılır ve
uygulamaya her dönüldüğünde tekrarlanır.

| Uygulama | Paylaşım adresi | Gereken sürüm |
|---|---|---|
| Cari Arama | `com.cariarama.app.paylasim` | 1.0.11+ (bir kez açılmalı) |
| Markalar | `com.deenizacar.markalar.paylasim` | paylaşımlı ilk CI sürümü (bir kez açılmalı) |
| Ürünler | `com.babamaku.urunler.paylasim` | 1.2.4+ |

Bir uygulama kurulu değilse ya da eski sürümse, o liste için yedek olarak **Excel'den Aktar** kullanılabilir:
Markalar/Ürünler programlarının Excel dışa aktarımı veya cari listesi (Cari Kodu, Cari İsmi, Adres, İlçe/Semt, İl, Telefon).

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
