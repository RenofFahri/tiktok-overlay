const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testCapture(user) {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Jalur standar Chrome Windows
        headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 450, height: 800 });
    
    console.log(`Mengakses live siaran: ${user}`);
    try {
        await page.goto(`https://www.tiktok.com/@${user}/live`, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Tunggu sebentar agar video player termuat
        await new Promise(r => setTimeout(r, 8000));
        
        const path = 'c:\\xampp\\htdocs\\apitiktok\\public\\uploads\\test_capture.jpg';
        await page.screenshot({ path, quality: 60, type: 'jpeg' });
        console.log('Screenshot berhasil disimpan di:', path);
    } catch (e) {
        console.error('Gagal mengambil screenshot:', e.message);
    } finally {
        await browser.close();
    }
}

testCapture('tiktok');
