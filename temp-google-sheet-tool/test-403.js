async function test() {
  const url = 'https://fviainboxes.com/domains';
  
  console.log("Test 1: No User-Agent");
  const res1 = await fetch(url, { headers: { 'Accept': 'application/json' } });
  console.log('Status 1:', res1.status);
  if (res1.ok) console.log(await res1.text());

  console.log("\nTest 2: Chrome User-Agent");
  const headers2 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://fviainboxes.com',
    'Referer': 'https://fviainboxes.com/',
  };
  const res2 = await fetch(url, { headers: headers2 });
  console.log('Status 2:', res2.status);
  
}
test();
