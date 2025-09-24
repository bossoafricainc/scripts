/**
 * Script to scrape content from the old Bosso website
 * 
 * This script uses Puppeteer to scrape content from the old Bosso website
 * and saves it to a JSON file that can be used to populate the site settings.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// URL of the old website
const OLD_WEBSITE_URL = 'https://www.thebosso.com/';

// Output file path
const OUTPUT_FILE = path.join(__dirname, 'old_website_content.json');

/**
 * Extract text content from a selector
 * @param {Page} page - Puppeteer page object
 * @param {string} selector - CSS selector
 * @returns {Promise<string>} - Text content
 */
async function extractText(page, selector) {
  try {
    return await page.$eval(selector, el => el.textContent.trim());
  } catch (error) {
    console.warn(`Warning: Could not extract text from selector "${selector}"`);
    return '';
  }
}

/**
 * Extract HTML content from a selector
 * @param {Page} page - Puppeteer page object
 * @param {string} selector - CSS selector
 * @returns {Promise<string>} - HTML content
 */
async function extractHTML(page, selector) {
  try {
    return await page.$eval(selector, el => el.innerHTML.trim());
  } catch (error) {
    console.warn(`Warning: Could not extract HTML from selector "${selector}"`);
    return '';
  }
}

/**
 * Extract image URLs from a selector
 * @param {Page} page - Puppeteer page object
 * @param {string} selector - CSS selector
 * @returns {Promise<string[]>} - Array of image URLs
 */
async function extractImages(page, selector) {
  try {
    return await page.$$eval(`${selector} img`, imgs => imgs.map(img => img.src));
  } catch (error) {
    console.warn(`Warning: Could not extract images from selector "${selector}"`);
    return [];
  }
}

/**
 * Scrape the home page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object>} - Home page content
 */
async function scrapeHomePage(page) {
  console.log('Scraping home page...');
  await page.goto(OLD_WEBSITE_URL, { waitUntil: 'networkidle2' });
  
  // Extract hero section
  const heroTitle = await extractText(page, '.hero-section h1, .banner-section h1, .main-banner h1');
  const heroContent = await extractText(page, '.hero-section p, .banner-section p, .main-banner p');
  
  // Extract features section
  const features = await page.$$eval('.features-section .feature, .services-section .service', elements => {
    return elements.map(el => {
      const title = el.querySelector('h2, h3')?.textContent.trim() || '';
      const description = el.querySelector('p')?.textContent.trim() || '';
      const iconClass = el.querySelector('i, .icon')?.className || '';
      
      return { title, description, iconClass };
    });
  }).catch(() => []);
  
  // Extract testimonials
  const testimonials = await page.$$eval('.testimonials-section .testimonial, .reviews-section .review', elements => {
    return elements.map(el => {
      const quote = el.querySelector('p, blockquote')?.textContent.trim() || '';
      const author = el.querySelector('.author, .name')?.textContent.trim() || '';
      
      return { quote, author };
    });
  }).catch(() => []);
  
  return {
    hero: {
      title: heroTitle,
      content: heroContent
    },
    features,
    testimonials
  };
}

/**
 * Scrape the about page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object>} - About page content
 */
async function scrapeAboutPage(page) {
  console.log('Scraping about page...');
  await page.goto(`${OLD_WEBSITE_URL}about`, { waitUntil: 'networkidle2' });
  
  // Extract company info
  const title = await extractText(page, '.about-section h1, .page-title h1');
  const content = await extractText(page, '.about-section p:first-of-type, .page-content p:first-of-type');
  
  // Extract mission, vision, values
  const mission = await extractText(page, '.mission-section p, .about-mission p');
  const vision = await extractText(page, '.vision-section p, .about-vision p');
  
  // Extract values
  const values = await page.$$eval('.values-section li, .about-values li', elements => {
    return elements.map(el => el.textContent.trim());
  }).catch(() => []);
  
  return {
    title,
    content,
    mission,
    vision,
    values
  };
}

/**
 * Scrape the contact page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object>} - Contact page content
 */
async function scrapeContactPage(page) {
  console.log('Scraping contact page...');
  await page.goto(`${OLD_WEBSITE_URL}contact`, { waitUntil: 'networkidle2' });
  
  // Extract contact info
  const title = await extractText(page, '.contact-section h1, .page-title h1');
  const content = await extractText(page, '.contact-section p:first-of-type, .page-content p:first-of-type');
  
  // Extract address, phone, email
  const address = await extractText(page, '.contact-address, .address');
  const phone = await extractText(page, '.contact-phone, .phone');
  const email = await extractText(page, '.contact-email, .email');
  
  return {
    title,
    content,
    contactInfo: {
      address,
      phone,
      email
    }
  };
}

/**
 * Scrape the FlexiPay page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object>} - FlexiPay page content
 */
async function scrapeFlexiPayPage(page) {
  console.log('Scraping FlexiPay page...');
  await page.goto(`${OLD_WEBSITE_URL}flexipay`, { waitUntil: 'networkidle2' });
  
  // Extract page info
  const title = await extractText(page, '.flexipay-section h1, .page-title h1');
  const content = await extractText(page, '.flexipay-section p:first-of-type, .page-content p:first-of-type');
  
  // Extract features
  const features = await page.$$eval('.flexipay-features .feature, .features-list .feature', elements => {
    return elements.map(el => {
      const title = el.querySelector('h2, h3')?.textContent.trim() || '';
      const description = el.querySelector('p')?.textContent.trim() || '';
      const iconClass = el.querySelector('i, .icon')?.className || '';
      
      return { title, description, iconClass };
    });
  }).catch(() => []);
  
  // Extract FAQs
  const faqs = await page.$$eval('.flexipay-faqs .faq, .faqs-section .faq', elements => {
    return elements.map(el => {
      const question = el.querySelector('h3, .question')?.textContent.trim() || '';
      const answer = el.querySelector('p, .answer')?.textContent.trim() || '';
      
      return { question, answer };
    });
  }).catch(() => []);
  
  return {
    title,
    content,
    features,
    faqs
  };
}

/**
 * Scrape the Diaspora page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object>} - Diaspora page content
 */
async function scrapeDiasporaPage(page) {
  console.log('Scraping Diaspora page...');
  await page.goto(`${OLD_WEBSITE_URL}diaspora`, { waitUntil: 'networkidle2' });
  
  // Extract page info
  const title = await extractText(page, '.diaspora-section h1, .page-title h1');
  const content = await extractText(page, '.diaspora-section p:first-of-type, .page-content p:first-of-type');
  
  // Extract sections
  const sections = await page.$$eval('.diaspora-services .service, .services-list .service', elements => {
    return elements.map(el => {
      const title = el.querySelector('h2, h3')?.textContent.trim() || '';
      const content = el.querySelector('p')?.textContent.trim() || '';
      
      return { title, content, type: 'text' };
    });
  }).catch(() => []);
  
  return {
    title,
    content,
    sections
  };
}

/**
 * Scrape the company logo
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<string>} - Logo URL
 */
async function scrapeLogo(page) {
  console.log('Scraping logo...');
  await page.goto(OLD_WEBSITE_URL, { waitUntil: 'networkidle2' });
  
  try {
    const logoUrl = await page.$eval('header .logo img, .navbar-brand img', img => img.src);
    return logoUrl;
  } catch (error) {
    console.warn('Warning: Could not extract logo');
    return '';
  }
}

/**
 * Scrape the footer links
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object[]>} - Footer links
 */
async function scrapeFooterLinks(page) {
  console.log('Scraping footer links...');
  await page.goto(OLD_WEBSITE_URL, { waitUntil: 'networkidle2' });
  
  try {
    const footerLinks = await page.$$eval('footer .links a, footer .nav a', links => {
      return links.map(link => {
        return {
          text: link.textContent.trim(),
          url: link.href
        };
      });
    });
    return footerLinks;
  } catch (error) {
    console.warn('Warning: Could not extract footer links');
    return [];
  }
}

/**
 * Scrape social media links
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<Object[]>} - Social media links
 */
async function scrapeSocialLinks(page) {
  console.log('Scraping social media links...');
  await page.goto(OLD_WEBSITE_URL, { waitUntil: 'networkidle2' });
  
  try {
    const socialLinks = await page.$$eval('footer .social a, .social-links a', links => {
      return links.map(link => {
        return {
          platform: link.getAttribute('aria-label') || link.title || '',
          url: link.href
        };
      });
    });
    return socialLinks;
  } catch (error) {
    console.warn('Warning: Could not extract social media links');
    return [];
  }
}

/**
 * Main function to scrape the website
 */
async function scrapeWebsite() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1366, height: 768 });
    
    // Scrape content
    const homeContent = await scrapeHomePage(page);
    const aboutContent = await scrapeAboutPage(page);
    const contactContent = await scrapeContactPage(page);
    const flexiPayContent = await scrapeFlexiPayPage(page);
    const diasporaContent = await scrapeDiasporaPage(page);
    const logoUrl = await scrapeLogo(page);
    const footerLinks = await scrapeFooterLinks(page);
    const socialLinks = await scrapeSocialLinks(page);
    
    // Combine all content
    const websiteContent = {
      branding: {
        logo: logoUrl
      },
      companyInfo: {
        name: 'Bosso',
        tagline: homeContent.hero.title,
        description: homeContent.hero.content,
        mission: aboutContent.mission,
        vision: aboutContent.vision,
        values: aboutContent.values
      },
      contactInfo: {
        address: contactContent.contactInfo.address,
        phone: contactContent.contactInfo.phone,
        email: contactContent.contactInfo.email
      },
      pages: {
        home: {
          title: homeContent.hero.title,
          content: homeContent.hero.content,
          features: homeContent.features,
          testimonials: homeContent.testimonials
        },
        about: {
          title: aboutContent.title,
          content: aboutContent.content
        },
        contact: {
          title: contactContent.title,
          content: contactContent.content
        },
        flexiPay: {
          title: flexiPayContent.title,
          content: flexiPayContent.content,
          features: flexiPayContent.features,
          faqs: flexiPayContent.faqs
        },
        diaspora: {
          title: diasporaContent.title,
          content: diasporaContent.content,
          sections: diasporaContent.sections
        }
      },
      footer: {
        links: footerLinks,
        socialLinks: socialLinks
      }
    };
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(websiteContent, null, 2));
    console.log(`Website content saved to ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error scraping website:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeWebsite().catch(console.error);
