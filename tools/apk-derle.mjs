// Android APK'yı bu bilgisayarda derler ve imzalar, sonra site/apk/ içine koyar.
// Kullanım:  npm run apk
// Gerekenler: Android Studio (JDK + Android SDK) ve keystore/ klasöründeki imza anahtarı.
// İmza anahtarı (keystore/) asla GitHub'a gönderilmez; kaybedilirse yeni sürümler eskisinin
// üzerine kurulamaz (önce kaldırmak gerekir ve telefondaki veriler silinir) — yedekleyin!
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const kok = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const surumDosyasi = join(kok, 'site/apk/surum.json');
const pencere = process.platform === 'win32';

if (!existsSync(join(kok, 'keystore/keystore.properties'))) {
  console.error('keystore/keystore.properties bulunamadı. İmza anahtarı olmadan APK güncellenemez.');
  process.exit(1);
}

const env = { ...process.env };
if (!env.JAVA_HOME) {
  const jbr = pencere ? 'C:/Program Files/Android/Android Studio/jbr' : '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  if (existsSync(jbr)) env.JAVA_HOME = jbr;
}
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || (pencere ? join(env.LOCALAPPDATA || '', 'Android/Sdk') : join(env.HOME || '', 'Library/Android/sdk'));
writeFileSync(join(kok, 'android/local.properties'), 'sdk.dir=' + sdk.split('\\').join('/') + '\n');

const eski = existsSync(surumDosyasi) ? JSON.parse(readFileSync(surumDosyasi, 'utf8')) : { kod: 0 };
const kod = (eski.kod || 0) + 1;
const ad = '1.0.' + kod;
env.SIPARIS_VERSION_CODE = String(kod);
env.SIPARIS_VERSION_NAME = ad;

const calistir = (komut, args, cwd) => {
  console.log('> ' + komut + ' ' + args.join(' '));
  const r = spawnSync(komut, args, { cwd, env, stdio: 'inherit', shell: pencere });
  if (r.status !== 0) { console.error('Hata: ' + komut + ' başarısız oldu.'); process.exit(r.status || 1); }
};

calistir('npx', ['cap', 'sync', 'android'], kok);
calistir(pencere ? '"' + join(kok, 'android', 'gradlew.bat') + '"' : './gradlew', ['assembleRelease', '--no-daemon', '-q'], join(kok, 'android'));

copyFileSync(join(kok, 'android/app/build/outputs/apk/release/app-release.apk'), join(kok, 'site/apk/siparis-hazirlama.apk'));
const tarih = new Date().toLocaleDateString('tr-TR');
writeFileSync(surumDosyasi, JSON.stringify({ kod, surum: ad, tarih }, null, 2) + '\n');
console.log(`\nTamam: site/apk/siparis-hazirlama.apk (sürüm ${ad}, ${tarih}).`);
console.log('Yayınlamak için değişiklikleri commit edip GitHub\'a gönderin (git push).');
