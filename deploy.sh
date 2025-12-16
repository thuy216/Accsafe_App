#!/bin/bash

# Deploy Script - Upload chỉ folder server/ lên VPS
# Sử dụng: bash deploy.sh

VPS_HOST="163.44.193.71"
VPS_USER="root"
# Thử deploy vào cả 2 đường dẫn có thể có
VPS_PATH1="/opt/accsafe-server"
VPS_PATH2="/var/www/accsafe-api"

echo "🚀 Deploying AccSafe Backend to VPS..."
echo "=========================================="

# Check if server folder exists
if [ ! -d "server" ]; then
    echo "❌ Error: Folder 'server' không tồn tại!"
    exit 1
fi

# Kiểm tra đường dẫn nào tồn tại trên server
echo "🔍 Checking server path..."
VPS_PATH=""
if ssh ${VPS_USER}@${VPS_HOST} "[ -d ${VPS_PATH1} ]"; then
    VPS_PATH=${VPS_PATH1}
    echo "✅ Found server at: ${VPS_PATH1}"
elif ssh ${VPS_USER}@${VPS_HOST} "[ -d ${VPS_PATH2} ]"; then
    VPS_PATH=${VPS_PATH2}
    echo "✅ Found server at: ${VPS_PATH2}"
else
    echo "⚠️  Neither path exists, using default: ${VPS_PATH1}"
    VPS_PATH=${VPS_PATH1}
fi

# Upload code (exclude node_modules, .env, logs)
echo "📤 Uploading code to VPS (${VPS_PATH})..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'logs' \
  --exclude '.git' \
  --exclude '*.log' \
  server/ ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/

if [ $? -eq 0 ]; then
    echo "✅ Upload thành công!"
else
    echo "❌ Upload thất bại!"
    exit 1
fi

# Run commands on VPS
echo "🔧 Installing dependencies and restarting server..."
ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
# Kiểm tra đường dẫn nào tồn tại
if [ -d "${VPS_PATH1}" ]; then
    cd ${VPS_PATH1}
    echo "📁 Using ${VPS_PATH1}"
elif [ -d "${VPS_PATH2}" ]; then
    cd ${VPS_PATH2}
    echo "📁 Using ${VPS_PATH2}"
else
    echo "❌ Không tìm thấy thư mục server!"
    exit 1
fi

echo "📥 Installing dependencies..."
npm install --production

echo "🔄 Restarting PM2..."
# Thử restart với các tên process có thể có
pm2 restart accsafe-api 2>/dev/null || \
pm2 restart accsafe-server 2>/dev/null || \
pm2 start server.js --name accsafe-api

pm2 save
echo "✅ Deploy completed!"
pm2 list
ENDSSH

echo ""
echo "✅ Deploy hoàn tất!"
echo "🌐 Test API: curl http://${VPS_HOST}:3000/api/health"
echo ""
echo "📋 Để test User Management API:"
echo "   1. Login: curl -X POST http://${VPS_HOST}:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@gmail.com\",\"password\":\"123\"}'"
echo "   2. Lấy token từ response"
echo "   3. Test: curl http://${VPS_HOST}:3000/api/users -H 'Authorization: Bearer TOKEN'"
