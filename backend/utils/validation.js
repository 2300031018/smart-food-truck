// Basic validation helpers for controllers
// Keep lightweight; avoid external deps

function missingFields(obj, required) {
  const missing = [];
  required.forEach(f => {
    const val = obj[f];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      missing.push(f);
    }
  });
  return missing;
}

function respondValidation(res, details, message = 'Validation failed') {
  return res.status(422).json({
    success: false,
    error: {
      message,
      code: 'VALIDATION_ERROR',
      details
    }
  });
}

module.exports = {
  missingFields,
  respondValidation
};