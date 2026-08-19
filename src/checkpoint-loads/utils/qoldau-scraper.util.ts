import { load } from 'cheerio';

export type QoldauCheckpointCatalogItem = {
  checkpointId: string;
  checkpointName: string;
  borderCountry: string | null;
  region: string | null;
};

export type QoldauWaitingAreaEntry = {
  waitingAreaName: string | null;
  checkpointName: string;
  truckNumber: string;
  entryTime: string | null;
  exitTime: string | null;
  stayPeriod: string | null;
  status: string;
  activeBookingSlot: string | null;
};

export type QoldauScoreboardItem = {
  truckNumber: string;
  status: string;
  date: string | null;
  timeSlot: string | null;
};

export type ParsedScoreboardPage = {
  totalRecords: number;
  totalPages: number;
};

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLastPageNumber($: ReturnType<typeof load>) {
  let maxPage = 1;

  $('.pagination a.page-link').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const url = new URL(href, 'https://cgr.qoldau.kz');
    const page = Number(url.searchParams.get('p') ?? '');

    if (Number.isInteger(page) && page > maxPage) {
      maxPage = page;
    }
  });

  return maxPage;
}

export function parseCheckpointCatalogPage(html: string) {
  const $ = load(html);
  const items: QoldauCheckpointCatalogItem[] = [];

  $('a.font-weight-bold.font-16[href*="/registry/checkpoint/list/"]').each(
    (_, element) => {
      const link = $(element);
      const href = link.attr('href') ?? '';
      const row = link.closest('.row.border-bottom.py-2');
      const checkpointName = normalizeText(link.text());

      if (!checkpointName) {
        return;
      }

      const idMatch = href.match(/\/checkpoint\/list\/(\d+)\/view/);
      const checkpointId = idMatch ? idMatch[1] : '';

      const region = normalizeText(
        row.find('span.text-secondary.font-12').first().text(),
      );
      const borderCountry = normalizeText(
        row.find('.col-md-4 span.font-weight-bold').first().text(),
      );

      items.push({
        checkpointId,
        checkpointName,
        borderCountry: borderCountry || null,
        region: region || null,
      });
    },
  );

  return {
    items,
    totalPages: parseLastPageNumber($),
  };
}

export function parseScoreboardPage(html: string): ParsedScoreboardPage {
  const $ = load(html);

  const totalText = $('small:contains("Всего записей")')
    .parent()
    .text()
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '');
  const totalMatch = totalText.match(/(\d+)/);
  const totalRecords = totalMatch ? Number(totalMatch[1]) : 0;

  const totalPages = parseLastPageNumber($);

  return { totalRecords, totalPages };
}

export function parseWaitingAreaPage(html: string) {
  const $ = load(html);
  const entries: QoldauWaitingAreaEntry[] = [];

  $('table.table tbody tr').each((_, element) => {
    const cells = $(element).find('td');
    const checkpointName = normalizeText(cells.eq(1).text());
    const truckNumber = normalizeText(cells.eq(2).text());
    const status = normalizeText(cells.eq(6).text());

    if (!checkpointName || !truckNumber) {
      return;
    }

    entries.push({
      waitingAreaName: normalizeText(cells.eq(0).text()) || null,
      checkpointName,
      truckNumber,
      entryTime: normalizeText(cells.eq(3).text()) || null,
      exitTime: normalizeText(cells.eq(4).text()) || null,
      stayPeriod: normalizeText(cells.eq(5).text()) || null,
      status,
      activeBookingSlot: normalizeText(cells.eq(7).text()) || null,
    });
  });

  return {
    entries,
    totalPages: parseLastPageNumber($),
  };
}
