import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function getNextDate(lastDate, recurrenceType, interval, unit) {
  const d = new Date(lastDate);
  switch (recurrenceType) {
    case 'daily': return addDays(d, 1);
    case 'weekly': return addDays(d, 7);
    case 'monthly': return addMonths(d, 1);
    case 'quarterly': return addMonths(d, 3);
    case 'custom': {
      if (unit === 'day') return addDays(d, interval);
      if (unit === 'week') return addDays(d, interval * 7);
      if (unit === 'month') return addMonths(d, interval);
      if (unit === 'year') return addMonths(d, interval * 12);
      return addDays(d, interval);
    }
    default: return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled automation (no user) or admin users
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAdmin = true;
    } catch (_) {
      // called from automation - use service role
    }

    const sixMonthsFromNow = toDateStr(addMonths(new Date(), 6));
    const today = toDateStr(new Date());

    // Get all recurring expense templates (no parent = they are templates)
    const allExpenses = await base44.asServiceRole.entities.Expense.list();
    const templates = allExpenses.filter(e =>
      e.recurrence_type && e.recurrence_type !== 'none' && !e.parent_expense_id
    );

    // Get all generated instances to detect duplicates
    const generated = allExpenses.filter(e => !!e.parent_expense_id);
    const generatedKey = new Set(generated.map(e => `${e.parent_expense_id}_${e.expense_date}`));

    let totalCreated = 0;

    for (const template of templates) {
      const endBoundary = template.recurrence_end_date
        ? (template.recurrence_end_date < sixMonthsFromNow ? template.recurrence_end_date : sixMonthsFromNow)
        : sixMonthsFromNow;

      // Start generating from last generated date or start date or expense_date
      const startFrom = template.last_generated_date || template.recurrence_start_date || template.expense_date;
      if (!startFrom) continue;

      const toCreate = [];
      let cursor = new Date(startFrom);

      // Move cursor forward to find first date > last_generated_date
      // Generate instances until endBoundary
      let safetyLimit = 500;
      while (safetyLimit-- > 0) {
        const nextDate = getNextDate(cursor, template.recurrence_type, template.recurrence_interval || 1, template.recurrence_unit);
        if (!nextDate) break;
        const nextStr = toDateStr(nextDate);
        if (nextStr > endBoundary) break;
        cursor = nextDate;

        if (!generatedKey.has(`${template.id}_${nextStr}`)) {
          toCreate.push({
            description: template.description,
            amount: template.amount,
            expense_date: nextStr,
            category: template.category,
            payment_mode: template.payment_mode || '',
            notes: template.notes || '',
            approval_status: 'not_required',
            submitted_by: template.submitted_by || '',
            submitted_by_name: template.submitted_by_name || '',
            parent_expense_id: template.id,
            recurrence_type: 'none',
          });
          generatedKey.add(`${template.id}_${nextStr}`);
        }
      }

      if (toCreate.length > 0) {
        await base44.asServiceRole.entities.Expense.bulkCreate(toCreate);
        totalCreated += toCreate.length;
      }

      // Update last_generated_date on template
      const lastDate = toDateStr(cursor);
      if (lastDate !== template.last_generated_date) {
        await base44.asServiceRole.entities.Expense.update(template.id, { last_generated_date: lastDate });
      }
    }

    return Response.json({ success: true, templates_processed: templates.length, instances_created: totalCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});