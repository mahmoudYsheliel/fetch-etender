const express = require('express')
const puppeteer = require('puppeteer')
const google = require('googleapis').google
const cheerio = require('cheerio')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express()
const port = 3000
app.get('/', async (req, res) => {

  const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(3600000)
  page.setDefaultTimeout(3600000)

  await page.goto('https://etenders.gov.eg/RedirectLogin');

  await page.type('[name="USER_NAME"]', 'zelabs');
  await page.type('[name="PASSWORD"]', '123456');
  await Promise.all([
    page.click('[name="commit"]'),
    page.waitForNavigation()
  ]);

  async function getContent(url) {
    await page.goto(url);
    const content = await page.content();
    return content
  }

  async function getData(sgeet) {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'cred.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    const spreadsheetId = '19Jd8qmDU_Pp8PD_mE7a3SnJ7uEv76canWIAZuK2XxHw';

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === sgeet
    );
    if (!sheetExists) {
      throw new Error(`Sheet "${sgeet}" does not exist.`);
    }
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sgeet,
    });

    const data = response.data.values || [];
    return data;
  }

  async function sendData(data, sgeet) {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'cred.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    const spreadsheetId = '19Jd8qmDU_Pp8PD_mE7a3SnJ7uEv76canWIAZuK2XxHw';

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === sgeet
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sgeet,
                },
              },
            },
          ],
        },
      });
      console.log(`Sheet "${sgeet}" created.`);
    }

    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sgeet,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: data },
    });


  }

  async function fetchTendeeFileUpload(url) {
    let links = []
    const html = await getContent(url)

    const $ = cheerio.load(html);
    $('tbody tr td a').each((i, el) => {
      links.push($(el).attr('href'))
    });
    return links

  }

  async function fetchTender() {
    const oldData = (await getData('Contracts')).join()
    let currentPage = 1
    const url = 'https://etenders.gov.eg/Tender/DoSearchSorted/3?page='
    let values = []
    let hasNextPage = true
    while (hasNextPage) {
      console.log(hasNextPage, currentPage)
      const date = new Date()
      console.log(date.getTime())
      const html = await getContent(`${url + currentPage}`)

      const $ = cheerio.load(html);

      if (currentPage == 1) {
        const headers = $('thead tr th').map(function () {
          return $(this).text().trim();
        }).get();
        headers.push('Links')
        headers.push('Type')
        values.push(headers.reverse())
      }

      const headerRows = [];

      const rows = $('tbody tr').toArray()
      for (const row of rows) {
        const rowValues = [];
        $(row).find('td').each((i, td) => {
          rowValues.push($(td).text().trim());
        });
        const dataArray = $(row).find('td').toArray()
        for (const data of dataArray) {
          const element = $.html(data)
          const $inner = cheerio.load(element);
          if ($inner('a').length > 0) {
            const ref = $inner('a').attr('href')
            if (ref.includes('Tender')) {
              const componenets = ref.split('/')
              const number = componenets[componenets.length - 1]
              const filesURL = `https://etenders.gov.eg/Tender/${number}/Files/2/1`
              const linkArr = await fetchTendeeFileUpload(filesURL)

              const links = linkArr.map((l, i) => `${l.toString('utf8')}`).join('\n');
              rowValues.push(links)
              const isOld = linkArr.map(l => oldData.includes(l) ? 'Old' : 'New').join('\n')
              rowValues.push(isOld)
            }
          }
        }
        headerRows.push(rowValues.reverse())
      }

      values.push(...headerRows)

      // hasNextPage = currentPage < 3
      hasNextPage = headerRows.length > 0

      currentPage += 1
    }
    return values
  }


  const v = await fetchTender()
  sendData(v, `Contracts`)

  await browser.close();



  res.send('Hello World')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
