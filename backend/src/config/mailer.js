import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendBookingEmail({ to, booking, qrDataUrl }) {
  try {
    const seatsList = (booking.seats || []).map((bs) => {
      const s = bs.showSeat?.seat || bs.seat
      return `${s.rowLabel}${s.seatNumber}`
    })

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Booking Confirmed</h2>
        <p><strong>Booking ID:</strong> ${booking.id}</p>
        <p><strong>Event:</strong> ${booking.show.event.title}</p>
        <p><strong>Venue:</strong> ${booking.show.venue.name}</p>
        <p><strong>Date:</strong> ${new Date(booking.show.date).toLocaleString()}</p>
        <p><strong>Start:</strong> ${new Date(booking.show.startTime).toLocaleTimeString()}</p>
        <p><strong>Seats:</strong> ${seatsList.join(', ')}</p>
        <p><strong>Total:</strong> $${booking.totalAmount}</p>
        <div><img src="cid:qrcode" alt="QR code"/></div>
      </div>
    `

    const attachments = []
    if (qrDataUrl) {
      const base64 = qrDataUrl.split(',')[1]
      attachments.push({ filename: 'ticket-qr.png', content: base64, encoding: 'base64', cid: 'qrcode' })
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Booking Confirmed - ${booking.id}`,
      html,
      attachments,
    })
  } catch (err) {
    console.error('Failed to send booking email:', err)
  }
}

export async function sendWaitlistOfferEmail({ to, show, showSeat, offerExpiresAt }) {
  try {
    const seatLabel = `${showSeat.seat.rowLabel}${showSeat.seat.seatNumber}`
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>A seat is available!</h2>
        <p><strong>Event:</strong> ${show.event.title}</p>
        <p><strong>Venue:</strong> ${show.venue.name}</p>
        <p><strong>Date:</strong> ${new Date(show.date).toLocaleString()}</p>
        <p><strong>Seat:</strong> ${seatLabel}</p>
        <p><strong>Expires at:</strong> ${new Date(offerExpiresAt).toLocaleString()}</p>
        <p>Please claim your seat: <a href="${process.env.FRONTEND_URL}/shows/${show.id}?claimSeat=${showSeat.id}">Claim seat</a></p>
      </div>
    `

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `A seat is available! - ${show.event.title}`,
      html,
    })
  } catch (err) {
    console.error('Failed to send waitlist offer email:', err)
  }
}

export default { transporter, sendBookingEmail, sendWaitlistOfferEmail }
