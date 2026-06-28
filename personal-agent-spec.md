# Personal Agent (Khan) — Proje Spesifikasyonu

Bu, projenin **tek otoriter dokümanıdır**: hem tasarımı hem mevcut implementasyonu
yansıtır. Sistemi sıfırdan kurmak için Bölüm 12'deki talimat verilebilir.

## Kurulum Durumu (2026-06-28)
- ✅ **Faz 1 motoru kurulu ve test edildi**: beyin (`core/agent.ts`), CLI (`cli.ts`),
  onboarding (`core/onboarding.ts`), index üreticisi (`scripts/build-index.ts`),
  Khan system prompt (`prompts/khan-system.md`). **Claude Pro aboneliğiyle** (`claude -p`)
  çalışıyor — ham API kredisi kullanmaz (bkz. Bölüm 8 Çalışma Kanalı).
- ⏳ **Yapılacak**: Google Calendar MCP entegrasyonu (`core/calendar.ts` + OAuth
  kurulum yönlendirmesi — Bölüm 7).
- Repo: `github.com/bedselvi/minding-shape` — temiz motor; kişisel veri (`knowledge/`)
  gitignore'lu, repoya gitmez (bkz. Bölüm 8 Repo Stratejisi).

## 1. Amaç

Local'de çalışan, terminalden (Claude Code CLI) sorgulanan kişisel bir agent.
Agent şunları bilecek:

- Takvimim (Google Calendar)
- Seyahatlerim (uçuşlar, oteller, geziler)
- Evim / yaşadığım yer ile ilgili sabit bilgiler
- Üzerinde çalıştığım projeler
- Task/todo listem
- Felsefem, karakterim, düşünce tarzım, tercihlerim

Tek bir komutla ("şu an ne yapıyoruz", "bugün ne var", "X projesinin durumu ne")
soru sorduğumda, agent ilgili md dosyalarından **düşük token maliyetiyle**
doğru context'i çekip cevap verecek. Konuştukça kendi kendine knowledge base'i
güncelleyecek (data flywheel).

Referans aldığım sistem: https://github.com/meanllbrl/dreamcontext — ama o
kadar complex olmasın. Hook'lar, sleep cycle, council, dashboard gibi şeyler
YOK. Sadece: iyi organize edilmiş md dosyaları + bunları okuyup yazan basit
bir CLI agent + Google Calendar MCP.

## 2. Faz Ayrımı

**FAZ 1 (şimdi kurulacak):**
- Local CLI agent (Claude Code projesi olarak)
- Knowledge base dosya yapısı + onboarding
- Google Calendar MCP entegrasyonu
- Otomatik öğrenme (konuşma sırasında knowledge base güncellenmesi)

**FAZ 2 (sonra, bu kurulumda yapılmayacak ama mimari buna izin vermeli):**
- WhatsApp üzerinden agent'a mesaj atabilme (örn. WhatsApp Business API / Twilio
  ya da bir MCP WhatsApp connector ile)
- Mobil arayüz (muhtemelen WhatsApp arayüzü üzerinden, ayrı bir app yazmaya
  gerek kalmadan)

**FAZ 3 — Sesli Mobil Asistan (Siri / Telegram):**

Hedef: telefondan sesli komut verip cevabı sesli almak, tıpkı bir voice assistant gibi.

**Yol A — Siri Shortcuts (iOS native):**
1. `core/agent.*` üzerine hafif bir HTTP server wrapper yazılır (Express/FastAPI,
   ~50 satır) — `POST /query` endpoint'i agent beynini çağırır, JSON döner.
2. Cloudflare Tunnel (ücretsiz, hesap gerekmez) ya da ngrok ile local server
   dışarıya açılır; böylece telefon ve bilgisayar aynı ağda olmak zorunda kalmaz.
3. iOS Shortcuts'ta bir shortcut oluşturulur:
   - "Siri, agent'ı aç" → mic input açılır, Siri sesi metne çevirir
   - Shortcut, metni `POST /query` ile server'a gönderir
   - Cevap JSON olarak döner, Shortcuts "Speak Text" ile sesli okur
4. Siri ile tetiklenebilir ya da Ana Ekran widget'ı olarak eklenebilir.

**Yol B — Telegram Bot (daha esnek, cross-platform):**
1. Telegram Bot API üzerinden bir bot oluşturulur (BotFather, ücretsiz).
2. Bot webhook'u agent HTTP server'ına bağlanır.
3. Telegram'dan sesli mesaj gönderilebilir (Telegram otomatik transcribe eder)
   ya da yazılı komut verilebilir; cevap bot üzerinden gelir.
4. Android + iOS + masaüstü çalışır; ek Cloudflare Tunnel gerekmez (Telegram
   long-polling ile de çalışır).

**Mimari notu:** Her iki yol da Faz 1 mimarisindeki HTTP server wrapper'ı
ortak kullanır — agent mantığı yeniden yazılmaz, sadece yeni bir "giriş
noktası" eklenir (CLI + WhatsApp + Siri/Telegram hepsi aynı `core/agent.*`'ı çağırır).

**!! GÜVENLİK NOTU (Faz 3 başlamadan önce mutlaka konuşulacak):**
Knowledge base kişisel ve hassas bilgiler içeriyor (kimlik, insanlar, seyahat,
sağlık, projeler). Server internete açılır açılmaz bu veriler risk altına girer.
Faz 3'e geçmeden önce şu konuları ayrıca ele almak gerekiyor:
- Auth: endpoint'e token/secret olmadan erişim açık olmamalı
- Tunnel güvenliği: Cloudflare/ngrok tunnel'ının ne kadar güvenli olduğu
- Hangi bilgilerin ağ üzerinden hiç geçmemesi gerektiği (hassas veri sınıflandırması)
- Telegram botu seçilirse: bot token'ının güvenliği, mesaj şifrelemesi
- Alternatif: tüm bunlar yerine sadece local network'te (VPN ile erişim) tutmak

Faz 1'i kurarken mimariyi şuna göre tasarla: agent'ın "beyni" (knowledge base +
query mantığı) bir Python/Node modülü/fonksiyon seti olarak ayrılsın, CLI sadece
bunun bir arayüzü olsun. Böylece Faz 2'de WhatsApp webhook'u aynı "beyni" çağırabilsin,
agent mantığını ikinci kez yazmaya gerek kalmasın.

## 3. Knowledge Base Yapısı

Bilgiyi **değişim hızına göre** klasörle. Bu, hem context'i organize eder hem de
sorgu sırasında "hangi dosyaları okumam gerekiyor" kararını basitleştirir
(düşük token kullanımı için kritik).

```
knowledge/
├── core/
│   ├── identity.md          # Kim olduğum, felsefem, karakterim, kafa yapım,
│   │                        # değerlerim, iletişim tarzım. NADİREN değişir.
│   ├── preferences.md       # Genel tercihlerim (yemek, çalışma saatleri,
│   │                        # iletişim tonu, agent'ın bana nasıl davranması
│   │                        # gerektiği). Yavaş değişir.
│   └── people.md            # Hayatımdaki önemli insanlar (aile, yakın
│                             # arkadaşlar, iş ortakları) — kim oldukları,
│                             # bana göre ilişkileri. Yavaş değişir.
│
├── life/
│   ├── home.md               # Yaşadığım yer, ev düzeni, sabit lojistik
│   │                          # bilgiler (adres, vs.). Sabit.
│   ├── routines.md           # Günlük/haftalık rutinlerim. Yavaş değişir.
│   └── health.md             # (opsiyonel) Sağlıkla ilgili sabit notlar —
│                              # sadece ben isteyip eklersem dolar, agent
│                              # kendiliğinden tıbbi çıkarım yapmaz.
│
├── work/
│   ├── projects/
│   │   ├── <proje-adı>.md    # Her aktif proje için ayrı dosya: ne olduğu,
│   │   │                     # durumu, önemli kararlar, sonraki adımlar.
│   │   └── _archive/         # Bitmiş/donmuş projeler buraya taşınır.
│   └── work-context.md       # Genel iş bağlamı (şirket, rol, çalışma şekli).
│
├── travel/
│   ├── upcoming.md            # Planlanan/yaklaşan seyahatler — uçuş, otel,
│   │                          # tarih. SIK değişir, kısa ömürlü bilgi.
│   └── preferences.md        # Seyahat tercihlerim (koltuk, otel tipi, vs.)
│                              # — yavaş değişir.
│
├── tasks/
│   ├── todos.md               # Aktif todo listesi. SÜREKLİ değişir.
│   └── done-log.md           # Tamamlanan task'ların kısa log'u (opsiyonel,
│                              # haftalık/aylık özetlenip arşivlenebilir).
│
└── log/
    └── YYYY-MM.md             # Aylık otomatik öğrenme günlüğü: agent'ın
                                # konuşmalardan çıkardığı, henüz ilgili
                                # dosyaya "terfi ettirmediği" ham notlar.
```

**Neden bu yapı:**
- `core/` ve `life/` → uzun dönem sabit, her sorguda mutlaka okunabilir
  (küçük dosyalar, maliyeti düşük).
- `work/projects/` → proje bazlı sorgularda SADECE ilgili proje dosyası okunur,
  diğerleri okunmaz.
- `travel/upcoming.md` ve `tasks/todos.md` → en sık değişen, "şu an ne
  oluyor" sorularında öncelikli okunacak dosyalar.
- `log/` → agent'ın emin olmadığı / henüz kategorize etmediği bilgi burada
  birikir, zamanla core dosyalara "terfi" eder (manuel ya da agent onayıyla).

Her md dosyasının başında kısa bir frontmatter olsun:

```yaml
---
updated: 2026-06-21
volatility: low   # low | medium | high
summary: "Bir-iki satır özet — index için kullanılır"
---
```

`volatility` alanı, agent'ın "bu dosya muhtemelen güncel mi, yeniden teyit
etmeli miyim" kararını vermesine yardımcı olur.

## 4. Index Dosyası

`knowledge/index.md` — tüm dosyaların listesi + her birinin `summary` ve
`volatility` bilgisinin otomatik derlendiği bir özet dosya. Agent her sorguda
önce bunu okur (küçük, ~1-2k token), sonra sorguya göre hangi dosyalara
gideceğine karar verir. Bu dosya elle değil, script ile otomatik üretilir
(`scripts/build-index.ts`) — her knowledge base güncellemesinde (ve onboarding/
sorgu sonrası otomatik) yeniden derlenir. `index.md` gitignore'ludur (üretilen, kişisel).

## 5. Sorgu Akışı (Query Flow)

Kullanıcı bir soru sorduğunda:

1. `knowledge/index.md` okunur (ucuz, her zaman).
2. Soru tipine göre ilgili dosyalar seçilir:
   - "bugün ne var / şu an ne yapıyoruz" → `tasks/todos.md` + Google Calendar
     (bugün/bu hafta) + `travel/upcoming.md` (varsa)
   - "X projesi nasıl gidiyor" → `work/projects/X.md`
   - Karakter/tercih/felsefe ile ilgili sorular → `core/identity.md` +
     `core/preferences.md`
   - Belirsizse → index'teki summary'lere göre en alakalı 1-3 dosya seçilir
3. Sadece seçilen dosyalar + (gerekirse) calendar API çağrısı context'e
   eklenir. Tüm knowledge base ASLA tek seferde yüklenmez.
4. Cevap verilir.
5. Konuşmadan yeni/güncel bir bilgi çıkarsa (örn. "yarın uçuşum değişti",
   "X projesini bitirdim"), agent bunu otomatik olarak ilgili dosyaya (veya
   belirsizse `log/YYYY-MM.md`'ye) yazar ve `index.md`'yi günceller.
   Kullanıcıya ne yazdığını kısaca bildirir (örn. "✓ travel/upcoming.md
   güncellendi").

## 6. Onboarding Akışı

İlk çalıştırmada (`knowledge/` boşsa) agent terminalden sırayla soru sorarak
base'i oluşturur. Tek seferde her şeyi sormaz, kategorilere böler:

1. **Kimlik & felsefe**: "Kendini nasıl tanımlarsın, sana nasıl hitap
   edeyim, hangi konularda nasıl bir tonla konuşmamı istersin, hayata/işe
   bakışını özetler misin?" → `core/identity.md`
2. **Tercihler**: çalışma saatleri, iletişim tarzı, agent'tan ne beklediği
   → `core/preferences.md`
3. **Yaşam**: yaşadığı yer, temel rutin → `life/home.md`, `life/routines.md`
4. **İş/Projeler**: şu an aktif olan projeler, her biri için kısa açıklama →
   `work/projects/*.md` (her proje ayrı dosya)
5. **Seyahat**: yaklaşan seyahat var mı, genel seyahat tercihleri →
   `travel/upcoming.md`, `travel/preferences.md`
6. **Calendar bağlantısı**: Google Calendar MCP kurulum adımlarını
   yönlendirir (bkz. Bölüm 7).
7. **Görevler**: şu anki açık todo'lar → `tasks/todos.md`

Onboarding script'i tamamlandığında `knowledge/index.md`'yi otomatik üretir.
Onboarding her zaman tekrar çalıştırılabilir olmalı (`agent onboard --section
work` gibi, sadece tek bir bölümü yeniden sormak için).

## 7. Google Calendar MCP

- Resmi/topluluk Google Calendar MCP server'ı kullanılacak (Claude Code'un
  MCP desteğiyle `claude mcp add` üzerinden bağlanacak).
- Claude Code, kurulum sırasında uygun bir Google Calendar MCP server'ı
  bulup (npm/pypi üzerinde güncel olanı araştırarak) kurulum adımlarını
  (OAuth, credentials.json, vs.) bana adım adım anlatacak — credential'ları
  ben kendim gireceğim, agent benim yerime Google hesabıma girmeyecek.
- Agent calendar'a sadece **okuma** erişimiyle başlasın (read-only scope).
  Yazma (etkinlik oluşturma/silme) ileride ayrı bir onayla açılabilir,
  varsayılan kapalı.
- Sorgu akışında calendar'dan "bugün", "bu hafta", "yaklaşan N gün" gibi
  dar aralıklarla veri çekilsin — tüm takvimi taramak yok.

## 8. Teknik Tercihler & Çalışma Kanalı

### Dil / Teknoloji
- **Node / TypeScript** (kesinleşti) — MCP client ekosistemi Node'da daha olgun.
- `tsx` ile çalışır (zorunlu derleme yok). Komutlar `npm run ...` üzerinden.

### Çalışma kanalı — abonelik (KRİTİK)
- Agent'ın "beyni" ham Anthropic API'yi **DEĞİL**, **Claude Code'u (`claude -p`)** çağırır.
- **Neden:** kullanıcı **Claude Pro/Max aboneliği** kullanıyor. Ham API
  (`@anthropic-ai/sdk`) aboneliğe dahil değildir, ayrı kredi ister → sürpriz fatura.
  `claude -p` wrapper'ı aboneliği kullanır, **ekstra ücret yoktur.**
- **Teknik:** `core/agent.ts`, `claude` launcher'ının çağırdığı `cli.js`'i bulup
  `node cli.js -p <soru> --append-system-prompt <khan-prompt> --model <model>
  --permission-mode acceptEdits` olarak çalıştırır (Windows `.cmd` ve arg kaçış
  sorunlarını atlar).
- **`--bare` KULLANILMAZ** — o mod sadece `ANTHROPIC_API_KEY` ile çalışır, abonelik
  (OAuth) auth'unu okumaz.
- (Alternatif: ileride daha fazla programatik kontrol gerekirse Claude Agent SDK;
  o da abonelik auth'unu kullanır.)

### Model
- Varsayılan: hızlı model (Sonnet/Haiku); `KHAN_MODEL` env ile ayarlanır.
- Opus sadece açıkça istenince (`agent --opus "..."`).
- Abonelikte token başına ödeme yok; model seçimi *maliyet* değil *hız / kullanım-limiti* meselesi.

### Repo, Gizlilik & Paylaşım Stratejisi (paylaşım için kritik)
- Repo **temiz motoru** tutar; **kişisel veri içermez** — başkasına olduğu gibi verilebilir.
- `knowledge/**/*.md` ve `knowledge/index.md` **gitignore'lu** → kullanıcının verisi
  asla commit edilmez (yanlışlıkla bile — yapısal garanti).
- Repoda sadece `.example.md` şablonları + klasör iskeleti (`.gitkeep`) izlenir.
- `.env` (sırlar) ve `.claude/settings.local.json` (yerel ayarlar) da gitignore'lu.
- **Başkasına verme:** klonla → `npm install` → `npm run onboard` (kendi beynini doldurur).
- **Kendi beynini başka cihaza taşıma:** `knowledge/` klasörünü manuel yedekle/kopyala
  (zip / iCloud / ayrı private repo) — bu repoya push DEĞİL.

### Diğer
- Tamamen **local**, cloud deploy YOK.
- **Veritabanı YOK** — her şey düz `.md` (git ile versiyonlanabilir, elle düzenlenebilir).
- **Vektör DB / embedding YOK** — index dosyası + dosya seçimi yeterli. Dosya sayısı
  çok artarsa basit bir keyword-match script eklenebilir; başta gerek yok.

## 9. Proje Dosya Yapısı (Faz 1 — kurulu)

```
minding-shape/                  # repo (app adı: Khan)
├── knowledge/                  # Bölüm 3'teki yapı — GERÇEK .md DOSYALARI GITIGNORE'LU
│   ├── index.md                # üretilir (gitignore)
│   ├── *.example.md            # her dosya için şablon (repoda izlenir)
│   ├── core/  life/  work/  travel/  tasks/  log/
├── prompts/
│   ├── khan-system.md          # Khan persona + query flow (system prompt)
│   └── khan-onboarding.md      # onboarding röportaj talimatı
├── core/
│   ├── agent.ts                # "Beyin": spawnClaude / runQuery (claude -p wrapper).
│   │                           # Faz 2/3'te WhatsApp/Siri handler'ı da bunu çağıracak.
│   ├── onboarding.ts           # interaktif kurulum (Claude-yönetimli röportaj)
│   └── calendar.ts             # Google Calendar MCP wrapper  ⏳ YAPILACAK
├── cli.ts                      # Terminal giriş noktası (query / onboard / build-index / consolidate)
├── scripts/
│   └── build-index.ts          # index.md'yi knowledge/ frontmatter'ından üretir
├── .claude/                    # Claude Code ayarları (settings.local.json gitignore)
├── .env.example                # şablon (.env gitignore — abonelikte anahtar gerekmez)
├── .gitignore  .gitattributes
├── package.json  package-lock.json  tsconfig.json
└── README.md                   # Kurulum + günlük kullanım
```

> **Not:** `knowledge/` altındaki gerçek `.md` dosyaları ve `index.md` gitignore'ludur;
> repoda sadece `.example.md` şablonları ve `.gitkeep`'ler durur (bkz. Bölüm 8 Repo Stratejisi).

## 10. Günlük Kullanım

```bash
npm run agent -- "bugün ne var"
npm run agent -- "X projesinin son durumu ne"
npm run agent -- "yarın 14:00 diş hekimi randevum var, not al"
npm run agent -- --opus "şu kararı derinlemesine analiz et"   # Opus modeli
npm run onboard                       # knowledge base'i interaktif doldur
npm run onboard -- --section work     # sadece bir bölümü yeniden doldur
npm run build-index                   # index.md'yi yeniden üret
npm run agent -- consolidate          # log/ ham notlarını core dosyalara terfi et
```

`agent` komutu, Claude Code'u (`claude -p`) önceden tanımlı **Khan system prompt**
(`prompts/khan-system.md`) + Bölüm 5 query flow ile çalıştıran ince bir wrapper'dır
(bkz. Bölüm 8 Çalışma Kanalı). İleride global `agent` komutu için `npm link` kullanılabilir.

**`agent consolidate`** (manuel, haftalık çalıştırılabilir): `log/YYYY-MM.md`'deki ham
notları ilgili core/life/work dosyalarına terfi ettirir, taşınanları log'dan temizler,
index'i günceller ve kısaca raporlar. Otomatik arka plan döngüsü DEĞİL (bkz. Bölüm 11).

## 11. Yapılmaması Gerekenler

- Karmaşık hook sistemi, **otomatik/arka plan** sleep/consolidation cycle,
  multi-agent council gibi dreamcontext'teki ileri seviye mekanizmalar — bunlara gerek yok.
  (NOT: **manuel** `agent consolidate` komutu DAHİLDİR — bu bir arka plan döngüsü değil,
  kullanıcının elle tetiklediği tek seferlik terfi işlemidir; boşuna kredi/kullanım yakmaz.)
- Vektör veritabanı / embedding pipeline'ı kurmaya gerek yok.
- Sağlık verisiyle ilgili otomatik çıkarım/tavsiye agent'ın işi değil; sadece
  kullanıcının açıkça yazdığını not alır.
- Faz 1'de WhatsApp/mobil entegrasyonuna hiç dokunulmayacak — sadece mimari
  buna izin verecek şekilde (agent mantığı CLI'dan ayrık) kurulacak.

## 12. Claude Code'a Talimat (sıfırdan kurmak / başkasına vermek için)

> Faz 1 motoru zaten kurulu (bkz. Kurulum Durumu). Aşağıdaki talimat, sistemi
> **sıfırdan yeniden kurmak** ya da temiz haliyle başka birine vermek için referanstır.

> Bu spec'i oku ve bu yapıya göre projeyi sıfırdan kur. Önce dosya/klasör
> iskeletini oluştur, sonra "beyin" modülünü (core/agent.*) yaz, sonra
> onboarding script'ini yaz ve çalıştır (benimle terminalden soru-cevap
> yaparak knowledge/ klasörünü doldur), sonra Google Calendar MCP kurulumu
> için bana adım adım talimat ver. Her adımdan sonra ne yaptığını kısaca
> özetle, büyük mimari kararları (dil seçimi, MCP server seçimi gibi) bana
> sormadan önce önerini söyle ve onay al.
