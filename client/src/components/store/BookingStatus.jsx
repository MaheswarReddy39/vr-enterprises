import { Badge } from '../ui/Badge.jsx';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '../../lib/bookings.js';

export const StatusBadge = ({ status }) => <Badge tone={BOOKING_STATUS_TONE[status]}>{BOOKING_STATUS_LABEL[status] ?? status}</Badge>;
