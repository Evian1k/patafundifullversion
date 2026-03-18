import { query, getClient } from '../db.js';

function md(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) out += strings[i] + (values[i] ?? '');
  return out.trim() + '\n';
}

async function upsertPolicy(client, { slug, title, version = '1.0' }) {
  const r = await client.query(
    `INSERT INTO policies (slug, title, version, status, published_at)
     VALUES ($1, $2, $3, 'published', NOW())
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [slug, title, version]
  );
  return r.rows[0].id;
}

async function ensurePolicySections(client, policyId, sections) {
  for (const section of sections) {
    const force = process.env.SEED_DEFAULT_CONTENT_FORCE === 'true';
    await client.query(
      `INSERT INTO policy_sections (policy_id, title, content, section_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (policy_id, section_order)
       DO ${force ? 'UPDATE' : 'NOTHING'} ${
         force ? 'SET title = EXCLUDED.title, content = EXCLUDED.content, updated_at = NOW()' : ''
       }`,
      [policyId, section.title, section.content, section.order]
    );
  }
}

export async function seedDefaultContent() {
  const shouldSeed =
    process.env.SEED_DEFAULT_CONTENT === 'true' ||
    (process.env.SEED_DEFAULT_CONTENT !== 'false' && process.env.NODE_ENV !== 'production') ||
    (process.env.SEED_DEFAULT_CONTENT !== 'false' && process.env.DB_AUTO_SETUP === 'true');

  if (!shouldSeed) return;

    const companyName = (process.env.COMPANY_NAME || 'PataFundi').trim();
    const supportEmail = (process.env.SUPPORT_EMAIL || 'patafundi6@gmail.com').trim();

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Policies
    const termsId = await upsertPolicy(client, {
      slug: 'terms-of-service',
      title: `Terms of Service – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, termsId, [
      {
        order: 1,
        title: '1. Acceptance of Terms',
        content: md`By accessing or using ${companyName}, you agree to comply with and be bound by these Terms of Service. If you do not agree, you must not use the platform.`,
      },
      {
        order: 2,
        title: '2. Platform Description',
        content: md`${companyName} is a digital marketplace that connects customers with verified service providers (“Fundis”) for various services (including plumbing, electrical, cleaning, and more). ${companyName} does not directly provide services; it facilitates connections and transactions.`,
      },
      {
        order: 3,
        title: '3. User Accounts',
        content: md`Users must provide accurate and complete information, maintain account security, and not share login credentials. We may suspend accounts with false information, suspected fraud, or policy violations.`,
      },
      {
        order: 4,
        title: '4. Fundi Verification',
        content: md`All Fundis must submit valid identification, pass verification checks, and maintain accurate profile details. ${companyName} reserves the right to approve or reject any Fundi.`,
      },
      {
        order: 5,
        title: '5. Payments',
        content: md`All payments must be made through the platform. Platform commission may apply. Off-platform payments are strictly prohibited and may result in suspension.`,
      },
      {
        order: 6,
        title: '6. Job Completion',
        content: md`A job is considered complete only when the Fundi marks it complete and the customer confirms completion (including via OTP where applicable).`,
      },
      {
        order: 7,
        title: '7. Prohibited Activities',
        content: md`Users must NOT commit fraud, provide false information, use fake GPS/location, bypass platform payments, harass or abuse other users, or attempt to manipulate ratings or payments.`,
      },
      {
        order: 8,
        title: '8. Account Suspension',
        content: md`We may suspend or terminate accounts and block access without prior notice in case of violations, fraud, or misuse.`,
      },
      {
        order: 9,
        title: '9. Disputes',
        content: md`If a dispute happens, users should report it through Support. We may request evidence (photos, messages, job details) and may take enforcement action based on findings.`,
      },
      {
        order: 10,
        title: '10. Liability',
        content: md`${companyName} is not liable for poor service quality, delays, or disputes between users. We may assist in dispute resolution at our discretion.`,
      },
      {
        order: 11,
        title: '11. Changes to Terms',
        content: md`We may update these terms at any time. Continued use means acceptance of changes.`,
      },
      {
        order: 12,
        title: 'Contact',
        content: md`If you have questions about these Terms, contact us at ${supportEmail}.`,
      },
    ]);

    const privacyId = await upsertPolicy(client, {
      slug: 'privacy-policy',
      title: `Privacy Policy – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, privacyId, [
      {
        order: 1,
        title: '1. Information We Collect',
        content: md`We collect personal details (name, phone, email), location data (GPS), verification data (ID documents for Fundis), payment information (through payment partners), and usage activity.`,
      },
      {
        order: 2,
        title: '2. How We Use Data',
        content: md`We use data to verify identity, match customers with Fundis, process payments, improve platform performance, and prevent fraud.`,
      },
      {
        order: 3,
        title: '3. Location Data',
        content: md`We may collect real-time GPS data to match services, support job tracking, and improve safety and accuracy.`,
      },
      {
        order: 4,
        title: '4. Data Sharing',
        content: md`We may share data with payment providers, verification services, and law enforcement where legally required. We do not sell user data.`,
      },
      {
        order: 5,
        title: '5. Data Security',
        content: md`We use security controls such as access restrictions and encryption in transit where possible. No system is 100% secure.`,
      },
      {
        order: 6,
        title: '6. User Rights',
        content: md`Users can request access to their data, request account deletion (where legally permissible), and update personal information.`,
      },
      {
        order: 7,
        title: '7. Retention',
        content: md`We retain data only as long as necessary for legal obligations and platform operations.`,
      },
      {
        order: 8,
        title: '8. Changes to Policy',
        content: md`We may update this policy. Continued use means acceptance of updates.`,
      },
      {
        order: 9,
        title: '9. Cookies and Analytics',
        content: md`We may use cookies and similar technologies to keep you signed in, remember preferences, and understand usage patterns. You can manage cookies in your browser settings.`,
      },
      {
        order: 10,
        title: '10. Data Processors',
        content: md`We may use third-party vendors to provide services (hosting, analytics, payment processing). These vendors process data under contractual obligations to protect it.`,
      },
      {
        order: 11,
        title: '11. Cross-border Transfers',
        content: md`If we store or process data outside your country, we take steps to protect your information using appropriate safeguards.`,
      },
      {
        order: 12,
        title: 'Contact',
        content: md`Questions about privacy? Contact ${supportEmail}.`,
      },
    ]);

    const cookiesId = await upsertPolicy(client, {
      slug: 'cookies-policy',
      title: `Cookies Policy – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, cookiesId, [
      {
        order: 1,
        title: 'Overview',
        content: md`Cookies are small files stored on your device. ${companyName} uses cookies and similar technologies to keep you signed in, improve performance, and measure product usage.`,
      },
      {
        order: 2,
        title: 'Types of Cookies We Use',
        content: md`We may use strictly necessary cookies (security, session), performance cookies (analytics), and functional cookies (preferences).`,
      },
      {
        order: 3,
        title: 'Managing Cookies',
        content: md`You can control cookies through your browser settings. Disabling cookies may affect certain features (like staying signed in).`,
      },
      {
        order: 4,
        title: 'Third-party Analytics',
        content: md`We may use analytics tools to understand product usage. These providers may set their own cookies. We aim to minimize and secure any data shared.`,
      },
      {
        order: 5,
        title: 'Contact',
        content: md`Questions? Contact ${supportEmail}.`,
      },
    ]);

    const refundId = await upsertPolicy(client, {
      slug: 'refund-policy',
      title: `Refund Policy – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, refundId, [
      {
        order: 1,
        title: 'Overview',
        content: md`${companyName} facilitates payments between customers and Fundis. Refund decisions depend on job status, evidence, and applicable laws.`,
      },
      {
        order: 2,
        title: 'Eligible Cases',
        content: md`Refunds may be considered for duplicate payments, proven non-delivery of service, or payment errors. Off-platform payments are not eligible.`,
      },
      {
        order: 3,
        title: 'Disputes',
        content: md`Disputes should be reported as soon as possible via Support. We may request photos, chat logs, and job details to investigate.`,
      },
      {
        order: 4,
        title: 'How to Request a Refund',
        content: md`Open a support ticket and include your job ID, a description of the issue, and any evidence. Contact ${supportEmail} if you can’t access the form.`,
      },
      {
        order: 5,
        title: 'Non-refundable Cases',
        content: md`Refunds are not available for off-platform payments, cash payments arranged directly between users, or cases where fraud is detected.`,
      },
    ]);

    const rulesId = await upsertPolicy(client, {
      slug: 'platform-rules',
      title: `Platform Rules – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, rulesId, [
      {
        order: 1,
        title: 'Customer Rules',
        content: md`Customers must provide accurate job details, confirm completion honestly, pay through the platform only, and treat Fundis respectfully. Customers must not post fake jobs, refuse payment after service, or abuse Fundis.`,
      },
      {
        order: 2,
        title: 'Fundi Rules',
        content: md`Fundis must use real identity, maintain accurate location, accept jobs responsibly, complete accepted jobs, and maintain good ratings. Fundis must not fake GPS location, request off-platform payments, or use another person’s identity.`,
      },
      {
        order: 3,
        title: 'Strictly Prohibited',
        content: md`Fraud, scams, identity theft, impersonation, payment manipulation, GPS spoofing, and harassment are strictly forbidden.`,
      },
      {
        order: 4,
        title: 'Enforcement',
        content: md`Violations may result in warnings, restrictions, suspension, or permanent bans depending on severity and recurrence.`,
      },
      {
        order: 5,
        title: 'Payments Rule (Critical)',
        content: md`All users must pay through the platform only. Any attempt to bypass payments can result in immediate suspension.`,
      },
    ]);

    const enforcementId = await upsertPolicy(client, {
      slug: 'enforcement-policy',
      title: `Enforcement Policy – ${companyName}`,
      version: '1.0',
    });
    await ensurePolicySections(client, enforcementId, [
      {
        order: 1,
        title: 'Level 1 – Warning',
        content: md`Triggered by minor or first-time violations. Action: warning notification and education on rules.`,
      },
      {
        order: 2,
        title: 'Level 2 – Temporary Restriction',
        content: md`Triggered by repeated cancellations, low ratings, or ignoring job requests. Action: temporary suspension (24–72 hours) and reduced visibility.`,
      },
      {
        order: 3,
        title: 'Level 3 – Account Suspension',
        content: md`Triggered by fake GPS, off-platform payments, or fraud attempts. Action: account disabled and jobs blocked.`,
      },
      {
        order: 4,
        title: 'Level 4 – Permanent Ban',
        content: md`Triggered by identity fraud, serious scams, or repeated violations. Action: permanent account deletion and blacklisting.`,
      },
      {
        order: 5,
        title: 'Automated Compliance Signals',
        content: md`We may monitor cancellation rate, completion rate, ratings, complaints, and GPS anomalies to detect abuse and protect the platform.`,
      },
      {
        order: 6,
        title: 'Rating-based Visibility',
        content: md`Ratings impact marketplace visibility. Repeated complaints, low ratings, and high cancellation rates may reduce visibility or trigger restrictions.`,
      },
      {
        order: 7,
        title: 'Payment Violations',
        content: md`Attempts to bypass platform payments can result in immediate suspension or permanent ban, and may lead to earnings being held during investigation.`,
      },
    ]);

    // Rules & penalties seeds (only if empty to avoid duplication)
    const rulesCount = await client.query('SELECT COUNT(*)::int AS n FROM rules');
    if ((rulesCount.rows[0]?.n ?? 0) === 0) {
      await client.query(
        `INSERT INTO rules (role, rule_text, severity_level) VALUES
         ('customer', 'No fake job requests.', 2),
         ('customer', 'Confirm job completion honestly.', 2),
         ('customer', 'No off-platform payments.', 3),
         ('customer', 'Provide accurate location and access details.', 2),
         ('customer', 'Treat Fundis respectfully; no harassment.', 3),
         ('fundi', 'Must use real identity and documents.', 4),
         ('fundi', 'No GPS spoofing or fake location.', 4),
         ('fundi', 'No off-platform payments.', 3),
         ('fundi', 'Complete accepted jobs or communicate cancellations early.', 2),
         ('fundi', 'No repeated cancellations that harm customers.', 2),
         ('fundi', 'Maintain quality and honest service descriptions.', 2),
         ('all', 'No harassment, abuse, or threats.', 3),
         ('all', 'No fraud, impersonation, or scams.', 4),
         ('all', 'No payment manipulation or chargeback abuse.', 4)`
      );
    }

    const penaltiesCount = await client.query('SELECT COUNT(*)::int AS n FROM penalties');
    if ((penaltiesCount.rows[0]?.n ?? 0) === 0) {
      await client.query(
        `INSERT INTO penalties (level, description, duration_minutes, action_type) VALUES
         ('warning', 'Warning notification and education.', 0, 'warn'),
         ('restriction', 'Temporary restriction and reduced visibility.', 1440, 'restrict'),
         ('suspension', 'Account suspension and job blocking.', 4320, 'suspend'),
         ('ban', 'Permanent ban and blacklisting.', NULL, 'ban')`
      );
    }

    // Help Center seed (only if empty)
    const faqCatCount = await client.query('SELECT COUNT(*)::int AS n FROM faq_categories');
    if ((faqCatCount.rows[0]?.n ?? 0) === 0) {
      const catRows = await client.query(
        `INSERT INTO faq_categories (slug, title, description, category_order)
         VALUES
          ('customer-help', 'Customer Help', 'Getting started and managing jobs', 1),
          ('fundi-help', 'Fundi Help', 'Verification, jobs, and payouts', 2),
          ('payments', 'Payments', 'How payments work and common issues', 3),
          ('account', 'Account Issues', 'Login, security, and profile', 4)
         RETURNING id, slug`
      );
      const catBySlug = Object.fromEntries(catRows.rows.map((r) => [r.slug, r.id]));

      await client.query(
        `INSERT INTO faqs (category_id, question, answer, faq_order) VALUES
         ($1, 'How do I create a job request?', 'Sign up, go to Create Job, describe the issue, and submit. We will match you with nearby Fundis.', 1),
         ($1, 'Can I pay a Fundi directly?', 'No. Off-platform payments are prohibited for safety and protection.', 2),
         ($2, 'How do I become a Fundi?', 'Go to Become a Fundi, complete verification, and wait for approval.', 1),
         ($2, 'Why do I need verification?', 'Verification protects customers and helps prevent fraud and impersonation.', 2),
         ($3, 'What payment methods are supported?', 'Payments are processed through supported providers shown during checkout.', 1),
         ($3, 'I was charged twice. What should I do?', 'Create a support ticket with your job ID and payment reference.', 2),
         ($4, 'I forgot my password. How do I reset it?', 'Use the sign-in page to request a password reset or contact support if you cannot access your email.', 1),
         ($4, 'How do I delete my account?', 'Contact support and we will guide you through the process.', 2)`,
        [
          catBySlug['customer-help'],
          catBySlug['fundi-help'],
          catBySlug['payments'],
          catBySlug['account'],
        ]
      );
    }

    // Blog seed
    await client.query(
      `INSERT INTO blog_posts (slug, title, excerpt, content, status, published_at)
       VALUES ($1, $2, $3, $4, 'published', NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [
        'welcome-to-patafundi',
        `Welcome to ${companyName}`,
        'Meet PataFundi — a safer way to find verified local professionals.',
        md`## What is ${companyName}?

${companyName} connects customers with verified local professionals (“Fundis”) for home and business services.

## Trust & safety

We work to reduce fraud with verification checks, platform payments, and clear platform rules.

## Need help?

Contact our support team at ${supportEmail}.`,
      ]
    );

    // Careers seed
    await client.query(
      `INSERT INTO career_jobs (slug, title, department, location, employment_type, description, requirements, status)
       VALUES
        ('software-engineer', 'Software Engineer', 'Engineering', 'Remote / Africa', 'Full-time',
         'Build reliable systems powering customer-to-fundi matching, payments, and safety features.',
         'Experience with TypeScript/Node, React, PostgreSQL, and secure API design.', 'open'),
        ('customer-support', 'Customer Support Specialist', 'Support', 'Nairobi', 'Full-time',
         'Help customers and Fundis resolve issues quickly and professionally.',
         'Strong communication skills; experience with support tools is a plus.', 'open'),
        ('operations-associate', 'Operations Associate', 'Operations', 'Nairobi', 'Full-time',
         'Support verification workflows, quality control, and marketplace operations.',
         'Detail-oriented; comfortable working with process checklists and data.', 'open')
       ON CONFLICT (slug) DO NOTHING`
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Default content seed failed:', err.message);
  } finally {
    client.release();
  }
}
