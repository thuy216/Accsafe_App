#!/bin/bash

# Script test tất cả endpoints của API
# Sử dụng: bash test-endpoints.sh

API_URL="http://163.44.193.71:3000/api"
TEST_EMAIL="admin@gmail.com"
TEST_PASSWORD="123"

echo "============================================="
echo "TEST API ENDPOINTS"
echo "============================================="
echo ""

# 1. Test Health
echo "1. Testing Health Endpoint:"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ Health check passed"
    echo "   Response: $BODY"
else
    echo "   ✗ Health check failed (HTTP $HTTP_CODE)"
fi
echo ""

# 2. Test Login
echo "2. Testing Login Endpoint:"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -w "\nHTTP_CODE:%{http_code}")
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ Login successful"
    TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        echo "   Token: ${TOKEN:0:30}..."
        export AUTH_TOKEN="$TOKEN"
    else
        echo "   ✗ No token in response"
        exit 1
    fi
else
    echo "   ✗ Login failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
    exit 1
fi
echo ""

# 3. Test GET Profiles
echo "3. Testing GET /api/profiles:"
PROFILES_RESPONSE=$(curl -s -X GET "$API_URL/profiles?userId=$TEST_EMAIL" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\nHTTP_CODE:%{http_code}")
HTTP_CODE=$(echo "$PROFILES_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$PROFILES_RESPONSE" | grep -v "HTTP_CODE")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ GET profiles successful"
    PROFILE_COUNT=$(echo "$BODY" | grep -o '"profiles":\[' | wc -l)
    echo "   Response received"
else
    echo "   ✗ GET profiles failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
fi
echo ""

# 4. Test POST Profile
echo "4. Testing POST /api/profiles:"
PROFILE_DATA='{
  "userId": "'$TEST_EMAIL'",
  "name": "Test Profile",
  "deviceType": "desktop",
  "os": "windows",
  "browser": "chrome",
  "userAgent": "Mozilla/5.0",
  "timezone": "Asia/Ho_Chi_Minh",
  "hardware": {
    "cpuCores": 4,
    "ram": 8,
    "gpu": "NVIDIA",
    "screenResolution": "1920x1080"
  },
  "status": "stopped"
}'
POST_RESPONSE=$(curl -s -X POST "$API_URL/profiles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$PROFILE_DATA" \
  -w "\nHTTP_CODE:%{http_code}")
HTTP_CODE=$(echo "$POST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$POST_RESPONSE" | grep -v "HTTP_CODE")
if [ "$HTTP_CODE" = "201" ]; then
    echo "   ✓ POST profile successful"
    PROFILE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    if [ -n "$PROFILE_ID" ]; then
        echo "   Created profile ID: $PROFILE_ID"
        export TEST_PROFILE_ID="$PROFILE_ID"
    fi
else
    echo "   ✗ POST profile failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
fi
echo ""

# 5. Test DELETE Profile (nếu có profile ID)
if [ -n "$TEST_PROFILE_ID" ]; then
    echo "5. Testing DELETE /api/profiles/$TEST_PROFILE_ID:"
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/profiles/$TEST_PROFILE_ID?userId=$TEST_EMAIL" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -w "\nHTTP_CODE:%{http_code}")
    HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✓ DELETE profile successful"
        echo "   Response: $BODY"
    else
        echo "   ✗ DELETE profile failed (HTTP $HTTP_CODE)"
        echo "   Response: $BODY"
    fi
else
    echo "5. Skipping DELETE test (no profile ID)"
fi
echo ""

echo "============================================="
echo "TEST COMPLETED"
echo "============================================="

