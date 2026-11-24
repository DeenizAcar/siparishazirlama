package com.deenizacar.siparishazirlama;

import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Cari Arama, Markalar ve Ürünler uygulamalarının verilerini okur
 * (o uygulamalardaki VeriPaylasim sağlayıcısı üzerinden).
 * durum: "tamam" (veri null olabilir), "yok" (uygulama kurulu değil / eski sürüm), "izin" (izin verilmedi)
 */
@CapacitorPlugin(name = "Kaynak")
public class KaynakPlugin extends Plugin {

    @PluginMethod
    public void oku(PluginCall call) {
        String yetki = call.getString("yetki", "");
        JSObject sonuc = new JSObject();
        if (!yetki.endsWith(".paylasim")) {
            call.reject("Geçersiz kaynak");
            return;
        }
        try {
            Bundle b = getContext().getContentResolver().call(Uri.parse("content://" + yetki), "oku", null, null);
            sonuc.put("durum", "tamam");
            String veri = b != null ? b.getString("veri") : null;
            if (veri != null) sonuc.put("veri", veri);
        } catch (SecurityException e) {
            sonuc.put("durum", "izin");
        } catch (Exception e) {
            sonuc.put("durum", "yok");
        }
        call.resolve(sonuc);
    }
}
