import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, Trash2, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ScheduledMessageList from './ScheduledMessageList';

export default function ReminderCampaignList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['reminderCampaigns'],
    queryFn: () => base44.entities.ReminderCampaign.list('-created_date'),
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
    },
  });



  if (campaigns.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No campaigns yet. Create one to get started.</div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Debtor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next Send</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map(campaign => (
              <React.Fragment key={campaign.id}>
                <TableRow>
                  <TableCell>
                    <button
                      onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedId === campaign.id ? 'rotate-180' : ''}`} />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                  <TableCell>{campaign.debtor_name}</TableCell>
                  <TableCell><Badge>{campaign.reminder_type}</Badge></TableCell>
                  <TableCell className="capitalize">{campaign.frequency}</TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{campaign.next_send_date || '-'}</p>
                      {campaign.send_time && <p className="text-xs text-muted-foreground">{campaign.send_time}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
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
                    <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(campaign.id)}>
                     <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === campaign.id && (
                  <TableRow>
                    <TableCell colSpan="8" className="p-4 bg-muted/50">
                      <ScheduledMessageList campaignId={campaign.id} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}