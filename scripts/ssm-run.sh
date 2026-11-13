#!/usr/bin/env bash
# Usage: scripts/ssm-run.sh <instance-id> "<shell command>"
set -u
ID="$1"; CMD="$2"
PARAMS=$(python3 -c 'import json,sys;print(json.dumps({"commands":[sys.argv[1]],"executionTimeout":["1800"]}))' "$CMD")
CID=$(aws ssm send-command --instance-ids "$ID" --document-name AWS-RunShellScript \
  --parameters "$PARAMS" --query 'Command.CommandId' --output text)
while :; do
  ST=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$ID" --query Status --output text 2>/dev/null || echo Pending)
  case "$ST" in Pending|InProgress|Delayed) sleep 5;; *) break;; esac
done
echo "== $ID : $ST =="
aws ssm get-command-invocation --command-id "$CID" --instance-id "$ID" --query StandardOutputContent --output text
aws ssm get-command-invocation --command-id "$CID" --instance-id "$ID" --query StandardErrorContent --output text
