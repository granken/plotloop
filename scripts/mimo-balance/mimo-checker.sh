#!/bin/sh
# ============================================
# MiMo Balance Checker
# 小米 MiMo 开放平台 余额 & 账单查询工具
# ============================================
# License: MIT
# ============================================

set -e

API_BASE="https://platform.xiaomimimo.com"
TMP_ROOT=${TMPDIR:-/tmp}
T=$(mktemp -d "${TMP_ROOT%/}/mimo.XXXXXX")

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' BOLD='' NC=''
fi

usage() {
    cat <<EOF
${BOLD}MiMo Balance Checker${NC} - 小米 MiMo 开放平台余额 & 账单查询

${BOLD}用法:${NC}
  $(basename "$0") [选项]

${BOLD}选项:${NC}
  -y, --year YEAR       查询年份（默认: 当年）
  -m, --month MONTH     查询月份（默认: 当月）
  -a, --all             显示本月全部日期（含无消费日）
  -t, --token-plan      仅显示 Token Plan 信息
  -p, --pay-as-you-go   仅显示按量付费信息
  -j, --json            以 JSON 格式输出
  --cookie COOKIE       直接传入 Cookie（不推荐写进历史记录）
  -h, --help            显示帮助信息

${BOLD}Cookie 获取方式:${NC}
  1. 在浏览器中登录 https://platform.xiaomimimo.com
  2. F12 → Network → 点击任意请求 → Headers → Cookie
  3. 复制完整 Cookie 值

  ${CYAN}export MIMO_COOKIE='your_cookie'${NC}
  或创建 .env 文件（参考 .env.example）
EOF
}

cleanup() { [ -n "${T:-}" ] && rm -rf "$T" 2>/dev/null; }
trap cleanup EXIT

die() {
    printf "${RED}❌ %s${NC}\n" "$1" >&2
    exit 1
}

need_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "缺少依赖: $1"
}

load_env_cookie() {
    file=$1
    [ -f "$file" ] || return 1
    line=$(grep -E '^[[:space:]]*MIMO_COOKIE=' "$file" 2>/dev/null | tail -1 || true)
    [ -n "$line" ] || return 1
    value=${line#*=}
    value=$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    case "$value" in
        \"*\") value=${value#\"}; value=${value%\"} ;;
        \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    [ -n "$value" ] || return 1
    MIMO_COOKIE=$value
    return 0
}

api_get()  { curl -sS --connect-timeout 10 --max-time 30 -b "$MIMO_COOKIE" "$API_BASE$1"; }
api_post() { curl -sS --connect-timeout 10 --max-time 30 -b "$MIMO_COOKIE" -X POST "$API_BASE$1" -H "Content-Type: application/json" -d "$2"; }
api_ok()   { grep -q '"code":0' "$1" 2>/dev/null; }

# ── 参数解析 ──

YEAR="" MONTH="" ALL=false TP=false PAY=false JSON=false COOKIE_INPUT=""

while [ $# -gt 0 ]; do
    case "$1" in
        -y|--year)          [ $# -ge 2 ] || die "参数 $1 需要 YEAR"; YEAR="$2"; shift 2 ;;
        -m|--month)         [ $# -ge 2 ] || die "参数 $1 需要 MONTH"; MONTH="$2"; shift 2 ;;
        -a|--all)           ALL=true; shift ;;
        -t|--token-plan)    TP=true; shift ;;
        -p|--pay-as-you-go) PAY=true; shift ;;
        -j|--json)          JSON=true; shift ;;
        --cookie)           [ $# -ge 2 ] || die "参数 --cookie 需要 COOKIE"; COOKIE_INPUT="$2"; shift 2 ;;
        -h|--help)          usage; exit 0 ;;
        *) die "未知参数: $1" ;;
    esac
done

[ "$TP" = false ] && [ "$PAY" = false ] && TP=true && PAY=true

# ── Cookie ──

if [ -n "$COOKIE_INPUT" ]; then
    MIMO_COOKIE="$COOKIE_INPUT"
elif [ -z "$MIMO_COOKIE" ]; then
    load_env_cookie ".env" || true
    [ -z "$MIMO_COOKIE" ] && load_env_cookie "$HOME/.mimo-checker.env" || true
fi

if [ -z "$MIMO_COOKIE" ]; then
    printf "${RED}❌ 未找到 Cookie${NC}\n"
    echo "export MIMO_COOKIE='...' 或使用 --cookie 参数"
    exit 1
fi

YEAR=${YEAR:-$(date +%Y)}
MONTH=${MONTH:-$(date +%m | sed 's/^0//')}

case "$YEAR" in
    [0-9][0-9][0-9][0-9]) ;;
    *) die "年份必须是 4 位数字: $YEAR" ;;
esac
case "$MONTH" in
    ''|*[!0-9]*) die "月份必须是 1-12 的数字: $MONTH" ;;
esac
[ "$MONTH" -ge 1 ] && [ "$MONTH" -le 12 ] || die "月份必须是 1-12: $MONTH"

need_cmd curl
need_cmd python3

# ── 查询 API ──

PH_RAW=$(echo "$MIMO_COOKIE" | tr ';' '\n' | grep 'api-platform_ph' | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"')
PH_ENC=$(echo "$PH_RAW" | python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read().strip()))" 2>/dev/null || echo "")

api_get "/api/v1/balance"                    > "${T}/bal.json"
api_get "/api/v1/usage"                      > "${T}/use.json"
api_get "/api/v1/tokenPlan/detail"           > "${T}/tp_d.json"
api_get "/api/v1/tokenPlan/usage"            > "${T}/tp_u.json"
[ -n "$PH_ENC" ] && api_post "/api/v1/usage/detail/list?api-platform_ph=$PH_ENC" \
    "{\"year\":$YEAR,\"month\":$MONTH}"       > "${T}/det.json"
[ -s "${T}/det.json" ] || printf '%s\n' '{"code":-1,"message":"api-platform_ph cookie not found","data":[]}' > "${T}/det.json"

# ── JSON 输出 ──

if [ "$JSON" = true ]; then
    echo "{\"balance\":$(cat "${T}/bal.json"),\"usage\":$(cat "${T}/use.json"),\"detail\":$(cat "${T}/det.json"),\"tokenPlan\":{\"detail\":$(cat "${T}/tp_d.json"),\"usage\":$(cat "${T}/tp_u.json")}}"
    exit 0
fi

# ── 输出 ──

echo ""
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${BOLD}  🔍 MiMo 账户信息   ${CYAN}%s年%s月${NC}\n" "$YEAR" "$MONTH"
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# ──── Token Plan ────
if [ "$TP" = true ]; then
    echo ""
    printf "${BOLD}🎫 Token Plan${NC}\n"
    if api_ok "${T}/tp_d.json" && api_ok "${T}/tp_u.json"; then
        python3 -c "
import json
d=json.load(open('${T}/tp_d.json'))['data']
u=json.load(open('${T}/tp_u.json'))['data']
plan=d['planName']; end=d['currentPeriodEnd']; exp=d['expired']; ar=d['enableAutoRenew']
mi=u.get('monthUsage',{}).get('items',[{}])[0]
ml,mp,mpct=mi.get('limit',0),mi.get('used',0),mi.get('percent',0)
ti=[i for i in u.get('usage',{}).get('items',[]) if i['name']=='plan_total_token']
tu=ti[0]['used'] if ti else 0; tl=ti[0]['limit'] if ti else 0
def f(n):
    if n>=1e9: return f'{n/1e9:.2f}B'
    if n>=1e6: return f'{n/1e6:.1f}M'
    if n>=1e3: return f'{n/1e3:.1f}K'
    return str(n)
st='🔴 已过期' if exp else '🟢 生效中'
print(f'  套餐       {plan}')
print(f'  状态       {st}')
print(f'  有效期至   {end} (UTC)')
print(f'  自动续费   {\"开启\" if ar else \"关闭\"}')
pct=mpct*100; filled=max(0,min(30,int(pct/100*30)))
bar='█'*filled+'░'*(30-filled)
c='\033[0;31m' if pct>=100 else ('\033[1;33m' if pct>=80 else '\033[0;32m')
print()
print(f'  本月额度   {f(mp)} / {f(ml)}')
print(f'  {c}{bar}\033[0m {pct:.1f}%')
if pct>=100: print('  ⚠️  本月额度已耗尽！')
elif pct>=80: print('  ⚠️  本月额度使用超过 80%')
if tl>0:
    tp=(tu/tl*100) if tl else 0
    print(f'\\n  套餐总量   {f(tu)} / {f(tl)}')
    print(f'  使用率     {tp:.1f}%')
"
    else
        printf "${YELLOW}⚠ 未订阅 Token Plan 或查询失败${NC}\n"
    fi
fi

# ──── 按量付费 ────
if [ "$PAY" = true ]; then
    echo ""
    printf "${BOLD}💰 按量付费 - 余额${NC}\n"
    if api_ok "${T}/bal.json"; then
        python3 -c "
import json
d=json.load(open('${T}/bal.json'))['data']
print(f'  总余额     ¥ {d[\"balance\"]:>10}')
print(f'  ├ 现金     ¥ {d[\"cashBalance\"]:>10}')
print(f'  └ 赠送     ¥ {d[\"giftBalance\"]:>10}')
if float(d['balance'])<35: print('  ⚠️  余额低于预警阈值（¥35.00）')
"
    else
        printf "${YELLOW}⚠ 余额查询失败${NC}\n"
    fi

    echo ""
    printf "${BOLD}📊 按量付费 - 用量概览${NC}\n"
    if api_ok "${T}/use.json"; then
        python3 -c "
import json
d=json.load(open('${T}/use.json'))['data']; c=d['costUsage']; t=d['tokenUsage']
print(f'  累计消费   ¥ {c[\"totalCost\"]:>10}')
print(f'  本月消费   ¥ {c[\"currentMonthCost\"]:>10}')
print(f'  输入 Token {t[\"inputToken\"]:>12,}')
print(f'  输出 Token {t[\"outputToken\"]:>12,}')
print(f'  缓存 Token {t[\"cacheToken\"]:>12,}')
"
    else
        printf "${YELLOW}⚠ 概览查询失败${NC}\n"
    fi

    echo ""
    printf "${BOLD}📅 按量付费 - %s年%s月 每日消费${NC}\n" "$YEAR" "$MONTH"
    if api_ok "${T}/det.json"; then
        python3 -c "
import calendar
import json
from collections import defaultdict
year=int('${YEAR}'); month=int('${MONTH}'); all_days='${ALL}' == 'true'
data=json.load(open('${T}/det.json'))['data']
if not data and not all_days: print('  本月暂无消费记录'); exit()
daily=defaultdict(lambda:{'a':0.0,'c':0})
for i in data:
    daily[i['date']]['a']+=float(i['consumedAmount']); daily[i['date']]['c']+=i['requestCount']
mx=max((v['a'] for v in daily.values()),default=1) or 1
if all_days:
    last_day=calendar.monthrange(year, month)[1]
    dates=[f'{year:04d}-{month:02d}-{day:02d}' for day in range(1,last_day+1)]
else:
    dates=sorted(daily)
for dt in dates:
    v=daily[dt]
    if v['a']>0:
        bl=int(v['a']/mx*30); bar='█'*max(bl,1)
        print(f'  {dt}  ¥ {v[\"a\"]:>8.2f}  {bar}  {v[\"c\"]}次')
    elif all_days:
        print(f'  {dt}  ¥ {0:>8.2f}  {\"-\":30}  0次')
print(f'  {\"─\"*55}')
print(f'  本月合计  ¥ {sum(v[\"a\"] for v in daily.values()):>8.2f}')
"
    else
        printf "${YELLOW}⚠ 账单查询失败${NC}\n"
    fi
fi

echo ""
printf "${BOLD}🔗 快捷链接${NC}\n"
[ "$PAY" = true ] && {
    echo "  余额  $API_BASE/console/balance"
    echo "  账单  $API_BASE/console/usage"
    echo "  Keys  $API_BASE/console/api-keys"
}
[ "$TP" = true ] && echo "  套餐  $API_BASE/console/plan-manage"
echo ""
