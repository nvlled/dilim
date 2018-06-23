
function cellpos(i, j) {
    if (i <= 0)
        i = 1;
    if (j <= 0)
        j = 1;
    let col = "";
    let b = 26;
    let alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let div = j;
    let mod = 0;
    while (div > 0) {
        mod = (div - 1) % b;
        col += alpha[mod];
        div = Math.floor((div - mod) / 26);
    }
    return col + i;
}

function asyncLoop(body) {
    return new Promise(resolve => {
        let batchSize = 50;
        let intervalId = setInterval(() => {
            let run = true;
            for (let i = 0; i < batchSize && run; i++) {
                run = body();
            }
            if (!run) {
                clearInterval(intervalId);
                resolve();
            }
        });
    });
}

function asyncEach(array, fn) {
    return new Promise(resolve => {
        let i = 0;
        let batchSize = 150;
        let intervalId = setInterval(() => {
            if (i >= array.length) {
                clearInterval(intervalId);
                resolve();
            }
            for (let j = 0; j < batchSize && i < array.length; j++, i++) {
                fn(array[i], i);
            }
        }, 20);
    });
}

function createPager(pageSize) {
    return {
        num: 0,
        size: pageSize,
        _data: [],

        setData(data) {
            this._data = data;
        },

        currentPageNo() {
            return this.num;
        },

        currentItemNo() {
            return this.currentPageNo() * this.size;
        },

        currentPage() {
            let size = this.size;
            let i = this.currentItemNo();
            return this._data.slice(i, i+size);
        },

        firstPage() {
            this.num = 0;
            return this.currentPage();
        },

        lastPage() {
            this.num = this.numPages()-1;
            return this.currentPage();
        },
        lastPageNo() {
            return this.numPages()-1;
        },

        nextPage() {
            let lastPage = this.lastPageNo();
            if (this.num < lastPage)
                this.num++;
            console.log(this.num);
            return this.currentPage();
        },

        prevPage() {
            if (this.num > 0)
                this.num--;
            return this.currentPage();
        },

        setPage(pageNo) {
            let lastPage = this.numPages()-1;
            if (pageNo < 0)
                pageNo = 0;
            else if (pageNo > lastPage)
                pageNo = lastPage;
            this.num = pageNo;
            return this.currentPage();
        },

        numPages() {
            return Math.ceil(this._data.length / this.size);
        },

        numItems() {
            return this._data.length;
        },
    }
}

function underscoreCase(str) {
    return str.split(/\s+/).join("_").toLowerCase();
}

function titleCase(str) {
    let firstUpper = w => {
        return w.slice(0,1).toUpperCase() + w.slice(1).toLowerCase();
    }
    return str.split(/_+/).map(firstUpper).join(" ");
}

function firstSheet(workbook) {
    let name = workbook.SheetNames[0];
    return workbook.Sheets[name];
}

async function extractTable(sheet) {
    let rowNum = 1;
    let rows = [];
    let header = [];

    // skip empty rows
    let emptyLimit = 100;
    while (emptyLimit > 0) {
        let pos = cellpos(rowNum, 1);
        if (sheet[pos])
            break;
        rowNum++;
        emptyLimit--;
    }

    // expects a header
    let j = 1;
    while (true) {
        let pos = cellpos(rowNum, j);
        let cell = sheet[pos]
        if (!cell) {
            break;
        }
        header.push(cell.v);
        j++;
    }

    rowNum++;

    header = header.map(underscoreCase);

    let index = {};
    // read all rows
    await asyncLoop(() => {
        let row = {};
        let colcount = 0;
        for (let j = 1; j <= header.length; j++) {
            let pos = cellpos(rowNum, j);
            let cell = sheet[pos]
            if (!cell) {
                cell = {};
            } else {
                colcount++;
            }
            let colName = header[j-1];
            row[j-1] = row[colName] = cell.v;
        }
        rowNum++;
        if (colcount > 0) {
            // first columns contains the primary key
            index[row[0]] = row;
            rows.push(row);
        } else {
            return false;
        }

        return true;
    });

    return Promise.resolve({
        header,
        body: rows,
        index,
    });
}

function mapNodeText(node, obj) {
    Object.keys(obj).forEach(function(k) {
        if (!isNaN(+k))
            return;
        var subNode = node.querySelector("."+k);
        if (subNode) {
            subNode.textContent = obj[k] || "";
        }
    });
}
function currentDate() {
    let date = new Date();
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function wordMatch(needle, haystack) {
    return haystack.split(/\s+/).some(function(str) {
        return needle.trim() == str.trim();
    });
}

module.exports = {
    cellpos,
    asyncLoop,
    asyncEach,
    createPager,
    underscoreCase,
    titleCase,
    firstSheet,
    extractTable,
    mapNodeText,
    currentDate,
    wordMatch,
}



