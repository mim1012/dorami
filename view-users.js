const { PrismaClient } = require('@prisma/client');
const express = require('express');
const fs = require('fs');
const app = express();

const prisma = new PrismaClient();

app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        kakaoId: true,
        instagramId: true,
        depositorName: true,
        shippingAddress: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>User List - ${users.length}명</title>
        <style>
          body { font-family: Arial; margin: 20px; background: #f5f5f5; }
          h1 { color: #333; }
          .controls { margin: 20px 0; }
          button { padding: 10px 20px; background: #FF1493; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
          button:hover { background: #ff0080; }
          table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-size: 14px; }
          th { background: #FF1493; color: white; font-weight: bold; }
          tr:hover { background: #f9f9f9; }
          .null { color: #999; font-style: italic; }
          .admin { background: #ffe6f0; }
          .stats { margin: 20px 0; padding: 15px; background: white; border-radius: 4px; }
          .stat-item { display: inline-block; margin-right: 30px; }
          .stat-num { font-size: 24px; font-weight: bold; color: #FF1493; }
        </style>
      </head>
      <body>
        <h1>👥 사용자 목록 (${users.length}명)</h1>
        
        <div class="controls">
          <button onclick="location.href='/download'">📥 Excel로 다운로드 (CSV)</button>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div>전체</div>
            <div class="stat-num">${users.length}</div>
          </div>
          <div class="stat-item">
            <div>instagramId 없음</div>
            <div class="stat-num">${users.filter(u => !u.instagramId).length}</div>
          </div>
          <div class="stat-item">
            <div>shippingAddress 없음</div>
            <div class="stat-num">${users.filter(u => !u.shippingAddress).length}</div>
          </div>
          <div class="stat-item">
            <div>둘 다 없음</div>
            <div class="stat-num">${users.filter(u => !u.instagramId && !u.shippingAddress).length}</div>
          </div>
        </div>

        <table>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>카카오ID</th>
            <th>인스타그램</th>
            <th>예금주</th>
            <th>배송주소</th>
            <th>역할</th>
            <th>가입일</th>
          </tr>
          ${users.map(u => `
            <tr ${u.role === 'ADMIN' ? 'class="admin"' : ''}>
              <td>${u.name}</td>
              <td>${u.email || '-'}</td>
              <td>${u.kakaoId}</td>
              <td>${u.instagramId ? u.instagramId : '<span class="null">없음</span>'}</td>
              <td>${u.depositorName ? u.depositorName : '<span class="null">없음</span>'}</td>
              <td>${u.shippingAddress ? '✓ 있음' : '<span class="null">없음</span>'}</td>
              <td>${u.role}</td>
              <td>${new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.send(`<h1>오류</h1><p>${err.message}</p>`);
  }
});

app.get('/download', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        kakaoId: true,
        instagramId: true,
        depositorName: true,
        shippingAddress: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let csv = 'name,email,kakaoId,instagramId,depositorName,shipping,role,createdAt\n';
    users.forEach(u => {
      csv += `"${u.name}","${u.email || ''}","${u.kakaoId}","${u.instagramId || ''}","${u.depositorName || ''}","${u.shippingAddress ? '✓' : ''}","${u.role}","${u.createdAt}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send('\ufeff' + csv);
  } catch (err) {
    res.send(`<h1>오류</h1><p>${err.message}</p>`);
  }
});

app.listen(3333, () => {
  console.log('📊 http://localhost:3333/users');
  console.log('📥 http://localhost:3333/download (CSV 다운로드)');
});
