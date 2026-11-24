/* Sipariş Hazırlama – uygulama kodu (web + Android ortak) */
(function () {
  'use strict';

  // Kendi kayıtlarımız
  const KEY_DURUM = 'siparis.durum.v1';      // açık sipariş sekmeleri
  const KEY_AKTARILAN = 'siparis.aktarilan.v1'; // Excel'den aktarılan cari / marka / ürün listeleri
  // Diğer programların kayıtları (web'de aynı adreste: deenizacar.github.io)
  const KEY_CARI = 'cariarama.veri.v1';      // Cari Arama:  { cariler: [{ id, kod, isim, adres, il, ilce, semt, tel, tarifler:[{id, ad}] }] }
  const KEY_MARKA = 'mk_marka';              // Markalar:    [{ id, ad, pasif }]
  const KEY_URUN = 'urunler:katalog';        // Ürünler:     { kategoriler: [{ id, ad, urunler: [{ id, ad }] }] }
  const KARISIK = '__karisik__';
  const SAYFA = 300;
  const NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform());

  // ===================================================================
  // Yardımcılar
  // ===================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ESC[c]);
  const bosluk = s => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dokunmatik = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const pad = n => (n < 10 ? '0' : '') + n;

  const FOLD = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  const FOLD_RE = /[çğıöşüâîû]/g;
  function fold(s) {
    s = s == null ? '' : String(s);
    let l = s.toLocaleLowerCase('tr');
    if (l.length !== s.length) {
      l = '';
      for (let i = 0; i < s.length; i++) {
        const c = s[i].toLocaleLowerCase('tr');
        l += c.length === 1 ? c : c[0];
      }
    }
    return l.replace(FOLD_RE, c => FOLD[c]);
  }

  function hl(text, kelimeler) {
    text = text == null ? '' : String(text);
    if (!text || !kelimeler.length) return esc(text);
    const f = fold(text);
    const araliklar = [];
    for (const k of kelimeler) {
      let i = f.indexOf(k);
      while (i !== -1) { araliklar.push([i, i + k.length]); i = f.indexOf(k, i + k.length); }
    }
    if (!araliklar.length) return esc(text);
    araliklar.sort((a, b) => a[0] - b[0]);
    const birlesik = [];
    for (const a of araliklar) {
      const son = birlesik[birlesik.length - 1];
      if (son && a[0] <= son[1]) son[1] = Math.max(son[1], a[1]); else birlesik.push([a[0], a[1]]);
    }
    let out = '', pos = 0;
    for (const [s, e] of birlesik) {
      out += esc(text.slice(pos, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
      pos = e;
    }
    return out + esc(text.slice(pos));
  }

  function oku(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function yaz(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Kayıt yapılamadı!'); return false; }
  }

  const IKON = {
    arti: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 3.5v17M3.5 12h17" stroke="#000" stroke-width="3.4" stroke-linecap="round"/></svg>',
    sol: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sag: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sil: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    kucukX: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="#000" stroke-width="3.2" stroke-linecap="round"/></svg>'
  };

  // Çift dokunma / çift tıklama (aynı satıra 450 ms içinde ikinci dokunuş)
  let sonDokunma = { anahtar: null, zaman: 0 };
  function ciftDokunma(anahtar) {
    const simdi = Date.now();
    const cift = sonDokunma.anahtar === anahtar && simdi - sonDokunma.zaman < 450;
    sonDokunma = cift ? { anahtar: null, zaman: 0 } : { anahtar, zaman: simdi };
    return cift;
  }

  // ===================================================================
  // Kaynak veriler: Cari Arama, Markalar ve Ürünler programları
  // ===================================================================
  let kaynak = { cariler: [], markalar: [], kategoriler: [], disari: { cari: false, marka: false, urun: false } };

  // Android: veriler Cari Arama, Markalar ve Ürünler uygulamalarından (VeriPaylasim sağlayıcıları) okunur.
  // Web'de aynı adresteki (deenizacar.github.io) localStorage kayıtları doğrudan okunur.
  const UYGULAMA = {
    cari: { yetki: 'com.cariarama.app.paylasim', ad: 'Cari Arama' },
    marka: { yetki: 'com.deenizacar.markalar.paylasim', ad: 'Markalar' },
    urun: { yetki: 'com.babamaku.urunler.paylasim', ad: 'Ürünler' }
  };
  const paylasilan = { cari: null, marka: null, urun: null };
  const paylasimDurum = { cari: '', marka: '', urun: '' };
  async function paylasimOku() {
    const K = NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.Kaynak;
    if (!K) return;
    await Promise.all(Object.keys(UYGULAMA).map(async t => {
      try {
        const r = await K.oku({ yetki: UYGULAMA[t].yetki });
        paylasimDurum[t] = r.durum;
        paylasilan[t] = r.veri ? JSON.parse(r.veri) : null;
      } catch (e) {
        paylasimDurum[t] = 'yok';
        paylasilan[t] = null;
      }
    }));
  }
  function yenile() {
    return paylasimOku().then(() => {
      kaynakYukle();
      siparisCiz();
      if ($('#dlgCari').open) aramaCiz();
    });
  }
  // Veri bulunamayınca gösterilecek açıklama
  function kaynakNotu(t) {
    const ad = UYGULAMA[t].ad;
    if (!NATIVE) return ad + ' programında kayıt yok (aynı tarayıcıda kullanılmalı) ya da Excel dosyasından aktarın.';
    if (paylasimDurum[t] === 'yok') return ad + ' uygulaması bu telefonda kurulu değil ya da güncel değil. Güncel sürümü kurun.';
    if (paylasimDurum[t] === 'izin') return ad + ' uygulaması verilerini paylaşmadı.';
    return ad + ' uygulamasında kayıt yok. Varsa ' + ad + ' uygulamasını bir kez açıp kapatın.';
  }

  function kaynakYukle() {
    const aktarilan = oku(KEY_AKTARILAN) || {};
    const c = NATIVE ? paylasilan.cari : oku(KEY_CARI);
    const m = NATIVE ? paylasilan.marka : oku(KEY_MARKA);
    const u = NATIVE ? paylasilan.urun : oku(KEY_URUN);
    const cariVar = !!(c && Array.isArray(c.cariler));
    const markaVar = Array.isArray(m);
    const urunVar = !!(u && Array.isArray(u.kategoriler));

    const cariler = (cariVar ? c.cariler : (aktarilan.cariler || [])).filter(x => x && (x.isim || x.kod)).map(x => ({
      id: String(x.id || uid()), kod: bosluk(x.kod), isim: bosluk(x.isim), adres: bosluk(x.adres),
      il: bosluk(x.il).toLocaleUpperCase('tr'), ilce: bosluk(x.ilce), semt: bosluk(x.semt), tel: bosluk(x.tel),
      tarifler: Array.isArray(x.tarifler) ? x.tarifler.filter(t => t && t.ad) : []
    }));
    cariler.sort((a, b) => collator.compare(a.isim, b.isim) || collator.compare(a.kod, b.kod));

    const markalar = (markaVar ? m : (aktarilan.markalar || []))
      .filter(x => x && x.ad && !x.pasif).map(x => ({ id: String(x.id), ad: bosluk(x.ad) }));

    const kategoriler = (urunVar ? u.kategoriler : (aktarilan.kategoriler || [])).filter(k => k && k.ad).map(k => ({
      id: String(k.id), ad: bosluk(k.ad),
      urunler: (Array.isArray(k.urunler) ? k.urunler : []).filter(x => x && x.ad).map(x => ({ id: String(x.id), ad: bosluk(x.ad) }))
    }));

    kaynak = { cariler, markalar, kategoriler, disari: { cari: cariVar, marka: markaVar, urun: urunVar } };
    aramaOnbellek = new WeakMap();
    $('#aktarBtn').hidden = cariVar && markaVar && urunVar;
  }

  // ===================================================================
  // Sipariş sekmeleri
  // ===================================================================
  // sekme: { id, cari: {id, kod, isim, yer} | null, sofor, plaka, markaId, katId, urunSecili: {katId: urunId},
  //          sepet: [{ id, urunId, katId, ad, katAd, adet }], sepetSecili }
  function durumYukle() {
    const d = oku(KEY_DURUM);
    if (d && Array.isArray(d.sekmeler)) {
      d.sekmeler.forEach(s => {
        if (!Array.isArray(s.sepet)) s.sepet = [];
        if (!s.urunSecili || typeof s.urunSecili !== 'object') s.urunSecili = {};
      });
      if (!d.sekmeler.some(s => s.id === d.aktifId)) d.aktifId = d.sekmeler.length ? d.sekmeler[0].id : null;
      return d;
    }
    return { sekmeler: [], aktifId: null };
  }
  let durum = durumYukle();
  const kaydet = () => yaz(KEY_DURUM, durum);
  const aktif = () => durum.sekmeler.find(s => s.id === durum.aktifId) || null;

  function yeniSekme() {
    const s = { id: uid(), cari: null, sofor: '', plaka: '', markaId: null, katId: null, urunSecili: {}, sepet: [], sepetSecili: null };
    durum.sekmeler.push(s); // her zaman en sağa
    durum.aktifId = s.id;
    kaydet();
    hepsiniCiz();
    const el = $('#sekmeler .sekme.aktif');
    if (el) el.scrollIntoView({ inline: 'end', block: 'nearest' });
  }

  function sekmeTasi(yon) {
    const l = durum.sekmeler;
    const i = l.findIndex(s => s.id === durum.aktifId);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= l.length) return; // + sekmesinin soluna geçemez
    [l[i], l[j]] = [l[j], l[i]];
    kaydet();
    sekmeleriCiz();
    const el = $('#sekmeler .sekme.aktif');
    if (el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  function sekmeleriCiz() {
    const n = durum.sekmeler.length;
    let html = '<div class="sekme sekme-arti" role="tab" data-arti title="Yeni sipariş" aria-label="Yeni sipariş">' + IKON.arti + '</div>';
    durum.sekmeler.forEach((s, i) => {
      const on = s.id === durum.aktifId;
      html += '<div class="sekme' + (on ? ' aktif' : '') + '" role="tab" aria-selected="' + on + '" data-id="' + esc(s.id) + '">' +
        (on ? '<button type="button" class="tasi" data-tasi="-1" title="Sola taşı" aria-label="Sola taşı"' + (i === 0 ? ' disabled' : '') + '>' + IKON.sol + '</button>' : '') +
        '<span class="etiket">Yeni Sipariş</span>' +
        (on ? '<button type="button" class="tasi" data-tasi="1" title="Sağa taşı" aria-label="Sağa taşı"' + (i === n - 1 ? ' disabled' : '') + '>' + IKON.sag + '</button>' : '') +
        '</div>';
    });
    $('#sekmeler').innerHTML = html;
  }

  // ===================================================================
  // Sipariş ekranı
  // ===================================================================
  function cariYer(c) {
    return [c.semt, c.ilce, c.il].filter(Boolean).join(' / ');
  }

  function cariCiz(s) {
    const k = $('#cariKutu');
    k.innerHTML = s.cari
      ? '<div class="ad">' + esc(s.cari.isim) + '</div>' + (s.cari.yer ? '<div class="yer">' + esc(s.cari.yer) + '</div>' : '')
      : '<span class="yok">Cari seçilmedi</span>';
  }

  function markaCiz(s) {
    const satirlar = kaynak.markalar.map(m => ({ id: m.id, ad: m.ad })).concat([{ id: KARISIK, ad: 'KARIŞIK' }]);
    $('#markaBody').innerHTML = satirlar.map(m => {
      const on = s.markaId === m.id;
      return '<tr data-id="' + esc(m.id) + '" class="' + (on ? 'sel' : '') + (m.id === KARISIK ? ' karisik' : '') + '">' +
        '<td class="radio"><input type="radio" name="marka" tabindex="-1" aria-label="' + esc(m.ad) + '"' + (on ? ' checked' : '') + '></td>' +
        '<td>' + esc(m.ad) + '</td></tr>';
    }).join('');
  }

  function aktifKategori(s) {
    const l = kaynak.kategoriler;
    return l.find(k => k.id === s.katId) || l[0] || null;
  }

  function urunCiz(s) {
    const kat = aktifKategori(s);
    $('#katSekmeler').innerHTML = kaynak.kategoriler.map(k =>
      '<button type="button" class="kat-sekme' + (kat && k.id === kat.id ? ' aktif' : '') + '" role="tab" data-kat="' + esc(k.id) + '">' + esc(k.ad) + '</button>').join('');
    $('#katSekmeler').hidden = !kaynak.kategoriler.length;
    const bos = $('#urunBos');
    if (!kat || !kat.urunler.length) {
      $('#urunBody').innerHTML = '';
      bos.hidden = false;
      bos.innerHTML = !kaynak.kategoriler.length
        ? 'Ürün bulunamadı.<br><small>' + esc(kaynakNotu('urun')) + '</small>'
        : 'Bu sekmede ürün yok.';
      return;
    }
    bos.hidden = true;
    let secili = s.urunSecili[kat.id];
    if (!kat.urunler.some(u => u.id === secili)) secili = kat.urunler[0].id; // ilk satır seçili gelir
    s.urunSecili[kat.id] = secili;
    $('#urunBody').innerHTML = kat.urunler.map(u =>
      '<tr data-id="' + esc(u.id) + '"' + (u.id === secili ? ' class="sel"' : '') + '><td>' + esc(u.ad) + '</td></tr>').join('');
  }

  function sepetCiz(s, parlatId) {
    const body = $('#sepetBody');
    $('#sepetBos').hidden = s.sepet.length > 0;
    body.innerHTML = s.sepet.map(x =>
      '<tr data-id="' + esc(x.id) + '" class="' + (x.id === s.sepetSecili ? 'sel' : '') + (x.id === parlatId ? ' flash' : '') + '">' +
      '<td><div class="u-ad">' + esc(x.ad) + '</div>' + (x.katAd ? '<div class="u-kat">' + esc(x.katAd) + '</div>' : '') + '</td>' +
      '<td class="num" data-adet>' + x.adet + '</td>' +
      '<td class="act"><button type="button" class="icon-btn del" data-sil title="Satırı sil" aria-label="Satırı sil">' + IKON.sil + '</button></td></tr>').join('');
    const toplam = s.sepet.reduce((t, x) => t + x.adet, 0);
    $('#sepetBilgi').textContent = s.sepet.length ? s.sepet.length + ' kalem · ' + toplam + ' adet' : '';
    if (parlatId) {
      const tr = body.querySelector('tr[data-id="' + CSS.escape(parlatId) + '"]');
      if (tr) tr.scrollIntoView({ block: 'nearest' });
    }
  }

  function siparisCiz() {
    const s = aktif();
    $('#bosEkran').hidden = !!s;
    $('#siparis').hidden = !s;
    if (!s) return;
    cariCiz(s);
    $('#sofor').value = s.sofor || '';
    $('#plaka').value = s.plaka || '';
    markaCiz(s);
    urunCiz(s);
    sepetCiz(s);
  }

  function hepsiniCiz() { sekmeleriCiz(); siparisCiz(); }

  // ---------- Sepet ----------
  function sepeteAt(s, kat, urun) {
    const var_ = s.sepet.find(x => x.urunId === urun.id);
    if (var_) {
      s.sepetSecili = var_.id;
      sepetCiz(s, var_.id);
      kaydet();
      bilgi('Uyarı', '<p><b>' + esc(urun.ad) + '</b> sepette zaten var.</p><p>Adedi değiştirmek için sepetteki adede çift dokunun.</p>');
      return;
    }
    adetSor(urun.ad, kat.ad, '', adet => {
      const ilk = kaynak.kategoriler[0];
      const x = { id: uid(), urunId: urun.id, katId: kat.id, ad: urun.ad, katAd: ilk && ilk.id === kat.id ? '' : kat.ad, adet };
      s.sepet.push(x);
      s.sepetSecili = x.id;
      kaydet();
      sepetCiz(s, x.id);
    });
  }

  // ---------- Adet penceresi ----------
  let adetSonuc = null;
  function adetSor(urunAd, katAd, deger, tamam) {
    adetSonuc = tamam;
    $('#adetBaslik').textContent = deger ? 'Adet Değiştir' : 'Adet';
    $('#adetUrun').innerHTML = esc(urunAd) + (katAd ? '<small>' + esc(katAd) + '</small>' : '');
    $('#adetHata').textContent = '';
    const inp = $('#adetInput');
    inp.value = deger;
    pencereAc($('#dlgAdet'));
    inp.focus();
    inp.select();
    setTimeout(() => { if (document.activeElement !== inp) { inp.focus(); inp.select(); } }, 30);
  }
  function adetOnayla() {
    const v = $('#adetInput').value;
    if (!/^\d{1,4}$/.test(v) || Number(v) < 1) {
      $('#adetHata').textContent = '1 ile 9999 arasında bir sayı girin.';
      $('#adetInput').focus();
      return;
    }
    const f = adetSonuc;
    adetSonuc = null;
    pencereKapat($('#dlgAdet'));
    if (f) f(Number(v));
  }

  // ===================================================================
  // Cari seçme penceresi (Cari Arama ön ekranı)
  // ===================================================================
  const input = $('#searchInput');
  const chipsEl = $('#chips');
  const arama = { kelimeler: [], sadeceTarif: false, limit: SAYFA, seciliId: null };
  let aramaOnbellek = new WeakMap();

  function kelimeEkle(k) {
    k = bosluk(k);
    if (!k) return false;
    const f = fold(k);
    if (arama.kelimeler.some(x => fold(x) === f)) return false;
    arama.kelimeler.push(k);
    return true;
  }
  function kelimeler() {
    const liste = arama.kelimeler.slice();
    const bekleyen = bosluk(input.value);
    if (bekleyen) liste.push(...bekleyen.split(' '));
    const gorulen = new Set(), out = [];
    for (const k of liste) {
      const f = fold(k);
      if (f && !gorulen.has(f)) { gorulen.add(f); out.push(f); }
    }
    return out;
  }
  function chipCiz() {
    chipsEl.innerHTML = arama.kelimeler.map((k, i) =>
      '<span class="chip"><span>' + esc(k) + '</span>' +
      '<button type="button" class="chip-x" data-i="' + i + '" title="“' + esc(k) + '” kelimesini aramadan çıkar" ' +
      'aria-label="' + esc(k) + ' kelimesini sil">' + IKON.kucukX + '</button></span>').join('');
  }
  let aramaZaman = null, sonAnahtar = null;
  function aramaDegisti(hemen) {
    clearTimeout(aramaZaman);
    const calis = () => {
      const anahtar = kelimeler().join('\u0001');
      if (anahtar === sonAnahtar) return;
      sonAnahtar = anahtar;
      arama.limit = SAYFA;
      aramaCiz();
      $('#aramaWrap').scrollTop = 0;
    };
    if (hemen) calis(); else aramaZaman = setTimeout(calis, 120);
  }
  function aramaMetni(c) {
    let h = aramaOnbellek.get(c);
    if (h === undefined) {
      const tel = c.tel || '';
      h = fold([c.kod, c.isim, c.adres, c.il, c.ilce, c.semt, tel, tel.replace(/\D/g, '')]
        .concat(c.tarifler.map(t => t.ad)).join('\n'));
      aramaOnbellek.set(c, h);
    }
    return h;
  }
  function filtrele(k) {
    const l = kaynak.cariler;
    if (!k.length) return l;
    if (arama.sadeceTarif) {
      return l.filter(c => c.tarifler.some(t => { const f = fold(t.ad); return k.some(w => f.includes(w)); }));
    }
    return l.filter(c => { const h = aramaMetni(c); return k.some(w => h.includes(w)); });
  }

  const DAR = window.matchMedia ? window.matchMedia('(max-width: 699px)') : { matches: false };
  const dar = () => DAR.matches;
  const kolonlar = y => y.map(w => (w ? '<col style="width:' + w + '">' : '<col>')).join('');

  function aramaBaslikCiz() {
    const t = $('#aramaTable');
    t.classList.toggle('dar', dar());
    if (dar()) {
      t.querySelector('colgroup').innerHTML = kolonlar(['23%', '26%', '28%', '23%']);
      t.tHead.innerHTML = '<tr><th>Tarif İsimleri</th><th>Cari Kodu<br>Cari İsmi</th><th>Adres</th><th>İlçe / İl</th></tr>';
    } else {
      t.querySelector('colgroup').innerHTML = kolonlar(['24%', '10%', '22%', '30%', '14%']);
      t.tHead.innerHTML = '<tr><th>Tarif İsimleri</th><th>Cari Kodu</th><th>Cari İsmi</th><th>Adres</th><th>İlçe / İl</th></tr>';
    }
  }

  function aramaSatir(c, k) {
    let tarifler = c.tarifler;
    if (k.length) {
      const uyan = tarifler.filter(t => { const f = fold(t.ad); return k.some(w => f.includes(w)); });
      if (uyan.length) tarifler = uyan;
    }
    const tarifHtml = tarifler.map(t => '<div class="tarif">' + hl(t.ad, k) + '</div>').join('');
    if (arama.sadeceTarif) k = [];
    let adres = c.adres ? '<div>' + hl(c.adres, k) + '</div>' : '';
    if (c.tel) adres += '<div class="tel">Tel: <b>' + hl(c.tel, k) + '</b></div>';
    const ust = c.ilce || c.semt;
    const yer = (ust ? '<div>' + hl(ust, k) + '</div>' : '') + (c.il ? '<div class="il">' + hl(c.il, k) + '</div>' : '');
    const kodIsim = dar()
      ? '<td class="c-kodisim"><div class="kod">' + hl(c.kod, k) + '</div><div class="isim">' + hl(c.isim, k) + '</div></td>'
      : '<td class="c-kod">' + hl(c.kod, k) + '</td><td class="c-isim">' + hl(c.isim, k) + '</td>';
    return '<tr data-id="' + esc(c.id) + '"' + (c.id === arama.seciliId ? ' class="sel"' : '') + '>' +
      '<td class="c-tarif">' + tarifHtml + '</td>' + kodIsim +
      '<td class="c-adres">' + adres + '</td><td class="c-yer">' + yer + '</td></tr>';
  }

  function aramaCiz() {
    input.placeholder = dar() ? 'Ara…' : 'Ara… (birden fazla kelime yazabilirsiniz)';
    aramaBaslikCiz();
    const k = kelimeler();
    const liste = filtrele(k);
    const toplam = kaynak.cariler.length;
    $('#sayac').textContent = (k.length ? liste.length + ' / ' + toplam : String(toplam)) + ' cari';
    $('#aramaBilgi').textContent = liste.length + ' kayıt listelendi · Seçmek için cariye çift dokunun';
    const body = $('#aramaBody'), bos = $('#aramaBos');
    if (!liste.length) {
      body.innerHTML = '';
      bos.hidden = false;
      bos.innerHTML = toplam ? 'Aramaya uyan cari bulunamadı.'
        : 'Cari bulunamadı.<br><small>' + esc(kaynakNotu('cari')) + '</small>';
      return;
    }
    bos.hidden = true;
    const n = Math.min(liste.length, arama.limit);
    let html = '';
    for (let i = 0; i < n; i++) html += aramaSatir(liste[i], k);
    if (liste.length > n) {
      html += '<tr class="more"><td colspan="' + (dar() ? 4 : 5) + '"><button type="button" class="btn" data-daha>Daha fazla göster (' +
        (liste.length - n) + ' cari daha)</button></td></tr>';
    }
    body.innerHTML = html;
  }

  function cariPenceresiAc() {
    kaynakYukle();
    if (NATIVE) yenile();
    const s = aktif();
    arama.seciliId = s && s.cari ? s.cari.id : null;
    sonAnahtar = kelimeler().join('\u0001');
    arama.limit = SAYFA;
    aramaCiz();
    pencereAc($('#dlgCari'));
    $('#aramaWrap').scrollTop = 0;
    const sel = $('#aramaBody tr.sel');
    if (sel) sel.scrollIntoView({ block: 'center' });
    if (!dokunmatik) input.focus();
  }

  function cariSec(id) {
    const c = kaynak.cariler.find(x => x.id === id);
    const s = aktif();
    if (!c || !s) return;
    s.cari = { id: c.id, kod: c.kod, isim: c.isim, yer: cariYer(c) };
    kaydet();
    pencereKapat($('#dlgCari'));
    cariCiz(s);
  }

  // ===================================================================
  // Pencereler, bildirim
  // ===================================================================
  const acikPencereler = [];
  function pencereAc(d) {
    if (!d.open) d.showModal();
    if (!acikPencereler.includes(d)) acikPencereler.push(d);
  }
  function pencereKapat(d) {
    if (d.open) d.close();
    const i = acikPencereler.indexOf(d);
    if (i >= 0) acikPencereler.splice(i, 1);
  }

  let onaySonuc = null;
  function onayla(baslik, mesajHtml, evetYazi, hayirYazi) {
    $('#onayBaslik').textContent = baslik;
    $('#onayMesaj').innerHTML = mesajHtml;
    $('#onayEvet').textContent = evetYazi || 'Tamam';
    $('#onayHayir').hidden = !hayirYazi;
    $('#onayHayir').textContent = hayirYazi || '';
    pencereAc($('#dlgOnay'));
    $('#onayEvet').focus();
    return new Promise(res => { onaySonuc = res; });
  }
  function onayKapat(sonuc) {
    pencereKapat($('#dlgOnay'));
    const f = onaySonuc;
    onaySonuc = null;
    if (f) f(sonuc);
  }
  const bilgi = (baslik, html) => onayla(baslik, html, 'Tamam');

  let toastZaman = null;
  function toast(mesaj) {
    const t = $('#toast');
    t.textContent = mesaj;
    t.classList.add('show');
    try { if (t.showPopover && !t.matches(':popover-open')) t.showPopover(); } catch (e) { /* yok say */ }
    clearTimeout(toastZaman);
    toastZaman = setTimeout(() => {
      t.classList.remove('show');
      try { if (t.hidePopover) t.hidePopover(); } catch (e) { /* yok say */ }
    }, 2600);
  }

  // ===================================================================
  // Excel'den aktarma (Android uygulamasında diğer programların verileri buradan gelir)
  //   Markalar programı dışa aktarımı:  "Markalar" sayfası  (Marka İsmi, Durumu)
  //   Ürünler programı dışa aktarımı:   "Ürünler" sayfası   (Kategori, Ürün)
  //   Cari listesi: Cari Kodu, Cari İsmi, Adres, İlçe/Semt, İl, Telefon
  // ===================================================================
  let xlsxYukleniyor = null;
  function xlsxYukle() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxYukleniyor) {
      xlsxYukleniyor = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'vendor/xlsx.full.min.js';
        s.onload = res;
        s.onerror = () => { xlsxYukleniyor = null; rej(new Error('Excel okuma kütüphanesi yüklenemedi.')); };
        document.head.appendChild(s);
      });
    }
    return xlsxYukleniyor;
  }
  const hucre = v => bosluk(v instanceof Date ? v.toLocaleDateString('tr-TR') : v);
  const baslikAnahtar = s => fold(hucre(s)).replace(/[^a-z0-9]/g, '');

  async function excelAktar(file) {
    let wb;
    try {
      await xlsxYukle();
      wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    } catch (e) {
      bilgi('Dosya Okunamadı', '<p>Seçilen dosya Excel dosyası olarak okunamadı.</p>');
      return;
    }
    const sayfa = ad => {
      const n = wb.SheetNames.find(x => fold(x) === fold(ad));
      return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) : null;
    };
    const aktarilan = oku(KEY_AKTARILAN) || {};
    const yapilan = [];

    // Markalar
    const mS = sayfa('Markalar');
    if (mS) {
      const bas = mS.length && baslikAnahtar(mS[0][0]).startsWith('marka') ? 1 : 0;
      const gorulen = new Set(), liste = [];
      mS.slice(bas).forEach(r => {
        const ad = hucre(r[0]);
        if (!ad || gorulen.has(fold(ad))) return;
        gorulen.add(fold(ad));
        liste.push({ id: 'x' + liste.length, ad, pasif: fold(hucre(r[1])) === 'pasif' });
      });
      aktarilan.markalar = liste;
      yapilan.push(liste.length + ' marka');
    }

    // Ürünler
    const uS = sayfa('Ürünler');
    if (uS) {
      const bas = uS.length && baslikAnahtar(uS[0][0]).startsWith('kategori') ? 1 : 0;
      const kats = [];
      let n = 0;
      uS.slice(bas).forEach(r => {
        const ka = hucre(r[0]), ua = hucre(r[1]);
        if (!ka) return;
        let k = kats.find(x => fold(x.ad) === fold(ka));
        if (!k) { k = { id: 'k' + kats.length, ad: ka, urunler: [] }; kats.push(k); }
        if (ua && !k.urunler.some(x => fold(x.ad) === fold(ua))) { k.urunler.push({ id: k.id + 'u' + k.urunler.length, ad: ua }); n++; }
      });
      aktarilan.kategoriler = kats;
      yapilan.push(kats.length + ' ürün sekmesi, ' + n + ' ürün');
    }

    // Cariler (Markalar / Ürünler sayfası olmayan dosya)
    if (!mS && !uS) {
      const satirlar = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const bas = satirlar.length && /kod|isim|unvan/.test(baslikAnahtar(satirlar[0][0]) + baslikAnahtar(satirlar[0][1])) ? 1 : 0;
      const kodlar = new Set(), liste = [];
      satirlar.slice(bas).forEach(r => {
        const kod = hucre(r[0]), isim = hucre(r[1]);
        if (!isim || (kod && kodlar.has(fold(kod)))) return;
        if (kod) kodlar.add(fold(kod));
        liste.push({ id: 'c' + liste.length, kod, isim, adres: hucre(r[2]), semt: hucre(r[3]), ilce: '', il: hucre(r[4]), tel: hucre(r[5]), tarifler: [] });
      });
      if (!liste.length) {
        bilgi('Aktarılamadı', '<p>Dosyada aktarılacak kayıt bulunamadı.</p>' + AKTAR_YARDIM);
        return;
      }
      aktarilan.cariler = liste;
      yapilan.push(liste.length + ' cari');
    }

    if (!yaz(KEY_AKTARILAN, aktarilan)) return;
    kaynakYukle();
    siparisCiz();
    bilgi('Aktarıldı', '<p>' + esc(yapilan.join(', ')) + ' aktarıldı.</p>');
  }

  const AKTAR_YARDIM = '<p>Aktarılabilen dosyalar:</p><ul>' +
    '<li><b>Markalar</b> programının Excel dışa aktarımı</li>' +
    '<li><b>Ürünler</b> programının Excel dışa aktarımı</li>' +
    '<li><b>Cari listesi</b>: Cari Kodu, Cari İsmi, Adres, İlçe/Semt, İl, Telefon sütunları</li></ul>';

  async function aktarBaslat() {
    const ok = await onayla('Excel\'den Aktar', AKTAR_YARDIM +
      '<p>Aynı türden daha önce aktarılmış liste varsa yenisiyle değiştirilir.</p>', 'Dosya Seç', 'Vazgeç');
    if (ok) $('#aktarDosya').click();
  }

  // ===================================================================
  // Olaylar
  // ===================================================================
  function olaylariBagla() {
    // Sipariş sekmeleri
    $('#sekmeler').addEventListener('click', e => {
      if (e.target.closest('[data-arti]')) { yeniSekme(); return; }
      const t = e.target.closest('[data-tasi]');
      if (t) { sekmeTasi(Number(t.dataset.tasi)); return; }
      const sek = e.target.closest('.sekme[data-id]');
      if (sek && sek.dataset.id !== durum.aktifId) {
        durum.aktifId = sek.dataset.id;
        kaydet();
        hepsiniCiz();
      }
    });

    // Cari, şoför, plaka
    $('#cariSecBtn').addEventListener('click', cariPenceresiAc);
    $('#sofor').addEventListener('input', e => { const s = aktif(); if (s) { s.sofor = e.target.value; kaydet(); } });
    $('#plaka').addEventListener('input', e => {
      const s = aktif();
      if (!s) return;
      s.plaka = e.target.value.toLocaleUpperCase('tr');
      kaydet();
    });

    // Markalar: tek satır seçilir
    $('#markaBody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      const s = aktif();
      if (!tr || !s) return;
      s.markaId = tr.dataset.id;
      kaydet();
      $('#markaBody').querySelectorAll('tr').forEach(x => {
        const on = x === tr;
        x.classList.toggle('sel', on);
        x.querySelector('input').checked = on;
      });
    });

    // Ürün sekmeleri ve ürünler
    $('#katSekmeler').addEventListener('click', e => {
      const b = e.target.closest('[data-kat]');
      const s = aktif();
      if (!b || !s || b.dataset.kat === s.katId) return;
      s.katId = b.dataset.kat;
      kaydet();
      urunCiz(s);
      $('#urunWrap').scrollTop = 0;
      const sel = $('#urunBody tr.sel');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    });
    $('#urunBody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      const s = aktif();
      if (!tr || !s) return;
      const kat = aktifKategori(s);
      if (!kat) return;
      s.urunSecili[kat.id] = tr.dataset.id;
      $('#urunBody').querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel'));
      tr.classList.add('sel');
      kaydet();
      if (ciftDokunma('u:' + tr.dataset.id)) {
        const urun = kat.urunler.find(u => u.id === tr.dataset.id);
        if (urun) sepeteAt(s, kat, urun);
      }
    });

    // Sepet: satır seçimi, adede çift dokunma, silme
    $('#sepetBody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      const s = aktif();
      if (!tr || !s) return;
      const x = s.sepet.find(y => y.id === tr.dataset.id);
      if (!x) return;
      if (e.target.closest('[data-sil]')) {
        s.sepet = s.sepet.filter(y => y !== x);
        s.sepetSecili = null;
        kaydet();
        sepetCiz(s);
        toast(x.ad + ' sepetten silindi.');
        return;
      }
      if (s.sepetSecili !== x.id) {
        s.sepetSecili = x.id;
        $('#sepetBody').querySelectorAll('tr.sel').forEach(y => y.classList.remove('sel'));
        tr.classList.add('sel');
        kaydet();
      }
      if (e.target.closest('[data-adet]') && ciftDokunma('s:' + x.id)) {
        adetSor(x.ad, x.katAd, String(x.adet), adet => {
          x.adet = adet;
          kaydet();
          sepetCiz(s, x.id);
        });
      } else if (!e.target.closest('[data-adet]')) {
        sonDokunma = { anahtar: null, zaman: 0 };
      }
    });

    // Adet penceresi: en fazla 4 hane rakam
    $('#adetInput').addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v !== e.target.value) e.target.value = v;
      $('#adetHata').textContent = '';
    });
    $('#adetForm').addEventListener('submit', e => { e.preventDefault(); adetOnayla(); });
    $('#adetIptal').addEventListener('click', () => { adetSonuc = null; pencereKapat($('#dlgAdet')); });

    // Onay penceresi
    $('#onayEvet').addEventListener('click', () => onayKapat(true));
    $('#onayHayir').addEventListener('click', () => onayKapat(false));

    // Esc ile kapanan pencereler
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', e => {
      e.preventDefault();
      geriTusu();
    }));

    // Cari seçme penceresi
    $('#cariKapat').addEventListener('click', () => pencereKapat($('#dlgCari')));
    $('#searchBox').addEventListener('click', e => {
      if (e.target === e.currentTarget || e.target.classList.contains('search-ico')) input.focus();
    });
    input.addEventListener('input', () => {
      const v = input.value;
      if (/\s/.test(v)) {
        const parcalar = v.split(/\s+/);
        const son = parcalar.pop();
        parcalar.forEach(kelimeEkle);
        input.value = son;
        chipCiz();
      }
      aramaDegisti();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        kelimeEkle(input.value);
        input.value = '';
        chipCiz();
        aramaDegisti(true);
        if (dokunmatik) input.blur();
      } else if (e.key === 'Backspace' && !input.value && arama.kelimeler.length) {
        e.preventDefault();
        input.value = arama.kelimeler.pop();
        chipCiz();
        aramaDegisti();
      }
    });
    chipsEl.addEventListener('click', e => {
      const b = e.target.closest('.chip-x');
      if (!b) return;
      arama.kelimeler.splice(Number(b.dataset.i), 1);
      chipCiz();
      aramaDegisti(true);
    });
    $('#clearAll').addEventListener('click', () => {
      arama.kelimeler = [];
      input.value = '';
      chipCiz();
      aramaDegisti(true);
      if (!dokunmatik) input.focus();
    });
    $('#sadeceTarif').addEventListener('change', e => {
      arama.sadeceTarif = e.target.checked;
      arama.limit = SAYFA;
      aramaCiz();
      $('#aramaWrap').scrollTop = 0;
    });
    $('#aramaBody').addEventListener('click', e => {
      if (e.target.closest('[data-daha]')) { arama.limit += SAYFA; aramaCiz(); return; }
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      if (tr.dataset.id !== arama.seciliId) {
        arama.seciliId = tr.dataset.id;
        $('#aramaBody').querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel'));
        tr.classList.add('sel');
      }
      if (ciftDokunma('c:' + tr.dataset.id)) cariSec(tr.dataset.id);
    });
    if (DAR.addEventListener) DAR.addEventListener('change', () => { if ($('#dlgCari').open) aramaCiz(); });

    // Excel'den aktar
    $('#aktarBtn').addEventListener('click', aktarBaslat);
    $('#aktarDosya').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) excelAktar(f);
    });

    // Diğer programlarda yapılan değişiklikler (web): başka sekmede kaydedilince ya da bu sayfaya dönülünce
    window.addEventListener('storage', e => {
      if ([KEY_CARI, KEY_MARKA, KEY_URUN, KEY_AKTARILAN].includes(e.key)) { kaynakYukle(); siparisCiz(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { tarihYaz(); yenile(); }
    });

    // Android geri tuşu
    const App = NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App) App.addListener('backButton', geriTusu);
  }

  async function geriTusu() {
    const d = acikPencereler[acikPencereler.length - 1];
    if (d) {
      if (d.id === 'dlgOnay') onayKapat(false);
      else { if (d.id === 'dlgAdet') adetSonuc = null; pencereKapat(d); }
      return;
    }
    if (!NATIVE) return;
    const ok = await onayla('Çıkış', '<p>Uygulamadan çıkılsın mı?</p>', 'Çık', 'Vazgeç');
    if (ok) window.Capacitor.Plugins.App.exitApp();
  }

  function tarihYaz() {
    const d = new Date();
    $('#tarih').textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function baslat() {
    tarihYaz();
    if (!NATIVE) $('#apkLink').hidden = false;
    kaynakYukle();
    olaylariBagla();
    hepsiniCiz();
    if (NATIVE) yenile();
  }
  baslat();
})();
