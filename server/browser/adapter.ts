import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BrowserCommandParams, BrowserCommandResult } from '../types';

export class BrowserAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private currentUrl: string = 'about:blank';
  private pageTitle: string = 'Blank';
  private lastScreenshotBase64: string = '';
  private isInitializing: boolean = false;

  async init(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      return;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
      }

      if (!this.context) {
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 PersonalAgentWorkbench/0.1',
        });
      }

      this.page = await this.context.newPage();
      this.currentUrl = 'about:blank';
      this.pageTitle = 'Personal Agent Browser';
    } finally {
      this.isInitializing = false;
    }
  }

  async executeCommand(params: BrowserCommandParams): Promise<BrowserCommandResult> {
    await this.init();
    if (!this.page) {
      throw new Error('Browser page failed to initialize');
    }

    try {
      switch (params.action) {
        case 'navigate': {
          let targetUrl = params.url || 'https://www.google.com';
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
          }
          await this.page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
          });
          break;
        }

        case 'click': {
          if (!params.selector) {
            throw new Error('Selector is required for click action');
          }
          await this.page.waitForSelector(params.selector, { timeout: 8000 });
          await this.page.click(params.selector);
          await this.page.waitForTimeout(1000);
          break;
        }

        case 'type': {
          if (!params.selector) {
            throw new Error('Selector is required for type action');
          }
          await this.page.waitForSelector(params.selector, { timeout: 8000 });
          await this.page.fill(params.selector, params.text || '');
          // Press Enter if it's an input or search box
          if (params.selector.includes('input') || params.selector.includes('search')) {
            await this.page.press(params.selector, 'Enter');
            await this.page.waitForTimeout(2000);
          }
          break;
        }

        case 'scroll': {
          const direction = params.scrollDirection || 'down';
          const amount = params.scrollAmount || 500;
          const deltaY = direction === 'down' ? amount : -amount;
          await this.page.evaluate((y) => window.scrollBy(0, y), deltaY);
          await this.page.waitForTimeout(500);
          break;
        }

        case 'back': {
          await this.page.goBack({ timeout: 10000 });
          break;
        }

        case 'new_tab': {
          if (this.context) {
            this.page = await this.context.newPage();
            if (params.url) {
              await this.page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            }
          }
          break;
        }

        case 'screenshot':
        case 'get_content':
        case 'get_dom_structure':
          // Handled in observation retrieval below
          break;

        default:
          throw new Error(`Unknown browser action: ${params.action}`);
      }

      // Update state
      this.currentUrl = this.page.url();
      this.pageTitle = await this.page.title();

      // Capture screenshot
      const screenshotBuffer = await this.page.screenshot({
        type: 'png',
        fullPage: false,
      });
      this.lastScreenshotBase64 = screenshotBuffer.toString('base64');

      // Extract readable content
      const content = await this.extractReadableContent();

      // Extract simplified DOM structure
      let domStructure = null;
      if (params.action === 'get_dom_structure' || params.action === 'navigate') {
        domStructure = await this.extractDomStructure();
      }

      return {
        success: true,
        currentUrl: this.currentUrl,
        pageTitle: this.pageTitle,
        screenshotBase64: this.lastScreenshotBase64,
        content,
        domStructure,
      };
    } catch (err: any) {
      console.error('Browser command execution failed:', err);
      return {
        success: false,
        currentUrl: this.currentUrl,
        pageTitle: this.pageTitle,
        screenshotBase64: this.lastScreenshotBase64,
        error: err.message,
      };
    }
  }

  async extractReadableContent(): Promise<string> {
    if (!this.page) return '';
    try {
      return await this.page.evaluate(() => {
        // Strip scripts and styles
        const cloned = document.body.cloneNode(true) as HTMLElement;
        const removeTags = ['script', 'style', 'noscript', 'svg', 'iframe'];
        removeTags.forEach((tag) => {
          const elements = cloned.querySelectorAll(tag);
          elements.forEach((el) => el.remove());
        });

        // Get inner text and clean up whitespace
        const text = cloned.innerText || '';
        return text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .slice(0, 200) // keep top 200 meaningful lines for agent context
          .join('\n');
      });
    } catch (e) {
      return '';
    }
  }

  async extractDomStructure(): Promise<any> {
    if (!this.page) return null;
    try {
      return await this.page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({
          tag: h.tagName.toLowerCase(),
          text: h.textContent?.trim().slice(0, 100),
        }));

        const links = Array.from(document.querySelectorAll('a[href]'))
          .slice(0, 15)
          .map((a) => ({
            text: a.textContent?.trim().slice(0, 80),
            href: (a as HTMLAnchorElement).href,
          }))
          .filter((item) => item.text && item.text.length > 0);

        const inputs = Array.from(document.querySelectorAll('input, textarea, button'))
          .slice(0, 15)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || '',
            placeholder: (el as HTMLInputElement).placeholder || '',
            name: (el as HTMLInputElement).name || '',
            id: el.id || '',
            text: el.textContent?.trim() || '',
          }));

        return {
          title: document.title,
          headings,
          links,
          interactiveElements: inputs,
        };
      });
    } catch (e) {
      return null;
    }
  }

  getCurrentState() {
    return {
      currentUrl: this.currentUrl,
      pageTitle: this.pageTitle,
      lastScreenshotBase64: this.lastScreenshotBase64,
    };
  }

  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.currentUrl = 'about:blank';
    this.pageTitle = 'Closed';
    this.lastScreenshotBase64 = '';
  }
}

// Global Browser Adapter instance
export const globalBrowserAdapter = new BrowserAdapter();
