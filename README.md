# Meyve Koşusu · KAPLAY

60 dakikalık 2D Agent Game Jam için **Meyve Koşusu** (endless-runner / platformer karışımı).
Motorda sadece KAPLAY 3001.x ve dahili fizik var; harici fizik kütüphanesi yok.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5173
```

Yeni asset üretmek / yeniden üretmek için:

```bash
npm run assets   # placeholder pixel-art + sfx üretir
npm run measure  # public/assets içindeki PNG'lerin boyutunu ve kare sayısını listeler
node scripts/smoke.mjs http://localhost:5199/  # headless Chrome: hata + ekran görüntüsü testi
```

## Kontroller

| Tuş | İşlev |
| --- | --- |
| `A` / `D` veya `←` / `→` | Yürü |
| `SPACE` / `↑` | Zıpla (basılı tutarsan daha yükseğe) |
| `SPACE` (menü / game over) | Başla / tekrar dene |

## Mekanikler

1. Yerçekimi + zemin çarpışması
2. Yürüme
3. Değişken yükseklikte zıplama (tuşu bırakınca yükseliş kesilir)
4. Coyote time (zeminden yeni ayrıldıysa hâlâ zıplayabilme)
5. Jump buffer (inişten hemen önce basılan zıplama kuyruğa alınır)
6. Meyve toplama + skor
7. Diken hasarı + 3 can
8. Respawn + kısa dokunulmazlık (blink)
9. Kamera takibi (yatay clamp'li)
10. Game over + yeniden başlatma

## İçerik puan listesi

Sunumda bu liste sırayla gösterilir (her satır ekranda tetiklenmeli).

### Mekanik (+3 / adet)
- [ ] Yürüme + yerçekimi + zemin
- [ ] Değişken yükseklikte zıplama
- [ ] Coyote time
- [ ] Jump buffer
- [ ] Meyve toplama + skor
- [ ] Diken hasarı + can sistemi
- [ ] Respawn + dokunulmazlık

### Animasyonlu karakter (+2 / adet)
- [ ] Ninja Frog (oyuncu) — idle / run / jump / fall

### Animasyon durumu (+1 / adet)
- [ ] `idle` (11 kare)
- [ ] `run` (12 kare)
- [ ] `jump`
- [ ] `fall`
- [ ] `hit` (asset hazır, ölüm animasyonunda kullanılacak)

### Level / sahne (+2 / adet)
- [ ] Ana level (40×10 tile, 1280 px genişlik)
- [ ] Menü sahnesi
- [ ] Game over sahnesi

### Parallax katmanı (+1 / adet, 3. katmandan itibaren)
- [ ] Gökyüzü + dağlar + bulutlar (0.50×)
- [ ] Tepeler + çalılar (0.75×)

### Juice (+1 / adet)
- [ ] Meyve toplama parçacıkları
- [ ] İniş tozu
- [ ] Ekran sarsıntısı (hasar)
- [ ] Hasar sonrası blink
- [ ] Meyve bob animasyonu

### UI (+1 / adet)
- [ ] Can göstergesi
- [ ] Skor
- [ ] Başlangıç ekranı

### Ses (+1 / 2 efekt)
- [ ] `jump`, `coin`, `hit`, `death` (4 efekt = +2)

### Twist (+3)
- [ ] 30. dakikada çekilecek kart (henüz eklenmedi)

## Dosya yapısı

```text
index.html
src/main.js            # tüm oyun
scripts/gen-assets.mjs # placeholder PNG + WAV üreteci
scripts/assets.mjs     # PNG boyut / kare sayısı ölçer
public/assets/
  frog/{idle,run,jump,fall,hit}.png
  fruits/{apple,banana,cherries,kiwi,melon,orange,pineapple,strawberry}.png
  bg/{blue,hills}.png
  {ground,dirt,platform,spike}.png
  sfx/{jump,coin,hit,death}.wav
```

`public/assets` içindeki dosyalar Pixel Adventure 1 ile **aynı isim ve kare sayısına** sahip
placeholder'lardır (idle 11, run 12, jump 1, fall 1, hit 7). Gerçek paketi indirince aynı
yollara kopyalamak yeterlidir; kod değişmez.

## Sonraki adımlar (kalan süre)

1. Gerçek Pixel Adventure tile'ları (`Terrain (16x16).png`) ile zemin/platform değişimi
2. 2. oda + anahtar/kapı veya portal
3. Çift zıplama + dash
4. Kings and Pigs domuzları (devriye + bomba atan)
5. Twist kartı (90 sn geri sayım + süre uzatan meyve)
6. Slow-mo ölüm, hit flash, kombo sayacı

## Lisans / Atıf

- Placeholder görseller ve sesler bu depoda kodla üretildi (CC0).
- Gerçek paketler eklendiğinde: Pixel Adventure 1 — Pixel Frog (ücretsiz), Kings and Pigs (CC0),
  Treasure Hunters (CC0), Sunny Land — ansimuz (ücretsiz), Kenney (CC0).
- Ses üretimi için isteğe bağlı `jsfxr` kullanılabilir.
