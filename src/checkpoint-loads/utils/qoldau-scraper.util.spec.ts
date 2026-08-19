import {
  parseCheckpointCatalogPage,
  parseScoreboardPage,
  parseWaitingAreaPage,
} from './qoldau-scraper.util';

describe('qoldau-scraper.util', () => {
  it('parses checkpoint catalog rows with IDs and pagination', () => {
    const html = `
      <div class="row border-bottom py-2">
        <div class="col-sm-8">
          <div class="col-md-8">
            <a href="/ru/registry/checkpoint/list/12345/view" class="font-weight-bold font-16">Достык - Алашанькоу</a>
            <span class="text-secondary font-12">область Жетісу, Алакольский район</span>
          </div>
          <div class="col-md-4">
            <span class="font-weight-bold">Китай</span>
          </div>
        </div>
      </div>
      <ul class="pagination">
        <li><a class="page-link" href="https://cgr.qoldau.kz/ru/registry/checkpoint/list?p=1">1</a></li>
        <li><a class="page-link" href="https://cgr.qoldau.kz/ru/registry/checkpoint/list?p=4">4</a></li>
      </ul>
    `;

    const result = parseCheckpointCatalogPage(html);

    expect(result.totalPages).toBe(4);
    expect(result.items).toEqual([
      {
        checkpointId: '12345',
        checkpointName: 'Достык - Алашанькоу',
        borderCountry: 'Китай',
        region: 'область Жетісу, Алакольский район',
      },
    ]);
  });

  it('parses scoreboard page and extracts total records', () => {
    const html = `
      <div class="mt-3">
        <div class="text-right text-nowrap">
          <span><small>Всего записей</small> 663</span>
          <ul class="ml-2 pagination mb-0 sw-pagination justify-content-end d-inline-flex">
            <li><a class="page-link" href="?p=1">1</a></li>
            <li><a class="page-link" href="?p=45">45</a></li>
          </ul>
        </div>
      </div>
    `;

    const result = parseScoreboardPage(html);

    expect(result.totalRecords).toBe(663);
    expect(result.totalPages).toBe(45);
  });

  it('parses scoreboard page with zero records', () => {
    const html = `
      <div class="mt-3">
        <div class="text-right text-nowrap">
          <span><small>Всего записей</small> 0</span>
        </div>
      </div>
    `;

    const result = parseScoreboardPage(html);

    expect(result.totalRecords).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it('parses waiting area table rows and pagination', () => {
    const html = `
      <table class="table">
        <tbody>
          <tr>
            <td>Зона ожидания при пункте пропуска "Достык"</td>
            <td>Достык - Алашанькоу</td>
            <td>AM8295H</td>
            <td>12.06.2026 03:01:47</td>
            <td></td>
            <td></td>
            <td>В зоне ожидания</td>
            <td>13.06.2026 16:00 - 17:00</td>
          </tr>
        </tbody>
      </table>
      <ul class="pagination">
        <li><a class="page-link" href="https://cgr.qoldau.kz/ru/registry/wa-history/list?flStatus=Active&p=1">1</a></li>
        <li><a class="page-link" href="https://cgr.qoldau.kz/ru/registry/wa-history/list?flStatus=Active&p=73">73</a></li>
      </ul>
    `;

    const result = parseWaitingAreaPage(html);

    expect(result.totalPages).toBe(73);
    expect(result.entries).toEqual([
      {
        waitingAreaName: 'Зона ожидания при пункте пропуска "Достык"',
        checkpointName: 'Достык - Алашанькоу',
        truckNumber: 'AM8295H',
        entryTime: '12.06.2026 03:01:47',
        exitTime: null,
        stayPeriod: null,
        status: 'В зоне ожидания',
        activeBookingSlot: '13.06.2026 16:00 - 17:00',
      },
    ]);
  });
});
