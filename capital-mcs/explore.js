const fs = require('fs');

async function explore() {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
  
  try {
    const res = await fetch('https://fviainboxes.com/', { headers });
    const html = await res.text();
    
    // Find all JS files
    const scripts = html.match(/<script.*?src=["'](.*?)["']/g);
    console.log('Scripts:', scripts);

    // Let's also check if there's any API url in the html
    const apis = html.match(/https:\/\/[a-zA-Z0-9.-]+\/api[a-zA-Z0-9.\/-]+/g);
    console.log('APIs:', apis);
  } catch(e) {
    console.error(e);
  }
}

explore();
