
Promise = require("bluebird");
let fs = Promise.promisifyAll(require("fs"));
const util = require('./util');
const XLSX = require('xlsx');

let borrowerSql = `
    create table if not exists borrowers(
        id integer primary key,
    );
`;

let config = {
    libFile : "lib.xls",
    borrowersFile : "borrowers.xls",
}

let newBookLib = async (filename=config.libFile) => {
    // TODO: load worksheet from file
    let header = ["Call Number", "Book Title", "Author", "Publisher", "Year", "Class Number", "Number Of Copies"];

    let table = {
        header: header.map(util.underscoreCase),
        body: [],
    }

    let workbook;
    let worksheet;
    try {
        let fileContents = await fs.readFileAsync(filename);
        workbook = XLSX.read(fileContents, {
            cellStyles: true,
        });
        worksheet = util.firstSheet(workbook);
        let loadedTable = await util.extractTable(worksheet);
        if (loadedTable && loadedTable.header.length > 0)
            table = loadedTable;
    } catch (e) {
        console.log("failed reading borrowers file:" + e);
    }

    return {
        table,
        saving: false,
        filename,
        save(destFilename=filename) {
            let array = this.toArray();
            workbook = XLSX.utils.book_new();
            worksheet = XLSX.utils.aoa_to_sheet(array);
            XLSX.utils.book_append_sheet(workbook, worksheet, "library");
            this.saving = true;
            XLSX.writeFile(workbook, destFilename, {
            });
            setTimeout(() => {
                this.saving = false;
            }, 200);
        },

        toArray() {
            let header = table.header;
            console.log(header);
            let header_ = header.map(util.titleCase);
            return [header_].concat(table.body.map(row => {
                return header.map(h => row[h]);
            }));
        },

        insert(row) {
            row.__rownum__ = table.rowNum++;
            let data = [];
            for (let [i, colname] of Object.entries(table.header)) {
                row[i] = row[colname];
                data.push(row[i]);
            }

            table.body.push(row);
            XLSX.utils.sheet_add_aoa(worksheet, [ data ], {origin: -1});
            this.save();
        },

        update(data) {
            console.log("updating", data);
            this.save();
        },

        isCallNumberUsed(book) {
            for (let row of table.body) {
                if (row.call_number == book.call_number 
                    && row != book)
                    return true;
            }
            return false;
        },
    }
}


let newXlsBorrowers = async (filename=config.borrowersFile) => {
    // TODO: load worksheet from file
    let header = ["Call Number", "Borrower", "Date Borrowed", "Date Returned"];

    let table = {
        header: header.map(util.underscoreCase),
        body: [],
    }

    let workbook;
    let worksheet;
    try {
        let fileContents = await fs.readFileAsync(filename);
        workbook = XLSX.read(fileContents, {
            cellStyles: true,
        });
        worksheet = util.firstSheet(workbook);
        let loadedTable = await util.extractTable(worksheet);
        if (loadedTable && loadedTable.header.length > 0)
            table = loadedTable;
    } catch (e) {
        console.log("failed reading borrowers file:" + e);
    }

    return {
        table,
        saving: false,
        filename,
        save(destFilename=filename) {
            let array = this.toArray();
            workbook = XLSX.utils.book_new();
            worksheet = XLSX.utils.aoa_to_sheet(array);
            XLSX.utils.book_append_sheet(workbook, worksheet, "borrowers");
            this.saving = true;
            XLSX.writeFile(workbook, destFilename, {
            });
            setTimeout(() => {
                this.saving = false;
            }, 200);
        },

        toArray() {
            let header = table.header;
            console.log(header);
            let header_ = header.map(util.titleCase);
            return [header_].concat(table.body.map(row => {
                return header.map(h => row[h]);
            }));
        },

        insert(row) {
            row.__rownum__ = table.rowNum++;
            let data = [];
            for (let [i, colname] of Object.entries(table.header)) {
                row[i] = row[colname];
                data.push(row[i]);
            }

            table.body.push(row);
            XLSX.utils.sheet_add_aoa(worksheet, [ data ], {origin: -1});
            this.save();
        },

        update(data) {
            console.log("updating", data);
            this.save();
        },

        changeCallNumber(callNumber, newCallNumber) {
            for (let row of table.body) {
                if (row.call_number == callNumber) {
                    row.call_number = newCallNumber;
                }
            }
            this.save();
        },

        list(bookId) {
            return table.body.filter(row => {
                return row.call_number == bookId;
            }).sort(function(r1, r2) {
                let k = "date_borrowed";
                let k2 = "date_returned";

                if (r1[k] != r2[k])
                    return util.compareSort(k, r1, r2);

                return util.compareSort(k2, r1, r2);

            });
        },

        listBorrowed(bookId) {
            return this.list(bookId).filter(function(row) {
                return !row.date_returned;
            });
        },

        borrowedCopies(bookId) {
            let rows = this.listBorrowed(bookId);
            return rows.length;
        },

        availableCopies(row) {
            let id = row.call_number;
            let n = row.number_of_copies - this.borrowedCopies(id);
            if (n < 0 || isNaN(n))
                n = 0;
            return n;
        },
    }
}

module.exports = {
    borrowersDB: newXlsBorrowers,
    bookDB: newBookLib,
}
