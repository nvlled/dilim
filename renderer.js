// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

Promise = require("bluebird");
let {ipcRenderer} = require("electron");
let fs = Promise.promisifyAll(require("fs"));
let util = require("./util");
let api = require("./api");

let main = async () => {
    setTimeout(async () => {
        let [bookDB, borrowersDB] = await Promise.all([
            await api.bookDB(),
            await api.borrowersDB(),
        ]);
        loadForm(bookDB, borrowersDB);

    }, 600);
}

setTimeout(_=> main());

function loadForm(bookDB, borrowersDB) {
    let loadingContainer = dom.sel("#loading");
    let catalogContainer = document.querySelector("#catalog-container");
    let searchContainer = document.querySelector("#search-container");
    let checkoutContainer = document.querySelector("#checkout-container");
    let generatorContainer = document.querySelector("#generator-container");

    let form = document.querySelector("form#search");
    let searchInput = form.querySelector("input[name=query]");
    let typeSelect  = form.querySelector("select[name=type]");
    let resultCount = form.querySelector(".result-count .n");
    let table = document.querySelector("table#result");
    let cardCatalog = document.querySelector("#card-catalog");

    let backButton = catalogContainer.querySelector("button.back");
    let checkoutButton = catalogContainer.querySelector("button.checkout");
    let editButton = catalogContainer.querySelector("button.edit");
    let addBookButton = searchContainer.querySelector("button.add-book");

    let pageNav = loadPageNavDom();
    let borrowerTable = loadBorrowerTable();
    let checkoutForm = loadCheckoutForm(checkoutContainer);
    let generatorForm = loadCallNumGenForm(generatorContainer);
    let pager = util.createPager(30);

    generatorForm.loadDatalist();
    initNotification();
    hideNotification();

    dom.hide(loadingContainer);
    dom.show(searchContainer);
    loadHeader(bookDB.table.header);
    searchDB();

    watchFiles();

    form.onsubmit = function(e) {
        e.preventDefault();
    }

    searchInput.onchange = e => {
        e.preventDefault();
        searchDB();
    }
    dom.sel("input[name=exact]", searchContainer).onchange = e => {
        searchDB();
    }
    searchInput.onkeypress = e => {
        if (e.keyCode == 13) {
            e.preventDefault();
            searchDB();
        }
    }

    addBookButton.onclick = () => {
        generatorForm.clear();
        dom.hide(searchContainer);
        generatorForm.show();

        generatorForm.showError("");
        generatorForm.cancelButton.onclick = () => {
            dom.show(searchContainer);
            generatorForm.hide();
        }
        generatorForm.submitButton.onclick = () => {
            let bookInfo = generatorForm.getBookInfo();
            bookInfo.number_of_copies = 1;

            if (!(bookInfo.book_title || "")) {
                generatorForm.showError("provide a book title");
                return;
            }
            if (!(bookInfo.call_number || "")) {
                generatorForm.showError("provide a call number");
                return;
            }
            for (let row of bookDB.table.body) {
                if (row.call_number == bookInfo.call_number) {
                    generatorForm.showError("call number is already used");
                    return;
                }
            }
            generatorForm.clear();
            bookDB.insert(bookInfo);

            dom.show(searchContainer);
            generatorForm.hide();
            searchDB();
            let matchedPage = pager.lastPage();
            loadTableRows(matchedPage);
        }
    }

    editButton.onclick = () => {
        dom.hide(searchContainer);
        dom.hide(catalogContainer);
        let book = checkoutForm.book;
        generatorForm.showBook(book);
        generatorForm.cancelButton.onclick = () => {
            dom.show(catalogContainer);
            generatorForm.hide();
        }
        generatorForm.showError("");
        generatorForm.submitButton.onclick = () => {
            let bookInfo = generatorForm.getBookInfo();
            for (let row of bookDB.table.body) {
                if (row == book)
                    continue;
                if (row.call_number == bookInfo.call_number) {
                    generatorForm.showError("call number is already used");
                    return;
                }
            }

            let oldCallNumber = book.call_number;
            let newCallNumber = bookInfo.call_number;
            for (let k of Object.keys(bookInfo)) {
                if (book[k] !== undefined) {
                    book[k] = bookInfo[k];
                }
            }

            bookDB.save();
            if (oldCallNumber != newCallNumber) {
                borrowersDB.changeCallNumber(oldCallNumber, newCallNumber);
            }

            dom.show(catalogContainer);
            generatorForm.hide();
            setCatalogContents(bookInfo);
            checkoutForm.setBook(bookInfo);
            searchDB();
        }
    }

    backButton.onclick = () => {
        dom.show(searchContainer);
        dom.hide(catalogContainer);
    }

    checkoutButton.onclick = () => {
        if (checkoutForm.hasCopies()) {
            dom.hide(searchContainer);
            dom.hide(catalogContainer);
            checkoutForm.show();
        } else {
            showNotification("No copies available");
        }
    }

    checkoutForm.cancelButton.onclick = () => {
        checkoutForm.hide();
        dom.show(catalogContainer);
    }

    checkoutForm.submitButton.onclick = () => {
        let okay = checkoutForm.submit();
        if (okay) {
            let row = checkoutForm.book;
            showCatalog(row);

            checkoutForm.hide();
            dom.show(catalogContainer);
        }
    }

    pageNav.first.onclick = e => {
        e.preventDefault();
        let matchedPage = pager.firstPage();
        loadTableRows(matchedPage);
    }

    pageNav.prev.onclick = e => {
        e.preventDefault();
        let matchedPage = pager.prevPage();
        loadTableRows(matchedPage);
    }
    pageNav.next.onclick = e => {
        e.preventDefault();
        let matchedPage = pager.nextPage();
        loadTableRows(matchedPage);
    }
    pageNav.last.onclick = e => {
        e.preventDefault();
        let matchedPage = pager.lastPage();
        loadTableRows(matchedPage);
    }

    /*-------------------------------------*/

    function selectPage(pageNo) {
        let page = pager.setPage(pageNo);
        loadTableRows(page);
    }

    function loadHeader(header) {
        let head = table.querySelector("thead tr");
        head.innerHTML = [""].concat(header).map(col => {
            col = util.titleCase(col);
            return `<th>${col}</th>`;
        }).join(" ");
    }

    async function searchDB() {
        let q = searchInput.value.trim();
        let type = typeSelect.value || bookDB.table.header[0];

        searchInput.disabled = true;
        let matched = [];
        let exactMatch = dom.sel("input[name=exact]", searchContainer).checked;
        console.log("searching");
        await util.asyncEach(bookDB.table.body, row => {
            let val = (row[type] || row[0] || "").toString().toLowerCase();
            if (exactMatch && !!q) {
                if (util.wordMatch(q, val))
                    matched.push(row);
            } else {
                if (val.match(q.toLowerCase())) {
                    matched.push(row);
                }
            }
        });
        if (matched.length == 0)
            dom.hide(table.querySelector("thead"));
        else
            dom.show(table.querySelector("thead"));

        pager.setData(matched);
        let matchedPage = pager.setPage(0);
        resultCount.textContent = pager.numItems();

        await loadTableRows(matchedPage);
        searchInput.disabled = false;
    }

    function loadCheckoutForm(container) {
        let cancelButton = dom.sel("button.cancel", container);
        let submitButton = dom.sel("button.checkout", container);
        let inputName = dom.sel("input.borrower-name", container);
        return {
            book: null,
            cancelButton,
            submitButton,
            showMessage(msg) {
                dom.sel(".error", container).textContent = msg;
            },

            
            hasCopies() {
                let book = this.book;
                if (!book)
                    return false;
                return borrowersDB.availableCopies(book) > 0;
            },

            submit() {
                this.showMessage("");
                let book = this.book;
                if (!book) {
                    this.showMessage("no book selected");
                    return false;
                }

                // TODO: check number of copies

                let borrower = inputName.value.trim();
                if (!borrower) {
                    this.showMessage("borrower name is required");
                    return false;
                }

                let date_borrowed = util.currentDate();
                borrowersDB.insert({
                    call_number: book.call_number,
                    borrower,
                    date_borrowed,
                });
                inputName.value = "";
                showNotification("`" + book.book_title + "` lent to " + borrower);

                return true;
            },
            hide() { dom.hide(container) },
            show() { dom.show(container) },
            setBook(book) {
                let title = book.book_title || "(untitled)";
                let date = new Date();
                util.mapNodeText(container, {
                    call_number: book.call_number,
                    book: title + " by " + book.author,
                    date: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
                });
                this.book = book;
            }
        }
    }

    function loadBorrowerTable() {
        let table = dom.sel("table#borrows", catalogContainer);
        let tbody = dom.sel("tbody", catalogContainer);
        let trTempl = dom.sel("tr.templ", tbody);
        trTempl.remove();
        return {
            table,
            setRows(rows) {
                this.clear();
                rows.forEach(function(row) {
                    let tr = trTempl.cloneNode(true);
                    util.mapNodeText(tr, row);

                    let returnLink = dom.sel(".return", tr);
                    if (row.date_returned) {
                        returnLink.style.display = "none";
                    } else {
                        returnLink.onclick = function(e) {
                            e.preventDefault();
                            row.date_returned = util.currentDate();
                            borrowersDB.update(row);
                            reloadCatalog();
                            showNotification("book copy from " + row.borrower + " has been returned");
                        }
                    }

                    tbody.appendChild(tr);
                });
            },
            addRow(row) {
            },
            clear() {
                tbody.innerHTML = "";
            },
        }
    }

    function loadPageNavDom() {
        let pageNav = dom.sel(".page-nav", searchContainer);
        return {
            first: dom.sel(".first", pageNav),
            last: dom.sel(".last", pageNav),
            prev: dom.sel(".prev", pageNav),
            next: dom.sel(".next", pageNav),
            nums: dom.sel(".nums", pageNav),
            fillPageNums(n) {
                if (n <= 1) {
                    dom.hide(pageNav);
                    return;
                }
                dom.show(pageNav);
                this.nums.innerHTML = "";
                var pageNo = pager.currentPageNo();
                for (let i = 0; i < n; i++) {
                    let a = dom.create("a");
                    a.textContent = (i+1)+"  ";
                    a.href = "#";
                    if (i == pageNo)
                        a.classList.add("sel");
                    a.onclick = e => { 
                        e.preventDefault();
                        selectPage(i);
                    }
                    this.nums.appendChild(a);
                }
            },
        }
    }

    function loadCallNumGenForm(container) {
        let classNum = dom.sel("input.ddc-classnum", container);
        let callNum = dom.sel("input.call-num", container);
        let cutterNum = dom.sel("input.cutter-num", container);
        let fname = dom.sel("input.firstname", container);
        let lname = dom.sel("input.lastname", container);
        let heading = dom.sel("input.ddc-heading", container);
        let title = dom.sel("input.title", container);
        let year = dom.sel("input.year", container);
        let copyNum = dom.sel("input.copy-num", container);
        let datalist = dom.sel("datalist", container);

        let ddcsum = require("ddcsum");
        let summary = ddcsum.data;
        let generate = () => {
            console.log("generating numbers");
            let firstname = fname.value;
            let lastname  = lname.value;
            cutterNum.value = ddcsum.generateCutterNumber(lastname, firstname); 
            let args = {
                title: title.value,
                copyNumber: copyNum.value,
                classNumber: classNum.value,
                publishYear: year.value,
                author: { lastname, firstname },
            }
            console.log("args", args);
            callNum.value = ddcsum.generateCallNumber(args);
        }

        fname.onchange = generate;
        lname.onchange = generate;
        title.onchange = generate;
        year.onchange = generate;
        copyNum.onchange = generate;

        classNum.onchange = function(e) {
            let headingText = summary[this.value.trim()];
            heading.value = headingText || "";
            generate();
        }

        return {
            cancelButton: dom.sel("button.cancel", container),
            submitButton: dom.sel("button.submit", container),

            getBookInfo() {
                return {
                    author: [lname, fname].map(f=>f.value).join(", "),
                    book_title: title.value,
                    year: year.value,
                    class_number: classNum.value,
                    call_number: callNum.value,
                }
            },

            showError(text) {
                dom.sel(".error", container).textContent = text;
            },

            setBook(book) {
                let [lastname, firstname] = (book.author||"").split(",").map(s => s.trim());
                classNum.value =  book.class_number;
                fname.value = firstname;
                lname.value = lastname;
                title.value = book.book_title || "";
                year.value = book.year || "";
                if (book.call_number)
                    callNum.value =  book.call_number;
            },

            showBook(book) {
                this.setBook(book);
                this.show();
            },

            show() { dom.show(container) },
            hide() { dom.hide(container) },
            clear() {
                fname.value = "";
                lname.value = "";
                title.value = "";
                year.value = "";
                copyNum.value = "";
                cutterNum.value = "";
                callNum.value = "";
            },

            loadDatalist() {
                datalist.innerHTML = "";
                for (let [classNum, heading] of Object.entries(summary)) {
                    let opt = dom.create("option");
                    opt.value = classNum;
                    opt.textContent = heading;
                    datalist.appendChild(opt);
                }
            },

        }
    }

    async function loadTableRows(rows) {
        let header = bookDB.table.header;
        let tbody = table.querySelector("tbody");
        let itemNo = pager.currentItemNo();

        await util.asyncEach(rows, (row, i) => {
            let tr = document.createElement("tr");
            let cols = header.map(col => {
                return `<td>${row[col] || "--"}</td>`;
            });
            cols = [`<td>${itemNo+i+1}</td>`].concat(cols);
            let html = cols.join("\n");

            tr.innerHTML = html;
            tr.onclick = () => showCatalog(row);
            let tr_ = tbody.children[i];
            if (tr_)
                tbody.replaceChild(tr, tr_);
            else
                tbody.appendChild(tr);
        });
        let tableRows = tbody.children;
        let n = tableRows.length;
        for (let i = rows.length; i < n; i++) {
            tbody.removeChild(tableRows[rows.length]);
        }

        pageNav.fillPageNums(pager.numPages());
    }

    function reloadCatalog(row) {
        if (checkoutForm.book)
            showCatalog(checkoutForm.book);
    }

    function setCatalogContents(row) {
        for (let [key, val] of Object.entries(row)) {
            if (key.match(/^\d+$/))
                continue;

            let node = catalogContainer.querySelector("."+key);
            if (!node)
                continue;
            node.textContent = val;
        }
    }

    function showCatalog(row) {
        dom.hide(searchContainer);
        dom.show(catalogContainer);

        setCatalogContents(row);

        let id = row.call_number
        let availableCopies = borrowersDB.availableCopies(row)
        let borrowers = borrowersDB.list(id);

        dom.sel(".number_of_copies", catalogContainer).textContent = 
            row.number_of_copies || 0;
        dom.sel(".avail_copies", catalogContainer).textContent = 
            availableCopies;
        
        borrowerTable.setRows(borrowers);
        checkoutForm.setBook(row);
    }

    function initNotification() {
        let notif = dom.sel("#notification");
        dom.sel(".panel a", notif).onclick = function(e) {
            e.preventDefault();
            hideNotification();
        }
    }

    function hideNotification() {
        let notif = dom.sel("#notification");
        notif.style.visibility = "hidden";
    }

    var timerId = null;
    function showNotification(msg, timeout=5000) {
        clearTimeout(timerId);
        let notif = dom.sel("#notification");
        dom.sel(".message", notif).textContent = msg;
        notif.style.visibility = "visible";
        setTimeout(() => {
            hideNotification();
        }, timeout); 
    }

    function watchFiles() {
        let chokidar = require('chokidar');
        let w = chokidar.watch("lib.xls");
        w.add(borrowersDB.filename);
        w.on("change", function(file) {
            if (file == borrowersDB.filename && borrowersDB.saving) {
                return;
            }
            if (file == bookDB.filename && bookDB.saving) {
                return;
            }
            showNotification(file + " has been changed, reloading...");
            setTimeout(() => {
                location.reload();
            }, 2200);
        });
    }
}

let dom = {
    sel(selector, node=document) {
        return node.querySelector(selector);
    },
    show(node) {
        node.style.display = "";
        node.classList.remove("hidden");
    },
    hide(node) {
        node.style.display = "none";
        node.classList.add("hidden");
    },
    create(name) {
        return document.createElement(name);
    },
    text(str) {
        return document.createTextNode(str);
    },
}
