import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role to list all users
    const users = await base44.asServiceRole.entities.User.list();

    const PROTECTED_ROLES = ['admin', 'inactive'];
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    let resetCount = 0;

    for (const user of users) {
      // Skip admins and already-inactive users
      if (PROTECTED_ROLES.includes(user.role)) continue;

      // Only reset users created in the last 15 minutes (new signups)
      const createdAt = new Date(user.created_date);
      if (createdAt >= fifteenMinutesAgo) {
        await base44.asServiceRole.entities.User.update(user.id, { role: 'inactive' });
        resetCount++;
        console.log(`Reset role to inactive for new user: ${user.email}`);
      }
    }

    return Response.json({ success: true, reset: resetCount });
  } catch (error) {
    console.error('resetNewUserRoles error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});