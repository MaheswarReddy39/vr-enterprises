import { Badge } from '../ui/Badge.jsx';

export const NOTIFICATION_STATE = {
  pending: ['Queued', 'neutral'],
  sending: ['Sending', 'neutral'],
  sent: ['Sent', 'success'],
  failed: ['Failed', 'danger'],
  skipped: ['Not sent (WhatsApp not set up)', 'warning'],
};

export const KIND_LABEL = { admin_new_booking: 'Alert to business', customer_status: 'Update to customer' };

export const NotificationBadge = ({ state }) => {
  const [label, tone] = NOTIFICATION_STATE[state] ?? [state, 'neutral'];
  return <Badge tone={tone}>{label}</Badge>;
};
