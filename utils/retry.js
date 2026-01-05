async function retry(fn, retries = 3, delayMs = 3000) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔁 Attempt ${attempt}/${retries}`);
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`❌ Attempt ${attempt} failed`);

      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }

  throw lastError;
}

module.exports = retry;
