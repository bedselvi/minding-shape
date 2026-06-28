# Personal Agent — Proje Spesifikasyonu

Bu dosyayı Claude Code'a ver ve "bu spec'e göre projeyi kur" de. Claude Code dosya
yapısını, scriptleri, MCP bağlantılarını ve onboarding akışını bu spec'e göre
oluşturacak.

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
(`scripts/build_index.py` gibi) — her knowledge base güncellemesinde yeniden
derlenir.

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

## 8. Teknik Tercihler (Claude Code karar verebilir, ama yönlendirme)

- Dil: Python ya da Node — Claude Code projenin ihtiyacına göre seçebilir,
  ama MCP client tarafı için Node ekosistemi daha olgun olduğundan TypeScript/
  Node tercih edilebilir.
- Local çalışacak, herhangi bir cloud deploy YOK.
- Veritabanı YOK — her şey düz `.md` dosyası (git ile versiyonlanabilir,
  okunabilir, elle düzenlenebilir).
- BM25 gibi basit bir local arama (vektör DB / embedding YOK, gereksiz
  complexity) index dosyası + dosya seçimiyle zaten çözülüyor; eğer ileride
  dosya sayısı çok artarsa basit bir keyword-match yardımcı script
  eklenebilir, ama başta gerek yok.
- `.env` içinde API key'ler, `.gitignore`'a eklensin.

## 9. Proje Dosya Yapısı (Faz 1)

```
personal-agent/
├── knowledge/                  # Bölüm 3'teki yapı
│   ├── index.md
│   ├── core/
│   ├── life/
│   ├── work/
│   ├── travel/
│   ├── tasks/
│   └── log/
├── core/
│   ├── agent.ts (veya .py)     # "Beyin": sorgu akışı, dosya seçimi,
│   │                            # knowledge base okuma/yazma fonksiyonları.
│   │                            # Faz 2'de WhatsApp handler'ı da bu modülü
│   │                            # çağıracak şekilde tasarlanmalı.
│   ├── onboarding.ts (veya .py)
│   └── calendar.ts (veya .py)  # Google Calendar MCP wrapper
├── cli.ts (veya .py)           # Terminal giriş noktası
├── scripts/
│   └── build_index.ts          # index.md'yi knowledge/ içeriğinden üretir
├── .claude/
│   └── (MCP config, varsa Claude Code'un kendi ayarları)
├── .env.example
├── .gitignore
├── package.json (veya requirements.txt)
└── README.md                   # Kurulum + günlük kullanım talimatları
```

## 10. Günlük Kullanım (hedeflenen deneyim)

```bash
agent "bugün ne var"
agent "X projesinin son durumu ne"
agent "yarın saat 14'te diş hekimi randevum var, not al"
agent onboard            # ilk kurulum / knowledge base'i sıfırdan oluşturma
agent onboard --section work   # sadece bir bölümü yeniden doldurma
```

`agent` komutu basitçe Claude Code'u önceden tanımlı bir system prompt +
yukarıdaki query flow ile çalıştıran bir wrapper olsun (ya `claude` CLI'ı
`-p` / non-interactive modda çağırarak, ya da Claude Agent SDK kullanarak —
Claude Code hangisinin bu use-case için daha uygun olduğuna kendi karar
versin).

## 11. Yapılmaması Gerekenler

- Karmaşık hook sistemi, sleep/consolidation cycle, multi-agent council gibi
  dreamcontext'teki ileri seviye mekanizmalar — bunlara gerek yok.
- Vektör veritabanı / embedding pipeline'ı kurmaya gerek yok.
- Sağlık verisiyle ilgili otomatik çıkarım/tavsiye agent'ın işi değil; sadece
  kullanıcının açıkça yazdığını not alır.
- Faz 1'de WhatsApp/mobil entegrasyonuna hiç dokunulmayacak — sadece mimari
  buna izin verecek şekilde (agent mantığı CLI'dan ayrık) kurulacak.

## 12. Claude Code'a Talimat (bu spec'i verirken ekle)

> Bu spec'i oku ve bu yapıya göre projeyi sıfırdan kur. Önce dosya/klasör
> iskeletini oluştur, sonra "beyin" modülünü (core/agent.*) yaz, sonra
> onboarding script'ini yaz ve çalıştır (benimle terminalden soru-cevap
> yaparak knowledge/ klasörünü doldur), sonra Google Calendar MCP kurulumu
> için bana adım adım talimat ver. Her adımdan sonra ne yaptığını kısaca
> özetle, büyük mimari kararları (dil seçimi, MCP server seçimi gibi) bana
> sormadan önce önerini söyle ve onay al.
