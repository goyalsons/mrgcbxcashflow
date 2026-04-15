import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered on User create — ensures every new user starts as 'inactive'
// unless they are already an admin (i.e., the first user / platform owner).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    if (event?.type !== 'create') {
      return Response.json({ skipped: true });
    }

    const userId = data?.id;
    const currentRole = data?.role;

    // If the role is already 'inactive' or 'admin', do nothing
    if (!userId || currentRole === 'inactive' || currentRole === 'admin') {
      return Response.json({ skipped: true, reason: 'role already correct' });
    }

    // Force role to 'inactive' for all other newly created users
    await base44.asServiceRole.entities.User.update(userId, { role: 'inactive' });

    return Response.json({ success: true, userId, previousRole: currentRole, newRole: 'inactive' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});