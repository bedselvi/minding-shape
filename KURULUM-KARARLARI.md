# Personal Agent (Khan) — Kurulum Kararları & Durum

> Bu dosya, projeye başlamadan önce alınan kararları ve mevcut durumu kaydeder.
> Claude Code'a "başla" dediğinde bu dosyayı + `personal-agent-spec.md`'yi referans alır.

## Durum
- **2026-06-21:** Kurulum HENÜZ başlamadı. Önce maliyet değerlendirildi, kullanıcı "şimdilik bekle" dedi.
- **2026-06-28:** Kuruluma BAŞLANDI. İki önemli karar netleşti (aşağıda): (1) çalışma kanalı abonelik üzerinden `claude -p` wrapper, (2) repo stratejisi = tek motor repo + kişisel veri gitignore'lu. İskelet kuruluyor.

## Alınan Kararlar

### Dil / Teknoloji
- **Node / TypeScript.** Neden: MCP client ekosistemi Node'da daha olgun; spec de bunu öneriyor.

### Çalışma kanalı — DÜZELTME (2026-06-28)
- **Karar: Ham Anthropic API DEĞİL — `claude` CLI wrapper (`claude -p`) kullanılacak.**
- **Neden:** Kullanıcı **Claude Pro aboneliği** kullanıyor, kredi/API bazlı değil. Ham API (`@anthropic-ai/sdk`) aboneliğe DAHİL değildir, ayrı kredi ister → sürpriz fatura riski. `agent` komutu, Claude Code'u (`claude -p`) önceden tanımlı bir system prompt ile çağıran ince bir wrapper olur. Bu, kullanıcının zaten kullandığı Claude Code olduğu için aboneliğe dahildir.
- **Spec uyumu:** Spec Bölüm 10 zaten bunu öngörmüş ("agent = Claude Code wrapper, `claude -p` veya Agent SDK"). Yani bu bir sapma değil, doğrulama.
- **Alternatif (ileride):** Daha fazla programatik kontrol gerekirse Claude Agent SDK'ya geçilebilir; o da abonelik auth'unu kullanır.
- **Bağımlılık:** `@anthropic-ai/sdk` GEREKMİYOR. Sadece Node + TypeScript (tsx) + ince bir CLI.

### Model seçimi (abonelik bağlamında)
- Abonelikte **token başına ödeme yok** — Sonnet/Haiku dinamik seçimi artık *maliyet* değil *hız/kullanım-limiti* meselesi.
- Varsayılan: `claude -p` çağrısında hızlı bir model (Sonnet/Haiku) kullanılır; Opus SADECE kullanıcı açıkça isterse (`agent --opus "..."`).
- Tek gerçek sınır: Pro aboneliğinin periyodik kullanım limitleri (günde ~10 sorgu için fazlasıyla yeterli).

### Maliyet tahmini (referans — ham API yolu seçilseydi)
> NOT: Aşağıdaki rakamlar HAM API yolu içindi. Abonelik kullanıldığı için bunlar ARTIK GEÇERLİ DEĞİL; ekstra ücret yok. Sadece tarihsel referans olarak duruyor.
- Güncel API fiyatları (1M token): Opus 4.8 $5/$25, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5.
- Aylık ~$4–15 (ham API senaryosu). **Abonelikte: $0 ek.**
- Düşük token kullanımının mantığı geçerliliğini koruyor: her sorguda önce küçük `index.md`, sonra SADECE ilgili 1-3 dosya — tüm knowledge base asla yüklenmez (kullanım limitlerini korur).

## Context / Kredi Yönetimi Yaklaşımı (spec'le uyumlu)
- **Otomatik/arka plan sleep cycle YOK** (spec Bölüm 11 bunu açıkça istemiyor — kredi yakan döngü olmayacak).
- Bunun yerine context sıkışması şu mekanizmalarla önlenir:
  1. Her `agent "..."` çağrısı **kısa ömürlü, bağımsız bir process** — context chat gibi birikmez.
  2. Sorgu akışı: index → ilgili dosya seçimi → sadece o dosyalar yüklenir.
  3. Calendar'dan dar aralık çekilir (bugün / bu hafta), tüm takvim taranmaz.
  4. Konuşmadan çıkan yeni bilgi `log/YYYY-AA.md`'ye yazılır; zamanla core dosyalara "terfi" eder.

### `agent consolidate` komutu (DAHİL EDİLECEK — karar verildi)
Manuel çalıştırılan hafif bir "consolidation" komutu kurulacak. Yaptığı iş:
- `log/YYYY-AA.md`'deki ham notları ilgili core/life/work dosyalarına taşır (terfi),
- taşınanları log'dan temizler,
- `index.md`'yi yeniden derler,
- ne yaptığını kısaca raporlar (örn. "✓ 3 not core/identity.md'ye taşındı").
**Tetikleme:** manuel (`agent consolidate`) — kullanıcı haftada bir çalıştırır. Otomatik arka plan döngüsü DEĞİL, o yüzden boşuna kredi yakmaz. (İleride istenirse basit bir cron'a bağlanabilir.)
**Model:** bu iş için Haiku/Sonnet yeter; Opus gerekmez.

## Repo / Senkronizasyon Stratejisi (2026-06-28 — karar verildi)
**Hedef:** Sistemi başkalarına da verebilmek (temiz "motor") + kendi beynini ayrı taşıyabilmek.

**Karar: Tek "motor" repo + kişisel veri gitignore'lu.**
- Repo, **kodu + boş beyin iskeletini + `.example.md` şablonlarını** tutar. Public yapılabilir hale gelir.
- **Gerçek kişisel veri (`knowledge/**/*.md`, `index.md`) ASLA commit edilmez** — `.gitignore` ile dışarıda tutulur. Sadece `.example.md` şablonları ve `.gitkeep`'ler izlenir.
- **API anahtarı / sırlar (`.env`)** hiçbir koşulda repoya girmez.
- **Başkasına verme:** repo zaten temiz; klonlar → `npm install` → `agent onboard` → kendi beynini doldurur.
- **Kendi beynini taşıma:** `knowledge/` klasörünü manuel (zip / iCloud) veya ayrı bir private repo ile yedekler, diğer cihaza kopyalar. Manuel aktarım kullanıcı için yeterli (kabul edildi).
- **Yeni cihaz kurulumu:** `git clone` → `npm install` → `cp .env.example .env` (anahtarı gir) → `agent onboard` veya yedek beyni kopyala.

## Sonraki Adım
Kullanıcı "başla" dediğinde spec sırası: iskelet → `core/agent.ts` (beyin) → onboarding (interaktif) → Calendar MCP kurulum yönlendirmesi. Büyük mimari kararlarda önce öneri + onay.
