/**
 * Parse HTML table element to JSON array of objects
 * @see https://gist.github.com/johannesjo/6b11ef072a0cb467cc93a885b5a1c19f?permalink_comment_id=4075154#gistcomment-4075154
 **/
export function parseHTMLTable<T extends Record<string, string>>(
    tableEl: HTMLTableElement,
    expectingHeaderRow = false
): { headers: (keyof T)[]; rows: T[] } {
    let columns: (keyof T)[] = Array.from(tableEl.querySelectorAll("th")).map(
        (it) => it.textContent ?? it.innerText
    );

    const rows = Array.from(tableEl.querySelectorAll("tbody > tr"));

    // must check for table that has no th cells, but only if we are told to "expectingHeaderRow"
    if (columns.length == 0 && expectingHeaderRow) {
        // get columns for a non-th'd table
        columns = Array.from(
            tableEl.querySelectorAll("tbody > tr")[0].children
        ).map((it) => it.textContent ?? it.innerHTML);

        // must remove first row as it is the header
        rows.shift();
    }

    const returnJson = {
        headers: columns,
        rows: rows.map((row) => {
            const cells = Array.from(row.querySelectorAll("td"));

            return columns.reduce((obj, col, idx) => {
                obj[col] = cells[idx].textContent ?? cells[idx].innerText;
                return obj;
            }, {} as Record<(typeof columns)[number], string>);
        }) as T[],
    };

    // if we were expecting a header row with th cells lets see if we got it
    // if we got nothing lets try looking for a regular table row as the header
    if (
        !expectingHeaderRow &&
        returnJson.headers.length == 0 &&
        returnJson.rows[0] &&
        Object.keys(returnJson.rows[0]).length === 0
    ) {
        return parseHTMLTable<T>(tableEl, true);
    }
    return returnJson;
}
