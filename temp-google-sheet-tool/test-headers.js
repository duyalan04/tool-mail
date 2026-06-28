async function test() {
  const url = 'https://fviainboxes.com/messages?username=andresa.victo1113&domain=fviainboxes.com';
  
  const headers2 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-requested-with': 'XMLHttpRequest',
    'Origin': 'https://fviainboxes.com',
    'Referer': 'https://fviainboxes.com/',
  };
  const res2 = await fetch(url, { headers: headers2 });
  console.log('Status 2:', res2.status);
  console.log(await res2.text());
}
test();
