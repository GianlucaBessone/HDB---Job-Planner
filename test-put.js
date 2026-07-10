const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/informes-tecnicos/cmrc9ende00014quyv5cn8uwo',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({ signatureId: 'test' }));
req.end();
