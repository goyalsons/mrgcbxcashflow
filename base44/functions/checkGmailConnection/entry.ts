import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    
    // Verify token by fetching Gmail profile
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) {
      return Response.json({ connected: false });
    }
    
    const profile = await res.json();
    return Response.json({ connected: true, email: profile.emailAddress });
  } catch {
    return Response.json({ connected: false });
  }
});