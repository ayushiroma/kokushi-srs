#!/bin/bash
BATCH_ID="msgbatch_01FB4F6ovxeLYfpGpZuBRLvA"
cd "C:\Users\shiro\dev\kokushi-srs"
while true; do
  STATUS=$(PYTHONUTF8=1 py -3 scripts/explain/generate_batch.py status "$BATCH_ID" 2>&1 | head -1)
  echo "$(date): $STATUS"
  if echo "$STATUS" | grep -q "status: ended"; then
    echo "Batch ended. Applying results..."
    PYTHONUTF8=1 py -3 scripts/explain/generate_batch.py apply "$BATCH_ID" 2>&1
    break
  fi
  sleep 180
done
