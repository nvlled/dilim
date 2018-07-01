
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
    borrowersFile : "borrowers.xls",
}

let newXlsBorrowers = async (filename=config.borrowersFile) => {
    // TODO: load worksheet from file
    header = ["Call Number", "Borrower", "Date Borrowed", "Date Returned"];

    let table = {
        header: header.map(util.underscoreCase),
        body: [],
    }

    try {
        let fileContents = await fs.readFileAsync(filename);
        let workbook = XLSX.read(fileContents);
        let sheet1 = util.firstSheet(workbook);
        let loadedTable = await util.extractTable(sheet1);
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
            let wb = XLSX.utils.book_new();
            let array = this.toArray();
            let worksheet = XLSX.utils.aoa_to_sheet(array);
            console.log(worksheet);
            XLSX.utils.book_append_sheet(wb, worksheet, "borrowers");
            this.saving = true;
            XLSX.writeFile(wb, destFilename);
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
            table.body.push(row);
            this.save();
        },

        update(data) {
            this.save();
            //data can be modified directly
            //table.index[data[0]] = data;
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
}
