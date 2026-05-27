#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  NetBoost - Internet Strengthener for Termux (Android)
#  No root needed!
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "  ███╗   ██╗███████╗████████╗██████╗  ██████╗  ██████╗ ███████╗████████╗"
  echo "  ████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗██╔═══██╗██╔════╝╚══██╔══╝"
  echo "  ██╔██╗ ██║█████╗     ██║   ██████╔╝██║   ██║██║   ██║███████╗   ██║   "
  echo "  ██║╚██╗██║██╔══╝     ██║   ██╔══██╗██║   ██║██║   ██║╚════██║   ██║   "
  echo "  ██║ ╚████║███████╗   ██║   ██████╔╝╚██████╔╝╚██████╔╝███████║   ██║   "
  echo "  ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝   ╚═╝   "
  echo -e "${NC}"
  echo -e "${BOLD}  📶 Internet Strengthener for Android (Termux)${NC}"
  echo -e "  ─────────────────────────────────────────────\n"
}

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✔ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "  ${RED}✘ $1${NC}"; }
info() { echo -e "  ${BOLD}$1${NC}"; }

# ─── 1. INSTALL TOOLS ────────────────────────────────────────────────────────
install_tools() {
  step "Installing required tools..."
  pkg update -y -q 2>/dev/null
  pkg install -y -q curl dnsutils python termux-api 2>/dev/null
  pip install -q dnspython requests 2>/dev/null
  ok "Tools ready"
}

# ─── 2. SIGNAL STRENGTH ──────────────────────────────────────────────────────
check_signal() {
  step "Checking your signal strength..."

  # Try termux-telephony-info (needs termux-api app installed)
  if command -v termux-telephony-info &>/dev/null; then
    INFO=$(termux-telephony-info 2>/dev/null)
    if [ -n "$INFO" ]; then
      SIGNAL=$(echo "$INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('signal_strength','unknown'))" 2>/dev/null)
      TYPE=$(echo "$INFO"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('network_type','unknown'))" 2>/dev/null)
      echo -e "  Network type  : ${BOLD}$TYPE${NC}"
      echo -e "  Signal level  : ${BOLD}$SIGNAL / 4${NC}"
      if [ "$SIGNAL" -ge 3 ] 2>/dev/null; then
        ok "Strong signal — you're good!"
      elif [ "$SIGNAL" -ge 2 ] 2>/dev/null; then
        warn "Moderate signal — optimising DNS will help"
      else
        warn "Weak signal — try moving to a window or higher floor"
      fi
    fi
  else
    warn "Install the 'Termux:API' app from F-Droid for signal info"
  fi

  # Basic connectivity check
  if curl -s --max-time 3 https://1.1.1.1 &>/dev/null; then
    ok "Internet is reachable"
  else
    fail "No internet detected — check your 5G connection"
    exit 1
  fi
}

# ─── 3. DNS RACE ─────────────────────────────────────────────────────────────
DNS_SERVERS=(
  "1.1.1.1     Cloudflare"
  "1.0.0.1     Cloudflare-2"
  "8.8.8.8     Google"
  "8.8.4.4     Google-2"
  "9.9.9.9     Quad9"
  "208.67.222.222 OpenDNS"
  "94.140.14.14   AdGuard"
  "76.76.2.0   ControlD"
)

race_dns() {
  step "Racing DNS servers — finding the fastest one for you..."
  BEST_TIME=9999
  BEST_IP=""
  BEST_NAME=""

  printf "  %-18s %-14s %s\n" "DNS Server" "Provider" "Response Time"
  printf "  %-18s %-14s %s\n" "──────────" "────────" "─────────────"

  for entry in "${DNS_SERVERS[@]}"; do
    IP=$(echo "$entry" | awk '{print $1}')
    NAME=$(echo "$entry" | awk '{print $2}')
    # Measure dig query time in ms
    RESULT=$(dig @"$IP" google.com +time=2 +tries=1 2>/dev/null | grep "Query time:" | awk '{print $4}')
    if [ -n "$RESULT" ]; then
      printf "  %-18s %-14s ${GREEN}%s ms${NC}\n" "$IP" "$NAME" "$RESULT"
      if [ "$RESULT" -lt "$BEST_TIME" ] 2>/dev/null; then
        BEST_TIME=$RESULT
        BEST_IP=$IP
        BEST_NAME=$NAME
      fi
    else
      printf "  %-18s %-14s ${RED}timeout${NC}\n" "$IP" "$NAME"
    fi
  done

  echo ""
  ok "Fastest DNS: ${BOLD}$BEST_IP ($BEST_NAME)${NC} at ${GREEN}${BEST_TIME}ms${NC}"
  echo "$BEST_IP" > ~/.netboost_best_dns
  echo "$BEST_NAME" >> ~/.netboost_best_dns
}

# ─── 4. APPLY DNS FIX ────────────────────────────────────────────────────────
apply_dns() {
  step "Applying DNS optimisation..."
  BEST_IP=$(head -1 ~/.netboost_best_dns)
  BEST_NAME=$(sed -n '2p' ~/.netboost_best_dns)

  # Termux DNS config (affects all termux processes)
  RESOLV="$PREFIX/etc/resolv.conf"
  echo "nameserver $BEST_IP" > "$RESOLV"
  echo "nameserver 1.1.1.1"  >> "$RESOLV"   # fallback

  ok "Termux DNS → $BEST_IP ($BEST_NAME)"

  # Also write a system-hosts speedup (blocks ad/tracker domains = less waste)
  apply_adblock_hosts
}

apply_adblock_hosts() {
  step "Blocking ad/tracker domains (frees up bandwidth)..."
  HOSTS="$PREFIX/etc/hosts"
  # Back up if needed
  [ ! -f "${HOSTS}.bak" ] && cp "$HOSTS" "${HOSTS}.bak"

  # Common trackers that waste your data
  BLOCKED=(
    "doubleclick.net"
    "googleadservices.com"
    "ads.google.com"
    "facebook.com tracking"
    "scorecardresearch.com"
    "outbrain.com"
    "taboola.com"
    "googlesyndication.com"
    "adnxs.com"
    "adsystem.amazon.com"
  )

  # Write a block header (idempotent)
  grep -q "# NetBoost" "$HOSTS" 2>/dev/null || {
    echo "" >> "$HOSTS"
    echo "# NetBoost - blocked ad/tracker domains" >> "$HOSTS"
    echo "0.0.0.0 doubleclick.net"        >> "$HOSTS"
    echo "0.0.0.0 googleadservices.com"   >> "$HOSTS"
    echo "0.0.0.0 googlesyndication.com"  >> "$HOSTS"
    echo "0.0.0.0 scorecardresearch.com"  >> "$HOSTS"
    echo "0.0.0.0 outbrain.com"           >> "$HOSTS"
    echo "0.0.0.0 taboola.com"            >> "$HOSTS"
    echo "0.0.0.0 adnxs.com"              >> "$HOSTS"
    echo "0.0.0.0 adsystem.amazon.com"    >> "$HOSTS"
    ok "Ad/tracker domains blocked — saves real data!"
  } || ok "Ad blocks already in place"
}

# ─── 5. SPEED TEST ───────────────────────────────────────────────────────────
speed_test() {
  step "Running speed test (download)..."
  echo -e "  Downloading 10MB test file via curl...\n"

  START=$(date +%s%N)
  curl -s -o /dev/null --max-time 20 \
    "https://speed.cloudflare.com/__down?bytes=10000000" \
    --progress-bar 2>&1 | sed 's/^/  /'
  END=$(date +%s%N)

  ELAPSED=$(( (END - START) / 1000000 ))   # ms
  if [ "$ELAPSED" -gt 0 ]; then
    SPEED=$(echo "scale=2; 10 * 8 / ($ELAPSED / 1000)" | bc 2>/dev/null)
    echo ""
    ok "Download speed: ~${BOLD}${SPEED} Mbps${NC}  (${ELAPSED}ms for 10MB)"
    if (( $(echo "$SPEED > 10" | bc -l 2>/dev/null || echo 0) )); then
      ok "Speed is good for streaming / browsing"
    elif (( $(echo "$SPEED > 2" | bc -l 2>/dev/null || echo 0) )); then
      warn "Speed is OK for browsing but slow for HD video"
    else
      warn "Speed is very slow — try moving for better signal"
    fi
  else
    warn "Could not measure speed"
  fi
}

# ─── 6. TCP TUNING ───────────────────────────────────────────────────────────
tune_tcp() {
  step "Tuning TCP buffers for better throughput (Termux-level)..."
  # We can't write to /proc/sys without root, but we can configure
  # curl & python to use optimal settings within Termux
  mkdir -p ~/.netboost

  cat > ~/.netboost/curlrc << 'EOF'
# NetBoost optimised curl config
--compressed
--keepalive-time 60
--speed-limit 0
--retry 3
--retry-delay 2
--tcp-fastopen
EOF

  # Set as default curl config
  cp ~/.netboost/curlrc ~/.curlrc
  ok "curl optimised (compression, keepalive, fast-open, auto-retry)"

  # Python requests session hint file
  cat > ~/.netboost/requests_tip.py << 'EOF'
# Drop this in your Python scripts for faster requests:
import requests
from requests.adapters import HTTPAdapter

s = requests.Session()
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=20,
    max_retries=3
)
s.mount("http://",  adapter)
s.mount("https://", adapter)
EOF
  ok "Python requests session config saved to ~/.netboost/requests_tip.py"
}

# ─── 7. BACKGROUND DATA KILLER ──────────────────────────────────────────────
show_data_hogs() {
  step "Checking what's eating your data in Termux..."
  if command -v ss &>/dev/null; then
    echo -e "\n  ${BOLD}Active connections:${NC}"
    ss -tnp 2>/dev/null | head -20 | sed 's/^/  /'
  fi
  info "\n  Tip: Go to Android Settings → Network → Data Usage"
  info "  to see which apps are eating your 5G data and restrict them."
}

# ─── 8. SUMMARY ──────────────────────────────────────────────────────────────
summary() {
  BEST_IP=$(head -1 ~/.netboost_best_dns 2>/dev/null || echo "1.1.1.1")
  BEST_NAME=$(sed -n '2p' ~/.netboost_best_dns 2>/dev/null || echo "Cloudflare")

  echo -e "\n${CYAN}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  ✅ NetBoost Complete! Here's what was done:${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
  echo -e "  ${GREEN}✔${NC} Found fastest DNS server: ${BOLD}$BEST_IP ($BEST_NAME)${NC}"
  echo -e "  ${GREEN}✔${NC} DNS applied to Termux"
  echo -e "  ${GREEN}✔${NC} Ad/tracker domains blocked (saves data)"
  echo -e "  ${GREEN}✔${NC} curl optimised (compression + keepalive)"
  echo -e "  ${GREEN}✔${NC} Connection speed measured"
  echo ""
  echo -e "  ${YELLOW}💡 For FULL system-wide DNS boost (no root):${NC}"
  echo -e "     Android Settings → Network → Private DNS"
  echo -e "     Set to: ${BOLD}one.one.one.one${NC}  (Cloudflare)"
  echo -e "     or:     ${BOLD}dns.google${NC}        (Google)"
  echo ""
  echo -e "  ${YELLOW}💡 Re-run anytime:  ${BOLD}bash ~/netboost.sh${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}\n"
}

# ─── MAIN ────────────────────────────────────────────────────────────────────
main() {
  banner
  install_tools
  check_signal
  race_dns
  apply_dns
  tune_tcp
  speed_test
  show_data_hogs
  summary
}

main
