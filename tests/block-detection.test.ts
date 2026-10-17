import { describe, expect, it } from 'vitest';
import { ErrorCodes, HotelBrowser } from '../src/browser.js';

interface BlockingProbe {
  page: {
    content: () => Promise<string>;
    url: () => string;
    locator: (selector: string) => { innerText: () => Promise<string> };
  };
  checkForBlocking: () => Promise<void>;
}

function checkPage(html: string, text: string, url = 'https://www.booking.com/searchresults.html') {
  const browser = new HotelBrowser() as unknown as BlockingProbe;
  browser.page = {
    content: async () => html,
    url: () => url,
    locator: () => ({ innerText: async () => text }),
  };
  return browser.checkForBlocking();
}

describe('Blocking classification', () => {
  it('accepts results when blocking terminology appears only in JavaScript', async () => {
    const html = '<body><h1>Madrid: hotels found</h1><script>const blocked = false;</script></body>';
    await expect(checkPage(html, 'Madrid: hotels found')).resolves.toBeUndefined();
  });

  it('still reports an access-denied page', async () => {
    await expect(checkPage(
      '<body>Access denied: request blocked</body>',
      'Access denied: request blocked',
    )).rejects.toMatchObject({ code: ErrorCodes.BLOCKED });
  });

  it('still reports a CAPTCHA challenge', async () => {
    await expect(checkPage(
      '<body><div id="px-captcha"></div></body>',
      'Verify that you are human',
    )).rejects.toMatchObject({ code: ErrorCodes.CAPTCHA_DETECTED });
  });

  it('still reports a blocking URL without visible error text', async () => {
    await expect(checkPage(
      '<body></body>',
      '',
      'https://www.booking.com/blocked',
    )).rejects.toMatchObject({ code: ErrorCodes.BLOCKED });
  });
});
