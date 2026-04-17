const puppeteer = require('puppeteer');

class PDFService {
  async generateWOReport(wo) {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
    body { font-family: 'Sarabun', sans-serif; margin: 20px; }
    .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
    h1 { color: #1e40af; font-size: 24px; }
    .wo-box { background: #dbeafe; padding: 10px; display: inline-block; border-radius: 5px; font-size: 18px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Industrial CMMS - Work Order Report</h1>
    <div style="font-size: 12px; color: #666;">Generated: ${new Date().toLocaleString('th-TH')}</div>
  </div>
  
  <div style="text-align: center; margin-bottom: 20px;">
    <div class="wo-box">${wo.wo_number}</div>
  </div>

  <div class="section">
    <div class="label">Title</div>
    <div style="font-size: 16px; font-weight: bold;">${wo.title}</div>
  </div>

  <table>
    <tr>
      <th>Equipment</th>
      <td>${wo.asset_code || '-'}</td>
      <th>Priority</th>
      <td>${wo.priority}</td>
    </tr>
    <tr>
      <th>Status</th>
      <td>${wo.status}</td>
      <th>Type</th>
      <td>${wo.wo_type || 'Corrective'}</td>
    </tr>
  </table>

  <div class="section" style="margin-top: 20px;">
    <div class="label">Description</div>
    <div style="background: #f8fafc; padding: 15px; border-radius: 5px;">${wo.description || '-'}</div>
  </div>

  <div style="margin-top: 40px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 30%;">
      <div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 60px;">Requester</div>
    </div>
    <div style="text-align: center; width: 30%;">
      <div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 60px;">Technician</div>
    </div>
    <div style="text-align: center; width: 30%;">
      <div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 60px;">Manager</div>
    </div>
  </div>
</body>
</html>`;

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return pdf;
    } finally {
      await browser.close();
    }
  }
}

module.exports = new PDFService();