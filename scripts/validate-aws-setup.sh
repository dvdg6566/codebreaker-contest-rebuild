#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

# ── Load .env ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  line="$(echo "$line" | sed 's/[[:space:]]*#.*$//')"
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && export "${line?}"
done < "$ENV_FILE"

for var in JUDGE_NAME AWS_REGION AWS_ACCOUNT_ID COGNITO_USER_POOL_ID COGNITO_CLIENT_ID; do
  [[ -z "${!var:-}" ]] && { echo "Error: $var not set in .env" >&2; exit 1; }
done

J="$JUDGE_NAME"
R="$AWS_REGION"

# ── Counters ───────────────────────────────────────────────────────────────────
TOTAL_FOUND=0; TOTAL_COUNT=0
DYNAMO_FOUND=0;  DYNAMO_TOTAL=0
S3_FOUND=0;      S3_TOTAL=0
COGNITO_FOUND=0; COGNITO_TOTAL=0
LAMBDA_FOUND=0;  LAMBDA_TOTAL=0
SF_FOUND=0;      SF_TOTAL=0
APIGW_FOUND=0;   APIGW_TOTAL=0

check() {
  local cat="$1" label="$2" ok="$3"
  TOTAL_COUNT=$(( TOTAL_COUNT + 1 ))
  eval "${cat}_TOTAL=\$(( \${${cat}_TOTAL} + 1 ))"
  if [[ "$ok" == "true" ]]; then
    TOTAL_FOUND=$(( TOTAL_FOUND + 1 ))
    eval "${cat}_FOUND=\$(( \${${cat}_FOUND} + 1 ))"
    printf "  ${GREEN}✓${RESET}  %s\n" "$label"
  else
    printf "  ${RED}✗${RESET}  %s\n" "$label"
  fi
}

ok_dynamo()  { aws dynamodb describe-table --table-name "$1" --region "$R" --output text --query 'Table.TableName' 2>/dev/null | grep -q "$1" && echo true || echo false; }
ok_s3()      { aws s3api get-bucket-location --bucket "$1" 2>/dev/null | grep -q "LocationConstraint" && echo true || echo false; }
ok_lambda()  { aws lambda get-function --function-name "$1" --region "$R" --output text --query 'Configuration.FunctionName' 2>/dev/null | grep -q "$1" && echo true || echo false; }
ok_sf()      { aws stepfunctions describe-state-machine --state-machine-arn "arn:aws:states:$R:$AWS_ACCOUNT_ID:stateMachine:$1" --region "$R" --output text --query 'name' 2>/dev/null | grep -q "$1" && echo true || echo false; }

# ── Header ─────────────────────────────────────────────────────────────────────
TITLE="AWS Setup Validation — $J"
TLEN=${#TITLE}
PAD=$(( (50 - TLEN) / 2 ))
echo ""
echo "╔══════════════════════════════════════════════════╗"
printf "║%*s%s%*s║\n" "$PAD" "" "$TITLE" $(( 50 - TLEN - PAD )) ""
echo "╚══════════════════════════════════════════════════╝"
echo ""
printf "  Region:  %-20s Account: %s\n" "$R" "$AWS_ACCOUNT_ID"
echo ""

# ── DynamoDB ───────────────────────────────────────────────────────────────────
echo "[DynamoDB Tables]"
check DYNAMO "$J-users"           "$(ok_dynamo $J-users)"
check DYNAMO "$J-contests"        "$(ok_dynamo $J-contests)"
check DYNAMO "$J-problems"        "$(ok_dynamo $J-problems)"
check DYNAMO "$J-submissions"     "$(ok_dynamo $J-submissions)"
check DYNAMO "$J-announcements"   "$(ok_dynamo $J-announcements)"
check DYNAMO "$J-clarifications"  "$(ok_dynamo $J-clarifications)"
check DYNAMO "$J-global-counters" "$(ok_dynamo $J-global-counters)"
check DYNAMO "$J-websocket"       "$(ok_dynamo $J-websocket)"
echo ""

# ── S3 ─────────────────────────────────────────────────────────────────────────
echo "[S3 Buckets]"
check S3 "$J-submissions"  "$(ok_s3 $J-submissions)"
check S3 "$J-testdata"     "$(ok_s3 $J-testdata)"
check S3 "$J-statements"   "$(ok_s3 $J-statements)"
check S3 "$J-attachments"  "$(ok_s3 $J-attachments)"
check S3 "$J-checkers"     "$(ok_s3 $J-checkers)"
check S3 "$J-graders"      "$(ok_s3 $J-graders)"
echo ""

# ── Cognito ────────────────────────────────────────────────────────────────────
echo "[Cognito]"
if aws cognito-idp describe-user-pool --user-pool-id "$COGNITO_USER_POOL_ID" \
     --region "$R" --output text --query 'UserPool.Id' 2>/dev/null | grep -q "$COGNITO_USER_POOL_ID"; then
  check COGNITO "User Pool ($COGNITO_USER_POOL_ID)" "true"
else
  check COGNITO "User Pool ($COGNITO_USER_POOL_ID)" "false"
fi

for grp in admin contestant; do
  if aws cognito-idp get-group --user-pool-id "$COGNITO_USER_POOL_ID" \
       --group-name "$grp" --region "$R" \
       --output text --query 'Group.GroupName' 2>/dev/null | grep -q "$grp"; then
    check COGNITO "Group: $grp" "true"
  else
    check COGNITO "Group: $grp" "false"
  fi
done

if aws cognito-idp describe-user-pool-client \
     --user-pool-id "$COGNITO_USER_POOL_ID" --client-id "$COGNITO_CLIENT_ID" \
     --region "$R" --output text --query 'UserPoolClient.ClientId' 2>/dev/null | grep -q "$COGNITO_CLIENT_ID"; then
  check COGNITO "App Client ($COGNITO_CLIENT_ID)" "true"
else
  check COGNITO "App Client ($COGNITO_CLIENT_ID)" "false"
fi
echo ""

# ── Lambda ─────────────────────────────────────────────────────────────────────
echo "[Lambda Functions]"
check LAMBDA "$J-compiler"             "$(ok_lambda $J-compiler)"
check LAMBDA "$J-websocket-connections" "$(ok_lambda $J-websocket-connections)"
check LAMBDA "$J-websocket-invoke"     "$(ok_lambda $J-websocket-invoke)"
echo ""

# ── Step Functions ─────────────────────────────────────────────────────────────
echo "[Step Functions]"
check SF "$J-grading"   "$(ok_sf $J-grading)"
check SF "$J-websocket" "$(ok_sf $J-websocket)"
echo ""

# ── API Gateway ────────────────────────────────────────────────────────────────
echo "[API Gateway WebSocket]"
if aws apigatewayv2 get-apis --region "$R" \
     --query "Items[?Name=='$J-websocket' && ProtocolType=='WEBSOCKET'].ApiId" \
     --output text 2>/dev/null | grep -qE '^[A-Za-z0-9]+'; then
  check APIGW "$J-websocket" "true"
else
  check APIGW "$J-websocket" "false"
fi
echo ""

# ── Summary ────────────────────────────────────────────────────────────────────
bar() {
  local f="$1" t="$2" w=8
  local filled=$(( f * w / t )) bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=filled; i<w; i++)); do bar+="░"; done
  echo "$bar"
}

row() {
  local label="$1" f="$2" t="$3"
  local b; b="$(bar "$f" "$t")"
  local s; [[ "$f" -eq "$t" ]] && s="${GREEN}✓${RESET}" || s="${RED}✗${RESET}"
  printf "  %-14s %s  %d/%d  %b\n" "$label" "$b" "$f" "$t" "$s"
}

echo "──────────────────────────────────────────────────"
printf "Summary: %d/%d resources found\n\n" "$TOTAL_FOUND" "$TOTAL_COUNT"
row "DynamoDB"    "$DYNAMO_FOUND"  "$DYNAMO_TOTAL"
row "S3 Buckets"  "$S3_FOUND"      "$S3_TOTAL"
row "Cognito"     "$COGNITO_FOUND" "$COGNITO_TOTAL"
row "Lambda"      "$LAMBDA_FOUND"  "$LAMBDA_TOTAL"
row "Step Funcs"  "$SF_FOUND"      "$SF_TOTAL"
row "API Gateway" "$APIGW_FOUND"   "$APIGW_TOTAL"
echo ""

[[ "$TOTAL_FOUND" -lt "$TOTAL_COUNT" ]] && exit 1 || exit 0
