# Oracle Cloud'a Kurulum (backend)

Hedef: `https://api.dorukplays.com` adresinde çalışan sunucu + PostgreSQL. Her şey Docker Compose ile tek komutla kalkar.

> Bu rehberdeki komutlar ve Docker dosyaları hazırlandı, ancak gerçek bir Oracle sanal makinesinde henüz denenmedi. Oracle paneli zamanla değişebilir; bir adım farklı görünürse menü adlarını buna göre ara.

## 1. Sanal makine

1. Oracle Cloud → **Compute → Instances → Create instance**.
2. **Image:** Ubuntu 24.04 (ARM için `aarch64`). **Shape:** `VM.Standard.A1.Flex` (Always Free, 2 OCPU / 12 GB yeterli). "Out of capacity" hatası alırsan başka zamanda ya da başka availability domain ile tekrar dene.
3. **SSH anahtarı** ekle (özel anahtarını sakla). Oluşunca **genel IP**'yi not al.
4. Boş kalma riskine karşı: Oracle, kullanılmayan Always Free makineleri geri alabilir. Düzenli yedek al (aşağıda).

## 2. Ağ (iki yerde de açılmalı)

**a) Oracle panelinde:** Networking → Virtual Cloud Networks → ağın → Security Lists → Default → **Add Ingress Rules**:
- Source `0.0.0.0/0`, TCP, port **80**
- Source `0.0.0.0/0`, TCP, port **443**

**b) Makinenin içinde** (Oracle'ın Ubuntu imajı kendi güvenlik duvarını kullanır):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Docker kurulumu

```bash
ssh ubuntu@GENEL_IP
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit   # çıkıp tekrar bağlan ki grup geçerli olsun
```

## 4. DNS (Cloudflare)

Cloudflare → `dorukplays.com` → **DNS → Add record**:
- Type **A**, Name **api**, IPv4 = makinenin genel IP'si
- **Proxy status: DNS only** (gri bulut). Caddy sertifikayı kendisi alacağı için ilk kurulumda proxy kapalı olmalı.

## 5. Projeyi kur

```bash
ssh ubuntu@GENEL_IP
git clone https://github.com/GokyokusDoruk/MagicalBattle.git
cd MagicalBattle
cp .env.example .env
nano .env
```

`.env` içinde doldur:
- `POSTGRES_PASSWORD`: uzun, rastgele (`openssl rand -hex 24` ile üretebilirsin)
- `JWT_SECRET`: en az 32 karakter (`openssl rand -base64 48`)
- Diğerleri varsayılan kalabilir (`CORS_ORIGINS`, `COOKIE_DOMAIN`, `API_DOMAIN`)

`.env` dosyası git'e **asla** eklenmez.

## 6. Başlat

```bash
docker compose up -d --build
docker compose logs -f server      # "Server listening" görünmeli, Ctrl+C ile çık
```

Kontrol (kendi bilgisayarından):

```bash
curl https://api.dorukplays.com/health
```

`{"status":"ok","game":"MagicalBattle"}` görmelisin. İlk istekte sertifika alınırken birkaç saniye sürebilir.

## 7. Güncelleme

```bash
cd MagicalBattle
git pull
docker compose up -d --build
```

Veritabanı değişiklikleri (migrasyonlar) sunucu açılırken kendiliğinden uygulanır.

## 8. Yedek

Elle:

```bash
docker compose exec -T db pg_dump -U magicalbattle magicalbattle | gzip > yedek-$(date +%F).sql.gz
```

Her gece otomatik için `crontab -e` ile ekle (yolu kendi kullanıcına göre ayarla):

```
0 3 * * * cd /home/ubuntu/MagicalBattle && docker compose exec -T db pg_dump -U magicalbattle magicalbattle | gzip > /home/ubuntu/yedek-$(date +\%F).sql.gz
```

Yedekleri makine dışına da kopyalamayı unutma.

## Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| `curl` zaman aşımı | 2. adımdaki iki güvenlik duvarı kuralı (Oracle paneli **ve** iptables) |
| Sertifika hatası | DNS kaydı doğru IP'yi gösteriyor mu, proxy **kapalı** mı: `docker compose logs caddy` |
| Sunucu açılmıyor | `docker compose logs server`: `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS` eksikse açılmaz |
| Giriş çalışıyor ama oyunda oturum düşüyor | `COOKIE_DOMAIN=.dorukplays.com` ve `CORS_ORIGINS` oyunun tam adresiyle aynı mı |
