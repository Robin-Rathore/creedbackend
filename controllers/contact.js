const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const transporter = createTransporter();
// Admin email addresses
const ADMIN_EMAILS = ['pranav.c@thpl.co.in', 'helpdesk@thpl.co.in'];

// Email template for admin notification
const createAdminEmailTemplate = (formData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Contact Form Submission</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .field { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
        .field:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #555; margin-bottom: 5px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        .value { font-size: 16px; color: #333; background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .message-field .value { min-height: 80px; white-space: pre-wrap; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .priority { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .priority.high { background: #fee; color: #c53030; }
        .priority.medium { background: #fef5e7; color: #d69e2e; }
        .priority.low { background: #f0fff4; color: #38a169; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Contact Form Submission</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Received on ${new Date().toLocaleString(
            'en-IN',
            { timeZone: 'Asia/Kolkata' }
          )}</p>
        </div>
        
        <div class="content">
          <div class="field">
            <div class="label">Full Name</div>
            <div class="value">${formData.name}</div>
          </div>
          
          <div class="field">
            <div class="label">Email Address</div>
            <div class="value">
              <a href="mailto:${
                formData.email
              }" style="color: #667eea; text-decoration: none;">${
    formData.email
  }</a>
            </div>
          </div>
          
          ${
            formData.phone
              ? `
          <div class="field">
            <div class="label">Phone Number</div>
            <div class="value">
              <a href="tel:${formData.phone}" style="color: #667eea; text-decoration: none;">${formData.phone}</a>
            </div>
          </div>
          `
              : ''
          }
          
          <div class="field">
            <div class="label">Subject</div>
            <div class="value">${formData.subject}</div>
          </div>
          
          ${
            formData.category
              ? `
          <div class="field">
            <div class="label">Category</div>
            <div class="value">
              <span class="priority ${
                formData.category === 'support'
                  ? 'high'
                  : formData.category === 'order'
                  ? 'medium'
                  : 'low'
              }">
                ${
                  formData.category.charAt(0).toUpperCase() +
                  formData.category.slice(1)
                }
              </span>
            </div>
          </div>
          `
              : ''
          }
          
          <div class="field message-field">
            <div class="label">Message</div>
            <div class="value">${formData.message}</div>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Action Required:</strong> Please respond to this inquiry within 24 hours.</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
            This email was automatically generated from the Creed website contact form.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Auto-reply email template for user
const createUserAutoReplyTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Thank you for contacting us</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px; text-align: center; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .contact-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Message Received!</h1>
        </div>
        
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for reaching out to us! We've successfully received your message and our team will get back to you within <strong>24 hours</strong>.</p>
          
          <div class="contact-info">
            <h3>Need immediate assistance?</h3>
            <p><strong>Phone:</strong> <a href="tel:+919897967727">+91 9897967727</a></p>
            <p><strong>Business Hours:</strong> Monday - Saturday, 9:00 AM - 6:00 PM IST</p>
          </div>
          
          <p>We appreciate your interest in Creed and look forward to assisting you.</p>
        </div>
        
        <div class="footer">
          <p><strong>Best regards,</strong><br>The Creed Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const postContact = async (req, res) => {
  try {
    const { name, email, phone, subject, category, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required fields',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Prepare form data for email templates
    const formData = {
      name,
      email,
      phone,
      subject,
      category,
      message,
    };

    // Send admin notification emails
    const adminEmailPromises = ADMIN_EMAILS.map((adminEmail) => {
      return transporter.sendMail({
        from: `"Creed Contact Form" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `🔔 New Contact: ${subject}`,
        html: createAdminEmailTemplate(formData),
        replyTo: email, // Allow admins to reply directly to the user
      });
    });

    // Send auto-reply to user
    const userEmailPromise = transporter.sendMail({
      from: `"Creed Team" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Thank you for contacting Creed - We'll be in touch soon!",
      html: createUserAutoReplyTemplate(name),
    });

    // Execute all email sends
    try {
      await Promise.all([...adminEmailPromises, userEmailPromise]);
      console.log(`Contact form emails sent successfully for: ${email}`);
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail the request if emails fail, but log the error
    }

    res.status(201).json({
      success: true,
      message:
        'Contact request submitted successfully. You will receive a confirmation email shortly.',
      data: {
        name: name,
        email: email,
        subject: subject,
      },
    });
  } catch (error) {
    console.error('Error submitting contact request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
