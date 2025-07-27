process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import * as cheerio from 'cheerio'
import { google } from 'googleapis';



async function sendData(data,sgeet){
  console.log(data)
  
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

  // 2. Create sheet if it doesn't exist
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
    range:sgeet,
    valueInputOption: 'RAW',
    requestBody: {values: data},
  });
  

}


async function fetchTender(){
  let currentPage = 1
  const url = 'https://etenders.gov.eg/Tender/DoSearchSorted/3?page='
  let values = []
  let hasNextPage = true
  while (hasNextPage){
    console.log(hasNextPage,currentPage)

    await fetch(`${url+currentPage}`)
    .then(res => res.text())
    .then(html =>{
     const $ = cheerio.load(html);
     if (currentPage == 1){
      const headers = $('thead tr th').map(function () {
        return $(this).text().trim();
      }).get();
      headers.push('Links')
      values.push(headers.reverse())
     }

    const headerRows = [];

    $('tbody tr').each(async (i, row) => {
      const rowValues = [];
      let links = ''
      $(row).find('td').each(async (j, cell) => {
        const element = $.html(cell)
        const $inner = cheerio.load(element);
        
        if( $inner('a').length > 0){
          const ref = $inner('a').attr('href')
          if (ref.includes('Tender')){
            const componenets = ref.split('/')
            const number = componenets[componenets.length - 1]
            const filesURL = `https://etenders.gov.eg/Tender/${number}/Files/2/1`
            const linkArr = await fetchTendeeFileUpload(filesURL)
            links = linkArr.join(' ')

          }

        }

        rowValues.push($(cell).text().trim().toString('utf8'));
        
      });
      rowValues.push(links)
      headerRows.push(rowValues.reverse());
    });
    
    values.push(...headerRows)
    console.log({headerRows})
    return
    
    if (currentPage>50){
      console.log(headerRows)
    }

    hasNextPage = currentPage < 3
    })
    .catch(err => console.error(err));
    currentPage +=1
  }
  return values
}



const activities = {
  educationalDevices:120,
  generalSupplies:52,
  scientificLaboratoryEquipment: 139,
  generalTrade:358,
  tradeSplies:165
}

async function fetchactivity(activityNumber){
  let currentPage = 1
  const url = `https://etenders.gov.eg/Supp/DoSearch?selactivity=${activityNumber}&page=`
  let values = []
  let hasNextPage = true
  while (hasNextPage){
    console.log(hasNextPage,currentPage)

    await fetch(`${url+currentPage}`)
    .then(res => res.text())
    .then(html =>{
     const $ = cheerio.load(html);
     if (currentPage == 1){
      const headers = $('thead tr th').map(function () {
        return $(this).text().trim();
      }).get();
      values.push(headers.reverse())
     }

    const headerRows = [];

    $('tbody tr').each((i, row) => {
      const rowValues = [];
      $(row).find('td').each((j, cell) => {
        // const element = $.html(cell)
        // console.log(element)
        rowValues.push($(cell).text().trim().toString('utf8'));
      });
      headerRows.push(rowValues.reverse());
    });
    
    values.push(...headerRows)

    //hasNextPage = headerRows.length > 0
    hasNextPage = currentPage < 3

    })
    .catch(err => console.error(err));
    currentPage +=1
  }
  return values
}

async function fetchSaveActivity(){
  for (let ac in activities){
    const v = await fetchactivity(activities[ac])
    console.log(v)
    // sendData(v,`${ac}!A1`)
    sendData(v,`${ac}`)
  }

}

const v = await fetchTender()
sendData(v,`canApplyTo`)

// fetchSaveActivity()


async function fetchTendeeFileUpload(url){
  let links = []
  const authString = '__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752735138.1752840831.16; __utmt=1; __utmb=143158369.27.10.1752840831; XSRF-TOKEN=eyJpdiI6Ikh3N21nOEhxeTMwVUlvZENyamp2cHc9PSIsInZhbHVlIjoiS0xMa1NOVVJwNGllSHBZUDRNYTZ6Y3RUaEVJVVkralJNYjlRYm5pNE1ueVJhT2ZhVWU5UnhqS2FjbHVETHFDZk9TWFhoXC9QZytMYTZSN0hWQ3B5S0lRPT0iLCJtYWMiOiI0Y2NjMWUyZmM0Yjc3YzY5NjM2MmZjMzUxNDRhNjg4Mzc0NzY1NjBmYTc5NjU4NjdiZTg3YTdlMDU0Njg2M2Y2In0%3D; laravel_session=eyJpdiI6ImVCaDNcLzFsQ2JuRWpTdU9Pdkh1dE53PT0iLCJ2YWx1ZSI6Ik9NYVNKTGZIbDNtS2s0Q1AwYUFwd1BwUHFvZWMwT3Jqazl3cVNqQ2FubFFFaVB6cU95dFQwZDF1S05kOEdMd1R3V013SkIwWXFjSkdJRzUwcXBkU21RPT0iLCJtYWMiOiI3M2ExZTI1NTM2ZjFjNWYyMWIwYWNmZDg5ODM2MTU5OGJjODE5ODU5NjdjOWM3ZTU3YzNhNTc0MmY3ZGM2MzI4In0%3D'
    await fetch(url,{headers: {
      'Cookie': authString, 
      'User-Agent': 'Mozilla/5.0', 
    }})
    .then(res => res.text())
    .then(html =>{
      const $ = cheerio.load(html);
     $('tbody tr td a').each((i, el) => {
      links.push($(el).attr('href'))
    });
    })
    .catch(err => console.error(err));

    return links

  }



'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6InlhN3oraVRqM1Vhcmk2QmxuN1QwV3c9PSIsInZhbHVlIjoicVl4MXVrdmx0VXc0MkxVWHcwNWFLalArWUtWek05VlhmZUVLeVFTUG9ybTM1ekR3NjJKNmhUXC84K0MrQ29qOWt2QW9INTllVkFWaEgxS0JFMkxPU3lRPT0iLCJtYWMiOiI3OGIyYjFlN2E5MTAwNDUyMWQ3MTQ1ODRiYjAzM2ZiNjZlNjI0YzEzY2Y0NWUxMjlhMThiYzlhN2U0ZTcxZDBhIn0%3D; laravel_session=eyJpdiI6IkVPWHlLVDJDZlZ2NHljVWM2dFcyU1E9PSIsInZhbHVlIjoiYzlEaWg2ekhKdVJRWVBFVzNQTndxQ0dHOG5MSkhNdVZicXVjak1CbmpXUkQ4bVNqQ2JYdDZ3cXlQYnhJZ1BPUG1kM044eWp1aWIza1dPemJMVVE3YXc9PSIsIm1hYyI6IjM0OWMyM2MxYmVkYTRmYzQ0MzNmNDhjYzU2YjFmMmI3NDM3YTExNGNlYTQ0Y2E4ODNlNjc4MjlmOTVmZTI0MjMifQ%3D%3D; __utmb=143158369.13.10.1752851619'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6IjkyeCtkcDVsZThLdmhxdjlxaVlrM0E9PSIsInZhbHVlIjoicXZseEo4WmswbW03R0JlWUc4K1dkYnNHY3ZEbDhDeEJua1wvR2laZ1puNHpkYzVNaEpUUVZcL09pR1dkMjc1WEpNZ1hMZ1hjUGtjSkRqWTdLVDZDUmJqZz09IiwibWFjIjoiZTQwODBhNTRmN2ZkZDdjOTBiOGRkYjEyNmJiMmFlMDVhMWQyYTExMzc5ZjNiNzFjNWIxM2Q3YzM3MjdkMWViMSJ9; laravel_session=eyJpdiI6ImJkY2ZITHpOdVI5SmJxbmh5dUxndWc9PSIsInZhbHVlIjoibmpCVnlISjAxVzA1ZndHVlRpd01NSzJINjZiYW1OeDRiYmhYVFlvMVZLRHR4YlNIRVwvajNpT3dYcFlFWUNwUXcxZm1rSHRXeTY2U3o3UU5ja0pJXC9odz09IiwibWFjIjoiZDdkOWQ2YTUwZTg0NjdjNGJmZjQ2NjdmZGQ2MTZjYzc2MDZjZDVkNzFlNjc0ZTUzODY0MGJmZjZiNzlkNDE2YiJ9; __utmb=143158369.17.10.1752851619'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752735138.1752840831.16; XSRF-TOKEN=eyJpdiI6Ik1jUHBVdHFoMmNhSmNcL21uNW8yYUtBPT0iLCJ2YWx1ZSI6ImJcL2pYTCtOUE1EQmJGVzYrVkxOVnFYQ1VFZEthRGY3U2k2VWpFRmozNCtZYklmXC9XREEweU1vNzFReXlVdG80MndrdDdtSDhjMmdsSlwvV2FvOFlkbUp3PT0iLCJtYWMiOiI0ZTYyMGE3ZTg5YTI1NzM0Mjg4YTE4MmJlYWJmNWU2YWNlMzJiOWRiMTVhNjQzNTBiN2ZmODYwNjQ0MmE4MGU2In0%3D; laravel_session=eyJpdiI6Ik5YVjhTZXQ5ZnNNNkpscVBNZDVkQ2c9PSIsInZhbHVlIjoiU2hYZzNBZEFcL3h1SFMrZE42bUpJYTRcL0RnUE9ub21BN0RyaGJYRjJZXC85cG4zWGRPWUhkK2VscXA0K3VTZGtBb3phcmlrV0VcL2FWUFVkT2wwdGxjOEtBPT0iLCJtYWMiOiJkNjI4NjZmNzFiZmJjNmM5MTRjMDlkOGQ1YjExNzBkMjI0MzI0NjExNjk1ODVlNTc1YjJlNTMxZjcyODYzNzBjIn0%3D'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6IjF4dSsxVjdsYmpoQWJ2RldKM05NWVE9PSIsInZhbHVlIjoiSVlcL1JLUk1qWENvSFM4ZUZmcDVNQkFOc01zZWJURnNtTGE5SlVwUnVRSFwvN01TM1ZZN0owdGpLZkp2VlwvZVhtNUgyV3VnTnBMbW1tdWpOWGtNKzRJaFE9PSIsIm1hYyI6Ijk3Y2VlMWEwYmQxYjM5NDU3NzZiY2JmZTA3YzgyODkwOWUzYTdhZWY5YzU1NmFiNGM0YTViOWI3YmEwZjhkNzkifQ%3D%3D; laravel_session=eyJpdiI6Im1MODZ1WUZSXC9lUWJIVHVuZ1l3RlZ3PT0iLCJ2YWx1ZSI6IkJkalFENmgzK3B3ZTBsNjNzeU1OV1lWdHdQU05iaG9nanpLVmhoUUdWWVB4eVhKTSs5NFdtSTlkWlRTY0Q0b2d3dmFMVnF5TFRDWVBySmI1SnM1Tm93PT0iLCJtYWMiOiIzZTYyYWNjMGM0YTAwYWU2ZmE2ODEzMTdmOGNkMTg1NjNhNDQ2MzViYjc5MWU2MDVmNjkyMjIxN2JlZTMwNjEyIn0%3D; __utmb=143158369.2.10.1752851619'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6ImtQK2gzdkJvSEIxN0NBbEVEOFFqMXc9PSIsInZhbHVlIjoiYkI2eTlYbTFSUjZtWWM5VDFUWnJtTHRnR1lpK1lUaUdKV1NoOFRRVGZPZW8zMk9aOXlYcHhOUlAxSXRCVXlrVXpNOWpoamJCY1MwZTFDMzhaXC9OQmZRPT0iLCJtYWMiOiI3MDQ4ZDNmODg3ZDNlMDEzYjE3Yzg4MDU1MmRkNGRkNzRmMjY4NDgyMDFjODAzMThhYmE5YWQ0MGE0ZjQzMDY1In0%3D; laravel_session=eyJpdiI6IlFvdlVXUER6M0pmYlluTzBaVjZ3SWc9PSIsInZhbHVlIjoiSnpnNWp3UWlObjR2NnlqZjNVV005Tmt2bDF6R3ZpZGE3UzRBU1pYWUN6ZTVobHdBSkhlb1luN0pzNDdxN2ZxaEFEbWlYRGxNY0Z5YUpzRGdRWWFjQ1E9PSIsIm1hYyI6IjhlOWYyM2YyZDlmNDZkODc4OTIzMWM5ZjcxMDI1NzFkOGU1MDNlM2UyYmZmZWJkYWE0ZDA5MGFhZDFkNTAzYWMifQ%3D%3D; __utmb=143158369.9.10.1752851619'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6InhhY3FCTk5xQzZLb0JCS1FsTUdCMFE9PSIsInZhbHVlIjoiMTVxYVQ0cTNjQzJDOVVXY0xkZVU0RW9oUWFhU08zWm0zYnJIMkl3WGhzb3lrSDRwb0VLaXFGTHd2RlFpeUdRMmNaOTVDbTE5SnQ5WG1JMkQ2TEVFTHc9PSIsIm1hYyI6IjBjYzRlZjRlMjI4NTZmMmI0MjcyZDY3ZTZmZDM5N2I5NzZhNTJkMTVmNjQxYzA4MmY3YzE0ZDRkOWVmZmU5MTIifQ%3D%3D; laravel_session=eyJpdiI6ImRpMTlJeGJlNDVGZ0V5SFhuMFpUTFE9PSIsInZhbHVlIjoiTjFCak5QMDduNGRYRENMU2pWK3JqVTRcL1BaYkc2eWN2NDVKY0N6RE1yVjVRT0xGSUlhUkVrSlFpeGVXWUtcL0tzSU5mYWlBNytcL1gyUDNyV3RVUWxnQUE9PSIsIm1hYyI6IjU2ZmIzMmU0NDcxZmI0OTRlOWYxNmExMWFhNTMxNTE4ZDJlNTlkYWZhNDViNDQwMjYwYjZjMDQyM2I5MDBhMTgifQ%3D%3D; __utmb=143158369.10.10.1752851619'
'__utmz=143158369.1752358768.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); __utmc=143158369; __utma=143158369.1182443046.1752358768.1752840831.1752851619.17; __utmt=1; XSRF-TOKEN=eyJpdiI6ImVpWEk1ZzQ4XC92S0pEa05kVGRUNVlnPT0iLCJ2YWx1ZSI6Im1wcmZzUTJQd21iSDQ5bGdNM1VYRGk4aUxuSTlFMTBIZk9EMldpXC8zZnRBekw4bGkrdkdlTWM5U3NVYnFPQjV6UEFqSlZSSVdFS29QM1gzbWFOaEZyZz09IiwibWFjIjoiNDNhNDhmMzUzOWYzYTMzNWIzMzFhODIwMmY2YTJkOTQ4OWI0MmExZjFjNzVhOGMyMGQzMTFhYWJjOGEwNmMyOSJ9; laravel_session=eyJpdiI6InpMNFByUk9PZ0xxeWVTNDdReE5Pa0E9PSIsInZhbHVlIjoiOEpsTnJcL0ZpVzEzTGdLa0MydHUwcm8zQnJIWldwUG90ZnZJZytNTG1LUjFNWmhWRHFnQ0JqbGhYRnNUd1J5MHFzaGJiQkZlcHlFb0dqY01DKzN6cm5nPT0iLCJtYWMiOiIzMjUzZjc0MDk2ZTg3NTQ5NGUyMjI5MTQ0NDMxZGJjNGIzN2EzYWU0YTc1MjhjNDYzOTYzNGQzN2Y4MDhiZTNhIn0%3D; __utmb=143158369.11.10.1752851619'