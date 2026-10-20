import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tickets = process.env.TICKET_TABLE;
const connections = process.env.CONNECTION_TABLE;

export async function authorize(event) {
  const token = event.queryStringParameters?.ticket;
  let record;
  if (typeof token === 'string' && /^[a-f0-9-]{36}$/.test(token)) {
    const result = await db.send(new DeleteCommand({ TableName: tickets, Key: { ticket: token }, ReturnValues: 'ALL_OLD' }));
    record = result.Attributes;
  }
  const allowed = record?.expiresAt > Math.floor(Date.now() / 1000) && !!record.userId;
  return {
    principalId: allowed ? record.userId : 'anonymous',
    policyDocument: { Version: '2012-10-17', Statement: [{ Action: 'execute-api:Invoke', Effect: allowed ? 'Allow' : 'Deny', Resource: event.methodArn }] },
    context: allowed ? { userId: record.userId } : {}
  };
}

export async function connection(event) {
  const { routeKey, connectionId } = event.requestContext || {};
  if (!connectionId) return { statusCode: 400 };
  if (routeKey === '$connect') {
    const userId = event.requestContext.authorizer?.userId;
    if (!userId) return { statusCode: 401 };
    await db.send(new PutCommand({ TableName: connections, Item: { connectionId, userId, expiresAt: Math.floor(Date.now() / 1000) + 7500 } }));
  } else if (routeKey === '$disconnect') {
    await db.send(new DeleteCommand({ TableName: connections, Key: { connectionId } }));
  }
  return { statusCode: 200 };
}
