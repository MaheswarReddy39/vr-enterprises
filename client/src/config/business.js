// ONE place to edit the business details shown across the storefront.
//
// Contact details below are the owner's real details (they can be changed in Admin > Store settings, which wins over
// these defaults). Anything wrapped in [square brackets] is a PLACEHOLDER: the site shows it as a visible
// "to be added" note and never turns it into a phone/email link. Replace it with the real value
// (without brackets). Nothing here is a real claim about the business; do not publish the site until
// the placeholders and the policy templates in content/pages.js have been reviewed.
//
// (A later milestone moves this into the admin "Store settings" so it can be edited without code.)
export const business = {
  name: 'VR Enterprises',
  category: 'Water purifiers',

  // Shows the slim "preview site" bar and tells search engines not to index the site.
  // Set to false when the placeholders and demo products have been replaced with real content.
  isPreview: false,

  contact: {
    phone: '9346411218',
    email: 'maheswarreddygondireddy12@gmail.com',
    address: 'Yerraguntla Circle, Dharmavaram, Andhra Pradesh, India.',
    hours: '', // not supplied yet: hidden on the site until entered in Admin > Store settings
  },
};

export const isPlaceholder = (value) => typeof value === 'string' && value.trim().startsWith('[');

/** Real phone number -> tel: link, otherwise null. */
export const telHref = (phone) => (isPlaceholder(phone) ? null : `tel:${phone.replace(/[^\d+]/g, '')}`);
export const mailHref = (email) => (isPlaceholder(email) ? null : `mailto:${email}`);

export const mainNav = [
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export const policyLinks = [
  { to: '/shipping-policy', label: 'Shipping policy' },
  { to: '/return-refund-policy', label: 'Return & refund policy' },
  { to: '/privacy-policy', label: 'Privacy policy' },
  { to: '/terms-and-conditions', label: 'Terms & conditions' },
];
