const EmailSuppression = require('../models/EmailSuppression');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isSuppressed = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const record = await EmailSuppression.findOne({ email: normalized, status: 'suppressed' }).lean();
  return !!record;
};

const suppressEmail = async ({ email, reason, category = 'recipient', providerError = '' }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const now = new Date();
  try {
    return await EmailSuppression.findOneAndUpdate(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          firstFailureAt: now,
          isPermanent: true,
          status: 'suppressed',
        },
        $set: {
          reason: reason || 'Email delivery failed',
          category,
          providerError: String(providerError || '').slice(0, 2000),
          lastFailureAt: now,
        },
        $inc: { failureCount: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Duplicate key (race) -> update existing record.
    if (err && err.code === 11000) {
      return EmailSuppression.findOneAndUpdate(
        { email: normalized },
        {
          $set: {
            reason: reason || 'Email delivery failed',
            category,
            providerError: String(providerError || '').slice(0, 2000),
            lastFailureAt: now,
          },
          $inc: { failureCount: 1 },
        },
        { new: true }
      );
    }
    throw err;
  }
};

const filterSuppressed = async (emails) => {
  const normalized = emails.map(normalizeEmail).filter(Boolean);
  if (!normalized.length) return { allowed: [], suppressed: [] };
  const records = await EmailSuppression.find({
    email: { $in: normalized },
    status: 'suppressed',
  })
    .select('email')
    .lean();
  const suppressedSet = new Set(records.map((r) => r.email));
  const allowed = [];
  const suppressed = [];
  for (const email of normalized) {
    if (suppressedSet.has(email)) suppressed.push(email);
    else allowed.push(email);
  }
  return { allowed, suppressed };
};

module.exports = {
  normalizeEmail,
  isSuppressed,
  suppressEmail,
  filterSuppressed,
};