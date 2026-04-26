require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST']
}));
app.use(express.static(path.join(__dirname)));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Rate limiting ───────────────────────────────────────────────────────────
const chatLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many requests. Please slow down.' } });
const bookLimiter = rateLimit({ windowMs: 60_000, max: 5,  message: { error: 'Too many booking attempts. Please try again shortly.' } });

// ─── Wealthy9 AI System Prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Aria, the AI receptionist for Wealthy9 — Miami's premier digital marketing agency. You are warm, confident, and speak like a premium brand that delivers real results.

WEALTHY9 OVERVIEW:
- Company: Wealthy9
- Tagline: "The Agency They Call" — Premium digital marketing for businesses that refuse to be invisible
- Location: Miami, Florida (serving businesses nationwide)
- Contact: contact@wealthy9.com
- Website: wealthy9.com

SERVICES:
01. Social Media Management — Full platform management across Instagram, Facebook, and LinkedIn. Content calendars, post creation, scheduling, and publishing every month — hands-off for the client.
02. Paid Social Advertising — Geo-targeted ad campaigns by zip code, demographics, and intent. We make sure the right customers find you.
03. Content Strategy — A custom framework built around the client's business, community, and brand voice so every post has purpose.
04. Community Engagement — Daily management of comments and DMs, building real relationships and protecting brand reputation in real time.
05. Brand Strategy — Unified brand voice, visual identity, and messaging that makes the business look as premium as the service it delivers.
06. Analytics & Reporting — Monthly dashboards with reach, follower growth, engagement rate, and ROI. Clear data, no jargon.
07. Reels & Video Content — Short-form video production for Instagram Reels, TikTok, and Facebook. We produce high-quality, scroll-stopping content: brand reels, behind-the-scenes, testimonials, promos, and thought-leadership clips. This is REAL, live, top-tier video content that drives engagement and builds authority. We handle concept, filming direction, editing, captions, and publishing.

INDUSTRIES WE SERVE:
- Hospitals & Health Systems — Social media management, paid advertising, community growth
- Law Firms — Authority-building digital marketing, client acquisition campaigns
- Dental Practices — Content strategy, paid social, appointment-filling campaigns
- Police & Government — Community-focused digital marketing, public trust building
- Professional Services (Real Estate, Restaurants, Retail Brands, Medical Practices) — Full-service presence for businesses that take reputation seriously

PRICING PACKAGES:

GROWTH — $5,000/month
• Social media management (2 platforms)
• Monthly content calendar
• 12 posts per month
• Basic paid social advertising
• Monthly analytics report
• Dedicated account manager
Best for: Businesses getting started with professional digital marketing

PREMIUM — $7,500/month (Most Popular)
• Social media management (3 platforms)
• Full content strategy & calendar
• 20 posts per month
• Full paid social ad management
• Daily community engagement
• Monthly performance dashboard
• Dedicated account manager
Best for: Established businesses ready to dominate their market online

ENTERPRISE — Custom pricing
• Multi-account or multi-location management
• Multilingual content strategy
• Influencer & creator partnerships
• Thought leadership content series
• Reels & video content production
• Advanced paid social strategy
• Weekly reporting & strategy calls
Best for: Large organizations, hospital systems, multi-location brands

NOTE: Reels & video content is available as an add-on to Growth/Premium plans or included in Enterprise. Custom quotes available.

OUR PROCESS:
Step 1 — Free Audit: We audit the client's current digital presence, identify their top 5 gaps, and benchmark them against their closest competitors. No cost, no obligation.
Step 2 — Strategy Build: A custom 90-day content strategy, calendar, and paid ad framework built for their specific business and market.
Step 3 — Launch: We go live within two weeks. Content created, scheduled, managed. Paid campaigns launch and optimize weekly.
Step 4 — Report & Scale: Monthly reports show what's working. We refine, scale what's winning, and set targets for the next 90-day cycle.

KEY STATS:
- 90 days to measurable results
- 100% premium focus — no shortcuts, no templates
- $0 cost for the initial free audit

BOOKING A FREE AUDIT:
When a prospect wants to schedule their free audit, collect these one at a time in a natural conversation:
1. Full name
2. Business name
3. Industry / type of business
4. Phone number
5. Email address
6. Preferred day and time for the call

Once all info is collected, confirm: "I've got everything — a Wealthy9 strategist will reach out to confirm your free audit within 24 hours. Check your email for a confirmation shortly."

CONVERSATION RULES:
- Always guide conversations toward the free audit (zero cost, zero risk to the prospect)
- If asked about pricing, explain all three packages clearly
- If asked about video/reels, explain our full Reels & Video Content service — concept, filming direction, editing, captions, publishing
- Keep responses conversational and concise (3-5 sentences max unless explaining packages)
- Never bad-mouth competitors
- If you don't know something specific, say "That's a great question — let me have one of our strategists follow up with you directly. Can I get your email?"
- Maintain Wealthy9's premium, confident tone at all times
- When someone seems ready to move forward, invite them to book their free audit`;

// ─── In-memory stores (use Redis/DB in production) ──────────────────────────
const appointments = [];
const voiceSessions = new Map();

// ─── Email transporter ───────────────────────────────────────────────────────
function getMailer() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendAuditNotification(data) {
  const mailer = getMailer();
  if (!mailer) {
    console.log('[Audit Request]', JSON.stringify(data, null, 2));
    return;
  }

  const rowStyle = 'padding:8px 0;border-bottom:1px solid rgba(240,244,255,0.05)';
  const labelStyle = 'font-size:12px;color:#8A9BBF;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.1em';
  const valueStyle = 'font-size:14px;color:#F0F4FF;font-family:Arial,sans-serif;padding-left:16px';

  const internalMail = {
    from: `"Wealthy9 Receptionist" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || 'contact@wealthy9.com',
    subject: `🎯 New Free Audit Request — ${data.business || data.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;background:#02040F;color:#F0F4FF;padding:36px;border:1px solid rgba(0,200,240,0.15)">
        <div style="font-size:11px;letter-spacing:.3em;color:#00C8F0;text-transform:uppercase;margin-bottom:8px">Wealthy9</div>
        <h2 style="font-size:22px;font-weight:400;letter-spacing:.04em;margin:0 0 28px">New Audit Request</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr style="${rowStyle}"><td style="${labelStyle}">Name</td><td style="${valueStyle}">${data.name}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Business</td><td style="${valueStyle}">${data.business || '—'}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Industry</td><td style="${valueStyle}">${data.industry || '—'}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Phone</td><td style="${valueStyle}">${data.phone || '—'}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Email</td><td style="${valueStyle}">${data.email}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Preferred Time</td><td style="${valueStyle}">${data.preferredTime || '—'}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Source</td><td style="${valueStyle}">${data.source || 'Website Chat'}</td></tr>
          <tr style="${rowStyle}"><td style="${labelStyle}">Submitted</td><td style="${valueStyle}">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
        </table>
      </div>`
  };

  const confirmMail = {
    from: `"Wealthy9" <${process.env.EMAIL_USER}>`,
    to: data.email,
    subject: 'Your Free Digital Marketing Audit — Wealthy9',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;background:#02040F;color:#F0F4FF;padding:40px;border:1px solid rgba(0,200,240,0.12)">
        <div style="font-size:11px;letter-spacing:.35em;color:#00C8F0;text-transform:uppercase;margin-bottom:6px">Wealthy9</div>
        <div style="font-size:9px;letter-spacing:.15em;color:rgba(138,155,191,0.5);text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:32px">Miami, Florida</div>
        <p style="font-size:15px;line-height:1.9;color:#F0F4FF">Hi ${data.name},</p>
        <p style="font-size:14px;color:rgba(138,155,191,0.85);line-height:1.9">We've received your request for a free digital marketing audit. A Wealthy9 strategist will reach out within <strong style="color:#F0F4FF">24 hours</strong> to confirm your appointment and answer any questions.</p>
        ${data.preferredTime ? `<p style="font-size:14px;color:rgba(138,155,191,0.85);line-height:1.9">Your preferred time: <strong style="color:#00C8F0">${data.preferredTime}</strong></p>` : ''}
        <div style="margin:32px 0;padding:20px 24px;background:#060914;border-left:3px solid #00C8F0">
          <div style="font-size:9px;letter-spacing:.2em;color:#00C8F0;text-transform:uppercase;font-family:Arial,sans-serif">What to Expect</div>
          <p style="font-size:13px;color:rgba(240,244,255,0.7);line-height:1.8;margin:8px 0 0">We'll audit your current digital presence, identify your top 5 gaps, and benchmark you against your closest competitors — no cost, no obligation, just honest data.</p>
        </div>
        <p style="font-size:12px;color:rgba(138,155,191,0.5);margin-top:40px;border-top:1px solid rgba(240,244,255,0.06);padding-top:20px">
          Wealthy9 · Miami, Florida · <a href="mailto:contact@wealthy9.com" style="color:#00C8F0;text-decoration:none">contact@wealthy9.com</a> · <a href="https://wealthy9.com" style="color:#00C8F0;text-decoration:none">wealthy9.com</a>
        </p>
      </div>`
  };

  await Promise.all([mailer.sendMail(internalMail), mailer.sendMail(confirmMail)]);
}

// ─── Chat API ─────────────────────────────────────────────────────────────────
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format.' });
    }

    const sanitized = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: sanitized
    });

    res.json({ message: response.content[0].text });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again or email contact@wealthy9.com' });
  }
});

// ─── Book Audit API ───────────────────────────────────────────────────────────
app.post('/api/book-audit', bookLimiter, async (req, res) => {
  try {
    const { name, business, industry, phone, email, preferredTime, source } = req.body;
    if (!name || !email || !email.includes('@')) {
      return res.status(400).json({ error: 'Name and a valid email are required.' });
    }

    const record = {
      id: Date.now(),
      name: String(name).slice(0, 100),
      business: String(business || '').slice(0, 100),
      industry: String(industry || '').slice(0, 100),
      phone: String(phone || '').slice(0, 20),
      email: String(email).slice(0, 200),
      preferredTime: String(preferredTime || '').slice(0, 100),
      source: String(source || 'Website Chat').slice(0, 50),
      createdAt: new Date().toISOString()
    };

    appointments.push(record);
    await sendAuditNotification(record);

    res.json({
      success: true,
      message: `You're all set, ${record.name}! A Wealthy9 strategist will confirm your free audit within 24 hours. Check your inbox for a confirmation.`
    });
  } catch (err) {
    console.error('[Booking Error]', err.message);
    res.status(500).json({ error: 'Booking failed. Please email us directly at contact@wealthy9.com' });
  }
});

// ─── Twilio Voice: Initial Greeting ──────────────────────────────────────────
app.post('/api/voice', (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/respond',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    language: 'en-US',
    timeout: 6
  });

  gather.say(
    { voice: 'Polly.Joanna-Neural', language: 'en-US' },
    "Thank you for calling Wealthy9, Miami's premier digital marketing agency. I'm Aria, your AI receptionist. How can I help you today?"
  );

  twiml.redirect('/api/voice');
  res.type('text/xml').send(twiml.toString());
});

// ─── Twilio Voice: Conversation Loop ─────────────────────────────────────────
app.post('/api/voice/respond', async (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const { SpeechResult, CallSid, From } = req.body;

  if (!SpeechResult) {
    const gather = twiml.gather({
      input: 'speech', action: '/api/voice/respond',
      speechTimeout: 'auto', language: 'en-US', timeout: 5
    });
    gather.say({ voice: 'Polly.Joanna-Neural' }, "I didn't catch that — could you repeat?");
    twiml.redirect('/api/voice');
    return res.type('text/xml').send(twiml.toString());
  }

  if (!voiceSessions.has(CallSid)) {
    voiceSessions.set(CallSid, { messages: [], phone: From, start: Date.now() });
  }

  const session = voiceSessions.get(CallSid);
  session.messages.push({ role: 'user', content: SpeechResult });

  try {
    const voicePrompt = SYSTEM_PROMPT +
      `\n\nPHONE CALL MODE — CRITICAL RULES:\n` +
      `- Max 2-3 sentences per response. This is a phone call.\n` +
      `- No bullet points, headers, asterisks, or formatting.\n` +
      `- Speak naturally and warmly as on a real call.\n` +
      `- Collect booking info one field at a time naturally.\n` +
      `- Caller phone: ${From || 'unknown'}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: voicePrompt,
      messages: session.messages.slice(-12)
    });

    const aiText = response.content[0].text;
    session.messages.push({ role: 'assistant', content: aiText });

    // Auto-save appointment if email was captured during call
    const fullTranscript = session.messages.map(m => m.content).join(' ');
    const emailMatch = fullTranscript.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (emailMatch && aiText.toLowerCase().includes('24 hours') && !session.saved) {
      session.saved = true;
      const record = {
        id: Date.now(), email: emailMatch[0], phone: From,
        source: 'Phone Call', createdAt: new Date().toISOString(),
        name: 'Phone Caller', business: '—', industry: '—', preferredTime: '—'
      };
      appointments.push(record);
      sendAuditNotification(record).catch(e => console.error('[Voice Email Error]', e.message));
    }

    const gather = twiml.gather({
      input: 'speech', action: '/api/voice/respond',
      speechTimeout: 'auto', speechModel: 'phone_call',
      language: 'en-US', timeout: 8
    });
    gather.say({ voice: 'Polly.Joanna-Neural', language: 'en-US' }, aiText);

    twiml.say({ voice: 'Polly.Joanna-Neural' },
      "Are you still there? Feel free to call us back or email us at contact at wealthy9 dot com. Have a great day!"
    );
    twiml.hangup();

  } catch (err) {
    console.error('[Voice AI Error]', err.message);
    twiml.say({ voice: 'Polly.Joanna-Neural' },
      "I apologize for the technical difficulty. Please call back or email us at contact at wealthy9 dot com. Thank you for calling Wealthy9!"
    );
    twiml.hangup();
  }

  res.type('text/xml').send(twiml.toString());
});

// Clean up voice sessions older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 7_200_000;
  for (const [sid, s] of voiceSessions) {
    if (s.start < cutoff) voiceSessions.delete(sid);
  }
}, 3_600_000);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Wealthy9 AI Receptionist', appointments: appointments.length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n  Wealthy9 AI Receptionist — running on port ${PORT}\n`));
