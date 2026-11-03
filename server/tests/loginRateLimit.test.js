const express = require('express');
const request = require('supertest');
const pino = require('pino');
const { createLoginRateLimit } = require('../src/middleware/loginRateLimit');
const { errorHandler } = require('../src/middleware/errorHandler');

function setup({ trustProxy = 0, maxEntries, handler } = {}) {
  let timestamp = 1000000;
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(express.json());
  app.post('/login', createLoginRateLimit({ now: () => timestamp, maxEntries }), handler || ((req, res) => res.status(req.body.status || 401).end()));
  app.use(errorHandler(pino({ level: 'silent' })));
  return { app, advance(ms) { timestamp += ms; } };
}

test('ten failures allowed, eleventh blocked with central error and Retry-After; exact expiry recovers', async () => {
  const { app, advance } = setup();
  for (let i=0; i<10; i++) expect((await request(app).post('/login').send({})).status).toBe(401);
  const blocked = await request(app).post('/login').send({ status: 200 });
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe('RATE_LIMITED');
  expect(blocked.headers['retry-after']).toBe('900');
  advance(899999);
  const boundary = await request(app).post('/login').send({});
  expect(boundary.status).toBe(429);
  expect(boundary.headers['retry-after']).toBe('1');
  advance(1);
  expect((await request(app).post('/login').send({ status: 200 })).status).toBe(200);
});

test('successful, invalid-input and service-error requests do not consume credential-failure quota', async () => {
  const { app }=setup();
  for (const status of [200,400,500]) {
    for (let i=0;i<11;i++) expect((await request(app).post('/login').send({status})).status).toBe(status);
  }
  for(let i=0;i<10;i++) expect((await request(app).post('/login').send({})).status).toBe(401);
  expect((await request(app).post('/login').send({})).status).toBe(429);
});

test('untrusted X-Forwarded-For changes cannot bypass the direct-connection bucket', async () => {
  const { app }=setup();
  for(let i=0;i<10;i++) expect((await request(app).post('/login').set('X-Forwarded-For',`192.0.2.${i+1}`).send({})).status).toBe(401);
  expect((await request(app).post('/login').set('X-Forwarded-For','192.0.2.99').send({})).status).toBe(429);
});

test('explicitly trusted proxy separates IP buckets and expired entries free capacity', async () => {
  const { app, advance }=setup({trustProxy:1,maxEntries:2});
  for(let i=0;i<10;i++) expect((await request(app).post('/login').set('X-Forwarded-For','192.0.2.1').send({})).status).toBe(401);
  expect((await request(app).post('/login').set('X-Forwarded-For','192.0.2.2').send({})).status).toBe(401);
  expect((await request(app).post('/login').set('X-Forwarded-For','192.0.2.3').send({})).status).toBe(429);
  advance(900000);
  expect((await request(app).post('/login').set('X-Forwarded-For','192.0.2.3').send({})).status).toBe(401);
});

test('limiter instances do not share failures between application instances', async () => {
  const first=setup(), second=setup();
  for(let i=0;i<10;i++) await request(first.app).post('/login').send({});
  expect((await request(second.app).post('/login').send({})).status).toBe(401);
});

test('in-flight credential checks reserve quota against concurrent bypass', async () => {
  const pending=[];
  let ready;
  const allStarted=new Promise(resolve=>{ready=resolve;});
  const {app}=setup({handler(req,res){pending.push(()=>res.status(401).end());if(pending.length===10)ready();}});
  const first=Array.from({length:10},()=>request(app).post('/login').send({}).then(response=>response.status));
  await allStarted;
  const blocked=await request(app).post('/login').send({});
  pending.forEach(finish=>finish());
  expect(blocked.status).toBe(429);
  expect(await Promise.all(first)).toEqual(Array(10).fill(401));
});
