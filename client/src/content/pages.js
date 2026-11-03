// Editable page content. Text in [square brackets] would be a prompt for the business owner to replace.
//
// Everything below describes only how this website works today and what is known. It makes no promises about
// delivery times, charges, refunds or warranty, because those terms have not been supplied. When the business
// decides them, edit the text here. The legal pages (privacy, terms) are plain summaries and have NOT been
// reviewed by a legal professional.
// Structure: { title, description, notice, sections: [{ heading, body: [paragraph, ...] }] }.

const SUMMARY_NOTICE = 'This is a plain summary of how the website works today. It has not been reviewed by a legal professional.';

export const pages = {
  about: {
    title: 'About us',
    description: 'About VR Water Solutions, a seller of water purifiers in Dharmavaram, Andhra Pradesh.',
    sections: [
      { heading: 'Who we are', body: ['VR Water Solutions sells water purifiers from Yerraguntla Circle, Dharmavaram, Andhra Pradesh, India.'] },
      { heading: 'What we offer', body: ['Browse our range in the shop. Each product page lists its availability and the specifications we have been able to verify.', 'To get a purifier, send a booking request on this website. We then contact you to confirm the details.'] },
      { heading: 'Get in touch', body: ['Phone, email and address are on the contact page. You are welcome to ask us about any product before you book.'] },
    ],
  },

  'shipping-policy': {
    title: 'Shipping policy',
    description: 'Delivery information for VR Water Solutions bookings.',
    notice: SUMMARY_NOTICE,
    sections: [
      { heading: 'How delivery works', body: ['This website takes booking requests, not payments. After you submit a booking we contact you on the mobile number you gave to confirm the product, the delivery address and the arrangements.'] },
      { heading: 'Delivery areas, timing and charges', body: ['We do not publish fixed delivery areas, delivery times or charges on this website. They are confirmed with you individually when we contact you about your booking.'] },
      { heading: 'Installation', body: ['Whether installation is included, and any charge for it, is confirmed with you when we contact you about your booking.'] },
      { heading: 'Questions about a delivery', body: ['Contact us using the details on the contact page.'] },
    ],
  },

  'return-refund-policy': {
    title: 'Return and refund policy',
    description: 'Return, refund and warranty information for VR Water Solutions.',
    notice: SUMMARY_NOTICE,
    sections: [
      { heading: 'No online payment', body: ['No payment is taken on this website, so there is nothing to refund through the website. Payment is arranged with VR Water Solutions when your booking is confirmed.'] },
      { heading: 'Returns and refunds', body: ['Return and refund terms are not published online yet. Please ask us about them before you confirm a booking.'] },
      { heading: 'Warranty', body: ['Warranty terms differ by product and are not the same for every purifier. Ask us for the warranty that applies to the product you are interested in before you confirm a booking.'] },
      { heading: 'Questions', body: ['Contact us using the details on the contact page.'] },
    ],
  },

  'privacy-policy': {
    title: 'Privacy policy',
    description: 'How VR Water Solutions handles personal information on this website.',
    notice: SUMMARY_NOTICE,
    sections: [
      { heading: 'What we collect', body: ['Enquiries: your name, email address, optional phone number, your message and the product you asked about, if any.', 'Accounts: your name, email address, optional phone number and a password, which is stored only in scrambled (hashed) form.', 'Bookings: your name, mobile number, delivery address and the products and quantities you booked.'] },
      { heading: 'How we use it', body: ['We use this information to reply to you, to create and manage your account, and to confirm and arrange your booking.'] },
      { heading: 'Payments', body: ['This website does not take payments and does not collect card or bank details.'] },
      { heading: 'Your information', body: ['To ask about, correct or remove your information, contact us using the details on the contact page.'] },
    ],
  },

  'terms-and-conditions': {
    title: 'Terms and conditions',
    description: 'Terms of using the VR Water Solutions website and booking products.',
    notice: SUMMARY_NOTICE,
    sections: [
      { heading: 'Bookings', body: ['A booking on this website is a request, not a confirmed sale. We contact you to confirm the product, price, delivery and payment arrangements. We may decline a booking, for example if a product is not available.'] },
      { heading: 'Products and information', body: ['Product information, specifications and availability are shown in good faith and may change. If something is unclear, ask us before you confirm a booking.'] },
      { heading: 'Prices', body: ['Where a product shows "Price on request", the price is given to you when we contact you.'] },
      { heading: 'Your account', body: ['Keep your password private. You are responsible for activity on your account.'] },
    ],
  },
};

export const faqs = [
  { q: 'How do I book a product?', a: ['Sign in, choose a product and select Book now, then enter your name, mobile number and delivery address. We review the booking, confirm it and contact you. No payment is taken on the website.'] },
  { q: 'How can I check if a product is in stock?', a: ['Each product page shows its current availability.'] },
  { q: 'What does "Price on request" mean?', a: ['The price for that product is not published on the website. We give you the price when we contact you about your booking or enquiry.'] },
  { q: 'Do you deliver to my area?', a: ['Delivery is arranged individually. Send a booking or an enquiry and we will tell you whether we can deliver to you.'] },
  { q: 'Is installation included?', a: ['This is confirmed with you when we contact you about your booking.'] },
  { q: 'What warranty do the products have?', a: ['Warranty differs by product. Ask us about the product you are interested in before you confirm a booking.'] },
  { q: 'How do I pay?', a: ['You do not pay on the website. Payment is arranged with us when your booking is confirmed.'] },
];
