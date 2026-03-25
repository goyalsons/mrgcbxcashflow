import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Info, Clock, Trash2, CheckCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

const NOTIFICATION_TYPES = {
  overdue_invoice: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Overdue Invoice' },
  payment_received: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Payment Received' },
  new_followup: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Follow-up Due' },
  system_alert: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'System Alert' },
  reminder: { icon: Info, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Reminder' },
};

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('unread');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date'),
  });

  const markAsReadMut = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAsUnreadMut = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMut = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: 'Notification deleted' });
    },
  });

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.is_read);
    for (const notif of unreadNotifs) {
      await base44.entities.Notification.update(notif.id, { is_read: true });
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: `Marked ${unreadNotifs.length} notifications as read` });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical' && !n.is_read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.priority === 'critical';
    if (filter === 'read') return n.is_read;
    return true;
  });

  const renderNotification = (notif) => {
    const typeConfig = NOTIFICATION_TYPES[notif.type] || NOTIFICATION_TYPES.system_alert;
    const IconComponent = typeConfig.icon;

    return (
      <Card
        key={notif.id}
        className={`${notif.is_read ? '' : typeConfig.bg + ' border-l-4'} ${
          !notif.is_read && notif.priority === 'critical' ? 'border-l-red-600 shadow-md' : 'border-l-gray-300'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className={`flex-shrink-0 ${typeConfig.color} mt-1`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex-1">
                  <h3 className={`text-sm font-semibold ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notif.title}
                  </h3>
                  <p className={`text-xs mt-0.5 ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notif.message}
                  </p>
                </div>
                <div className="flex gap-1">
                  {notif.priority === 'critical' && (
                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                  )}
                  {!notif.is_read && (
                    <Badge variant="default" className="text-xs">New</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {new Date(notif.created_date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <div className="flex gap-2">
                  {!notif.is_read ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsReadMut.mutate(notif.id)}
                      className="text-xs h-7"
                    >
                      Mark as read
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsUnreadMut.mutate(notif.id)}
                      className="text-xs h-7 text-muted-foreground"
                    >
                      <CheckCheck className="w-3.5 h-3.5 mr-1" />
                      Mark unread
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteNotificationMut.mutate(notif.id)}
                    className="text-xs h-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Notifications" subtitle="View all critical notifications and updates" />
        {unreadCount > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="default" className="text-base">
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
              {criticalCount > 0 && ` (${criticalCount} critical)`}
            </Badge>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={markAllAsRead}
                className="gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="unread" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="unread" className="gap-2">
            Unread {unreadCount > 0 && <Badge variant="default" className="ml-1">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="critical" className="gap-2">
            Critical {criticalCount > 0 && <Badge variant="destructive" className="ml-1">{criticalCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title={filter === 'unread' ? 'All caught up!' : 'No notifications'}
              description={filter === 'unread' ? 'You have no unread notifications' : 'No notifications to display'}
            />
          ) : (
            filteredNotifications.map(renderNotification)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}