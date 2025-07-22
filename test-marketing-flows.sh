#!/bin/bash

echo "🚀 CCL-3 Marketing Platform End-to-End Test"
echo "============================================="

BASE_URL="http://localhost:5000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" "$BASE_URL$endpoint")
        http_code="${response: -3}"
        body="${response%???}"
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
        http_code="${response: -3}"
        body="${response%???}"
    fi
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
        echo "Response: $body"
        return 1
    fi
}

echo ""
echo "📋 1. CORE API ENDPOINTS"
echo "========================"

test_endpoint "Health Check" "GET" "/health"
test_endpoint "Leads List" "GET" "/api/leads"
test_endpoint "Available Leads" "GET" "/api/campaigns/available-leads"
test_endpoint "Agent Configurations" "GET" "/api/agent-configurations"

echo ""
echo "📤 2. DATA UPLOAD & API CREATION"
echo "================================="

# Test POST lead creation
lead_data='{"name":"Test Marketing Lead","email":"test@marketing.com","phone":"+15551234567","source":"api_test"}'
test_endpoint "Create Lead via API" "POST" "/api/leads" "$lead_data"

# Test CSV upload
echo -n "Testing CSV Upload... "
csv_response=$(curl -s -F "file=@comprehensive-test.csv" -F 'mappings=[{"csvColumn":"name","leadField":"name"},{"csvColumn":"email","leadField":"email"},{"csvColumn":"phone","leadField":"phone"},{"csvColumn":"source","leadField":"source"}]' "$BASE_URL/api/import/leads")
if echo "$csv_response" | jq -e '.successful > 0' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $csv_response"
fi

echo ""
echo "🤖 3. AGENT FUNCTIONALITY"
echo "========================="

# Test agent creation
agent_data='{"name":"Test Email Bot","type":"email","role":"Sales Rep","endGoal":"Convert leads","instructions":{"dos":["Be helpful"],"donts":["Be pushy"]},"personality":"professional","tone":"friendly"}'
test_endpoint "Create Agent" "POST" "/api/agent-configurations" "$agent_data"

echo ""
echo "📧 4. COMMUNICATION TESTING"
echo "============================"

# Test communications endpoint (if working)
comm_data='{"leadId":"test-123","channel":"email","direction":"inbound","content":"I need help with loans","status":"received"}'
test_endpoint "Communications" "POST" "/api/communications" "$comm_data"

echo ""
echo "📊 5. CAMPAIGN & EXECUTION"
echo "=========================="

test_endpoint "Campaigns List" "GET" "/api/campaigns"
test_endpoint "Campaign Execution" "GET" "/api/campaign-execution"

echo ""
echo "🎯 SUMMARY"
echo "=========="

# Count total leads to verify uploads worked
echo -n "Checking lead count... "
lead_count=$(curl -s "$BASE_URL/api/leads" | jq -r '.leads | length' 2>/dev/null)
if [ "$lead_count" -gt 10 ]; then
    echo -e "${GREEN}✅ $lead_count leads in database${NC}"
else
    echo -e "${YELLOW}⚠️  Only $lead_count leads found${NC}"
fi

echo ""
echo "🔍 NEXT STEPS FOR MANUAL TESTING:"
echo "- Test email generation through UI"
echo "- Test SMS functionality"  
echo "- Test conversation channel switching"
echo "- Test campaign goal achievement and handover"
echo "" 