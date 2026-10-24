export async function handler(event) {
  const email = event.request.userAttributes.email?.toLowerCase() || '';
  const domains = (process.env.UNIVERSITY_DOMAINS || 'gmail.com').split(',').map(x => x.trim());
  if (!domains.includes(email.split('@')[1])) throw new Error('Please use a Gmail address (@gmail.com).');
  return event;
}
