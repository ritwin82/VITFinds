import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../aws/presignup.mjs';

test('Cognito accepts Gmail registration and rejects other email domains by default', async () => {
  const previous = process.env.UNIVERSITY_DOMAINS;
  delete process.env.UNIVERSITY_DOMAINS;
  try {
    for (const email of ['student@gmail.com', 'Student@GMAIL.COM']) {
      const event = { request: { userAttributes: { email } }, response: {} };
      assert.equal(await handler(event), event);
      assert.equal(event.response.autoConfirmUser, undefined);
      assert.equal(event.response.autoVerifyEmail, undefined);
    }
    for (const email of ['student@vitstudent.ac.in', 'student@yahoo.com', 'student@gmail.com.evil.example']) {
      await assert.rejects(handler({ request: { userAttributes: { email } } }), /Gmail address/);
    }
  } finally {
    if (previous === undefined) delete process.env.UNIVERSITY_DOMAINS;
    else process.env.UNIVERSITY_DOMAINS = previous;
  }
});
