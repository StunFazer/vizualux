import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('BROWSER_REQ_FAILED:', request.url(), request.failure().errorText)
  );

  console.log('Navigating to http://localhost:5173...');
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 5000 });
  } catch (e) {
    console.log('Goto error:', e.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
