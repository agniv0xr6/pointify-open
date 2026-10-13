/**
 * POINTIFY CORE DATABASE ENGINE
 * Native IndexedDB Wrapper with Atomic Transactions
 */

const DB_NAME = 'Pointify_Enterprise_DB';
// v3: index creation moved out of the store-existence guard (see onupgradeneeded)
// and settings gained an atomic multi-record write. Bumping the version is what
// makes existing installations actually run the upgrade handler.
const DB_VERSION = 3;

// D2: temporary bootstrap credentials. Kept in the code on purpose so a fresh
// install can be opened, but auth.js forces a password change on first login
// for any account still carrying this value (see DEFAULT_PASSWORD below).
export const DEFAULT_USERNAME = 'Super';
export const DEFAULT_PASSWORD = 'super68';

// Backup file envelope (Phase 1.3). Bump BACKUP_VERSION when the shape of a
// record changes so old files are rejected instead of half-applied.
export const BACKUP_FORMAT = 'pointify-backup';
export const BACKUP_VERSION = 1;

/**
 * CANONICAL MONEY MATH
 * These are the ONLY formulas used for line/sale arithmetic.
 * pos.js, db.js and reports.js must all go through here so the receipt,
 * the reports screen and the CSV can never disagree.
 *
 *   gross      = price * qty              (before discount)
 *   costTotal  = costPrice * qty
 *   discount   = flat amount off the whole line
 *   net        = gross - discount         (what the customer pays)
 *   profit     = net - costTotal          (discount-aware)
 */

export function calcLine(item) {
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    const cost = Number(item.costPrice) || 0;
    const discount = Number(item.discount) || 0;

    const gross = price * qty;
    const costTotal = cost * qty;
    const net = gross - discount;

    return {
        unitPrice: price,
        qty,
        gross,
        costTotal,
        discount,
        net,
        profit: net - costTotal
    };
}

export function calcSale(items) {
    const out = { gross: 0, discount: 0, net: 0, costTotal: 0, profit: 0, qty: 0 };

    (items || []).forEach(item => {
        const line = calcLine(item);
        out.gross += line.gross;
        out.discount += line.discount;
        out.net += line.net;
        out.costTotal += line.costTotal;
        out.profit += line.profit;
        out.qty += line.qty;
    });

    return out;
}

// IndexedDB rejects with DOMExceptions whose `name` carries the meaning, but the
// UI only ever showed "Error saving product". Map the two failures this app can
// actually produce to something a cashier can act on; everything else keeps its
// original message. `hint` lets a caller name the field it knows about.
export function wrapDBError(error, storeName, hint) {
    if (!error) return new Error('Database operation failed.');

    const name = error.name || 'DatabaseError';
    let message = error.message || 'Database operation failed.';

    if (name === 'ConstraintError') {
        message = hint || `That record already exists (duplicate value in "${storeName}").`;
    } else if (name === 'QuotaExceededError') {
        message = 'Device storage is full. Export a backup from Settings before adding more data.';
    } else if (name === 'DataError') {
        message = `Could not save to "${storeName}": the record has an invalid key.`;
    }

    const wrapped = new Error(message);
    wrapped.name = name;
    wrapped.storeName = storeName;
    wrapped.cause = error;
    return wrapped;
}

class PointifyDB {
    constructor() {
        this.db = null;
        // Chain the init with seeding to ensure data exists
        this.initPromise = this.init().then(() => this.seed());

        // Request Persistent Storage
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(granted => {
                if (granted) {
                    console.log("Storage will not be cleared except by explicit user action");
                } else {
                    console.warn("Storage may be cleared by the UA under storage pressure.");
                }
            });
        }
    }

    async init() {
        return new Promise((resolve, reject) => {
            // Guard so onblocked/onsuccess/onerror can never settle twice.
            let settled = false;
            let blockedTimer = null;
            const succeed = (db) => {
                if (settled) return;
                settled = true;
                if (blockedTimer) clearTimeout(blockedTimer);
                this.db = db;
                console.log("Database opened successfully");
                resolve(db);
            };
            const failWith = (message) => {
                if (settled) return;
                settled = true;
                if (blockedTimer) clearTimeout(blockedTimer);
                reject(new Error(message));
            };

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                failWith("Database failed to open");
            };

            // Phase 3 bumps DB_VERSION, so a device that had another tab of the
            // app open would wait indefinitely for that tab to close and the app
            // would hang on a blank screen with no message. Give the other tab a
            // grace period to close on its own, then say what is wrong instead
            // of hanging forever.
            request.onblocked = () => {
                console.error("Database upgrade blocked: another Pointify tab is open.");
                blockedTimer = setTimeout(() => {
                    failWith("Database upgrade is blocked by another tab. Close all Pointify tabs and reopen.");
                }, 5000);
            };

            request.onsuccess = (event) => {
                succeed(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Inside an upgrade the only usable transaction is the versionchange one.
                const tx = event.target.transaction;

                const ensureStore = (name, options) => {
                    if (db.objectStoreNames.contains(name)) return tx.objectStore(name);
                    return db.createObjectStore(name, options);
                };

                // Indexes are ensured SEPARATELY from store creation. The previous
                // code wrapped every createIndex in `if (!objectStoreNames.contains(...))`,
                // which is FALSE for a store that already exists - so an index added
                // in a later DB_VERSION was silently never created on any install
                // made before that version. processSale reads sales.date to allocate
                // order numbers and login relies on users.username, so a missing
                // index breaks checkout outright with no recovery path.
                const ensureIndex = (store, name, keyPath, options) => {
                    if (store.indexNames.contains(name)) return;
                    store.createIndex(name, keyPath, options);
                };

                // Users Store (Admin, Manager, Cashier) - D3: exactly three roles
                const usersStore = ensureStore('users', { keyPath: 'id', autoIncrement: true });
                ensureIndex(usersStore, 'username', 'username', { unique: true });
                ensureIndex(usersStore, 'role', 'role', { unique: false });

                // Products Store
                const productsStore = ensureStore('products', { keyPath: 'id', autoIncrement: true });
                ensureIndex(productsStore, 'barcode', 'barcode', { unique: true });
                ensureIndex(productsStore, 'name', 'name', { unique: false });

                // Sales Store
                const salesStore = ensureStore('sales', { keyPath: 'id', autoIncrement: true });
                ensureIndex(salesStore, 'date', 'date', { unique: false });
                ensureIndex(salesStore, 'cashier', 'cashier', { unique: false });

                // Settings Store
                ensureStore('settings', { keyPath: 'key' });
            };
        });
    }

    async seed() {
        // Ensure Admin Exists
        try {
            const db = await this.getDB();
            const userCount = await this.count('users');
            if (userCount === 0) {
                // D2: bootstrap credentials live in the code on purpose. The old
                // "force Super back to admin / super68 on every load" block was
                // removed in Phase 2 - it silently reverted any password change
                // made to the Super account. Password changes now persist, and the
                // new account is flagged so auth.js blocks the app until the
                // default password is replaced (Phase 2.5).
                await this.add('users', {
                    username: DEFAULT_USERNAME,
                    password: DEFAULT_PASSWORD,
                    role: 'admin',
                    name: 'System Admin',
                    mustChangePassword: true
                });
                console.log("Seeded Default Admin User (password change required on first login)");
            }
        } catch (e) {
            console.error("Seeding failed", e);
        }
    }

    async count(storeName) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // Generic Add. `duplicateHint` is shown when the unique index rejects the
    // record (unique: users.username, products.barcode).
    async add(storeName, data, duplicateHint) {
        if (storeName === 'users') await this.guardSingleAdmin(data);
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(wrapDBError(request.error, storeName, duplicateHint));
        });
    }

    // Generic Get All
    async getAll(storeName) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Get by ID
    async get(storeName, id) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Update. `put` REPLACES the whole record - callers must always pass
    // the complete object, never a partial patch.
    // D6: exactly one Admin may exist. The owner account is the only one with
    // full access, so a second Admin can never be created - not through the
    // form, not through a restore, not through any future caller. Enforced here
    // rather than by disabling an option, because the form is not the only
    // writer.
    async guardSingleAdmin(record) {
        if (!record || String(record.role) !== 'admin') return;
        const all = await this.getAll('users');
        const others = all.filter(u =>
            u.role === 'admin' &&
            (record.id === undefined || record.id === null || u.id !== record.id));
        if (others.length > 0) {
            const err = new Error('Only one Admin account is allowed');
            err.name = 'ConstraintError';
            console.error('[DB] Single-admin rule blocked a write:', record.username);
            throw err;
        }
    }

    async put(storeName, data, duplicateHint) {
        if (storeName === 'users') await this.guardSingleAdmin(data);
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                const wrapped = wrapDBError(request.error, storeName, duplicateHint);
                console.error(`[DB] Error saving to ${storeName}:`, wrapped.message);
                reject(wrapped);
            };
        });
    }

    // Generic Delete
    async delete(storeName, id) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(wrapDBError(request.error, storeName));
        });
    }

    // Atomic multi-record write for the settings store.
    //
    // A single "Save Settings" click used to build one db.put promise per field
    // and Promise.all them - 26 SEPARATE readwrite transactions. If any of them
    // failed (quota, abort, tab closed) the rest had already committed, leaving
    // the store half-configured: currency updated but store name not, or one
    // half of the Somalia agent/store-number pair written while its partner was
    // not - breaking the invariant the form just validated.
    //
    // entries: [{key, value}, ...] -> all or nothing.
    async putSettings(entries) {
        const rows = Array.isArray(entries) ? entries : [entries];
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            let settled = false;
            const done = (fn, value) => {
                if (settled) return;
                settled = true;
                fn(value);
            };

            let transaction;
            try {
                transaction = db.transaction(['settings'], 'readwrite');
            } catch (e) {
                done(reject, new Error(e.message || 'Could not open the settings store.'));
                return;
            }

            transaction.oncomplete = () => done(resolve, true);
            transaction.onerror = (event) => {
                const err = event && event.target && event.target.error;
                done(reject, wrapDBError(err, 'settings'));
            };
            transaction.onabort = (event) => {
                const err = event && event.target && event.target.error;
                done(reject, wrapDBError(err, 'settings', 'Settings could not be saved and nothing was changed.'));
            };

            try {
                const store = transaction.objectStore('settings');
                rows.forEach(row => {
                    if (!row || typeof row.key !== 'string' || !row.key) {
                        throw new Error('A settings row is missing its key.');
                    }
                    store.put(row);
                });
            } catch (e) {
                done(reject, new Error(e.message || 'Settings could not be saved.'));
                try { transaction.abort(); } catch (ignore) { /* already settled */ }
            }
        });
    }

    // Atomic Sale Transaction
    async processSale(saleData, cartItems) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['products', 'sales'], 'readwrite');
            const productStore = transaction.objectStore('products');
            const saleStore = transaction.objectStore('sales');

            let saleKey = null;
            let aborted = false;
            let abortReason = 'Sale could not be completed';

            // Sets the reason, then rolls the whole transaction back
            const fail = (reason) => {
                if (aborted) return;
                aborted = true;
                abortReason = reason;
                try {
                    transaction.abort();
                } catch (e) {
                    // Transaction already finished
                }
            };

            transaction.oncomplete = () => {
                console.log("Transaction completed: Sale processed");
                saleData.id = saleKey;
                resolve(saleData);
            };

            transaction.onabort = () => {
                console.error("Transaction aborted: ", abortReason);
                reject(new Error(abortReason));
            };

            transaction.onerror = (event) => {
                console.error("Transaction failed: ", event.target.error);
                if (!aborted) {
                    aborted = true;
                    abortReason = (event.target.error && event.target.error.message) || 'Transaction failed';
                }
                reject(event.target.error || new Error(abortReason));
            };

            // 1. Allocate today's order number (YYYYMMDD-NNNN) and add the sale.
            //    Done inside the same transaction so two sales cannot take the same number.
            const now = new Date();
            const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const countRequest = saleStore.index('date').count(IDBKeyRange.bound(dayStart, dayEnd, false, true));
            countRequest.onerror = () => fail('Could not allocate an order number');

            countRequest.onsuccess = () => {
                if (aborted) return;
                saleData.orderNo = `${prefix}-${String(countRequest.result + 1).padStart(4, '0')}`;

                // D4: never persist product image blobs inside sale records
                if (Array.isArray(saleData.items)) {
                    saleData.items = saleData.items.map(li => ({
                        id: li.id,
                        name: li.name,
                        barcode: li.barcode || null,
                        price: li.price,
                        costPrice: li.costPrice || 0,
                        qty: li.qty,
                        discount: li.discount || 0,
                        stock: li.stock
                    }));
                }

                // 1.2.1 / 1.2.2: totals are derived from the exact lines being stored,
                // through the canonical formula, so stored headers can never
                // disagree with stored items.
                const totals = calcSale(saleData.items);
                saleData.subtotal = totals.gross;
                saleData.discountTotal = totals.discount;
                saleData.total = totals.net;
                saleData.netProfit = totals.profit;

                const addRequest = saleStore.add(saleData);
                addRequest.onsuccess = () => { saleKey = addRequest.result; };
                addRequest.onerror = () => fail('Could not save the sale record');

                // 2. Validate stock, then decrement it
                cartItems.forEach(item => {
                    const getRequest = productStore.get(item.id);
                    getRequest.onsuccess = () => {
                        if (aborted) return;
                        const product = getRequest.result;
                        if (!product) {
                            console.error(`Product ${item.id} not found during transaction`);
                            fail(`"${item.name || item.id}" is no longer in inventory`);
                            return;
                        }
                        const currentStock = Number(product.stock) || 0;
                        if (currentStock < item.qty) {
                            fail(`Insufficient stock for "${product.name}" (available: ${currentStock}, needed: ${item.qty})`);
                            return;
                        }
                        product.stock = currentStock - item.qty;
                        productStore.put(product);
                    };
                    getRequest.onerror = () => fail('Could not read product stock');
                });
            };
        });
    }

    // --- Backup / Restore (Phase 1.3) ---------------------------------------

    backupStores() {
        return ['users', 'products', 'sales', 'settings'];
    }

    // Full JSON export, compact on purpose: backups are stored, not read by hand.
    async exportData() {
        const stores = this.backupStores();
        const data = {};
        const counts = {};

        for (const storeName of stores) {
            const rows = await this.getAll(storeName);
            data[storeName] = rows;
            counts[storeName] = rows.length;
        }

        return JSON.stringify({
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            counts,
            data
        });
    }

    // Pure: parse + validate + normalise. Touches nothing in IndexedDB, so the
    // same function backs the confirm dialog AND gates importData - a malformed
    // file is rejected before a single store is cleared.
    //
    // Returns { ok:true, data, counts, exportedAt } or { ok:false, error }.
    parseBackup(text) {
        const stores = this.backupStores();
        const fail = error => ({ ok: false, error });

        let raw;
        try {
            raw = JSON.parse(text);
        } catch (e) {
            return fail('That file is not valid JSON.');
        }

        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Not a Pointify backup file.');
        if (raw.format !== BACKUP_FORMAT) return fail('Not a Pointify backup file (no format marker).');
        if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
            return fail('This backup was made by a newer version of Pointify.');
        }
        if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
            return fail('Backup file has no data section.');
        }

        const ROLES = ['admin', 'manager', 'cashier']; // D3: exactly three roles
        const data = {};
        const counts = {};

        for (const storeName of stores) {
            const rows = raw.data[storeName];
            if (!Array.isArray(rows)) {
                return fail(`Backup is incomplete: "${storeName}" is missing or is not a list.`);
            }

            const seenKeys = new Set();
            const seenBarcodes = new Set();
            const seenUsernames = new Set();
            const out = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const where = `${storeName} record ${i + 1}`;

                if (!row || typeof row !== 'object' || Array.isArray(row)) {
                    return fail(`Backup is damaged: ${where} is not an object.`);
                }

                if (storeName === 'settings') {
                    if (typeof row.key !== 'string' || !row.key) return fail(`Backup is damaged: ${where} has no key.`);
                    if (seenKeys.has(row.key)) return fail(`Backup is damaged: duplicate settings key "${row.key}".`);
                    seenKeys.add(row.key);
                } else {
                    if (typeof row.id !== 'number' || !Number.isFinite(row.id)) {
                        return fail(`Backup is damaged: ${where} has no numeric id.`);
                    }
                    if (seenKeys.has(row.id)) return fail(`Backup is damaged: duplicate id ${row.id} in "${storeName}".`);
                    seenKeys.add(row.id);
                }

                if (storeName === 'users') {
                    if (typeof row.username !== 'string' || !row.username) return fail(`Backup is damaged: ${where} has no username.`);
                    if (typeof row.password !== 'string') return fail(`Backup is damaged: user "${row.username}" has no password.`);
                    if (!ROLES.includes(row.role)) {
                        return fail(`Backup is damaged: user "${row.username}" has unknown role "${row.role}".`);
                    }
                    // The username index is unique - catch it here rather than let
                    // the transaction abort with an opaque ConstraintError.
                    if (seenUsernames.has(row.username)) return fail(`Backup is damaged: duplicate username "${row.username}".`);
                    seenUsernames.add(row.username);
                }

                if (storeName === 'products') {
                    if (typeof row.name !== 'string' || !row.name) return fail(`Backup is damaged: ${where} has no name.`);
                    if (!Number.isFinite(Number(row.price))) return fail(`Backup is damaged: product "${row.name}" has no valid price.`);
                    if (!Number.isFinite(Number(row.stock))) return fail(`Backup is damaged: product "${row.name}" has no valid stock.`);
                    // Restore is the other door into the database, so it must not
                    // re-admit the records the form now rejects. Normalise instead
                    // of refusing: refusing the whole file would strand a store on
                    // legacy data it cannot get rid of.
                    //   price -5  -> 0      (never free, never negative)
                    //   stock 2.5 -> 2      (whole units only)
                    //   missing costPrice/alertLevel -> 0 / 5
                    row.price = Math.max(0, Number(row.price));
                    row.costPrice = Number.isFinite(Number(row.costPrice)) ? Math.max(0, Number(row.costPrice)) : 0;
                    row.stock = Math.max(0, Math.floor(Number(row.stock)));
                    row.alertLevel = Number.isFinite(Number(row.alertLevel)) ? Math.max(0, Math.floor(Number(row.alertLevel))) : 5;
                    // The barcode index is unique and "" IS a valid IndexedDB key, so
                    // an empty barcode must be dropped instead of appearing twice.
                    if (row.barcode === '' || row.barcode === null) delete row.barcode;
                    if (typeof row.barcode === 'string') {
                        if (seenBarcodes.has(row.barcode)) return fail(`Backup is damaged: duplicate barcode "${row.barcode}".`);
                        seenBarcodes.add(row.barcode);
                    }
                }

                if (storeName === 'sales') {
                    if (!Array.isArray(row.items)) return fail(`Backup is damaged: sale ${row.id} has no item list.`);
                    // Order numbers are allocated with a range query over the
                    // Date-keyed 'date' index. JSON turns Date into a string, and
                    // string keys sort apart from date keys, so the range would stop
                    // matching and order numbers would restart at 0001. Revive them.
                    const when = new Date(row.date);
                    if (isNaN(when.getTime())) return fail(`Backup is damaged: sale ${row.id} has an unreadable date.`);
                    row.date = when;

                    // Recompute the stored header from the items actually being
                    // written, so a hand-edited or pre-Phase-1.2 file cannot import
                    // a total that disagrees with its own lines. The invariant that
                    // db.processSale establishes must survive a restore too.
                    const totals = calcSale(row.items);
                    row.subtotal = totals.gross;
                    row.discountTotal = totals.discount;
                    row.total = totals.net;
                    row.netProfit = totals.profit;
                }

                out.push(row);
            }

            data[storeName] = out;
            counts[storeName] = out.length;
        }

        return {
            ok: true,
            data,
            counts,
            exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null
        };
    }

    // Atomic replace. parseBackup runs first, so the transaction only ever starts
    // with data already known to be valid; anything that still fails inside
    // aborts the whole transaction and IndexedDB rolls every store back.
    async importData(jsonString) {
        const check = this.parseBackup(jsonString);
        if (!check.ok) throw new Error(check.error);

        const stores = this.backupStores();
        const data = check.data;
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            let settled = false;
            const fail = (message) => {
                if (settled) return;
                settled = true;
                reject(new Error(message || 'Restore failed.'));
            };

            let transaction;
            try {
                transaction = db.transaction(stores, 'readwrite');
            } catch (e) {
                fail(e.message);
                return;
            }

            transaction.oncomplete = () => {
                if (settled) return;
                settled = true;
                resolve(true);
            };
            transaction.onerror = (event) => {
                const err = event && event.target && event.target.error;
                fail(err ? err.message : 'Restore failed.');
            };
            transaction.onabort = (event) => {
                const err = event && event.target && event.target.error;
                fail(err ? err.message : 'Restore was rolled back.');
            };

            try {
                for (const storeName of stores) {
                    const store = transaction.objectStore(storeName);
                    store.clear();
                    data[storeName].forEach(item => store.add(item));
                }
            } catch (e) {
                fail(e.message || 'Restore failed.');
                try { transaction.abort(); } catch (ignore) { /* already settled */ }
            }
        });
    }
}

// Factory reset.
//
// A single-device POS has no server, so there is no password reset and no way
// to recover a forgotten admin password. The only way back into a locked-out
// device is to wipe the local database and let seed() rebuild the bootstrap
// admin. Our own connection is closed first: deleteDatabase() blocks forever
// while any connection is open, and the timeout means a blocked delete still
// lets the reload finish the job.
export async function resetDatabase() {
    db.close();
    await new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        try {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = done;
            request.onerror = done;
            request.onblocked = done;
        } catch (e) {
            done();
        }
        setTimeout(done, 1500);
    });
}

// --- Recovery codes ---------------------------------------------------------
//
// Five one-time codes that let the owner regain access WITHOUT erasing the
// device. Each dies the instant it is used, so losing one slip of paper costs
// one code, not access.
//
// Stored recoverably rather than hashed, deliberately:
//   1. Every password in this app is already plain text in IndexedDB (D1), so
//      a one-way hash here would be a padlock on an open shed.
//   2. The owner must be able to re-read the codes from Settings while they can
//      still sign in - and that is exactly the situation that prevents a
//      lockout, which is the real risk on a single-device till.
const RECOVERY_CODES_KEY = 'recoveryCodes';
// No 0, O, 1, I or L: a handwritten slip must never be mistyped into a
// different-but-valid code.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_COUNT = 5;
const RECOVERY_LEN = 10;   // XXXXX-XXXXX
const RECOVERY_GROUP = 5;

export function randomRecoveryCode() {
    const bytes = new Uint8Array(RECOVERY_LEN);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        // Only reached on a non-secure origin without the WebCrypto API.
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (let i = 0; i < RECOVERY_LEN; i++) {
        if (i && i % RECOVERY_GROUP === 0) out += '-';
        out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    }
    return out;
}

// Case- and punctuation-insensitive, so a user who typed the dashes in the
// wrong place or used lower case still gets in.
export function normaliseRecoveryCode(input) {
    return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function loadRecoveryCodes() {
    const rows = await db.getAll('settings');
    const row = rows.find(r => r.key === RECOVERY_CODES_KEY);
    const list = Array.isArray(row && row.value) ? row.value : [];
    return list.filter(c => typeof c === 'string' && c);
}

export async function saveRecoveryCodes(codes) {
    await db.putSettings([{ key: RECOVERY_CODES_KEY, value: codes }]);
}

export async function issueRecoveryCodes() {
    const codes = [];
    while (codes.length < RECOVERY_COUNT) {
        const code = randomRecoveryCode();
        if (!codes.includes(code)) codes.push(code);
    }
    await saveRecoveryCodes(codes);
    return codes;
}

export async function verifyRecoveryCode(input) {
    const want = normaliseRecoveryCode(input);
    if (!want) return false;
    const codes = await loadRecoveryCodes();
    return codes.some(c => normaliseRecoveryCode(c) === want);
}

// Spends the code. Called ONLY after the new credentials have been saved, so a
// failed recovery never burns one of the owner's five codes.
export async function spendRecoveryCode(input) {
    const want = normaliseRecoveryCode(input);
    if (!want) return false;
    const codes = await loadRecoveryCodes();
    const idx = codes.findIndex(c => normaliseRecoveryCode(c) === want);
    if (idx === -1) return false;
    codes.splice(idx, 1);
    await saveRecoveryCodes(codes);
    return true;
}

export const db = new PointifyDB();
