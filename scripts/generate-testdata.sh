#!/bin/bash

# Generate test data for Codebreaker Contest Manager
# This script creates JSON files that can be used to seed DynamoDB tables
# or reset the mock data if databases get wiped.
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

echo "Generating test data in $OUTPUT_DIR..."

# =============================================================================
# USERS
# =============================================================================
cat > "$OUTPUT_DIR/users.json" << 'EOF'
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
        "twosum": {"N": "100"},
        "binarysearch": {"N": "100"},
        "longestsubstr": {"N": "30"},
        "graphtraversal": {"N": "0"}
      }},
      "problemSubmissions": {"M": {
        "twosum": {"N": "1"},
        "binarysearch": {"N": "2"},
        "longestsubstr": {"N": "3"},
        "graphtraversal": {"N": "1"}
      }},
      "latestSubmissions": {"M": {
        "twosum": {"S": "PLACEHOLDER_30MIN_AGO"},
        "longestsubstr": {"S": "PLACEHOLDER_20MIN_AGO"},
        "graphtraversal": {"S": "PLACEHOLDER_2MIN_AGO"}
      }},
      "latestScoreChange": {"S": "PLACEHOLDER_30MIN_AGO"}
    },
    {
      "username": {"S": "bob"},
      "role": {"S": "member"},
      "fullname": {"S": "Bob Smith"},
      "email": {"S": "bob@example.com"},
      "label": {"S": "Team B"},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {
        "twosum": {"N": "60"}
      }},
      "problemSubmissions": {"M": {
        "twosum": {"N": "1"}
      }},
      "latestSubmissions": {"M": {
        "twosum": {"S": "PLACEHOLDER_25MIN_AGO"}
      }},
      "latestScoreChange": {"S": "PLACEHOLDER_25MIN_AGO"}
    },
    {
      "username": {"S": "charlie"},
      "role": {"S": "member"},
      "fullname": {"S": "Charlie Brown"},
      "email": {"S": "charlie@example.com"},
      "label": {"S": ""},
      "contest": {"S": "contest-1"},
      "problemScores": {"M": {
        "twosum": {"N": "100"},
        "binarysearch": {"N": "100"}
      }},
      "problemSubmissions": {"M": {
        "twosum": {"N": "2"},
        "binarysearch": {"N": "1"}
      }},
      "latestSubmissions": {"M": {
        "twosum": {"S": "PLACEHOLDER_40MIN_AGO"},
        "binarysearch": {"S": "PLACEHOLDER_15MIN_AGO"}
      }},
      "latestScoreChange": {"S": "PLACEHOLDER_15MIN_AGO"}
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

# Replace placeholders with actual timestamps
THIRTY_MIN_AGO=$(get_timestamp -1800)
TWENTY_MIN_AGO=$(get_timestamp -1200)
TWENTY_FIVE_MIN_AGO=$(get_timestamp -1500)
FORTY_MIN_AGO=$(get_timestamp -2400)
FIFTEEN_MIN_AGO=$(get_timestamp -900)
TWO_MIN_AGO=$(get_timestamp -120)

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/PLACEHOLDER_30MIN_AGO/$THIRTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i '' "s/PLACEHOLDER_20MIN_AGO/$TWENTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i '' "s/PLACEHOLDER_25MIN_AGO/$TWENTY_FIVE_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i '' "s/PLACEHOLDER_40MIN_AGO/$FORTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i '' "s/PLACEHOLDER_15MIN_AGO/$FIFTEEN_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i '' "s/PLACEHOLDER_2MIN_AGO/$TWO_MIN_AGO/g" "$OUTPUT_DIR/users.json"
else
  sed -i "s/PLACEHOLDER_30MIN_AGO/$THIRTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i "s/PLACEHOLDER_20MIN_AGO/$TWENTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i "s/PLACEHOLDER_25MIN_AGO/$TWENTY_FIVE_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i "s/PLACEHOLDER_40MIN_AGO/$FORTY_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i "s/PLACEHOLDER_15MIN_AGO/$FIFTEEN_MIN_AGO/g" "$OUTPUT_DIR/users.json"
  sed -i "s/PLACEHOLDER_2MIN_AGO/$TWO_MIN_AGO/g" "$OUTPUT_DIR/users.json"
fi

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
        {"S": "twosum"},
        {"S": "binarysearch"},
        {"S": "longestsubstr"},
        {"S": "graphtraversal"}
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
        {"S": "helloworld"},
        {"S": "sumtwo"}
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
        {"S": "twosum"},
        {"S": "longestsubstr"},
        {"S": "graphtraversal"}
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
# PROBLEMS
# =============================================================================
cat > "$OUTPUT_DIR/problems.json" << 'EOF'
{
  "tableName": "{JudgeName}-problems",
  "items": [
    {
      "problemName": {"S": "twosum"},
      "title": {"S": "Two Sum"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "10"},
      "subtaskScores": {"L": [{"N": "30"}, {"N": "70"}]},
      "subtaskDependency": {"L": [{"S": "1-3"}, {"S": "4-10"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "binarysearch"},
      "title": {"S": "Binary Search"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "15"},
      "subtaskScores": {"L": [{"N": "100"}]},
      "subtaskDependency": {"L": [{"S": "1-15"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "longestsubstr"},
      "title": {"S": "Longest Substring Without Repeating"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "2"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "20"},
      "subtaskScores": {"L": [{"N": "30"}, {"N": "30"}, {"N": "40"}]},
      "subtaskDependency": {"L": [{"S": "1-5"}, {"S": "6-12"}, {"S": "13-20"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "graphtraversal"},
      "title": {"S": "Graph Traversal"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "3"},
      "memoryLimit": {"N": "512"},
      "testcaseCount": {"N": "25"},
      "subtaskScores": {"L": [{"N": "10"}, {"N": "30"}, {"N": "60"}]},
      "subtaskDependency": {"L": [{"S": "1-5"}, {"S": "6-15"}, {"S": "16-25"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "helloworld"},
      "title": {"S": "Hello World"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "1"},
      "subtaskScores": {"L": [{"N": "100"}]},
      "subtaskDependency": {"L": [{"S": "1"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "sumtwo"},
      "title": {"S": "Sum of Two Numbers"},
      "problem_type": {"S": "Batch"},
      "timeLimit": {"N": "1"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "10"},
      "subtaskScores": {"L": [{"N": "100"}]},
      "subtaskDependency": {"L": [{"S": "1-10"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": false},
      "fullFeedback": {"BOOL": true},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "interactive"},
      "title": {"S": "Guess the Number"},
      "problem_type": {"S": "Interactive"},
      "timeLimit": {"N": "2"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "5"},
      "subtaskScores": {"L": [{"N": "20"}, {"N": "80"}]},
      "subtaskDependency": {"L": [{"S": "1"}, {"S": "2-5"}]},
      "attachments": {"BOOL": false},
      "customChecker": {"BOOL": true},
      "fullFeedback": {"BOOL": false},
      "validated": {"BOOL": true}
    },
    {
      "problemName": {"S": "communication"},
      "title": {"S": "Message Passing"},
      "problem_type": {"S": "Communication"},
      "timeLimit": {"N": "2"},
      "memoryLimit": {"N": "256"},
      "testcaseCount": {"N": "10"},
      "subtaskScores": {"L": [{"N": "50"}, {"N": "50"}]},
      "subtaskDependency": {"L": [{"S": "1-5"}, {"S": "6-10"}]},
      "attachments": {"BOOL": true},
      "customChecker": {"BOOL": true},
      "fullFeedback": {"BOOL": false},
      "validated": {"BOOL": false},
      "nameA": {"S": "encoder"},
      "nameB": {"S": "decoder"}
    }
  ]
}
EOF
echo "  Created problems.json (8 problems)"

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
      "problemName": {"S": "twosum"},
      "submissionTime": {"S": "$THIRTY_MIN_AGO"},
      "gradingTime": {"S": "$THIRTY_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1740)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "10"}, {"N": "10"}, {"N": "10"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "45"}, {"N": "42"}, {"N": "48"}, {"N": "50"}, {"N": "52"}, {"N": "49"}, {"N": "51"}, {"N": "47"}, {"N": "53"}, {"N": "46"}]},
      "memories": {"L": [{"N": "4200"}, {"N": "4180"}, {"N": "4220"}, {"N": "4250"}, {"N": "4300"}, {"N": "4280"}, {"N": "4260"}, {"N": "4240"}, {"N": "4320"}, {"N": "4190"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "30"}, {"N": "70"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "53"},
      "maxMemory": {"N": "4320"}
    },
    {
      "subId": {"N": "2"},
      "username": {"S": "bob"},
      "problemName": {"S": "twosum"},
      "submissionTime": {"S": "$TWENTY_FIVE_MIN_AGO"},
      "gradingTime": {"S": "$TWENTY_FIVE_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1440)"},
      "language": {"S": "py"},
      "score": {"L": [{"N": "10"}, {"N": "10"}, {"N": "10"}, {"N": "7"}, {"N": "7"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "WA"}, {"S": "WA"}, {"S": "WA"}, {"S": "WA"}, {"S": "WA"}]},
      "times": {"L": [{"N": "120"}, {"N": "115"}, {"N": "125"}, {"N": "130"}, {"N": "128"}, {"N": "122"}, {"N": "118"}, {"N": "124"}, {"N": "126"}, {"N": "119"}]},
      "memories": {"L": [{"N": "8400"}, {"N": "8350"}, {"N": "8420"}, {"N": "8500"}, {"N": "8480"}, {"N": "8460"}, {"N": "8440"}, {"N": "8410"}, {"N": "8520"}, {"N": "8380"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "30"}, {"N": "30"}]},
      "totalScore": {"N": "60"},
      "maxTime": {"N": "130"},
      "maxMemory": {"N": "8520"}
    },
    {
      "subId": {"N": "3"},
      "username": {"S": "alice"},
      "problemName": {"S": "longestsubstr"},
      "submissionTime": {"S": "$TWENTY_MIN_AGO"},
      "gradingTime": {"S": "$TWENTY_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -1140)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "6"}, {"N": "6"}, {"N": "6"}, {"N": "6"}, {"N": "6"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}, {"S": "TLE"}]},
      "times": {"L": [{"N": "500"}, {"N": "480"}, {"N": "510"}, {"N": "495"}, {"N": "505"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}, {"N": "2500"}]},
      "memories": {"L": [{"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}, {"N": "5100"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "30"}, {"N": "0"}, {"N": "0"}]},
      "totalScore": {"N": "30"},
      "maxTime": {"N": "2500"},
      "maxMemory": {"N": "5100"}
    },
    {
      "subId": {"N": "4"},
      "username": {"S": "charlie"},
      "problemName": {"S": "binarysearch"},
      "submissionTime": {"S": "$FIFTEEN_MIN_AGO"},
      "gradingTime": {"S": "$FIFTEEN_MIN_AGO"},
      "gradingCompleteTime": {"S": "$(get_timestamp -840)"},
      "language": {"S": "java"},
      "score": {"L": [{"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "6"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "89"}, {"N": "85"}, {"N": "92"}, {"N": "88"}, {"N": "91"}, {"N": "87"}, {"N": "90"}, {"N": "86"}, {"N": "93"}, {"N": "84"}, {"N": "89"}, {"N": "88"}, {"N": "90"}, {"N": "87"}, {"N": "89"}]},
      "memories": {"L": [{"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}, {"N": "42000"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "100"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "93"},
      "maxMemory": {"N": "42000"}
    },
    {
      "subId": {"N": "5"},
      "username": {"S": "alice"},
      "problemName": {"S": "graphtraversal"},
      "submissionTime": {"S": "$TWO_MIN_AGO"},
      "gradingTime": {"S": "$TWO_MIN_AGO"},
      "gradingCompleteTime": {"S": ""},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "verdicts": {"L": [{"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}, {"S": ":("}]},
      "times": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "memories": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}, {"N": "1"}]},
      "subtaskScores": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "totalScore": {"N": "0"},
      "maxTime": {"N": "0"},
      "maxMemory": {"N": "0"}
    },
    {
      "subId": {"N": "6"},
      "username": {"S": "alice"},
      "problemName": {"S": "binarysearch"},
      "submissionTime": {"S": "$(get_timestamp -2700)"},
      "gradingTime": {"S": "$(get_timestamp -2700)"},
      "gradingCompleteTime": {"S": "$(get_timestamp -2640)"},
      "language": {"S": "cpp"},
      "score": {"L": [{"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "7"}, {"N": "6"}]},
      "verdicts": {"L": [{"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}, {"S": "AC"}]},
      "times": {"L": [{"N": "35"}, {"N": "32"}, {"N": "38"}, {"N": "34"}, {"N": "36"}, {"N": "33"}, {"N": "37"}, {"N": "31"}, {"N": "39"}, {"N": "30"}, {"N": "35"}, {"N": "34"}, {"N": "36"}, {"N": "33"}, {"N": "35"}]},
      "memories": {"L": [{"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}, {"N": "3800"}]},
      "returnCodes": {"L": [{"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}, {"N": "0"}]},
      "status": {"L": [{"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}, {"N": "2"}]},
      "subtaskScores": {"L": [{"N": "100"}]},
      "totalScore": {"N": "100"},
      "maxTime": {"N": "39"},
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
      "title": {"S": "Clarification on Problem 3"},
      "text": {"S": "The input string will only contain lowercase English letters. Maximum length is 10^5."},
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
FORTY_FIVE_MIN_AGO=$(get_timestamp -2700)
TEN_MIN_AGO=$(get_timestamp -600)
FIFTY_MIN_AGO=$(get_timestamp -3000)

cat > "$OUTPUT_DIR/clarifications.json" << EOF
{
  "tableName": "{JudgeName}-clarifications",
  "items": [
    {
      "askedBy": {"S": "alice"},
      "clarificationTime": {"S": "$FORTY_FIVE_MIN_AGO"},
      "problemName": {"S": "twosum"},
      "question": {"S": "Can the array contain duplicate values?"},
      "answer": {"S": "Yes, the array can contain duplicates, but the solution indices will be unique."},
      "answeredBy": {"S": "admin"}
    },
    {
      "askedBy": {"S": "bob"},
      "clarificationTime": {"S": "$TEN_MIN_AGO"},
      "problemName": {"S": "longestsubstr"},
      "question": {"S": "Is the empty string considered a valid substring?"},
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
echo "To import into DynamoDB, replace {JudgeName} with your judge prefix and use:"
echo "  aws dynamodb batch-write-item --request-items file://<filename>.json"
echo ""
echo "Note: Timestamps are relative to when this script was run."
echo "      Re-run the script to generate fresh timestamps."
