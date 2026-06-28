# Khan — Kişisel CLI Asistan

Khan, markdown tabanlı bir **kişisel knowledge base** üzerinden çalışan, terminalden
kullanılan bir asistandır. "Beyin" olarak Claude'u, **Claude Code (`claude -p`)**
üzerinden kullanır — yani Claude Pro/Max aboneliğinle çalışır, ayrı API kredisi
gerektirmez.

> Detaylı tasarım, alınan kararlar ve dosya yapısı için tek kaynak:
> [`personal-agent-spec.md`](personal-agent-spec.md).

## Mimari (kısaca)

- **Beyin** (`core/agent.ts`): sorgu akışını yönetir — önce `knowledge/index.md`'yi
  okur, soruya göre ilgili 1-3 dosyayı seçer, `claude -p`'yi çağırır, gerekirse
  knowledge base'i günceller. Tüm knowledge base asla tek seferde yüklenmez.
- **CLI** (`cli.ts`): sadece bir arayüz. Beyin modülünü çağırır. (Faz 2'de WhatsApp,
  Faz 3'te Siri/Telegram aynı beyni çağıracak.)
- **Knowledge base** (`knowledge/`): değişim hızına göre klasörlenmiş markdown
  dosyaları (`core/`, `life/`, `work/`, `travel/`, `tasks/`, `log/`).

## Kurulum

```bash
# 1. Bağımlılıklar
npm install

# 2. Ortam değişkenleri
cp .env.example .env        # gerekirse düzenle (abonelikte anahtar gerekmez)

# 3. Claude Code aboneliğinle giriş (bir kez)
claude            # açılınca Pro/Max hesabınla giriş yap, sonra çık

# 4. Knowledge base'i doldur (interaktif soru-cevap)
npm run onboard
```

## Günlük Kullanım

```bash
npm run agent -- "bugün ne var"
npm run agent -- "X projesinin son durumu ne"
npm run agent -- "yarın 14:00 diş hekimi randevum var, not al"
npm run agent -- onboard --section work   # tek bölümü yeniden doldur
```

> İstersen `npm link` ile global `agent` komutu kurabilirsin (build sonrası).

## Repo / Senkronizasyon Stratejisi

Bu repo **temiz motoru** içerir — kişisel veri **içermez**:

- `knowledge/**/*.md` ve `index.md` **gitignore'lu** → senin verin asla commit edilmez.
- Sadece `.example.md` şablonları ve klasör iskeleti repoda durur.
- `.env` (sırlar) asla commit edilmez.

**Başkasına vermek:** repo zaten temiz; klonlar → `npm install` → `npm run onboard`.

**Kendi beynini başka cihaza taşımak:** `knowledge/` klasörünü manuel yedekle
(zip / iCloud / ayrı private repo) ve diğer cihaza kopyala.

## Güvenlik Notu

- API anahtarları/sırlar yalnızca `.env`'de; repoya girmez.
- Kişisel knowledge base (kimlik, iş, sağlık notları) gitignore ile korunur.
- Faz 3 (mobil/Siri, ağ erişimi) öncesinde güvenlik ayrıca konuşulacak
  (bkz. spec'in Faz 3 güvenlik notu).
