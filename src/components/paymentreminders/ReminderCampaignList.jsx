import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pause, Play, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import EditCampaignModal from './EditCampaignModal';

export default function ReminderCampaignList({ onDuplicateDetected }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['reminderCampaigns'],
    queryFn: async () => {
      const cmpns = await base44.entities.ReminderCampaign.list('-created_date');
      const customers = await base44.entities.Customer.list();
      const templates = await base44.entities.MessageTemplate.list();
      return cmpns.map(c => {
        const customer = customers.find(cust => cust.id === c.debtor_id);
        const template = templates.find(t => t.id === c.template_id);
        return { ...c, customer, template };
      });
    },
  });

  const pauseResumeMut = useMutation({
    mutationFn: ({ campaignId, action }) => 
      base44.functions.invoke('manageReminderCampaign', {
        action,
        campaignId
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminderCampaigns'] });
      toast({ title: 'Campaign updated' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (campaignId) => 
      base44.functions.invoke('manageReminderCampaign', {
        action: 'delete',
        campaignId
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminderCampaigns'] });
      toast({ title: 'Campaign deleted' });
      setDeleteConfirm(null);
    },
  });

  const handleDeleteClick = (campaign) => {
    setDeleteConfirm(campaign);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMut.mutate(deleteConfirm.id);
    }
  };



  if (campaigns.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No campaigns yet. Create one to get started.</div>;
  }

  return (
    <>
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next Send</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map(campaign => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.debtor_name}</TableCell>
                <TableCell>{campaign.customer?.contact_person || '-'}</TableCell>
                <TableCell>{campaign.customer?.email || '-'}</TableCell>
                <TableCell>{campaign.customer?.phone || '-'}</TableCell>
                <TableCell><Badge>{campaign.reminder_type}</Badge></TableCell>
                <TableCell className="text-sm">{campaign.template?.name || '-'}</TableCell>
                <TableCell className="capitalize">{campaign.frequency}</TableCell>
                <TableCell className="text-sm">09:00</TableCell>
                <TableCell>
                  <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}>
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {campaign.start_date || '—'}
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingCampaign(campaign)} title="Edit campaign">
                    <Edit className="w-4 h-4" />
                  </Button>
                  {campaign.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => pauseResumeMut.mutate({ campaignId: campaign.id, action: 'pause' })}>
                     <Pause className="w-4 h-4" />
                    </Button>
                  )}
                  {campaign.status === 'paused' && (
                    <Button size="sm" variant="ghost" onClick={() => pauseResumeMut.mutate({ campaignId: campaign.id, action: 'resume' })}>
                     <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(campaign)}>
                   <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

      {/* Edit Campaign Modal */}
    {editingCampaign && (
      <EditCampaignModal campaign={editingCampaign} onClose={() => setEditingCampaign(null)} />
    )}

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Campaign</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete the campaign <strong>"{deleteConfirm?.campaign_name}"</strong>? This will also delete all associated scheduled reminders. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? 'Deleting...' : 'Delete Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}