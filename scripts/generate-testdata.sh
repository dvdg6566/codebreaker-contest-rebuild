#!/bin/bash

# Generate test data for Codebreaker Contest Manager
# This script creates JSON files that can be used to seed DynamoDB tables
# or reset the mock data if databases get wiped.
#
# IMPORTANT: This script generates data that references problems created by
# init-problems.ts: addition, ping, prisoners
#
# Usage: ./scripts/generate-testdata.sh [output_dir]
# Default output: ./testdata/

set -e

OUTPUT_DIR="${1:-./testdata}"
mkdir -p "$OUTPUT_DIR"

# Get current timestamp in DynamoDB format (YYYY-MM-DD HH:MM:SS UTC)
get_timestamp() {
  local offset_seconds="${1:-0}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS date requires explicit +/- sign
    if [[ $offset_seconds -ge 0 ]]; then
      date -u -v"+${offset_seconds}S" "+%Y-%m-%d %H:%M:%S"
    else
      date -u -v"${offset_seconds}S" "+%Y-%m-%d %H:%M:%S"
    fi
  else
    date -u -d "${offset_seconds} seconds" "+%Y-%m-%d %H:%M:%S"
  fi
}

# Generate a UUID
gen_uuid() {
  if command -v uuidgen &> /dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$RANDOM-$RANDOM"
  fi
}

NOW=$(get_timestamp 0)
HOUR_AGO=$(get_timestamp -3600)
TWO_HOURS_LATER=$(get_timestamp 7200)
DAY_AGO=$(get_timestamp -86400)
WEEK_AGO=$(get_timestamp -604800)
MONTH_LATER=$(get_timestamp 2592000)
TWO_DAYS_LATER=$(get_timestamp 172800)
FAR_FUTURE="9999-12-31 23:59:59"

# Specific timestamps
THIRTY_MIN_AGO=$(get_timestamp -1800)
TWENTY_MIN_AGO=$(get_timestamp -1200)
TWENTY_FIVE_MIN_AGO=$(get_timestamp -1500)
FORTY_MIN_AGO=$(get_timestamp -2400)
FIFTEEN_MIN_AGO=$(get_timestamp -900)
TWO_MIN_AGO=$(get_timestamp -120)
FORTY_FIVE_MIN_AGO=$(get_timestamp -2700)
TEN_MIN_AGO=$(get_timestamp -600)
FIFTY_MIN_AGO=$(get_timestamp -3000)

echo "Generating test data in $OUTPUT_DIR..."
echo "Using problems: addition, ping, prisoners"

# =============================================================================
# USERS
# =============================================================================
cat > "$OUTPUT_DIR/users.json" << EOF
{
  "tableName": "{JudgeName}-users",
  "items": [
    {
      "username": {"S": "admin"},
      "role": {"S": "admin"},
      "fullname": {"S": "Administrator"},
      "email": {"S": "admin@codebreaker.local"},
      "label": {"S": ""},
      "contest": {"S": ""},
      "problemScores": {"M": {}},
      "problemSubmissions": {"M": {}},
      "latestSubmissions": {"M": {}},
      "latestScoreChange": {"S": ""}
    },
    {
      "username": {"S": "alice"},
      "role": {"S": "member"},
      "fullname": {"S": "Alice Chen"},
      "email": {"S": "alice@example.com"},
      "label": {"S": "Team A"},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {
        "addition": {"N": "100"},
        "ping": {"N": "40"},
        "prisoners": {"N": "27"}
      }},
      "problemSubmissions": {"M": {
        "addition": {"N": "1"},
        "ping": {"N": "3"},
        "prisoners": {"N": "2"}
      }},
      "latestSubmissions": {"M": {
        "addition": {"S": "$THIRTY_MIN_AGO"},
        "ping": {"S": "$TWENTY_MIN_AGO"},
        "prisoners": {"S": "$TWO_MIN_AGO"}
      }},
      "latestScoreChange": {"S": "$THIRTY_MIN_AGO"}
    },
    {
      "username": {"S": "bob"},
      "role": {"S": "member"},
      "fullname": {"S": "Bob Smith"},
      "email": {"S": "bob@example.com"},
      "label": {"S": "Team B"},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {
        "addition": {"N": "36"}
      }},
      "problemSubmissions": {"M": {
        "addition": {"N": "1"}
      }},
      "latestSubmissions": {"M": {
        "addition": {"S": "$TWENTY_FIVE_MIN_AGO"}
      }},
      "latestScoreChange": {"S": "$TWENTY_FIVE_MIN_AGO"}
    },
    {
      "username": {"S": "charlie"},
      "role": {"S": "member"},
      "fullname": {"S": "Charlie Brown"},
      "email": {"S": "charlie@example.com"},
      "label": {"S": ""},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {
        "addition": {"N": "100"},
        "ping": {"N": "100"}
      }},
      "problemSubmissions": {"M": {
        "addition": {"N": "2"},
        "ping": {"N": "1"}
      }},
      "latestSubmissions": {"M": {
        "addition": {"S": "$FORTY_MIN_AGO"},
        "ping": {"S": "$FIFTEEN_MIN_AGO"}
      }},
      "latestScoreChange": {"S": "$FIFTEEN_MIN_AGO"}
    },
    {
      "username": {"S": "diana"},
      "role": {"S": "member"},
      "fullname": {"S": "Diana Prince"},
      "email": {"S": "diana@example.com"},
      "label": {"S": "Team A"},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {}},
      "problemSubmissions": {"M": {}},
      "latestSubmissions": {"M": {}},
      "latestScoreChange": {"S": ""}
    },
    {
      "username": {"S": "eve"},
      "role": {"S": "member"},
      "fullname": {"S": "Eve Wilson"},
      "email": {"S": "eve@example.com"},
      "label": {"S": ""},
      "contest": {"S": ""},
      "problemScores": {"M": {}},
      "problemSubmissions": {"M": {}},
      "latestSubmissions": {"M": {}},
      "latestScoreChange": {"S": ""}
    }
  ]
}
EOF

echo "  Created users.json (6 users)"

# =============================================================================
# CONTESTS
# =============================================================================
cat > "$OUTPUT_DIR/contests.json" << EOF
{
  "tableName": "{JudgeName}-contests",
  "items": [
    {
      "contestId": {"S": "contest-1"},
      "contestName": {"S": "Weekly Contest #42"},
      "problems": {"L": [
        {"S": "addition"},
        {"S": "ping"},
        {"S": "prisoners"}
      ]},
      "startTime": {"S": "$HOUR_AGO"},
      "endTime": {"S": "$TWO_HOURS_LATER"},
      "subLimit": {"N": "50"},
      "subDelay": {"N": "60"}
    },
    {
      "contestId": {"S": "contest-2"},
      "contestName": {"S": "Practice Round"},
      "problems": {"L": [
        {"S": "addition"}
      ]},
      "startTime": {"S": "$DAY_AGO"},
      "endTime": {"S": "$MONTH_LATER"},
      "subLimit": {"N": "-1"},
      "subDelay": {"N": "10"}
    },
    {
      "contestId": {"S": "contest-3"},
      "contestName": {"S": "Private Training Session"},
      "problems": {"L": [
        {"S": "addition"},
        {"S": "ping"}
      ]},
      "startTime": {"S": "$TWO_DAYS_LATER"},
      "endTime": {"S": "$FAR_FUTURE"},
      "subLimit": {"N": "10"},
      "subDelay": {"N": "30"}
    }
  ]
}
EOF
echo "  Created contests.json (3 contests)"

# =============================================================================
# PROBLEMS (matches init-problems.ts output)
# =============================================================================
cat > "$OUTPUT_DIR/problems.json" << 'EOF'
{
  "tableName": "{JudgeName}-problems",
  "items": [
    {
      "problemName": {"S": "addition"},
      "title": {"S": "addition"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "1024"},
      "testcaseCount": {"N": "4"},
      "subtaskScores": {"L": [{"N": "0"}, {"N": "36"}, {"N": "64"}]},
      "subtaskDependency": {"L": [{"S": "1"}, {"S": "1-3"}, {"S": "1-4"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "ping"},
      "title": {"S": "ping"},
      "problem_type": {"S": "Interactive"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "1024"},
      "testcaseCount": {"N": "152"},
      "subtaskScores": {"L": [{"N": "10"}, {"N": "30"}, {"N": "60"}]},
      "subtaskDependency": {"L": [{"S": "1-20"}, {"S": "1-73"}, {"S": "74-152"}]},
      "attachments": {"BOOL": true},
      "customChecker": {"BOOL": true},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "prisoners"},
      "title": {"S": "prisoners"},
      "problem_type": {"S": "Communication"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "1024"},
      "testcaseCount": {"N": "31"},
      "subtaskScores": {"L": [{"N": "27"}, {"N": "29"}, {"N": "44"}, {"N": "0"}]},
      "subtaskDependency": {"L": [{"S": "1-10"}, {"S": "11-20"}, {"S": "1-30"}, {"S": "31"}]},
      "attachments": {"BOOL": true},
      "customChecker": {"BOOL": true},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true},
      "nameA": {"S": "swapper"},
      "nameB": {"S": "prisoner"}
    }
  ]
}
EOF
echo "  Created problems.json (3 problems: addition, ping, prisoners)"

# =============================================================================
# SUBMISSIONS
# =============================================================================
cat > "$OUTPUT_DIR/submissions.json" << EOF
{
  "tableName": "{JudgeName}-submissions",
  "items": [
    {
      "subId": {"N": "1"},
      "username": {"S": "alice"},
      "problemName": {"S": "addition"},
      "submissionTime": {"S": "$THIRTY_MIN_AGO"},
      "gradingTime": {"S": "$THIRTY_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1740)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "0"}, {"N": "36"}, {"N": "36"}, {"N": "64"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "45"}, {"N": "42"}, {"N": "48"}, {"N": "50"}]},
      "memories": {"L": [{"N": "4200"}, {"N": "4180"}, {"N": "4220"}, {"N": "4250"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "0"}, {"N": "36"}, {"N": "64"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "50"},
      "maxMemory": {"N": "4250"}
    },
    {
      "subId": {"N": "2"},
      "username": {"S": "bob"},
      "problemName": {"S": "addition"},
      "submissionTime": {"S": "$TWENTY_FIVE_MIN_AGO"},
      "gradingTime": {"S": "$TWENTY_FIVE_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1440)"},
      "language": {"S": "py"},
      "score": {"L": [{"N": "0"}, {"N": "36"}, {"N": "0"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "WA"}, {"S": "WA"}]},
      "times": {"L": [{"N": "120"}, {"N": "115"}, {"N": "125"}, {"N": "130"}]},
      "memories": {"L": [{"N": "8400"}, {"N": "8350"}, {"N": "8420"}, {"N": "8500"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "0"}, {"N": "36"}, {"N": "0"}]},
      "totalScore": {"N": "36"},
      "maxTime": {"N": "130"},
      "maxMemory": {"N": "8500"}
    },
    {
      "subId": {"N": "3"},
      "username": {"S": "alice"},
      "problemName": {"S": "ping"},
      "submissionTime": {"S": "$TWENTY_MIN_AGO"},
      "gradingTime": {"S": "$TWENTY_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1140)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "10"}, {"N": "30"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "WA"}]},
      "times": {"L": [{"N": "500"}, {"N": "480"}, {"N": "510"}]},
      "memories": {"L": [{"N": "5100"}, {"N": "5100"}, {"N": "5100"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "10"}, {"N": "30"}, {"N": "0"}]},
      "totalScore": {"N": "40"},
      "maxTime": {"N": "510"},
      "maxMemory": {"N": "5100"}
    },
    {
      "subId": {"N": "4"},
      "username": {"S": "charlie"},
      "problemName": {"S": "ping"},
      "submissionTime": {"S": "$FIFTEEN_MIN_AGO"},
      "gradingTime": {"S": "$FIFTEEN_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -840)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "10"}, {"N": "30"}, {"N": "60"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "89"}, {"N": "85"}, {"N": "92"}]},
      "memories": {"L": [{"N": "42000"}, {"N": "42000"}, {"N": "42000"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "10"}, {"N": "30"}, {"N": "60"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "92"},
      "maxMemory": {"N": "42000"}
    },
    {
      "subId": {"N": "5"},
      "username": {"S": "alice"},
      "problemName": {"S": "prisoners"},
      "submissionTime": {"S": "$TWO_MIN_AGO"},
      "gradingTime": {"S": "$TWO_MIN_AGO"},
      "gradingCompleteTime": {"S": ""},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "27"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "WA"}, {"S": ":("}, {"S": ":("}]},
      "times": {"L": [{"N": "100"}, {"N": "150"}, {"N": "0"}, {"N": "0"}]},
      "memories": {"L": [{"N": "5000"}, {"N": "5000"}, {"N": "0"}, {"N": "0"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "1"}, {"N": "1"}]},
      "subtaskScores": {"L": [{"N": "27"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "totalScore": {"N": "27"},
      "maxTime": {"N": "150"},
      "maxMemory": {"N": "5000"}
    },
    {
      "subId": {"N": "6"},
      "username": {"S": "charlie"},
      "problemName": {"S": "addition"},
      "submissionTime": {"S": "$(get_timestamp -2700)"},
      "gradingTime": {"S": "$(get_timestamp -2700)"},
      "gradingCompleteTime": {"S": "$(get_timestamp -2640)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "0"}, {"N": "36"}, {"N": "36"}, {"N": "64"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "35"}, {"N": "32"}, {"N": "38"}, {"N": "34"}]},
      "memories": {"L": [{"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "0"}, {"N": "36"}, {"N": "64"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "38"},
      "maxMemory": {"N": "3800"}
    }
  ]
}
EOF
echo "  Created submissions.json (6 submissions)"

# =============================================================================
# ANNOUNCEMENTS
# =============================================================================
ANN_UUID1=$(gen_uuid)
ANN_UUID2=$(gen_uuid)
ANN_UUID3=$(gen_uuid)

cat > "$OUTPUT_DIR/announcements.json" << EOF
{
  "tableName": "{JudgeName}-announcements",
  "items": [
    {
      "announcementId": {"S": "$ANN_UUID1"},
      "title": {"S": "Welcome to Weekly Contest #42!"},
      "text": {"S": "The contest has started. Good luck to all participants! Remember to read the problem statements carefully."},
      "announcementTime": {"S": "$HOUR_AGO"}
    },
    {
      "announcementId": {"S": "$ANN_UUID2"},
      "title": {"S": "Clarification on Problem: ping"},
      "text": {"S": "The number of guesses allowed is at most 3. Make sure to read the Interactive section carefully."},
      "announcementTime": {"S": "$THIRTY_MIN_AGO"}
    },
    {
      "announcementId": {"S": "$ANN_UUID3"},
      "title": {"S": "15 minutes remaining"},
      "text": {"S": "The contest will end in 15 minutes. Make sure to submit your solutions before time runs out!"},
      "announcementTime": {"S": "$(get_timestamp -300)"}
    }
  ]
}
EOF
echo "  Created announcements.json (3 announcements)"

# =============================================================================
# CLARIFICATIONS
# =============================================================================
cat > "$OUTPUT_DIR/clarifications.json" << EOF
{
  "tableName": "{JudgeName}-clarifications",
  "items": [
    {
      "askedBy": {"S": "alice"},
      "clarificationTime": {"S": "$FORTY_FIVE_MIN_AGO"},
      "problemName": {"S": "addition"},
      "question": {"S": "Can the input numbers be negative?"},
      "answer": {"S": "Yes, the numbers can be negative. Please read the constraints carefully."},
      "answeredBy": {"S": "admin"}
    },
    {
      "askedBy": {"S": "bob"},
      "clarificationTime": {"S": "$TEN_MIN_AGO"},
      "problemName": {"S": "ping"},
      "question": {"S": "How many guesses are we allowed?"},
      "answer": {"S": ""},
      "answeredBy": {"S": ""}
    },
    {
      "askedBy": {"S": "charlie"},
      "clarificationTime": {"S": "$FIFTY_MIN_AGO"},
      "problemName": {"S": ""},
      "question": {"S": "Is there a penalty for wrong submissions?"},
      "answer": {"S": "No penalty in this contest. Only your best score counts."},
      "answeredBy": {"S": "admin"}
    }
  ]
}
EOF
echo "  Created clarifications.json (3 clarifications)"

# =============================================================================
# GLOBAL COUNTERS
# =============================================================================
cat > "$OUTPUT_DIR/counters.json" << 'EOF'
{
  "tableName": "{JudgeName}-global-counters",
  "items": [
    {
      "counterId": {"S": "submissionId"},
      "value": {"N": "6"}
    }
  ]
}
EOF
echo "  Created counters.json (1 counter)"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "Test data generation complete!"
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "Files created:"
ls -la "$OUTPUT_DIR"/*.json
echo ""
echo "Problems referenced: addition, ping, prisoners"
echo "(These must be created by running: bun run scripts/init-problems.ts)"
echo ""
echo "To import into DynamoDB, replace {JudgeName} with your judge prefix and use:"
echo "  ./scripts/import-testdata.sh <judge_name>"
echo ""
echo "Note: Timestamps are relative to when this script was run."
echo "      Re-run the script to generate fresh timestamps."
