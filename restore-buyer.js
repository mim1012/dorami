const http = require('http');
function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
async function run() {
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/dev-login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@doremi.shop', name: 'E2E ADMIN' }));
  const cookies = (loginRes.headers['set-cookie'] || []).join('; ');
  const searchRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/admin/users?search=buyer%40test.com&limit=5&page=1',
    method: 'GET', headers: { 'Cookie': cookies }
  });
  const d = JSON.parse(searchRes.body);
  const user = d.data && d.data.users && d.data.users[0];
  console.log('buyer@test.com status:', user && user.status);
  if (user && user.status !== 'ACTIVE') {
    const patchRes = await makeRequest({
      hostname: 'localhost', port: 3001,
      path: '/api/admin/users/' + user.id + '/status',
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Cookie': cookies }
    }, JSON.stringify({ status: 'ACTIVE' }));
    console.log('Restore PATCH status:', patchRes.status);
    console.log('Response:', patchRes.body.slice(0, 200));
  } else {
    console.log('Already ACTIVE, no action needed');
  }
}
run().catch(console.error);
