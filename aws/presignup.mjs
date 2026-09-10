export async function handler(event) {
  const email = event.request.userAttributes.email?.toLowerCase() || '';
  const domains = (process.env.UNIVERSITY_DOMAINS || 'vitstudent.ac.in').split(',').map(x => x.trim());
  if (!domains.includes(email.split('@')[1])) throw new Error('Please use your university email address.');
  return event;
}
