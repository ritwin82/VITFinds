import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, TransactWriteCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { randomUUID } from 'node:crypto';
import { execute, initialState, AppError } from './domain.mjs';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const table = process.env.TABLE_NAME;
const realtime = new ApiGatewayManagementApiClient({ endpoint: process.env.WS_MANAGEMENT_URL });
async function publish(userIds) {
  for (const userId of new Set(userIds)) {
    let cursor;
    do {
      const page = await db.send(new QueryCommand({ TableName: process.env.CONNECTION_TABLE, IndexName: 'ByUser', KeyConditionExpression: 'userId = :id', ExpressionAttributeValues: { ':id': userId }, ExclusiveStartKey: cursor }));
      await Promise.all((page.Items || []).map(async connection => {
        try { await realtime.send(new PostToConnectionCommand({ ConnectionId: connection.connectionId, Data: Buffer.from(JSON.stringify({ type: 'sync' })) })); }
        catch (error) {
          if (error.name === 'GoneException') await db.send(new DeleteCommand({ TableName: process.env.CONNECTION_TABLE, Key: { connectionId: connection.connectionId } }));
          else console.error('Realtime delivery failed', error);
        }
      }));
      cursor = page.LastEvaluatedKey;
    } while (cursor);
  }
}
async function load() {
  const s = initialState(); let cursor;
  do {
    const page = await db.send(new ScanCommand({ TableName: table, ConsistentRead: true, ExclusiveStartKey: cursor }));
    for (const item of page.Items || []) if (Object.hasOwn(s, item.kind)) s[item.kind].push(item.value);
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return s;
}
const flatten = s => new Map(Object.entries(s).flatMap(([kind, rows]) => rows.map(value => [`${kind}#${value.id}`, { kind, value }])));
async function save(before, after) {
  const old = flatten(before), next = flatten(after), actions = [];
  for (const [pk, item] of next) {
    const previous = old.get(pk);
    if (JSON.stringify(previous?.value) === JSON.stringify(item.value)) continue;
    const value = { ...item.value, version: (previous?.value.version || 0) + 1 };
    actions.push({ Put: { TableName: table, Item: { pk, kind: item.kind, value }, ConditionExpression: previous ? '#v.#version = :version' : 'attribute_not_exists(pk)', ...(previous ? { ExpressionAttributeNames: { '#v': 'value', '#version': 'version' }, ExpressionAttributeValues: { ':version': previous.value.version } } : {}) } });
  }
  for (const [pk, item] of old) if (!next.has(pk)) actions.push({ Delete: { TableName: table, Key: { pk }, ConditionExpression: '#v.#version = :version', ExpressionAttributeNames: { '#v': 'value', '#version': 'version' }, ExpressionAttributeValues: { ':version': item.value.version } } });
  if (actions.length > 100) throw new AppError(409, 'Too many updates at once. Contact the administrator.');
  if (actions.length) await db.send(new TransactWriteCommand({ TransactItems: actions }));
}
export async function handler(event) {
  const response = (statusCode, data) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) });
  // Browsers send preflight requests without the user's JWT.
  if (event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 204, body: '' };
  try {
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const allowedDomains = (process.env.UNIVERSITY_DOMAINS || 'vitstudent.ac.in').split(',').map(x=>x.trim());
    if (!claims?.sub || ![true, 'true'].includes(claims.email_verified) || !allowedDomains.includes(claims.email?.split('@')[1])) throw new AppError(403, 'A verified university account is required.');
    let body = {}; try { body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}; } catch { throw new AppError(400, 'Invalid request.'); }
    const path = event.rawPath, method = event.requestContext.http.method, query = event.queryStringParameters || {};
    if (path === '/api/realtime-ticket' && method === 'POST') {
      const ticket = randomUUID();
      await db.send(new PutCommand({ TableName: process.env.TICKET_TABLE, Item: { ticket, userId: claims.sub, expiresAt: Math.floor(Date.now() / 1000) + 60 } }));
      return response(200, { ticket });
    }
    if (path === '/api/uploads' && method === 'POST') {
      const match = typeof body.data === 'string' && body.data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new AppError(400, 'Use a JPEG, PNG, or WebP photo.');
      const buffer = Buffer.from(match[2], 'base64'); if (buffer.length > 3000000) throw new AppError(413, 'Use an image under 3 MB.');
      const key = `uploads/${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.SITE_BUCKET, Key: key, Body: buffer, ContentType: `image/${match[1]}`, CacheControl: 'public, max-age=31536000, immutable' }));
      return response(200, { url: '/' + key });
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await load(), after = structuredClone(before);
      let user = after.users.find(u => u.id === claims.sub);
      const role = String(claims['cognito:groups'] || '').split(/[\[\]," ]+/).includes('Admins') ? 'admin' : 'student';
      if (!user) { user = { id: claims.sub, name: (claims.name || 'Student').slice(0,60), email: claims.email, verified: true, role }; after.users.push(user); }
      else { user.role = role; user.name = (claims.name || user.name).slice(0,60); }
      const result = await execute(after, { method, path, body, query, user });
      try {
        await save(before, after);
        const added = after.messages.slice(before.messages.length);
        const read = path.match(/^\/api\/conversations\/([^/]+)\/read$/);
        const affected = added.flatMap(m => after.conversations.find(c => c.id === m.conversationId)?.members || []);
        if (read) affected.push(...(after.conversations.find(c => c.id === read[1])?.members || []));
        if (affected.length) try { await publish(affected); } catch (error) { console.error('Realtime delivery failed', error); }
        return response(200, result);
      }
      catch (e) { if (e.name !== 'TransactionCanceledException' || attempt === 2) throw e; }
    }
  } catch (e) { if (!e.status) console.error(e); return response(e.status || (e.name === 'TransactionCanceledException' ? 409 : 500), { error: e.status ? e.message : e.name === 'TransactionCanceledException' ? 'Another update happened. Please try again.' : 'Unable to complete the request. Please try again.' }); }
}
