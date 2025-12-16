#!/bin/bash

echo "=========================================="
echo "   KIỂM TRA SERVER ACCSAFE API"
echo "=========================================="
echo ""

# 1. Kiểm tra Node.js
echo "1. Node.js Version:"
if command -v node &> /dev/null; then
    node -v
else
    echo "   ❌ Node.js chưa được cài đặt"
fi
echo ""

# 2. Kiểm tra process
echo "2. Process đang chạy:"
if pgrep -f "node.*server.js" > /dev/null; then
    echo "   ✅ Server đang chạy"
    ps aux | grep "node.*server.js" | grep -v grep
else
    echo "   ❌ Server không chạy"
fi
echo ""

# 3. Kiểm tra PM2
echo "3. PM2 Status:"
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "   ⚠️  PM2 chưa được cài đặt"
fi
echo ""

# 4. Kiểm tra port 3000
echo "4. Port 3000:"
if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    echo "   ✅ Port 3000 đang được sử dụng"
    netstat -tulpn 2>/dev/null | grep ":3000 " || echo "   (Không thể hiển thị process)"
else
    echo "   ❌ Port 3000 không được sử dụng"
fi
echo ""

# 5. Kiểm tra files
echo "5. Database Files:"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -f "database.json" ]; then
    echo "   ✅ database.json tồn tại"
    SIZE=$(wc -c < database.json)
    echo "   📊 Kích thước: $SIZE bytes"
    USER_COUNT=$(cat database.json 2>/dev/null | grep -o '"email"' | wc -l)
    echo "   👥 Số users: $USER_COUNT"
else
    echo "   ❌ database.json không tồn tại"
fi

if [ -f "profiles.json" ]; then
    echo "   ✅ profiles.json tồn tại"
    SIZE=$(wc -c < profiles.json)
    echo "   📊 Kích thước: $SIZE bytes"
else
    echo "   ⚠️  profiles.json không tồn tại (sẽ tự tạo)"
fi

if [ -f "proxies.json" ]; then
    echo "   ✅ proxies.json tồn tại"
    SIZE=$(wc -c < proxies.json)
    echo "   📊 Kích thước: $SIZE bytes"
else
    echo "   ⚠️  proxies.json không tồn tại (sẽ tự tạo)"
fi
echo ""

# 6. Kiểm tra quyền file
echo "6. Quyền File:"
ls -la database.json profiles.json proxies.json 2>/dev/null | awk '{print "   " $1 " " $9}'
echo ""

# 7. Test API Health
echo "7. Test API Health:"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "   ✅ API Health Check: OK"
    curl -s http://localhost:3000/api/health | head -c 100
    echo ""
else
    echo "   ❌ API Health Check: FAILED (HTTP $HEALTH_RESPONSE)"
    echo "   💡 Server có thể chưa chạy hoặc có lỗi"
fi
echo ""

# 8. Kiểm tra firewall (nếu có quyền)
echo "8. Firewall Status:"
if command -v ufw &> /dev/null && [ "$EUID" -eq 0 ]; then
    ufw status | grep 3000 || echo "   ⚠️  Port 3000 chưa được mở trong UFW"
elif command -v firewall-cmd &> /dev/null && [ "$EUID" -eq 0 ]; then
    firewall-cmd --list-ports | grep -q 3000 && echo "   ✅ Port 3000 đã mở" || echo "   ⚠️  Port 3000 chưa được mở"
else
    echo "   ⚠️  Không thể kiểm tra firewall (cần quyền root)"
fi
echo ""

echo "=========================================="
echo "   KẾT THÚC KIỂM TRA"
echo "=========================================="

