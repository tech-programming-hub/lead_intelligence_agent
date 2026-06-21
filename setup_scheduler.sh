#!/bin/bash
# setup_scheduler.sh
# Sets up the agent to run every 6 hours via cron (Mac/Linux)
# Run once: bash setup_scheduler.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_PATH="$(which python3)"
LOG_FILE="$SCRIPT_DIR/agent.log"

# Build the cron line: run at 00:00, 06:00, 12:00, 18:00 every day
CRON_LINE="0 */6 * * * cd $SCRIPT_DIR && $PYTHON_PATH agent.py >> $LOG_FILE 2>&1"

echo "Adding cron job..."
echo "$CRON_LINE"

# Add to crontab (removes duplicates first)
(crontab -l 2>/dev/null | grep -v "lead_intelligence_agent/agent.py"; echo "$CRON_LINE") | crontab -

echo ""
echo "✅ Cron job set. Agent will run every 6 hours."
echo "   Logs → $LOG_FILE"
echo "   Leads → $SCRIPT_DIR/leads.xlsx"
echo ""
echo "To run immediately: python3 agent.py"
echo "To remove cron:    crontab -e  (and delete the lead agent line)"
