import { escapeAttr, escapeText } from './html-utils.js';

export class LegacyLayoutRenderer {
  constructor(options = {}) {
    this.fallbackColor = options.fallbackColor ?? '#dbeafe';
    this.fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
  }

  buildLegacyHtml({ title, url, navHtml = '', contentHtml = '' }) {
    const safeTitle = escapeText(title);
    const safeUrl = escapeAttr(url || '');
    const toolbar = this.buildToolbar(safeUrl);

    const ff = this.fontFamily;
    const hasUrl = !!url;
    const originalInfo = hasUrl ? `Original: ${escapeText(url)}` : 'Bitte gib eine URL ein.';
    const navCell = hasUrl ? navHtml || '<small>Keine Navigation erkannt.</small>' : '';

    const navBg = this.fallbackColor;
    const headerBg = this.fallbackColor;

    const headerRowHtml = `
    <tr>
      <td colspan="2" align="center" bgcolor="${headerBg}">
        <h1>${safeTitle}</h1>
        <small>${originalInfo}</small>
        <hr>
      </td>
    </tr>`.trim();

    const navRowHtml = hasUrl
      ? `
    <tr>
      <td width="22%" valign="top" bgcolor="${navBg}">
        ${navCell}
      </td>
      <td width="78%" valign="top">
        ${contentHtml || ''}
      </td>
    </tr>`.trim()
      : '';

    let result = `
  <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
  <html>
  <head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style type="text/css">
  body {
    font-family: ${ff};
  }
  ul {
    list-style-type: none;
  }
  @media screen and (max-width: 9000px) {
    body {
      margin: 0;
      padding: 10px;
    }
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
    }
    .browser-url {
      width: 80%;
      max-width: 600px;
      font-size: 16px;
      box-sizing: border-box;
    }
  }
  </style>
  </head>
  <body>
  <font face="${ff}">
  ${toolbar}
  <table width="100%" cellpadding="6" cellspacing="0" border="0">
    ${headerRowHtml}
    ${navRowHtml}
  </table>
  </font>
  </body>
  </html>
  `.trim();

    // remove markers
    result = result
      .replace(/\sdata-browser-nav-root="1"/g, '')
      .replace(/\sdata-browser-content-root="1"/g, '');

    return result;
  }

  buildToolbar(url) {
    const value = url || '';

    return `
  <table width="100%" cellpadding="2" cellspacing="0" border="0">
    <tr>
      <td align="left" width="100%">
        <form action="/browser/browse" method="get">
          <input class="browser-url" type="text" name="url" size="120" value="${value}">
          <input type="submit" value="Öffnen">
        </form>
      </td>
      <td align="left" valign="middle">
        <form action="/browser/search" method="get" onsubmit="this.url.value = document.getElementsByTagName('form')[0].elements[0].value;">
          <input type="hidden" name="url">
          <input type="submit" value="Suchen">
        </form>
      </td>
      <td align="right" valign="middle">
        <form action="/" method="get">
          <input type="submit" value="Schließen">
        </form>
      </td>
    </tr>
  </table>
  <hr>
  `.trim();
  }
}
