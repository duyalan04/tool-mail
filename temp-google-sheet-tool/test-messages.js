const headers = { 'Accept': 'application/json, text/plain, */*' };

async function check() {
  const url = `https://fviainboxes.com/messages?username=andresa.victo1113&domain=fviainboxes.com`;
  console.log('Fetching', url);
  const r2 = await fetch(url, {headers});
  console.log('Status:', r2.status);
  const text = await r2.text();
  console.log('Response:', text.slice(0, 100));
}
check();
