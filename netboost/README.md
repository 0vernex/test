# 📶 NetBoost — Internet Strengthener for Android (Termux)

## What it does
- 🏎️ **Races DNS servers** and picks the fastest one for your location
- 🔧 **Applies the fastest DNS** to all Termux connections
- 🚫 **Blocks ad/tracker domains** — stops wasted data on ads
- ⚡ **Optimises curl & Python** for faster downloads
- 📊 **Runs a speed test** so you can see the improvement
- 📡 **Shows your signal strength** (with Termux:API app)

## Install & Run (Termux)

### Step 1 — Install Termux
Download **Termux** from F-Droid (recommended) or Play Store

### Step 2 — One-liner to download and run NetBoost
```bash
curl -O https://raw.githubusercontent.com/0vernex/test/main/netboost/netboost.sh && bash netboost.sh
```

### Or manually:
```bash
pkg install curl -y
curl -O https://raw.githubusercontent.com/0vernex/test/main/netboost/netboost.sh
bash netboost.sh
```

### Re-run anytime:
```bash
bash ~/netboost.sh
```

## Bonus tip (no Termux needed!)
Go to: **Android Settings → Network & Internet → Private DNS**
Set hostname to: `one.one.one.one`
This forces your ENTIRE phone (not just Termux) to use Cloudflare's fast DNS!

## What each section does
| Section | What it does |
|---|---|
| Signal Check | Shows your 5G/LTE signal level |
| DNS Race | Pings 8 DNS servers, picks fastest |
| Apply DNS | Writes fastest DNS to Termux config |
| Ad Blocker | Blocks tracker domains in /etc/hosts |
| TCP Tuning | Sets curl options (compression, keepalive) |
| Speed Test | Downloads 10MB, calculates Mbps |
| Data Hogs | Shows active network connections |
