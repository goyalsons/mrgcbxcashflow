import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AddCustomerInfoPopover({ customerName, existingCustomer }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    contact_person: '',
    email: '',
    phone: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async () => {
      if (existingCustomer?.id) {
        return base44.entities.Customer.update(existingCustomer.id, form);
      } else {
        return base44.entities.Customer.create({ name: customerName, ...form });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer info saved!' });
      setShowForm(false);
    },
  });

  if (showForm) {
    return (
      <div className="px-4 py-3 space-y-2 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Add contact info</p>
        <Input
          placeholder="Contact person"
          value={form.contact_person}
          onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Phone"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="h-7 text-xs"
        />
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={saveMut.isPending || (!form.email && !form.phone && !form.contact_person)}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 border-t">
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" /> Add contact info
      </button>
    </div>
  );
}