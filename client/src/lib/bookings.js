export const BOOKING_STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  completed: 'Completed',
  rejected: 'Rejected',
};

export const BOOKING_STATUS_TONE = {
  pending: 'warning',
  confirmed: 'brand',
  processing: 'accent',
  completed: 'success',
  rejected: 'danger',
};

/** The happy-path steps shown as a progress timeline on the booking page. */
export const PROGRESS_STEPS = ['pending', 'confirmed', 'processing', 'completed'];

export const formatAddress = (a) => [a?.name, a?.line1, a?.line2, [a?.city, a?.state, a?.postalCode].filter(Boolean).join(', '), a?.phone].filter(Boolean);
