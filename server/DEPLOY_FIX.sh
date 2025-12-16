#!/bin/bash

# Script để fix server dựa trên log

cd /var/www/accsafe-api

echo "=== FIXING SERVER ==="

# 1. Backup server.js
echo "1. Backup server.js..."
cp server.js server.js.bak

# 2. Kiểm tra database.json có admin không
echo "2. Kiểm tra database.json..."
if ! grep -q "admin@gmail.com" database.json 2>/dev/null; then
  echo "   Tạo lại admin account..."
  cat > database.json << 'EOF'
[
  {
    "email": "admin@gmail.com",
    "password": "123",
    "name": "Super Admin",
    "role": "admin",
    "createdAt": "2025-12-12T00:00:00.000Z"
  }
]
EOF
  echo "   ✅ Đã tạo admin account"
else
  echo "   ✅ Admin account đã tồn tại"
fi

# 3. Kiểm tra auth-middleware.js có tồn tại không
echo "3. Kiểm tra auth-middleware.js..."
if [ ! -f "auth-middleware.js" ]; then
  echo "   ⚠️  auth-middleware.js chưa tồn tại, cần pull code mới từ Git"
  echo "   Chạy: git pull origin server"
else
  echo "   ✅ auth-middleware.js đã tồn tại"
fi

# 4. Kiểm tra server.js có require auth-middleware không
echo "4. Kiểm tra server.js..."
if ! grep -q "require.*auth-middleware" server.js; then
  echo "   ⚠️  server.js chưa require auth-middleware, cần pull code mới từ Git"
  echo "   Chạy: git pull origin server"
else
  echo "   ✅ server.js đã require auth-middleware"
fi

# 5. Kiểm tra token format trong login
echo "5. Kiểm tra token format..."
if ! grep -q 'token: "fake-jwt-" + Date.now() + "-" + email' server.js; then
  echo "   ⚠️  Token format chưa được cập nhật, cần pull code mới từ Git"
  echo "   Chạy: git pull origin server"
else
  echo "   ✅ Token format đã đúng"
fi

# 6. Restart server
echo "6. Restart server..."
pm2 restart accsafe-api
sleep 3

# 7. Kiểm tra trạng thái
echo "7. Kiểm tra trạng thái server..."
pm2 list | grep accsafe-api

# 8. Test API
echo "8. Test API health check..."
curl -s http://localhost:3000/api/health | head -c 100
echo ""

echo ""
echo "=== FIX COMPLETED ==="
echo ""
echo "Nếu vẫn có lỗi, hãy:"
echo "1. Pull code mới: git pull origin server"
echo "2. Restart server: pm2 restart accsafe-api"
echo "3. Kiểm tra logs: pm2 logs accsafe-api"

