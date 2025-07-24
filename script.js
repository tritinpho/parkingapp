// Database Manager for SQLite
class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Initialize SQL.js
            this.SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
            
            // Try to load existing database from localStorage
            const savedDb = localStorage.getItem('sqliteDatabase');
            if (savedDb) {
                try {
                    const buffer = this.base64ToArrayBuffer(savedDb);
                    this.db = new this.SQL.Database(new Uint8Array(buffer));
                    
                    // Check if database has the required columns
                    if (!this.hasRequiredColumns()) {
                        console.log('Database schema outdated, recreating...');
                        this.recreateDatabase();
                    } else {
                        // Run migrations to add any missing columns
                        this.runMigrations();
                    }
                } catch (error) {
                    console.error('Failed to load existing database, creating new one:', error);
                    this.createNewDatabase();
                }
            } else {
                // Create new database
                this.createNewDatabase();
            }
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            return false;
        }
    }

    hasRequiredColumns() {
        try {
            // Check if isOpenEnded column exists
            const result = this.db.exec("PRAGMA table_info(rentals)");
            const columns = result[0].values.map(row => row[1]); // Column names
            return columns.includes('isOpenEnded');
        } catch (error) {
            console.error('Error checking database schema:', error);
            return false;
        }
    }

    createNewDatabase() {
        this.db = new this.SQL.Database();
        this.createTables();
    }

    recreateDatabase() {
        // Export existing data
        const existingRentals = this.getAllRentals();
        const existingPayments = this.getAllPaymentHistory();
        
        // Create new database with updated schema
        this.createNewDatabase();
        
        // Restore data
        existingRentals.forEach(rental => {
            // Add isOpenEnded field to existing rentals (default to false)
            rental.isOpenEnded = false;
            this.addRental(rental);
        });
        
        // Restore payment history
        existingPayments.forEach(payment => {
            this.addPaymentRecord(payment.rental_id, payment);
        });
    }

    getAllPaymentHistory() {
        if (!this.isInitialized) return [];
        
        try {
            const stmt = this.db.prepare("SELECT * FROM payment_history ORDER BY id");
            const results = [];
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row);
            }
            
            stmt.free();
            return results;
        } catch (error) {
            console.error('Error getting payment history:', error);
            return [];
        }
    }

    runMigrations() {
        // Add isOpenEnded column to existing tables if it doesn't exist
        try {
            this.db.exec("ALTER TABLE rentals ADD COLUMN isOpenEnded BOOLEAN DEFAULT 0");
            console.log('Added isOpenEnded column to rentals table');
        } catch (error) {
            // Column already exists, ignore error
        }
        
        // Add payment method column to existing tables if it doesn't exist
        try {
            this.db.exec("ALTER TABLE rentals ADD COLUMN paymentMethod TEXT DEFAULT 'Tiền mặt'");
        } catch (error) {
            // Column already exists, ignore error
        }
        
        // Add notes column to existing tables if it doesn't exist
        try {
            this.db.exec("ALTER TABLE rentals ADD COLUMN notes TEXT DEFAULT ''");
        } catch (error) {
            // Column already exists, ignore error
        }
        
        // Add parking area column to existing tables if it doesn't exist
        try {
            this.db.exec("ALTER TABLE rentals ADD COLUMN parkingArea TEXT DEFAULT '1'");
        } catch (error) {
            // Column already exists, ignore error
        }
        
        // Add refund_fulfilled column to payment_history table if it doesn't exist
        try {
            this.db.exec("ALTER TABLE payment_history ADD COLUMN refund_fulfilled BOOLEAN DEFAULT NULL");
        } catch (error) {
            // Column already exists, ignore error
        }
        
        this.saveToLocalStorage();
    }

    resetDatabase() {
        // Clear localStorage
        localStorage.removeItem('sqliteDatabase');
        
        // Create new database
        this.createNewDatabase();
        
        console.log('Database reset successfully');
        return true;
    }

    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS rentals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner TEXT NOT NULL,
                driverAddress TEXT NOT NULL,
                phoneNumber TEXT NOT NULL,
                carModel TEXT NOT NULL,
                plateNumber TEXT NOT NULL,
                parkingArea TEXT NOT NULL,
                dateIn TEXT NOT NULL,
                dateOut TEXT,
                isOpenEnded BOOLEAN DEFAULT 0,
                price INTEGER NOT NULL,
                monthsPaid INTEGER DEFAULT 0,
                monthsPaidDetails TEXT DEFAULT '',
                amountOwed REAL DEFAULT 0,
                paid BOOLEAN DEFAULT 0,
                paymentMethod TEXT DEFAULT 'Tiền mặt',
                notes TEXT DEFAULT '',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        const createPaymentHistorySQL = `
            CREATE TABLE IF NOT EXISTS payment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rental_id INTEGER NOT NULL,
                payment_date TEXT NOT NULL,
                amount_paid REAL NOT NULL,
                months_covered TEXT NOT NULL,
                payment_method TEXT DEFAULT 'Tiền mặt',
                notes TEXT DEFAULT '',
                refund_fulfilled BOOLEAN DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rental_id) REFERENCES rentals (id) ON DELETE CASCADE
            );
        `;
        
        this.db.exec(createTableSQL);
        this.db.exec(createPaymentHistorySQL);
        
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        if (this.db) {
            const data = this.db.export();
            const base64 = this.arrayBufferToBase64(data);
            localStorage.setItem('sqliteDatabase', base64);
        }
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    getAllRentals() {
        if (!this.isInitialized) return [];
        
        const stmt = this.db.prepare("SELECT * FROM rentals ORDER BY id");
        const results = [];
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                ...row,
                paid: Boolean(row.paid)
            });
        }
        
        stmt.free();
        return results;
    }

    addRental(rental) {
        if (!this.isInitialized) return null;
        
        const stmt = this.db.prepare(`
            INSERT INTO rentals (
                owner, driverAddress, phoneNumber, carModel, plateNumber, parkingArea,
                dateIn, dateOut, isOpenEnded, price, monthsPaid, monthsPaidDetails, amountOwed, paid, paymentMethod, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            rental.owner || '',
            rental.driverAddress || '',
            rental.phoneNumber || '',
            rental.carModel || '',
            rental.plateNumber || '',
            rental.parkingArea || '1',
            rental.dateIn || '',
            rental.dateOut || null,
            rental.isOpenEnded ? 1 : 0,
            rental.price || 0,
            rental.monthsPaid || 0,
            rental.monthsPaidDetails || '',
            rental.amountOwed || 0,
            rental.paid ? 1 : 0,
            rental.paymentMethod || 'Tiền mặt',
            rental.notes || ''
        ]);
        
        const insertId = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        this.saveToLocalStorage();
        
        return insertId;
    }

    updateRental(id, rental) {
        if (!this.isInitialized) return false;
        
        const stmt = this.db.prepare(`
            UPDATE rentals SET
                owner = ?, driverAddress = ?, phoneNumber = ?, carModel = ?, plateNumber = ?, parkingArea = ?,
                dateIn = ?, dateOut = ?, isOpenEnded = ?, price = ?, monthsPaid = ?, monthsPaidDetails = ?, 
                amountOwed = ?, paid = ?, paymentMethod = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        stmt.run([
            rental.owner || '',
            rental.driverAddress || '',
            rental.phoneNumber || '',
            rental.carModel || '',
            rental.plateNumber || '',
            rental.parkingArea || '1',
            rental.dateIn || '',
            rental.dateOut || null,
            rental.isOpenEnded ? 1 : 0,
            rental.price || 0,
            rental.monthsPaid || 0,
            rental.monthsPaidDetails || '',
            rental.amountOwed || 0,
            rental.paid ? 1 : 0,
            rental.paymentMethod || 'Tiền mặt',
            rental.notes || '',
            id || 0
        ]);
        
        stmt.free();
        this.saveToLocalStorage();
        return true;
    }

    deleteRental(id) {
        if (!this.isInitialized) return false;
        
        const stmt = this.db.prepare("DELETE FROM rentals WHERE id = ?");
        stmt.run([id || 0]);
        stmt.free();
        this.saveToLocalStorage();
        return true;
    }

    exportDatabase() {
        if (!this.db) return null;
        
        const data = this.db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `bai_gui_xe_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.sqlite`;
        link.click();
        
        URL.revokeObjectURL(url);
        return true;
    }

    async importDatabase(file) {
        try {
            const buffer = await file.arrayBuffer();
            this.db = new this.SQL.Database(new Uint8Array(buffer));
            this.saveToLocalStorage();
            return true;
        } catch (error) {
            console.error('Failed to import database:', error);
            return false;
        }
    }

    // Payment History Methods
    addPaymentRecord(rentalId, paymentData) {
        if (!this.isInitialized) return null;
        
        const stmt = this.db.prepare(`
            INSERT INTO payment_history (
                rental_id, payment_date, amount_paid, months_covered, payment_method, notes, refund_fulfilled
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            rentalId || 0,
            paymentData.payment_date || '',
            paymentData.amount_paid || 0,
            paymentData.months_covered || '',
            paymentData.payment_method || 'Tiền mặt',
            paymentData.notes || '',
            paymentData.refund_fulfilled || null
        ]);
        
        const insertId = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        stmt.free();
        this.saveToLocalStorage();
        
        return insertId;
    }

    getPaymentHistory(rentalId) {
        if (!this.isInitialized) return [];
        
        const stmt = this.db.prepare(`
            SELECT * FROM payment_history 
            WHERE rental_id = ? 
            ORDER BY payment_date DESC
        `);
        
        const results = [];
        stmt.bind([rentalId || 0]);
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        
        stmt.free();
        return results;
    }

    getPaymentById(paymentId) {
        if (!this.isInitialized) return null;
        
        const stmt = this.db.prepare(`
            SELECT ph.*, r.owner, r.plateNumber, r.carModel, r.driverAddress, r.price, r.parkingArea
            FROM payment_history ph
            JOIN rentals r ON ph.rental_id = r.id
            WHERE ph.id = ?
        `);
        
        stmt.bind([paymentId || 0]);
        let result = null;
        
        if (stmt.step()) {
            result = stmt.getAsObject();
        }
        
        stmt.free();
        return result;
    }

    deletePaymentRecord(paymentId) {
        if (!this.isInitialized) return false;
        
        const stmt = this.db.prepare("DELETE FROM payment_history WHERE id = ?");
        stmt.run([paymentId || 0]);
        stmt.free();
        this.saveToLocalStorage();
        return true;
    }

    updatePaymentRecord(paymentId, paymentData) {
        if (!this.isInitialized) return false;
        
        const stmt = this.db.prepare(`
            UPDATE payment_history SET
                payment_date = ?, amount_paid = ?, months_covered = ?, 
                payment_method = ?, notes = ?, refund_fulfilled = ?
            WHERE id = ?
        `);
        
        stmt.run([
            paymentData.payment_date || '',
            paymentData.amount_paid || 0,
            paymentData.months_covered || '',
            paymentData.payment_method || 'Tiền mặt',
            paymentData.notes || '',
            paymentData.refund_fulfilled || null,
            paymentId || 0
        ]);
        
        stmt.free();
        this.saveToLocalStorage();
        return true;
    }

    markRefundAsFulfilled(paymentId) {
        if (!this.isInitialized) return false;
        
        const stmt = this.db.prepare(`
            UPDATE payment_history SET
                refund_fulfilled = true
            WHERE id = ?
        `);
        
        stmt.run([paymentId || 0]);
        stmt.free();
        this.saveToLocalStorage();
        return true;
    }


}

// Parking Rental Management System
class ParkingApp {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.rentals = [];
        this.filteredRentals = [];
        this.currentEditId = null;
        this.currentSort = { field: 'id', direction: 'asc' };
        this.isInitialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            const success = await this.dbManager.initialize();
            if (success) {
                this.isInitialized = true;
                this.rentals = this.dbManager.getAllRentals();
                this.filteredRentals = [...this.rentals];
                this.initializeElements();
                this.attachEventListeners();
                this.initializeDateInputs();

                this.applyFilters();
                this.initializeColumnVisibility();
                this.showMessage('Database initialized successfully!');
            } else {
                this.showError('Failed to initialize database');
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Database initialization failed');
        }
    }

    initializeElements() {
        this.modal = document.getElementById('modal');
        this.addNewBtn = document.getElementById('addNewBtn');
        this.closeBtn = document.querySelector('.close');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.form = document.getElementById('rentalForm');
        this.tableBody = document.getElementById('dataTableBody');
        this.modalTitle = document.getElementById('modalTitle');
        
        // Open-ended rental elements
        this.openEndedCheckbox = document.getElementById('openEndedRental');
        this.dateOutInput = document.getElementById('dateOut');
        
        // Filter and search elements
        this.searchInput = document.getElementById('searchInput');
        this.clearSearchBtn = document.getElementById('clearSearch');

        this.statusFilter = document.getElementById('statusFilter');
        this.reminderFilter = document.getElementById('reminderFilter');
        this.sortableHeaders = document.querySelectorAll('.sortable');
        
        // Database elements
        this.exportDbBtn = document.getElementById('exportDbBtn');
        this.importDbBtn = document.getElementById('importDbBtn');
        this.importDbFile = document.getElementById('importDbFile');
        this.recalculateBtn = document.getElementById('recalculateBtn');
        
        // Report elements
        this.reportBtn = document.getElementById('reportBtn');
        this.reportModal = document.getElementById('reportModal');
        this.reportCloseBtn = document.getElementById('reportCloseBtn');
        this.closeReportBtn = document.getElementById('closeReportBtn');
        this.printReportBtn = document.getElementById('printReportBtn');
        this.exportReportBtn = document.getElementById('exportReportBtn');
        this.reportContent = document.getElementById('reportContent');
        
        // Invoice elements
        this.invoiceModal = document.getElementById('invoiceModal');
        this.invoiceCloseBtn = document.getElementById('invoiceCloseBtn');
        this.closeInvoiceBtn = document.getElementById('closeInvoiceBtn');
        this.printInvoiceBtn = document.getElementById('printInvoiceBtn');
        
        // Column visibility elements
        this.columnVisibilityBtn = document.getElementById('columnVisibilityBtn');
        this.columnVisibilityModal = document.getElementById('columnVisibilityModal');
        this.columnVisibilityCloseBtn = document.getElementById('columnVisibilityCloseBtn');
        this.showAllColumnsBtn = document.getElementById('showAllColumns');
        this.hideAllColumnsBtn = document.getElementById('hideAllColumns');
        this.resetToDefaultBtn = document.getElementById('resetToDefault');
        this.applyColumnChangesBtn = document.getElementById('applyColumnChanges');
        this.cancelColumnChangesBtn = document.getElementById('cancelColumnChanges');
        this.columnCheckboxes = document.querySelectorAll('.column-checkboxes input[type="checkbox"]');
        
        // Payment history elements
        this.paymentHistoryModal = document.getElementById('paymentHistoryModal');
        this.paymentHistoryCloseBtn = document.getElementById('paymentHistoryCloseBtn');
        this.closePaymentHistoryBtn = document.getElementById('closePaymentHistoryBtn');
        this.printPaymentHistoryBtn = document.getElementById('printPaymentHistoryBtn');
        this.paymentHistoryList = document.getElementById('paymentHistoryList');
        this.addPaymentBtn = document.getElementById('addPaymentBtn');
        
        // Add payment elements
        this.addPaymentModal = document.getElementById('addPaymentModal');
        this.addPaymentCloseBtn = document.getElementById('addPaymentCloseBtn');
        this.cancelAddPaymentBtn = document.getElementById('cancelAddPaymentBtn');
        this.addPaymentSubmitBtn = document.getElementById('addPaymentSubmitBtn');
        this.addPaymentRate = document.getElementById('addPaymentRate');
        this.addPaymentSelectAll = document.getElementById('addPaymentSelectAll');
        this.addPaymentClearAll = document.getElementById('addPaymentClearAll');
    }

    initializeDateInputs() {
        // Initialize Vietnamese date pickers
        const dateInputs = document.querySelectorAll('.vietnamese-date-input');
        dateInputs.forEach(input => {
            this.initializeVietnameseDatePicker(input);
        });
    }

    initializeVietnameseDatePicker(input) {
        const pickerId = input.id + 'Picker';
        const picker = document.getElementById(pickerId);
        if (!picker) {
            console.error('Picker not found for input:', input.id);
            return;
        }

        let currentDate = new Date();
        let selectedDate = null;
        const self = this;

        // Add input event handler for manual typing
        input.addEventListener('input', (e) => {
            let value = e.target.value;
            
            // Remove any non-digit characters except '/'
            value = value.replace(/[^\d/]/g, '');
            
            // Auto-format as user types
            if (value.length >= 2 && !value.includes('/')) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            if (value.length >= 5 && value.split('/').length === 2) {
                value = value.slice(0, 5) + '/' + value.slice(5);
            }
            
            // Limit to dd/mm/yyyy format
            if (value.length > 10) {
                value = value.slice(0, 10);
            }
            
            e.target.value = value;
            
            // Validate date when user finishes typing
            if (value.length === 10) {
                this.validateAndFormatDate(input, value);
            }
        });

        // Add blur event to validate when user leaves the field
        input.addEventListener('blur', (e) => {
            const value = e.target.value;
            if (value && value.length === 10) {
                this.validateAndFormatDate(input, value);
            }
        }); // Store reference to 'this'

        // Vietnamese month names
        const vietnameseMonths = [
            'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
        ];

        function renderCalendar() {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            
            // Update title
            picker.querySelector('.date-picker-title').textContent = 
                `${vietnameseMonths[month]} năm ${year}`;
            
            // Clear days
            const daysContainer = picker.querySelector('.date-picker-days');
            daysContainer.innerHTML = '';
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay() + 1); // Monday = 1
            
            // Generate calendar grid
            for (let i = 0; i < 42; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                
                const dayElement = document.createElement('div');
                dayElement.className = 'date-day';
                dayElement.textContent = date.getDate();
                
                // Check if it's today
                const today = new Date();
                if (date.toDateString() === today.toDateString()) {
                    dayElement.classList.add('today');
                }
                
                // Check if it's selected
                if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
                    dayElement.classList.add('selected');
                }
                
                // Check if it's from other month
                if (date.getMonth() !== month) {
                    dayElement.classList.add('other-month');
                }
                
                // Add click event
                dayElement.addEventListener('click', () => {
                    // Create date without timezone conversion by using UTC
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    const day = date.getDate();
                    selectedDate = new Date(year, month, day);
                    input.value = self.formatVietnameseDate(selectedDate);
                    input.style.borderColor = '#27ae60'; // Green border for valid date
                    picker.style.display = 'none';
                    
                    // Trigger change event for form validation
                    input.dispatchEvent(new Event('change'));
                });
                
                daysContainer.appendChild(dayElement);
            }
        }

        // Navigation buttons
        picker.querySelectorAll('.date-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'prev') {
                    currentDate.setMonth(currentDate.getMonth() - 1);
                } else if (action === 'next') {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
                renderCalendar();
            });
        });

        // Footer buttons
        picker.querySelectorAll('.date-picker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'clear') {
                    selectedDate = null;
                    input.value = '';
                    picker.style.display = 'none';
                } else if (action === 'today') {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = today.getMonth();
                    const day = today.getDate();
                    selectedDate = new Date(year, month, day);
                    input.value = self.formatVietnameseDate(selectedDate);
                    input.style.borderColor = '#27ae60'; // Green border for valid date
                    picker.style.display = 'none';
                    input.dispatchEvent(new Event('change'));
                }
            });
        });

        // Toggle picker on input click
        input.addEventListener('click', (e) => {
            e.preventDefault();
            // Hide all other pickers
            document.querySelectorAll('.date-picker-container').forEach(p => {
                p.style.display = 'none';
            });
            picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
            renderCalendar();
        });

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && !input.contains(e.target)) {
                picker.style.display = 'none';
            }
        });

        // Initial render
        renderCalendar();
    }

    formatVietnameseDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatDateForStorage(date) {
        // Format date as YYYY-MM-DD without timezone conversion
        if (!date || isNaN(date.getTime())) {
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatVietnameseDateForInvoice() {
        // Create current date without timezone conversion for invoice
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        return `Ngày ${day} tháng ${month} năm ${year}`;
    }

    formatVietnameseDateForInvoiceFromDate(dateString) {
        // Format a specific date for invoice display (timezone-safe)
        let date;
        if (dateString.includes('/')) {
            // Vietnamese format (dd/mm/yyyy)
            const [day, month, year] = dateString.split('/');
            date = new Date(year, month - 1, day);
        } else if (dateString.includes('-')) {
            // ISO format (yyyy-mm-dd) - create date without timezone conversion
            const [year, month, day] = dateString.split('-');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
            // Fallback to standard Date constructor
            date = new Date(dateString);
        }
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `Ngày ${day} tháng ${month} năm ${year}`;
    }

    validateAndFormatDate(input, value) {
        // Validate and format date input
        const parts = value.split('/');
        if (parts.length !== 3) {
            input.style.borderColor = '#e74c3c';
            return false;
        }

        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        // Basic validation
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            input.style.borderColor = '#e74c3c';
            return false;
        }

        if (year < 1900 || year > 2100) {
            input.style.borderColor = '#e74c3c';
            return false;
        }

        if (month < 1 || month > 12) {
            input.style.borderColor = '#e74c3c';
            return false;
        }

        // Check if day is valid for the month
        const date = new Date(year, month - 1, day);
        if (date.getMonth() !== month - 1 || date.getDate() !== day) {
            input.style.borderColor = '#e74c3c';
            return false;
        }

        // Format the date properly
        const formattedDay = String(day).padStart(2, '0');
        const formattedMonth = String(month).padStart(2, '0');
        const formattedYear = String(year);

        const formattedDate = `${formattedDay}/${formattedMonth}/${formattedYear}`;
        input.value = formattedDate;
        input.style.borderColor = '#27ae60';

        // Update selected date for calendar
        const pickerId = input.id + 'Picker';
        const picker = document.getElementById(pickerId);
        if (picker) {
            // Update calendar to show the selected date
            const selectedDate = new Date(year, month - 1, day);
            this.updateCalendarSelection(picker, selectedDate);
        }

        // Trigger change event for form validation
        input.dispatchEvent(new Event('change'));
        return true;
    }

    updateCalendarSelection(picker, selectedDate) {
        // Update calendar to show the selected date
        const daysContainer = picker.querySelector('.date-picker-days');
        const days = daysContainer.querySelectorAll('.date-day');
        
        // Remove previous selection
        days.forEach(day => day.classList.remove('selected'));
        
        // Find and select the new date
        days.forEach(day => {
            const dayNumber = parseInt(day.textContent);
            if (!isNaN(dayNumber)) {
                const currentMonth = selectedDate.getMonth();
                const currentYear = selectedDate.getFullYear();
                
                // Check if this day matches the selected date
                const dayDate = new Date(currentYear, currentMonth, dayNumber);
                if (dayDate.getDate() === selectedDate.getDate() && 
                    dayDate.getMonth() === selectedDate.getMonth() && 
                    dayDate.getFullYear() === selectedDate.getFullYear()) {
                    day.classList.add('selected');
                }
            }
        });
    }

    attachEventListeners() {
        // Open modal for new rental
        this.addNewBtn.addEventListener('click', () => this.openModal());
        
        // Close modal events
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Price input formatting with text input
        const priceInput = document.getElementById('price');
        
        priceInput.addEventListener('input', (e) => {
            const input = e.target;
            let value = input.value;
            
            // Remove all non-digit characters
            const numericValue = value.replace(/[^\d]/g, '');
            
            // If we have a valid number, format it
            if (numericValue && numericValue.length > 0) {
                const num = parseInt(numericValue);
                if (!isNaN(num)) {
                    const formattedValue = this.formatNumberWithCommas(num);
                    input.value = formattedValue;
                }
            } else if (value === '') {
                // Allow empty value
                input.value = '';
            }
            
            // Calculate amount owed
            this.autoCalculateOwed();
        });
        
        document.getElementById('dateIn').addEventListener('change', () => this.autoCalculateOwed());
        document.getElementById('dateOut').addEventListener('change', () => this.autoCalculateOwed());
        
        // Open-ended rental checkbox event
        this.openEndedCheckbox.addEventListener('change', () => this.handleOpenEndedToggle());
        
        // Search and filter events
        this.searchInput.addEventListener('input', () => this.applyFilters());
        this.clearSearchBtn.addEventListener('click', () => this.clearSearch());

        this.statusFilter.addEventListener('change', () => this.applyFilters());
        this.reminderFilter.addEventListener('change', () => this.applyFilters());
        
        // Sorting events
        this.sortableHeaders.forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });
        
        // Database events
        this.exportDbBtn.addEventListener('click', () => this.exportDatabase());
        this.importDbBtn.addEventListener('click', () => this.importDbFile.click());
        this.importDbFile.addEventListener('change', (e) => this.importDatabase(e));
        this.recalculateBtn.addEventListener('click', () => this.recalculateAllAmountsOwed());
        
        // Report events
        this.reportBtn.addEventListener('click', () => this.openReportModal());
        this.reportCloseBtn.addEventListener('click', () => this.closeReportModal());
        this.closeReportBtn.addEventListener('click', () => this.closeReportModal());
        this.printReportBtn.addEventListener('click', () => this.printReport());
        this.exportReportBtn.addEventListener('click', () => this.exportReportToCSV());
        
        // Close report modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.reportModal) {
                this.closeReportModal();
            }
            if (e.target === this.invoiceModal) {
                this.closeInvoiceModal();
            }
        });
        
        // Invoice events
        this.invoiceCloseBtn.addEventListener('click', () => this.closeInvoiceModal());
        this.closeInvoiceBtn.addEventListener('click', () => this.closeInvoiceModal());
        this.printInvoiceBtn.addEventListener('click', () => this.printInvoice());
        

        
        // Column visibility events
        this.columnVisibilityBtn.addEventListener('click', () => this.openColumnVisibilityModal());
        this.columnVisibilityCloseBtn.addEventListener('click', () => this.closeColumnVisibilityModal());
        this.showAllColumnsBtn.addEventListener('click', () => this.showAllColumns());
        this.hideAllColumnsBtn.addEventListener('click', () => this.hideAllColumns());
        this.resetToDefaultBtn.addEventListener('click', () => this.resetToDefaultColumns());
        this.applyColumnChangesBtn.addEventListener('click', () => this.applyColumnChanges());
        this.cancelColumnChangesBtn.addEventListener('click', () => this.closeColumnVisibilityModal());
        
        // Close column visibility modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.columnVisibilityModal) {
                this.closeColumnVisibilityModal();
            }
            if (e.target === this.paymentHistoryModal) {
                this.closePaymentHistoryModal();
            }
            if (e.target === this.addPaymentModal) {
                this.closeAddPaymentModal();
            }
        });
        
        // Payment history events
        this.paymentHistoryCloseBtn.addEventListener('click', () => this.closePaymentHistoryModal());
        this.closePaymentHistoryBtn.addEventListener('click', () => this.closePaymentHistoryModal());
        this.printPaymentHistoryBtn.addEventListener('click', () => this.printPaymentHistory());
        this.addPaymentBtn.addEventListener('click', () => this.openAddPaymentModal());
        
        // Add payment events
        this.addPaymentCloseBtn.addEventListener('click', () => this.closeAddPaymentModal());
        this.cancelAddPaymentBtn.addEventListener('click', () => this.closeAddPaymentModal());
        this.addPaymentSubmitBtn.addEventListener('click', () => this.handleAddPayment());
        
        // Add payment calculation events
        this.addPaymentRate.addEventListener('input', (e) => {
            // Format the input with commas
            const input = e.target;
            let value = input.value;
            
            // Remove all non-digit characters
            const numericValue = value.replace(/[^\d]/g, '');
            
            // If we have a valid number, format it
            if (numericValue && numericValue.length > 0) {
                const num = parseInt(numericValue);
                if (!isNaN(num)) {
                    const formattedValue = this.formatNumberWithCommas(num);
                    input.value = formattedValue;
                }
            } else if (value === '') {
                // Allow empty value
                input.value = '';
            }
            
            this.updateAddPaymentCalculation();
        });
        this.addPaymentSelectAll.addEventListener('click', () => this.addPaymentSelectAllMonths());
        this.addPaymentClearAll.addEventListener('click', () => this.addPaymentClearAllMonths());
    }

    handleOpenEndedToggle() {
        const isOpenEnded = this.openEndedCheckbox.checked;
        
        if (isOpenEnded) {
            // Disable and clear end date
            this.dateOutInput.disabled = true;
            this.dateOutInput.value = '';
            this.dateOutInput.style.backgroundColor = '#f5f5f5';
            this.dateOutInput.required = false;
            
            // Hide date picker
            const picker = document.getElementById('dateOutPicker');
            if (picker) picker.style.display = 'none';
        } else {
            // Enable end date
            this.dateOutInput.disabled = false;
            this.dateOutInput.style.backgroundColor = 'white';
            this.dateOutInput.required = true;
        }
        
        // Recalculate amount owed
        this.autoCalculateOwed();
    }

    refreshData() {
        if (!this.isInitialized) return;
        this.rentals = this.dbManager.getAllRentals();
        this.filteredRentals = [...this.rentals];
    }

    recalculateAllAmountsOwed() {
        console.log('Recalculating amounts owed for all rentals...');
        
        this.rentals.forEach(rental => {
            const recalculatedAmount = this.calculateCorrectAmountOwed(rental, [], 0);
            
            if (recalculatedAmount !== rental.amountOwed) {
                console.log(`Rental ${rental.id}: ${rental.amountOwed} -> ${recalculatedAmount}`);
                
                const updatedRental = {
                    ...rental,
                    amountOwed: recalculatedAmount,
                    paid: recalculatedAmount === 0
                };
                
                this.dbManager.updateRental(rental.id, updatedRental);
                
                // Update local rentals array
                const index = this.rentals.findIndex(r => r.id === rental.id);
                if (index !== -1) {
                    this.rentals[index] = updatedRental;
                }
            }
        });
        
        this.refreshData();
        this.renderTable();
        console.log('Recalculation complete!');
    }

    recalculateSpecificRental(rentalId) {
        const rental = this.rentals.find(r => r.id === rentalId);
        if (!rental) {
            console.error('Rental not found:', rentalId);
            return;
        }
        
        console.log('Recalculating for specific rental:', rentalId);
        const recalculatedAmount = this.calculateCorrectAmountOwed(rental, [], 0);
        
        console.log(`Rental ${rental.id}: ${rental.amountOwed} -> ${recalculatedAmount}`);
        
        const updatedRental = {
            ...rental,
            amountOwed: recalculatedAmount,
            paid: recalculatedAmount === 0
        };
        
        this.dbManager.updateRental(rental.id, updatedRental);
        
        // Update local rentals array
        const index = this.rentals.findIndex(r => r.id === rental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
        
        this.refreshData();
        this.renderTable();
        console.log('Specific rental recalculation complete!');
    }

    openModal(rental = null) {
        if (rental) {
            // Edit mode
            this.currentEditId = rental.id;
            this.modalTitle.textContent = 'Sửa Hợp Đồng';
            this.populateForm(rental);
        } else {
            // Add mode
            this.currentEditId = null;
            this.modalTitle.textContent = 'Thêm Hợp Đồng Mới';
            this.clearForm();
        }
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.clearForm();
        this.currentEditId = null;
    }

    populateForm(rental) {
        document.getElementById('owner').value = rental.owner;
        document.getElementById('driverAddress').value = rental.driverAddress || '';
        document.getElementById('phoneNumber').value = rental.phoneNumber || '';
        document.getElementById('carModel').value = rental.carModel;
        document.getElementById('plateNumber').value = rental.plateNumber;
        document.getElementById('parkingArea').value = rental.parkingArea || '1';
        
        // Convert date format for Vietnamese date inputs
        if (rental.dateIn) {
            const dateIn = new Date(rental.dateIn);
            document.getElementById('dateIn').value = this.formatVietnameseDate(dateIn);
        }
        if (rental.dateOut) {
            const dateOut = new Date(rental.dateOut);
            document.getElementById('dateOut').value = this.formatVietnameseDate(dateOut);
        }
        
        // Handle open-ended rental checkbox
        const isOpenEnded = rental.isOpenEnded || false;
        this.openEndedCheckbox.checked = isOpenEnded;
        this.handleOpenEndedToggle(); // Apply the toggle logic
        
        document.getElementById('price').value = this.formatNumberWithCommas(rental.price);
        document.getElementById('amountOwed').value = rental.amountOwed || 0;
        document.getElementById('notes').value = rental.notes || '';
    }

    clearForm() {
        this.form.reset();
    }

    handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const amountOwed = parseFloat(formData.get('amountOwed') || '0');
        const isOpenEnded = formData.get('openEndedRental') === 'on';
        
        // Convert Vietnamese date format (dd/mm/yyyy) to ISO format for storage
        const dateInStr = formData.get('dateIn');
        let dateOutStr = formData.get('dateOut');
        
        let dateIn, dateOut;
        if (dateInStr && dateInStr.includes('/')) {
            const [day, month, year] = dateInStr.split('/');
            dateIn = new Date(year, month - 1, day);
        } else {
            dateIn = new Date(dateInStr);
        }
        
        // For open-ended rentals, set dateOut to null
        if (isOpenEnded || !dateOutStr.trim()) {
            dateOut = null;
        } else if (dateOutStr && dateOutStr.includes('/')) {
            const [day, month, year] = dateOutStr.split('/');
            dateOut = new Date(year, month - 1, day);
        } else {
            dateOut = new Date(dateOutStr);
        }
        
        // Validate dates
        if (isNaN(dateIn.getTime())) {
            this.showError('Ngày vào không hợp lệ!');
            return;
        }
        
        if (!isOpenEnded && (isNaN(dateOut.getTime()) || !dateOutStr.trim())) {
            this.showError('Ngày ra là bắt buộc cho thuê có thời hạn!');
            return;
        }
        
        // For fixed-term rentals, validate that dateIn is before dateOut
        if (!isOpenEnded && dateOut && dateIn >= dateOut) {
            this.showError('Ngày vào phải trước ngày ra!');
            return;
        }
        
        // Validate required fields
        const owner = formData.get('owner') || '';
        const carModel = formData.get('carModel') || '';
        const plateNumber = formData.get('plateNumber') || '';
        
        if (!owner.trim()) {
            this.showError('Tên chủ xe là bắt buộc!');
            return;
        }
        
        if (!carModel.trim()) {
            this.showError('Dòng xe là bắt buộc!');
            return;
        }
        
        if (!plateNumber.trim()) {
            this.showError('Biển số xe là bắt buộc!');
            return;
        }
        
        // Auto-calculate paid status based on amount owed
        const isFullyPaid = amountOwed === 0;
        
        const rental = {
            owner: owner,
            driverAddress: formData.get('driverAddress') || '',
            phoneNumber: formData.get('phoneNumber') || '',
            carModel: carModel,
            plateNumber: plateNumber,
            parkingArea: formData.get('parkingArea') || '1',
            dateIn: this.formatDateForStorage(dateIn), // Store in timezone-safe format
            dateOut: dateOut ? this.formatDateForStorage(dateOut) : null, // Store in timezone-safe format
            isOpenEnded: isOpenEnded,
            price: this.parseFormattedPrice(formData.get('price') || '0'),
            monthsPaid: 0, // Default to 0, will be managed through payment history
            monthsPaidDetails: '', // Default to empty, will be managed through payment history
            amountOwed: amountOwed || 0,
            paid: isFullyPaid, // Auto-calculate paid status
            paymentMethod: 'Tiền mặt', // Default payment method
            notes: formData.get('notes') || ''
        };

        if (!this.isInitialized) {
            this.showError('Database not initialized');
            return;
        }

        if (this.currentEditId) {
            // Get the original rental data to compare price changes
            const originalRental = this.rentals.find(r => r.id === this.currentEditId);
            const priceChanged = originalRental && originalRental.price !== rental.price;
            
            // Update existing rental
            const success = this.dbManager.updateRental(this.currentEditId, rental);
            if (success) {
                // Handle price change if detected
                if (priceChanged) {
                    this.handlePriceChange(originalRental, rental);
                }
                
                this.refreshData();
                this.applyFilters();
                this.closeModal();
                this.showMessage('Cập nhật hợp đồng thành công!');
            } else {
                this.showError('Cập nhật hợp đồng thất bại!');
            }
        } else {
            // Add new rental
            const newId = this.dbManager.addRental(rental);
            if (newId) {
                this.refreshData();
                this.applyFilters();
                this.closeModal();
                this.showMessage('Thêm hợp đồng thành công!');
            } else {
                this.showError('Thêm hợp đồng thất bại!');
            }
        }
    }

    handlePriceChange(originalRental, newRental) {
        const oldPrice = originalRental.price;
        const newPrice = newRental.price;
        const priceDifference = newPrice - oldPrice;
        
        // Recalculate amount owed for this rental with the new price
        const recalculatedAmountOwed = this.calculateCorrectAmountOwed(newRental, [], 0);
        
        // Update the rental with the new amount owed
        const updatedRental = {
            ...newRental,
            amountOwed: recalculatedAmountOwed,
            paid: recalculatedAmountOwed === 0
        };
        
        this.dbManager.updateRental(newRental.id, updatedRental);
        
        // Update local rentals array
        const index = this.rentals.findIndex(r => r.id === newRental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
        
        if (priceDifference > 0) {
            this.showMessage(`Giá thuê đã tăng từ ${this.formatVND(oldPrice)} lên ${this.formatVND(newPrice)}. Số tiền nợ đã được cập nhật.`);
        } else {
            this.showMessage(`Giá thuê đã giảm từ ${this.formatVND(oldPrice)} xuống ${this.formatVND(newPrice)}. Số tiền nợ đã được cập nhật.`);
        }
    }

    handlePriceIncrease(rental, currentMonthPayment, additionalAmount) {
        // Create a new payment record for the additional amount
        const paymentData = {
            payment_date: this.formatDateForStorage(new Date()),
            amount_paid: 0, // Customer hasn't paid yet
            months_covered: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
            payment_method: 'Điều chỉnh giá',
            notes: `Điều chỉnh giá thuê từ ${this.formatVND(rental.price - additionalAmount)} lên ${this.formatVND(rental.price)}`,
            refund_fulfilled: null
        };
        
        // Add the payment record
        const paymentId = this.dbManager.addPaymentRecord(rental.id, paymentData);
        
        // Update rental amount owed
        const updatedRental = {
            ...rental,
            amountOwed: rental.amountOwed + additionalAmount
        };
        this.dbManager.updateRental(rental.id, updatedRental);
        
        // Update local rentals array
        const index = this.rentals.findIndex(r => r.id === rental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
        
        // Generate invoice for additional payment
        this.printPaymentInvoice(paymentId);
        
        this.showMessage(`Giá thuê đã tăng. Đã tạo hóa đơn bổ sung ${this.formatVND(additionalAmount)} cho khách hàng.`);
    }

    handlePriceDecrease(rental, currentMonthPayment, refundAmount) {
        // Create a refund record
        const refundData = {
            payment_date: this.formatDateForStorage(new Date()),
            amount_paid: -refundAmount, // Negative amount indicates refund
            months_covered: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
            payment_method: 'Hoàn tiền',
            notes: `Hoàn tiền do giảm giá thuê từ ${this.formatVND(rental.price + refundAmount)} xuống ${this.formatVND(rental.price)}`,
            refund_fulfilled: false
        };
        
        // Add the refund record
        const refundId = this.dbManager.addPaymentRecord(rental.id, refundData);
        
        // Update rental amount owed (negative amount)
        const updatedRental = {
            ...rental,
            amountOwed: Math.max(0, rental.amountOwed - refundAmount)
        };
        this.dbManager.updateRental(rental.id, updatedRental);
        
        // Update local rentals array
        const index = this.rentals.findIndex(r => r.id === rental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
        
        // Generate refund invoice
        this.printPaymentInvoice(refundId);
        
        this.showMessage(`Giá thuê đã giảm. Đã tạo hóa đơn hoàn tiền ${this.formatVND(refundAmount)} cho khách hàng.`);
    }



    markRefundAsFulfilled(paymentId) {
        if (!this.isInitialized) {
            this.showError('Database not initialized');
            return;
        }
        
        const success = this.dbManager.markRefundAsFulfilled(paymentId);
        if (success) {
            this.showMessage('Đã đánh dấu hoàn tiền đã được thực hiện!');
            // Refresh payment history if modal is open
            if (this.currentRentalId) {
                this.loadPaymentHistory(this.currentRentalId);
            }
        } else {
            this.showError('Không thể cập nhật trạng thái hoàn tiền!');
        }
    }

    deleteRental(id) {
        if (!this.isInitialized) {
            this.showError('Database not initialized');
            return;
        }
        
        if (confirm('Bạn có chắc chắn muốn xóa hợp đồng này?')) {
            const success = this.dbManager.deleteRental(id);
            if (success) {
                this.refreshData();
                this.applyFilters();
                this.showMessage('Xóa hợp đồng thành công!');
            } else {
                this.showError('Xóa hợp đồng thất bại!');
            }
        }
    }

    renderTable() {
        this.tableBody.innerHTML = '';
        
        if (this.filteredRentals.length === 0) {
            const message = this.rentals.length === 0 
                ? 'Chưa có hợp đồng nào. Nhấn "Thêm Hợp Đồng Mới" để bắt đầu.'
                : 'Không tìm thấy hợp đồng nào phù hợp với bộ lọc.';
            
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="17" style="text-align: center; padding: 40px; color: #7f8c8d; font-style: italic;">
                        ${message}
                    </td>
                </tr>
            `;
            return;
        }

        this.filteredRentals.forEach(rental => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rental.id}</td>
                <td>${rental.owner}</td>
                <td class="address-cell">
                    ${rental.driverAddress || '-'}
                </td>
                <td class="phone-cell">
                    ${rental.phoneNumber || '-'}
                </td>
                <td>${rental.carModel}</td>
                <td>${rental.plateNumber}</td>
                <td>Khu vực ${rental.parkingArea || '1'}</td>
                <td>${this.formatDate(rental.dateIn)}</td>
                <td>${rental.isOpenEnded ? 
                    '<span style="color: #3498db; font-style: italic;">Không thời hạn</span>' : 
                    this.formatDate(rental.dateOut)
                }</td>
                <td class="reminder-date-cell">
                    ${this.calculateNextReminderDate(rental)}
                </td>
                <td>${this.formatVND(rental.price)}</td>
                <td>${rental.monthsPaid || 0}</td>
                <td class="months-details-cell">
                    ${rental.monthsPaidDetails ? this.expandMonthsForDisplay(rental.monthsPaidDetails) : '-'}
                </td>
                <td class="${(rental.amountOwed || 0) > 0 ? 'amount-owed' : 'amount-clear'}">
                    ${this.formatVND(rental.amountOwed || 0)}
                </td>
                <td>
                    <span class="${rental.paid ? 'status-paid' : 'status-unpaid'}">
                        ${rental.paid ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}
                    </span>
                </td>

                <td class="notes-cell">
                    ${rental.notes || '-'}
                </td>
                <td>
                    <button class="action-btn edit-btn" onclick="app.openModal(${JSON.stringify(rental).replace(/"/g, '&quot;')})">
                        Sửa
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteRental(${rental.id})">
                        Xóa
                    </button>
                    <button class="action-btn history-btn" onclick="app.openPaymentHistoryModal(${rental.id})">
                        Lịch Sử
                    </button>
                </td>
            `;
            this.tableBody.appendChild(row);
        });
        
        // Apply column visibility settings after rendering
        const savedSettings = localStorage.getItem('columnVisibility');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.updateTableColumnVisibility(settings);
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Chưa có ngày';
        try {
            let date;
            // Handle different date formats
            if (dateString.includes('/')) {
                // Vietnamese format (dd/mm/yyyy)
                const [day, month, year] = dateString.split('/');
                date = new Date(year, month - 1, day);
            } else if (dateString.includes('-')) {
                // ISO format (yyyy-mm-dd)
                const [year, month, day] = dateString.split('-');
                date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                date = new Date(dateString);
            }
            if (isNaN(date.getTime())) {
                return 'Ngày không hợp lệ';
            }
            // Format as dd/mm/yyyy
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Ngày không hợp lệ';
        }
    }

    formatDateForPrint(dateString) {
        if (!dateString) return 'Chưa có ngày';
        
        try {
            let date;
            
            // Handle different date formats
            if (dateString.includes('/')) {
                // Vietnamese format (dd/mm/yyyy)
                const [day, month, year] = dateString.split('/');
                date = new Date(year, month - 1, day);
            } else if (dateString.includes('-')) {
                // ISO format (yyyy-mm-dd) - create date without timezone conversion
                const [year, month, day] = dateString.split('-');
                date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                // Fallback to standard Date constructor
                date = new Date(dateString);
            }
            
            // Check if the date is valid
            if (isNaN(date.getTime())) {
                return 'Ngày không hợp lệ';
            }
            
            // Format as dd/mm/yyyy
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.error('Error formatting date for print:', error);
            return 'Ngày không hợp lệ';
        }
    }

    formatVND(amount) {
        if (amount === 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatNumberWithCommas(number) {
        if (!number && number !== 0) return '';
        const numStr = number.toString();
        return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    parseFormattedPrice(priceString) {
        if (!priceString) return 0;
        return parseInt(priceString.replace(/,/g, '')) || 0;
    }

    calculateMonthsBetween(startDate, endDate) {
        const yearDiff = endDate.getFullYear() - startDate.getFullYear();
        const monthDiff = endDate.getMonth() - startDate.getMonth();
        return Math.max(1, yearDiff * 12 + monthDiff + 1); // At least 1 month
    }

    calculateNextReminderDate(rental) {
        // Validate date inputs
        if (!rental.dateIn) {
            return '<span style="color: #95a5a6;">Chưa có ngày</span>';
        }
        
        try {
            const dateIn = new Date(rental.dateIn);
            
            // Check if start date is valid
            if (isNaN(dateIn.getTime())) {
                return '<span style="color: #95a5a6;">Ngày không hợp lệ</span>';
            }
            
            const monthsPaid = rental.monthsPaid || 0;
            
            // Calculate next reminder date: Date In + (monthsPaid + 1) months (exact day of month)
            const nextReminderDate = new Date(dateIn);
            nextReminderDate.setMonth(nextReminderDate.getMonth() + (monthsPaid + 1));
            
            // Check if rental is fully paid
            if (rental.paid) {
                return '<span style="color: #27ae60; font-weight: 500;">Đã Thanh Toán ✓</span>';
            }
            
            // For open-ended rentals, check if next reminder date is past current date
            if (rental.isOpenEnded) {
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
                nextReminderDate.setHours(0, 0, 0, 0);
                
                if (nextReminderDate < today) {
                    return `<span style="color: #e74c3c; font-weight: 500;">⚠️ ${this.formatDate(nextReminderDate.toISOString().split('T')[0])}</span>`;
                } else if (nextReminderDate.getTime() === today.getTime()) {
                    return `<span style="color: #f39c12; font-weight: 500;">📅 Hôm Nay!</span>`;
                } else {
                    return `<span style="color: #3498db;">${this.formatDate(nextReminderDate.toISOString().split('T')[0])}</span>`;
                }
            } else {
                // For fixed-term rentals, check against end date
                if (!rental.dateOut) {
                    return '<span style="color: #95a5a6;">Chưa có ngày kết thúc</span>';
                }
                
                const dateOut = new Date(rental.dateOut);
                
                // Check if end date is valid
                if (isNaN(dateOut.getTime())) {
                    return '<span style="color: #95a5a6;">Ngày kết thúc không hợp lệ</span>';
                }
                
                // Check if next reminder date is past rental end date
                if (nextReminderDate > dateOut) {
                    return '<span style="color: #95a5a6;">Hết Hạn Thuê</span>';
                }
                
                // Check if reminder date is overdue (past today)
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
                nextReminderDate.setHours(0, 0, 0, 0);
                
                if (nextReminderDate < today) {
                    return `<span style="color: #e74c3c; font-weight: 500;">⚠️ ${this.formatDate(nextReminderDate.toISOString().split('T')[0])}</span>`;
                } else if (nextReminderDate.getTime() === today.getTime()) {
                    return `<span style="color: #f39c12; font-weight: 500;">📅 Hôm Nay!</span>`;
                } else {
                    return `<span style="color: #3498db;">${this.formatDate(nextReminderDate.toISOString().split('T')[0])}</span>`;
                }
            }
        } catch (error) {
            console.error('Error calculating next reminder date:', error);
            return '<span style="color: #95a5a6;">Lỗi tính toán</span>';
        }
    }

    autoCalculateOwed() {
        const priceValue = document.getElementById('price').value;
        const price = this.parseFormattedPrice(priceValue);
        const dateInStr = document.getElementById('dateIn').value;
        const isOpenEnded = this.openEndedCheckbox.checked;
        
        if (dateInStr && price > 0) {
            try {
                // Convert Vietnamese date format to Date objects
                let dateIn;
                
                if (dateInStr.includes('/')) {
                    const [day, month, year] = dateInStr.split('/');
                    dateIn = new Date(year, month - 1, day);
                } else {
                    dateIn = new Date(dateInStr);
                }
                
                // Validate start date
                if (isNaN(dateIn.getTime())) {
                    console.warn('Invalid start date in autoCalculateOwed');
                    return;
                }
                
                let totalOwed;
                
                if (isOpenEnded) {
                    // For open-ended rentals: calculate from start date to current date
                    const currentDate = new Date();
                    const monthsFromStart = this.calculateMonthsBetween(dateIn, currentDate);
                    totalOwed = price * Math.max(1, monthsFromStart); // At least 1 month
                } else {
                    // For fixed-term rentals: use end date
                    const dateOutStr = document.getElementById('dateOut').value;
                    if (!dateOutStr.trim()) {
                        return; // Can't calculate without end date
                    }
                    
                    let dateOut;
                    if (dateOutStr.includes('/')) {
                        const [day, month, year] = dateOutStr.split('/');
                        dateOut = new Date(year, month - 1, day);
                    } else {
                        dateOut = new Date(dateOutStr);
                    }
                    
                    // Validate end date
                    if (isNaN(dateOut.getTime())) {
                        console.warn('Invalid end date in autoCalculateOwed');
                        return;
                    }
                    
                    const totalMonths = this.calculateMonthsBetween(dateIn, dateOut);
                    totalOwed = price * totalMonths;
                }
                
                // Since payment details are managed through payment history, 
                // we'll set the amount owed to the full amount initially
                document.getElementById('amountOwed').value = totalOwed.toFixed(2);
            } catch (error) {
                console.error('Error in autoCalculateOwed:', error);
            }
        }
    }

    // Sorting functionality
    handleSort(field) {
        if (this.currentSort.field === field) {
            // Toggle direction if same field
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to ascending
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }
        
        this.updateSortIndicators();
        this.sortData();
        this.renderTable();
    }

    updateSortIndicators() {
        // Reset all indicators
        this.sortableHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Set current sort indicator
        const currentHeader = document.querySelector(`[data-sort="${this.currentSort.field}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${this.currentSort.direction}`);
        }
    }

    sortData() {
        this.filteredRentals.sort((a, b) => {
            let aValue = this.getSortValue(a, this.currentSort.field);
            let bValue = this.getSortValue(b, this.currentSort.field);
            
            // Handle different data types
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                // Use Vietnamese normalization for proper sorting
                aValue = this.normalizeVietnameseText(aValue);
                bValue = this.normalizeVietnameseText(bValue);
            }
            
            let result = 0;
            if (aValue < bValue) result = -1;
            else if (aValue > bValue) result = 1;
            
            return this.currentSort.direction === 'desc' ? -result : result;
        });
    }

    getSortValue(rental, field) {
        switch (field) {
            case 'id':
            case 'price':
            case 'monthsPaid':
            case 'amountOwed':
                return rental[field] || 0;
            case 'dateIn':
            case 'dateOut':
                return new Date(rental[field]);
            case 'nextReminder':
                return this.getNextReminderSortValue(rental);
            default:
                return rental[field] || '';
        }
    }

    getNextReminderSortValue(rental) {
        if (rental.paid) return new Date('9999-12-31'); // Fully paid goes to end
        
        try {
            // Validate date inputs
            if (!rental.dateIn) {
                return new Date('9999-12-29'); // Invalid dates go to end
            }
        
            const dateIn = new Date(rental.dateIn);
            
            // Check if start date is valid
            if (isNaN(dateIn.getTime())) {
                return new Date('9999-12-29'); // Invalid dates go to end
            }
            
            const monthsPaid = rental.monthsPaid || 0;
            
            const nextReminderDate = new Date(dateIn);
            nextReminderDate.setMonth(nextReminderDate.getMonth() + (monthsPaid + 1));
            
            if (rental.isOpenEnded) {
                // For open-ended rentals, use current date as limit
                const currentDate = new Date();
                if (nextReminderDate > currentDate) {
                    return new Date('9999-12-30'); // Future reminders go near end
                }
                return nextReminderDate;
            } else {
                // For fixed-term rentals, check against end date
                if (!rental.dateOut) {
                    return new Date('9999-12-29'); // No end date goes to end
                }
                
                const dateOut = new Date(rental.dateOut);
                
                // Check if end date is valid
                if (isNaN(dateOut.getTime())) {
                    return new Date('9999-12-29'); // Invalid end date goes to end
                }
                
                if (nextReminderDate > dateOut) {
                    return new Date('9999-12-30'); // Rental ended goes near end
                }
                
                return nextReminderDate;
            }
        } catch (error) {
            console.error('Error calculating next reminder sort value:', error);
            return new Date('9999-12-29'); // Error goes to end
        }
    }

    // Vietnamese text normalization function
    normalizeVietnameseText(text) {
        if (!text || typeof text !== 'string') return '';
        
        // Convert to string and lowercase first
        text = String(text).toLowerCase();
        
        // Use a more efficient approach with normalize() first, then manual mapping
        try {
            // Try Unicode normalization first (NFD - decomposed form)
            text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {
            // Fallback to manual replacement if normalize() fails
        }
        
        // Manual mapping for Vietnamese-specific characters that Unicode normalize might miss
        const vietnameseMap = {
            'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
            'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
            'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
            'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
            'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
            'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
            'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
            'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
            'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
            'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
            'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
            'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
            'đ': 'd'
        };
        
        // Replace each Vietnamese character with its base equivalent
        for (const [vietnamese, base] of Object.entries(vietnameseMap)) {
            text = text.replace(new RegExp(vietnamese, 'g'), base);
        }
        
        return text;
    }



    // Filtering functionality
    applyFilters() {
        let filtered = [...this.rentals];
        
        // Apply search filter
        const searchTerm = this.searchInput.value.trim();
        if (searchTerm) {
            const normalizedSearchTerm = this.normalizeVietnameseText(searchTerm);
            
            filtered = filtered.filter(rental => {
                // Create searchable text from all fields
                const searchableFields = [
                    rental.owner || '',
                    rental.plateNumber || '',
                    rental.driverAddress || '',
                    rental.phoneNumber || '',
                    rental.carModel || '',
                    rental.parkingArea || '',
                    rental.paymentMethod || '',
                    rental.notes || ''
                ];
                
                // Normalize and check each field
                const matches = searchableFields.some(field => {
                    const normalizedField = this.normalizeVietnameseText(field);
                    return normalizedField.includes(normalizedSearchTerm);
                });
                
                return matches;
            });
        }
        
        // Apply status filter
        const statusFilter = this.statusFilter.value;
        if (statusFilter) {
            filtered = filtered.filter(rental => {
                return statusFilter === 'paid' ? rental.paid : !rental.paid;
            });
        }
        
        // Apply reminder filter
        const reminderFilter = this.reminderFilter.value;
        if (reminderFilter) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            filtered = filtered.filter(rental => {
                if (rental.paid) return false; // Skip fully paid
                
                const dateIn = new Date(rental.dateIn);
                const dateOut = new Date(rental.dateOut);
                const monthsPaid = rental.monthsPaid || 0;
                
                const nextReminderDate = new Date(dateIn);
                nextReminderDate.setMonth(nextReminderDate.getMonth() + (monthsPaid + 1));
                nextReminderDate.setHours(0, 0, 0, 0);
                
                if (nextReminderDate > dateOut) return false; // Rental ended
                
                switch (reminderFilter) {
                    case 'overdue':
                        return nextReminderDate < today;
                    case 'today':
                        return nextReminderDate.getTime() === today.getTime();
                    case 'upcoming':
                        return nextReminderDate > today;
                    default:
                        return true;
                }
            });
        }
        
        this.filteredRentals = filtered;
        this.sortData();
        this.renderTable();
    }

    clearSearch() {
        this.searchInput.value = '';
        this.statusFilter.value = '';
        this.reminderFilter.value = '';
        this.applyFilters();
    }

    // Financial Report Methods
    openReportModal() {
        this.generateFinancialReport();
        this.reportModal.style.display = 'block';
    }

    closeReportModal() {
        this.reportModal.style.display = 'none';
    }

    calculateFinancialStats() {
        const stats = {
            // Basic customer stats
            totalCustomers: this.rentals.length,
            fullyPaidCustomers: 0,
            customersWithDebt: 0,
            activeCustomers: 0,
            inactiveCustomers: 0,
            
            // Revenue stats
            totalRevenue: 0,
            totalPaidCash: 0,
            totalPaidBank: 0,
            totalDebt: 0,
            potentialRevenue: 0,
            
            // Transaction stats
            cashTransactions: 0,
            bankTransactions: 0,
            totalTransactions: 0,
            averageTransactionAmount: 0,
            largestTransaction: 0,
            smallestTransaction: 0,
            
            // Time-based stats
            thisMonthRevenue: 0,
            lastMonthRevenue: 0,
            thisYearRevenue: 0,
            recentPayments: 0,
            
            // Customer value stats
            averageCustomerValue: 0,
            topCustomerValue: 0,
            customerRetentionRate: 0,
            
            // Payment method stats
            cashPercentage: 0,
            bankPercentage: 0,
            preferredPaymentMethod: '',
            
            // Debt analysis
            averageDebtAmount: 0,
            highestDebtAmount: 0,
            debtToRevenueRatio: 0,
            
            // Performance metrics
            collectionEfficiency: 0,
            revenueGrowth: 0,
            customerGrowth: 0
        };

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const allPayments = [];
        const customerValues = new Map();
        const monthlyRevenue = new Map();
        const debtAmounts = [];

        // Calculate statistics from actual payment records
        this.rentals.forEach(rental => {
            const amountOwed = rental.amountOwed || 0;
            const monthlyPrice = rental.price || 0;
            const startDate = new Date(rental.startDate);
            const endDate = rental.endDate ? new Date(rental.endDate) : null;
            
            // Track customer status
            if (rental.paid) {
                stats.fullyPaidCustomers++;
            }
            if (amountOwed > 0) {
                stats.customersWithDebt++;
                stats.totalDebt += amountOwed;
                debtAmounts.push(amountOwed);
            }
            
            // Determine if customer is active (has recent activity or is current)
            const isActive = !endDate || endDate > currentDate || 
                           (rental.lastPaymentDate && new Date(rental.lastPaymentDate) > new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000));
            
            if (isActive) {
                stats.activeCustomers++;
            } else {
                stats.inactiveCustomers++;
            }
            
            // Calculate potential revenue
            const monthsSinceStart = this.calculateMonthsBetween(startDate, currentDate);
            const potentialRevenue = monthlyPrice * monthsSinceStart;
            stats.potentialRevenue += potentialRevenue;
            
            // Get payment history for this rental
            const payments = this.dbManager.getPaymentHistory(rental.id);
            let customerTotalPaid = 0;
            
            // Calculate totals from actual payment records
            payments.forEach(payment => {
                const amount = payment.amount_paid || 0;
                const method = payment.payment_method || 'Tiền mặt';
                const paymentDate = new Date(payment.payment_date);
                
                stats.totalRevenue += amount;
                customerTotalPaid += amount;
                allPayments.push({ amount, method, date: paymentDate });
                
                // Track largest and smallest transactions
                if (amount > stats.largestTransaction) stats.largestTransaction = amount;
                if (stats.smallestTransaction === 0 || amount < stats.smallestTransaction) {
                    stats.smallestTransaction = amount;
                }
            
            // Categorize by payment method
                if (method === 'Chuyển khoản') {
                    stats.totalPaidBank += amount;
                    stats.bankTransactions++;
            } else {
                    stats.totalPaidCash += amount;
                    stats.cashTransactions++;
                }
                
                // Time-based analysis
                const paymentMonth = paymentDate.getMonth();
                const paymentYear = paymentDate.getFullYear();
                
                if (paymentMonth === currentMonth && paymentYear === currentYear) {
                    stats.thisMonthRevenue += amount;
                }
                if (paymentMonth === lastMonth && paymentYear === lastMonthYear) {
                    stats.lastMonthRevenue += amount;
                }
                if (paymentYear === currentYear) {
                    stats.thisYearRevenue += amount;
                }
                
                // Recent payments (last 30 days)
                const daysSincePayment = (currentDate - paymentDate) / (1000 * 60 * 60 * 24);
                if (daysSincePayment <= 30) {
                    stats.recentPayments++;
                }
                
                // Monthly revenue tracking
                const monthKey = `${paymentYear}-${paymentMonth + 1}`;
                monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + amount);
            });
            
            // Track customer value
            customerValues.set(rental.id, customerTotalPaid);
        });

        // Calculate derived statistics
        stats.totalTransactions = stats.cashTransactions + stats.bankTransactions;
        stats.averageTransactionAmount = stats.totalTransactions > 0 ? stats.totalRevenue / stats.totalTransactions : 0;
        stats.averageCustomerValue = stats.totalCustomers > 0 ? stats.totalRevenue / stats.totalCustomers : 0;
        stats.topCustomerValue = Math.max(...customerValues.values());
        stats.averageDebtAmount = debtAmounts.length > 0 ? stats.totalDebt / debtAmounts.length : 0;
        stats.highestDebtAmount = debtAmounts.length > 0 ? Math.max(...debtAmounts) : 0;
        stats.debtToRevenueRatio = stats.totalRevenue > 0 ? (stats.totalDebt / stats.totalRevenue) * 100 : 0;
        stats.collectionEfficiency = stats.potentialRevenue > 0 ? (stats.totalRevenue / stats.potentialRevenue) * 100 : 0;
        
        // Payment method percentages
        stats.cashPercentage = stats.totalRevenue > 0 ? (stats.totalPaidCash / stats.totalRevenue) * 100 : 0;
        stats.bankPercentage = stats.totalRevenue > 0 ? (stats.totalPaidBank / stats.totalRevenue) * 100 : 0;
        stats.preferredPaymentMethod = stats.cashPercentage > stats.bankPercentage ? 'Tiền mặt' : 'Chuyển khoản';
        
        // Revenue growth (this month vs last month)
        stats.revenueGrowth = stats.lastMonthRevenue > 0 ? 
            ((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100 : 0;
        
        // Customer retention (active customers / total customers)
        stats.customerRetentionRate = stats.totalCustomers > 0 ? (stats.activeCustomers / stats.totalCustomers) * 100 : 0;

        return stats;
    }

    generateFinancialReport() {
        const stats = this.calculateFinancialStats();
        const currentDate = new Date().toLocaleDateString('vi-VN');
        
        this.reportContent.innerHTML = `
            <div class="report-header">
                <h3>🏢 BÃI GỬI XE THÀNH ĐẠT</h3>
                <p class="report-date">Ngày tạo báo cáo: ${currentDate}</p>
            </div>
            
            <div class="report-section">
                <h4>👥 Thống Kê Khách Hàng</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalCustomers}</div>
                        <div class="stat-label">Tổng số khách hàng</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-number">${stats.activeCustomers}</div>
                        <div class="stat-label">Khách hàng đang hoạt động</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-number">${stats.fullyPaidCustomers}</div>
                        <div class="stat-label">Đã thanh toán đủ</div>
                    </div>
                    <div class="stat-card danger">
                        <div class="stat-number">${stats.customersWithDebt}</div>
                        <div class="stat-label">Còn nợ tiền</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>💰 Thống Kê Doanh Thu</h4>
                <div class="stats-grid">
                    <div class="stat-card primary">
                        <div class="stat-number">${this.formatVND(stats.totalRevenue)}</div>
                        <div class="stat-label">Tổng doanh thu đã thu</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-number">${this.formatVND(stats.thisMonthRevenue)}</div>
                        <div class="stat-label">Doanh thu tháng này</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-number">${this.formatVND(stats.thisYearRevenue)}</div>
                        <div class="stat-label">Doanh thu năm ${new Date().getFullYear()}</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-number">${this.formatVND(stats.potentialRevenue)}</div>
                        <div class="stat-label">Doanh thu tiềm năng</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>💳 Phân Tích Thanh Toán</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${stats.cashTransactions}</div>
                        <div class="stat-label">Giao dịch tiền mặt</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.bankTransactions}</div>
                        <div class="stat-label">Giao dịch chuyển khoản</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalTransactions}</div>
                        <div class="stat-label">Tổng số giao dịch</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.recentPayments}</div>
                        <div class="stat-label">Giao dịch 30 ngày qua</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>💵 Chi Tiết Thanh Toán</h4>
                <div class="stats-grid">
                    <div class="stat-card info">
                        <div class="stat-number">${this.formatVND(stats.totalPaidCash)}</div>
                        <div class="stat-label">Thu bằng tiền mặt</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-number">${this.formatVND(stats.totalPaidBank)}</div>
                        <div class="stat-label">Thu bằng chuyển khoản</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.formatVND(stats.averageTransactionAmount)}</div>
                        <div class="stat-label">Trung bình/giao dịch</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.formatVND(stats.largestTransaction)}</div>
                        <div class="stat-label">Giao dịch lớn nhất</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>📊 Phân Tích Nợ</h4>
                <div class="stats-grid">
                    <div class="stat-card danger">
                        <div class="stat-number">${this.formatVND(stats.totalDebt)}</div>
                        <div class="stat-label">Tổng số tiền nợ</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-number">${this.formatVND(stats.averageDebtAmount)}</div>
                        <div class="stat-label">Nợ trung bình/khách</div>
                    </div>
                    <div class="stat-card danger">
                        <div class="stat-number">${this.formatVND(stats.highestDebtAmount)}</div>
                        <div class="stat-label">Nợ cao nhất</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.debtToRevenueRatio.toFixed(1)}%</div>
                        <div class="stat-label">Tỷ lệ nợ/doanh thu</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>📈 Hiệu Suất Kinh Doanh</h4>
                <div class="stats-grid">
                    <div class="stat-card success">
                        <div class="stat-number">${stats.collectionEfficiency.toFixed(1)}%</div>
                        <div class="stat-label">Hiệu suất thu tiền</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.customerRetentionRate.toFixed(1)}%</div>
                        <div class="stat-label">Tỷ lệ giữ chân khách</div>
                    </div>
                    <div class="stat-card ${stats.revenueGrowth >= 0 ? 'success' : 'danger'}">
                        <div class="stat-number">${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}%</div>
                        <div class="stat-label">Tăng trưởng doanh thu</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.formatVND(stats.averageCustomerValue)}</div>
                        <div class="stat-label">Giá trị khách hàng TB</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>📊 Tỷ Lệ Phần Trăm</h4>
                <div class="percentage-stats">
                    <div class="percentage-item">
                        <span class="percentage-label">Khách hàng đã thanh toán đủ:</span>
                        <span class="percentage-value">${stats.totalCustomers > 0 ? ((stats.fullyPaidCustomers / stats.totalCustomers) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div class="percentage-item">
                        <span class="percentage-label">Khách hàng đang hoạt động:</span>
                        <span class="percentage-value">${stats.customerRetentionRate.toFixed(1)}%</span>
                    </div>
                    <div class="percentage-item">
                        <span class="percentage-label">Thanh toán bằng tiền mặt:</span>
                        <span class="percentage-value">${stats.cashPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="percentage-item">
                        <span class="percentage-label">Thanh toán bằng chuyển khoản:</span>
                        <span class="percentage-value">${stats.bankPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="percentage-item">
                        <span class="percentage-label">Phương thức ưa chuộng:</span>
                        <span class="percentage-value">${stats.preferredPaymentMethod}</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>🎯 Thông Tin Bổ Sung</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">📅 Tháng hiện tại:</span>
                        <span class="info-value">${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💰 Doanh thu tháng trước:</span>
                        <span class="info-value">${this.formatVND(stats.lastMonthRevenue)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">👑 Khách hàng giá trị nhất:</span>
                        <span class="info-value">${this.formatVND(stats.topCustomerValue)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💳 Giao dịch nhỏ nhất:</span>
                        <span class="info-value">${this.formatVND(stats.smallestTransaction)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    printReport() {
        const printWindow = window.open('', '_blank');
        const reportContent = this.reportContent.innerHTML;
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Báo Cáo Tài Chính - Bãi Gửi Xe Thành Đạt</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .report-header { text-align: center; margin-bottom: 30px; }
                    .report-header h3 { color: #2c3e50; margin: 0; }
                    .report-date { color: #7f8c8d; margin: 5px 0; }
                    .report-section { margin: 20px 0; page-break-inside: avoid; }
                    .report-section h4 { color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
                    .stat-card { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 5px; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
                    .stat-label { font-size: 12px; color: #7f8c8d; margin-top: 5px; }
                    .percentage-stats { margin: 15px 0; }
                    .percentage-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1; }
                    .percentage-label { font-weight: 500; }
                    .percentage-value { font-weight: bold; color: #3498db; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    }

    exportReportToCSV() {
        const stats = this.calculateFinancialStats();
        const currentDate = new Date().toLocaleDateString('vi-VN');
        
        let csv = 'Báo Cáo Tài Chính - Bãi Gửi Xe Thành Đạt\n';
        csv += `Ngày tạo,${currentDate}\n\n`;
        
        csv += 'Loại Thống Kê,Giá Trị\n';
        
        // Customer Statistics
        csv += '=== THỐNG KÊ KHÁCH HÀNG ===\n';
        csv += `Tổng số khách hàng,${stats.totalCustomers}\n`;
        csv += `Khách hàng đang hoạt động,${stats.activeCustomers}\n`;
        csv += `Khách hàng đã thanh toán đủ,${stats.fullyPaidCustomers}\n`;
        csv += `Khách hàng còn nợ,${stats.customersWithDebt}\n`;
        csv += `Tỷ lệ giữ chân khách,${stats.customerRetentionRate.toFixed(1)}%\n`;
        
        // Revenue Statistics
        csv += '\n=== THỐNG KÊ DOANH THU ===\n';
        csv += `Tổng doanh thu,${stats.totalRevenue}\n`;
        csv += `Doanh thu tháng này,${stats.thisMonthRevenue}\n`;
        csv += `Doanh thu tháng trước,${stats.lastMonthRevenue}\n`;
        csv += `Doanh thu năm ${new Date().getFullYear()},${stats.thisYearRevenue}\n`;
        csv += `Doanh thu tiềm năng,${stats.potentialRevenue}\n`;
        csv += `Tăng trưởng doanh thu,${stats.revenueGrowth.toFixed(1)}%\n`;
        
        // Payment Statistics
        csv += '\n=== THỐNG KÊ THANH TOÁN ===\n';
        csv += `Thu bằng tiền mặt,${stats.totalPaidCash}\n`;
        csv += `Thu bằng chuyển khoản,${stats.totalPaidBank}\n`;
        csv += `Giao dịch tiền mặt,${stats.cashTransactions}\n`;
        csv += `Giao dịch chuyển khoản,${stats.bankTransactions}\n`;
        csv += `Tổng số giao dịch,${stats.totalTransactions}\n`;
        csv += `Giao dịch 30 ngày qua,${stats.recentPayments}\n`;
        csv += `Trung bình/giao dịch,${stats.averageTransactionAmount.toFixed(0)}\n`;
        csv += `Giao dịch lớn nhất,${stats.largestTransaction}\n`;
        csv += `Giao dịch nhỏ nhất,${stats.smallestTransaction}\n`;
        csv += `Tỷ lệ thanh toán tiền mặt,${stats.cashPercentage.toFixed(1)}%\n`;
        csv += `Tỷ lệ thanh toán chuyển khoản,${stats.bankPercentage.toFixed(1)}%\n`;
        csv += `Phương thức ưa chuộng,${stats.preferredPaymentMethod}\n`;
        
        // Debt Analysis
        csv += '\n=== PHÂN TÍCH NỢ ===\n';
        csv += `Tổng số tiền nợ,${stats.totalDebt}\n`;
        csv += `Nợ trung bình/khách,${stats.averageDebtAmount.toFixed(0)}\n`;
        csv += `Nợ cao nhất,${stats.highestDebtAmount}\n`;
        csv += `Tỷ lệ nợ/doanh thu,${stats.debtToRevenueRatio.toFixed(1)}%\n`;
        
        // Performance Metrics
        csv += '\n=== HIỆU SUẤT KINH DOANH ===\n';
        csv += `Hiệu suất thu tiền,${stats.collectionEfficiency.toFixed(1)}%\n`;
        csv += `Giá trị khách hàng TB,${stats.averageCustomerValue.toFixed(0)}\n`;
        csv += `Khách hàng giá trị nhất,${stats.topCustomerValue}\n`;
        
        // Percentages
        csv += '\n=== TỶ LỆ PHẦN TRĂM ===\n';
        csv += `Khách hàng đã thanh toán đủ,${stats.totalCustomers > 0 ? ((stats.fullyPaidCustomers / stats.totalCustomers) * 100).toFixed(1) : 0}%\n`;
        csv += `Khách hàng đang hoạt động,${stats.customerRetentionRate.toFixed(1)}%\n`;
        csv += `Thanh toán bằng tiền mặt,${stats.cashPercentage.toFixed(1)}%\n`;
        csv += `Thanh toán bằng chuyển khoản,${stats.bankPercentage.toFixed(1)}%\n`;
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bao_cao_tai_chinh_${currentDate.replace(/\//g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    exportDatabase() {
        if (!this.isInitialized) {
            this.showError('Database not initialized');
            return;
        }
        
        const success = this.dbManager.exportDatabase();
        if (success) {
            this.showMessage('Xuất database thành công!');
        } else {
            this.showError('Xuất database thất bại!');
        }
    }

    async importDatabase(event) {
        const file = event.target.files[0];
        if (file) {
            const success = await this.dbManager.importDatabase(file);
            if (success) {
                this.refreshData();
                this.applyFilters();
                this.showMessage('Database imported successfully!');
            } else {
                this.showError('Failed to import database');
            }
        }
    }

    showMessage(message, isError = false) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${isError ? '#e74c3c' : '#27ae60'};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Fade in
        setTimeout(() => toast.style.opacity = '1', 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    showError(message) {
        this.showMessage(message, true);
    }

    // Invoice Methods
    openInvoiceModal(rental) {
        // Hide the reprint banner (this is a new invoice, not a reprint)
        document.getElementById('reprintBanner').style.display = 'none';
        
        this.populateInvoice(rental);
        this.invoiceModal.style.display = 'block';
    }

    closeInvoiceModal() {
        this.invoiceModal.style.display = 'none';
        // Hide the reprint banner when closing
        document.getElementById('reprintBanner').style.display = 'none';
        
        // If payment history modal is open, ensure it remains focused
        if (this.paymentHistoryModal && this.paymentHistoryModal.style.display === 'block') {
            setTimeout(() => {
                this.paymentHistoryModal.focus();
            }, 100);
        }
    }

    populateInvoice(rental) {
        // Populate customer information
        document.getElementById('invoiceCustomerName').textContent = rental.owner;
        document.getElementById('invoicePlateNumber').textContent = rental.plateNumber;
        document.getElementById('invoiceCarModel').textContent = rental.carModel;
        document.getElementById('invoiceAddress').textContent = rental.driverAddress || '';
        
        // Set payment amount and period based on rental data
        const totalPaid = (rental.price || 0) * (rental.monthsPaid || 0);
        document.getElementById('invoiceAmount').textContent = this.formatVND(totalPaid).replace('₫', '');
        document.getElementById('invoiceAmountText').textContent = this.numberToWords(totalPaid);
        document.getElementById('invoicePeriod').textContent = this.formatInvoicePeriod(rental);
        
        // Calculate and display date periods
        const datePeriods = this.calculateInvoicePeriods(rental);
        if (datePeriods.length > 0) {
            const periodsText = datePeriods.map(period => 
                `TỪ ${period.startDate} ĐẾN ${period.endDate}`
            ).join(' + ');
            document.getElementById('invoiceDatePeriods').textContent = periodsText;
        } else {
            document.getElementById('invoiceDatePeriods').textContent = 'CHƯA CÓ THÔNG TIN';
        }
        

        
        // Set current date for invoice generation
        // Set current date for invoice generation
        document.getElementById('invoiceDate').textContent = this.formatVietnameseDateForInvoice();
    }

    formatInvoicePeriod(rental) {
        if (!rental.monthsPaidDetails || rental.monthsPaidDetails.trim() === '') {
            // If no detailed payment info, generate based on months paid
            const monthsPaid = rental.monthsPaid || 0;
            if (monthsPaid === 0) return 'CHƯA THANH TOÁN';
            
            const dateIn = new Date(rental.dateIn);
            const months = [];
            
            for (let i = 0; i < monthsPaid; i++) {
                const month = new Date(dateIn);
                month.setMonth(month.getMonth() + i);
                const monthNum = String(month.getMonth() + 1).padStart(2, '0');
                const year = month.getFullYear();
                months.push(`${monthNum}/${year}`);
            }
            
            return `${months.join('+')}`;
        } else {
            // Use the detailed payment information and expand to individual months
            return this.expandMonthsForDisplay(rental.monthsPaidDetails);
        }
    }







    printInvoice() {
        const invoiceContent = document.getElementById('invoiceContainer').innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Phiếu Thu Gửi Xe Ô Tô</title>
                <style>
                    @page {
                        size: A5 landscape;
                        margin: 5mm;
                    }
                    
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none !important; }
                    }
                    
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Times New Roman', serif;
                        font-size: 14px;
                        line-height: 1.4;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    
                    .invoice-container {
                        background: white;
                        padding: 15px;
                        width: 100%;
                        max-width: 100%;
                        margin: 0 auto;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 8px;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                        flex-shrink: 0;
                    }
                    
                    .company-info h2 {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 0 0 5px 0;
                        color: #000;
                        text-transform: uppercase;
                    }
                    
                    .company-info p {
                        margin: 2px 0;
                        font-size: 12px;
                        color: #333;
                    }
                    
                    .invoice-title {
                        text-align: center;
                        flex-grow: 1;
                        margin: 0 10px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                    }
                    
                    .invoice-title h1 {
                        font-size: 22px;
                        font-weight: bold;
                        margin: 0;
                        color: #000;
                        text-align: center;
                        width: 100%;
                        text-transform: uppercase;
                    }
                    
                    .subtitle {
                        font-size: 14px;
                        margin: 3px 0 0 0;
                        font-style: italic;
                        text-align: center;
                        width: 100%;
                        color: #666;
                    }
                    
                    .invoice-content {
                        margin: 8px 0 5px 0;
                        flex-grow: 1;
                    }
                    
                    .invoice-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 4px;
                        border-bottom: 1px solid #ccc;
                        padding-bottom: 2px;
                    }
                    
                    .invoice-row:last-child {
                        margin-bottom: 3px;
                    }
                    
                    .invoice-row .label {
                        font-weight: bold;
                        width: 35%;
                        flex-shrink: 0;
                        font-size: 13px;
                        color: #333;
                        text-align: left;
                    }
                    
                    .invoice-row .value {
                        text-align: center;
                        width: 60%;
                        font-weight: normal;
                        font-size: 13px;
                        color: #000;
                    }
                    
                    .invoice-row .value.amount {
                        font-size: 16px;
                        font-weight: bold;
                        color: #000;
                    }
                    
                    .amount-text {
                        margin: 8px 0 6px 0;
                        text-align: center;
                        font-size: 12px;
                    }
                    
                    .amount-text em {
                        font-style: italic;
                        color: #666;
                    }
                    
                    .invoice-footer {
                        margin-top: 8px;
                        border-top: 1px solid #000;
                        padding-top: 5px;
                        flex-shrink: 0;
                    }
                    
                    .signature-section {
                        margin-bottom: 8px;
                    }
                    
                    .signature-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                    }
                    
                    .payer-section,
                    .receiver-section {
                        text-align: center;
                        width: 45%;
                    }
                    
                    .signature-title {
                        margin: 5px 0;
                        font-weight: bold;
                        font-size: 14px;
                        text-transform: uppercase;
                    }
                    
                    .signature-date {
                        margin: 0 0 5px 0;
                        font-size: 12px;
                        font-weight: normal;
                        text-align: center;
                        color: #666;
                    }
                    
                    .signature-spacer {
                        height: 8px;
                        margin: 0 0 3px 0;
                    }
                    
                    .signature-space {
                        height: 40px;
                        margin: 4px 0;
                        width: 100%;
                    }
                    
                    .signature-note {
                        font-size: 12px !important;
                        font-weight: normal !important;
                        font-style: italic;
                        margin: 5px 0 !important;
                        color: #666;
                    }
                    
                    .invoice-notes {
                        margin-top: 12px;
                        border-top: 1px solid #000;
                        padding-top: 8px;
                    }
                    
                    .invoice-notes p {
                        font-size: 11px;
                        line-height: 1.4;
                        margin: 4px 0;
                    }
                    
                    .invoice-notes p:first-child {
                        font-weight: bold;
                        margin-bottom: 6px;
                        font-size: 11px;
                    }
                    
                    /* Hide calculation section in print */
                    .invoice-calculation {
                        display: none !important;
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    ${invoiceContent}
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    }

    // Column Visibility Methods
    openColumnVisibilityModal() {
        this.loadColumnVisibilitySettings();
        this.columnVisibilityModal.style.display = 'block';
    }

    closeColumnVisibilityModal() {
        this.columnVisibilityModal.style.display = 'none';
    }

    loadColumnVisibilitySettings() {
        // Load saved settings from localStorage
        const savedSettings = localStorage.getItem('columnVisibility');
        const settings = savedSettings ? JSON.parse(savedSettings) : this.getDefaultColumnSettings();
        
        // Update checkboxes to match saved settings
        this.columnCheckboxes.forEach(checkbox => {
            const columnIndex = parseInt(checkbox.dataset.column);
            checkbox.checked = settings[columnIndex] !== false;
        });
    }

    getDefaultColumnSettings() {
        // Default: show all columns except some optional ones
        return {
            1: true,  // ID
            2: true,  // Chủ Xe
            3: true,  // Địa Chỉ
            4: true,  // Số Điện Thoại
            5: true,  // Loại Xe
            6: true,  // Biển Số
            7: true,  // Khu Vực
            8: true,  // Ngày Vào
            9: true,  // Ngày Ra
            10: true, // Ngày Nhắc Nhở
            11: true, // Giá Thuê
            12: true, // Tháng Đã Trả
            13: false, // Chi Tiết Thanh Toán (hidden by default)
            14: true, // Số Tiền Nợ
            15: true, // Trạng Thái
            16: false, // Ghi Chú (hidden by default)
            17: true  // Thao Tác
        };
    }

    showAllColumns() {
        this.columnCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    hideAllColumns() {
        this.columnCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        // Always keep actions column visible
        const actionsCheckbox = document.querySelector('input[data-column="17"]');
        if (actionsCheckbox) actionsCheckbox.checked = true;
    }

    resetToDefaultColumns() {
        const defaultSettings = this.getDefaultColumnSettings();
        this.columnCheckboxes.forEach(checkbox => {
            const columnIndex = parseInt(checkbox.dataset.column);
            checkbox.checked = defaultSettings[columnIndex] !== false;
        });
    }

    applyColumnChanges() {
        const settings = {};
        
        // Collect current checkbox states
        this.columnCheckboxes.forEach(checkbox => {
            const columnIndex = parseInt(checkbox.dataset.column);
            settings[columnIndex] = checkbox.checked;
        });
        
        // Save to localStorage
        localStorage.setItem('columnVisibility', JSON.stringify(settings));
        
        // Apply changes to table
        this.updateTableColumnVisibility(settings);
        
        // Close modal
        this.closeColumnVisibilityModal();
    }

    updateTableColumnVisibility(settings) {
        const table = document.getElementById('dataTable');
        if (!table) return;

        // Update header columns
        const headerCells = table.querySelectorAll('thead th');
        headerCells.forEach((cell, index) => {
            const columnIndex = index + 1;
            if (settings[columnIndex] === false) {
                cell.classList.add('hidden-column');
            } else {
                cell.classList.remove('hidden-column');
            }
        });

        // Update data columns
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                const columnIndex = index + 1;
                if (settings[columnIndex] === false) {
                    cell.classList.add('hidden-column');
                } else {
                    cell.classList.remove('hidden-column');
                }
            });
        });
    }

    initializeColumnVisibility() {
        // Load and apply saved column visibility settings on app start
        const savedSettings = localStorage.getItem('columnVisibility');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.updateTableColumnVisibility(settings);
        } else {
            // Apply default settings
            const defaultSettings = this.getDefaultColumnSettings();
            this.updateTableColumnVisibility(defaultSettings);
            localStorage.setItem('columnVisibility', JSON.stringify(defaultSettings));
        }
    }

    // Payment History Methods
    openPaymentHistoryModal(rentalId) {
        this.currentRentalId = rentalId;
        
        // Find the rental data
        const rental = this.rentals.find(r => r.id === rentalId);
        if (!rental) {
            this.showError('Không tìm thấy thông tin hợp đồng!');
            return;
        }

        // Populate customer info
        document.getElementById('historyCustomerName').textContent = rental.owner;
        document.getElementById('historyPlateNumber').textContent = rental.plateNumber;
        document.getElementById('historyCarModel').textContent = rental.carModel;
        document.getElementById('historyMonthlyRate').textContent = this.formatVND(rental.price);

        // Load and display payment history
        this.loadPaymentHistory(rentalId);
        
        // Show modal
        this.paymentHistoryModal.style.display = 'block';
    }

    closePaymentHistoryModal() {
        this.paymentHistoryModal.style.display = 'none';
        this.currentRentalId = null;
    }

    loadPaymentHistory(rentalId) {
        const rental = this.rentals.find(r => r.id === rentalId);
        if (!rental) {
            console.error('Rental not found for ID:', rentalId);
            return;
        }
        
        // Populate customer information
        document.getElementById('historyCustomerName').textContent = rental.owner;
        document.getElementById('historyPlateNumber').textContent = rental.plateNumber;
        document.getElementById('historyCarModel').textContent = rental.carModel;
        document.getElementById('historyMonthlyRate').textContent = this.formatVND(rental.price);
        
        // Add rental type indicator to payment history modal
        const customerInfo = document.querySelector('.customer-info');
        let rentalTypeIndicator = customerInfo.querySelector('.rental-type-indicator');
        
        if (!rentalTypeIndicator) {
            rentalTypeIndicator = document.createElement('div');
            rentalTypeIndicator.className = 'rental-type-indicator';
            customerInfo.appendChild(rentalTypeIndicator);
        }
        
        if (rental.isOpenEnded) {
            rentalTypeIndicator.innerHTML = '<span class="open-ended-badge">🔄 Thuê không thời hạn</span>';
            rentalTypeIndicator.style.display = 'block';
        } else {
            rentalTypeIndicator.style.display = 'none';
        }
        
        // Load payment history
        const payments = this.dbManager.getPaymentHistory(rentalId);
        const paymentList = document.getElementById('paymentHistoryList');
        
        if (payments.length === 0) {
            paymentList.innerHTML = `
                <div class="empty-payment-message">
                    <p>Chưa có lịch sử thanh toán nào.</p>
                    <p>Nhấn "Thêm Thanh Toán" để bắt đầu.</p>
                </div>
            `;
        } else {
            paymentList.innerHTML = '';
            // Debug: Log the payments to see the actual data structure
            console.log('Original payments:', payments);
            
            // Simple reverse sort - just reverse the array to show newest first
            const sortedPayments = [...payments].reverse();
            
            console.log('Sorted payments:', sortedPayments);
            sortedPayments.forEach(payment => {
                const paymentItem = document.createElement('div');
                paymentItem.className = 'payment-item';
                
                const paymentDate = this.formatDate(payment.payment_date);
                const amountPaid = this.formatVND(payment.amount_paid);
                const monthsCovered = this.expandMonthsForDisplay(payment.months_covered);
                const paymentMethod = payment.payment_method || 'Tiền mặt';
                
                paymentItem.innerHTML = `
                    <div class="payment-info">
                        <div class="payment-date">📅 ${paymentDate}</div>
                        <div class="payment-amount ${payment.amount_paid < 0 ? 'refund-amount' : ''}">💰 ${amountPaid}</div>
                        <div class="payment-months">📋 ${monthsCovered}</div>
                        <div class="payment-method ${paymentMethod === 'Tiền mặt' ? 'cash' : 'bank'}">
                            ${paymentMethod === 'Tiền mặt' ? '💵' : '🏦'} ${paymentMethod}
                        </div>
                        ${payment.amount_paid < 0 && !payment.refund_fulfilled ? 
                            '<div class="refund-status">🔄 Chưa hoàn tiền</div>' : 
                            payment.amount_paid < 0 && payment.refund_fulfilled ? 
                            '<div class="refund-status fulfilled">✅ Đã hoàn tiền</div>' : ''
                        }
                    </div>
                    <div class="payment-actions">
                        <button class="edit-payment-btn" onclick="app.editPayment(${payment.id})">
                            ✏️ Sửa
                        </button>
                        <button class="print-invoice-small-btn" onclick="app.printPaymentInvoice(${payment.id})">
                            🖨️ In Phiếu
                        </button>
                        ${payment.amount_paid < 0 && !payment.refund_fulfilled ? 
                            `<button class="fulfill-refund-btn" onclick="app.markRefundAsFulfilled(${payment.id})">
                                ✅ Hoàn Tiền
                            </button>` : ''
                        }
                        <button class="delete-payment-btn" onclick="app.deletePayment(${payment.id})">
                            🗑️ Xóa
                        </button>
                    </div>
                `;
                
                paymentList.appendChild(paymentItem);
            });
        }
        
        this.paymentHistoryModal.style.display = 'block';
    }

    openAddPaymentModal() {
        if (!this.currentRentalId) {
            console.error('No currentRentalId set');
            this.showError('Không tìm thấy thông tin hợp đồng!');
            return;
        }
        
        const rental = this.rentals.find(r => r.id === this.currentRentalId);
        if (!rental) {
            console.error('Rental not found for ID:', this.currentRentalId);
            this.showError('Không tìm thấy thông tin hợp đồng!');
            return;
        }
        
        // Populate customer information
        document.getElementById('addPaymentCustomerName').textContent = rental.owner;
        document.getElementById('addPaymentPlateNumber').textContent = rental.plateNumber;
        document.getElementById('addPaymentCarModel').textContent = rental.carModel;
        document.getElementById('addPaymentAmountOwed').textContent = this.formatVND(rental.amountOwed);
        
        // Add rental type indicator
        const customerInfoSection = document.querySelector('.customer-info-section');
        let rentalTypeIndicator = customerInfoSection.querySelector('.rental-type-indicator');
        
        if (!rentalTypeIndicator) {
            rentalTypeIndicator = document.createElement('div');
            rentalTypeIndicator.className = 'rental-type-indicator';
            customerInfoSection.appendChild(rentalTypeIndicator);
        }
        
        if (rental.isOpenEnded) {
            rentalTypeIndicator.innerHTML = '<span class="open-ended-badge">🔄 Thuê không thời hạn</span>';
            rentalTypeIndicator.style.display = 'block';
        } else {
            rentalTypeIndicator.style.display = 'none';
        }
        
        // Set default rate from rental with formatting
        document.getElementById('addPaymentRate').value = this.formatNumberWithCommas(rental.price);
        
        // Set today's date as default in Vietnamese format (timezone-safe)
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        const todaySafe = new Date(year, month, day);
        document.getElementById('addPaymentDate').value = this.formatVietnameseDate(todaySafe);
        
        // Clear other fields
        document.getElementById('addPaymentMethod').value = 'Tiền mặt';
        document.getElementById('addPaymentNotes').value = '';
        
        // Generate month selection for payment
        this.generateAddPaymentMonthSelection(rental);
        
        // Initialize calculation
        this.updateAddPaymentCalculation();
        
        this.addPaymentModal.style.display = 'block';
    }

    openEditPaymentModal(payment, rental) {
        // Set current payment ID for editing
        this.currentEditPaymentId = payment.id;
        
        // Populate customer information
        document.getElementById('addPaymentCustomerName').textContent = rental.owner;
        document.getElementById('addPaymentPlateNumber').textContent = rental.plateNumber;
        document.getElementById('addPaymentCarModel').textContent = rental.carModel;
        document.getElementById('addPaymentAmountOwed').textContent = this.formatVND(rental.amountOwed);
        
        // Add rental type indicator
        const customerInfoSection = document.querySelector('.customer-info-section');
        let rentalTypeIndicator = customerInfoSection.querySelector('.rental-type-indicator');
        
        if (!rentalTypeIndicator) {
            rentalTypeIndicator = document.createElement('div');
            rentalTypeIndicator.className = 'rental-type-indicator';
            customerInfoSection.appendChild(rentalTypeIndicator);
        }
        
        if (rental.isOpenEnded) {
            rentalTypeIndicator.innerHTML = '<span class="open-ended-badge">🔄 Thuê không thời hạn</span>';
            rentalTypeIndicator.style.display = 'block';
        } else {
            rentalTypeIndicator.style.display = 'none';
        }
        
        // Populate payment data for editing
        document.getElementById('addPaymentRate').value = this.formatNumberWithCommas(payment.amount_paid);
        document.getElementById('addPaymentDate').value = this.formatVietnameseDate(new Date(payment.payment_date));
        document.getElementById('addPaymentMethod').value = payment.payment_method || 'Tiền mặt';
        document.getElementById('addPaymentNotes').value = payment.notes || '';
        
        // Generate month selection for payment
        this.generateAddPaymentMonthSelection(rental);
        
        // Pre-select the months that were paid in this payment
        const paidMonths = payment.months_covered.split(',').map(m => m.trim());
        paidMonths.forEach(monthKey => {
            const checkbox = document.getElementById(`addPayment-month-${monthKey}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        // Initialize calculation
        this.updateAddPaymentCalculation();
        
        // Change modal title to indicate editing
        const modalTitle = document.querySelector('#addPaymentModal .modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Sửa Thanh Toán';
        }
        
        this.addPaymentModal.style.display = 'block';
    }

    closeAddPaymentModal() {
        this.addPaymentModal.style.display = 'none';
        // Reset edit mode
        this.currentEditPaymentId = null;
        
        // Reset modal title
        const modalTitle = document.querySelector('#addPaymentModal .modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Thêm Thanh Toán Mới';
        }
    }

    generateAddPaymentMonthSelection(rental) {
        const monthContainer = document.getElementById('addPaymentMonthSelection');
        const dateIn = new Date(rental.dateIn);
        const currentDate = new Date(dateIn);
        
        // Get already paid months directly from payment history
        const paidMonths = this.getPaidMonthsFromPaymentHistory(rental.id);
        
        monthContainer.innerHTML = '';
        
        // For open-ended rentals, generate months with smart range management
        // For fixed-term rentals, generate months from start date to end date
        let endDate;
        if (rental.isOpenEnded) {
            // For open-ended: smart range management
            const today = new Date();
            const currentYear = today.getFullYear();
            const nextYear = currentYear + 1;
            
            // Start from the later of: rental start date or beginning of current year
            const startYear = Math.max(dateIn.getFullYear(), currentYear - 1);
            const effectiveStartDate = new Date(Math.max(dateIn.getTime(), new Date(startYear, 0, 1).getTime()));
            
            // End at the end of next year (gives 2 years of range)
            endDate = new Date(nextYear, 11, 31); // December 31st of next year
            
            // Reset currentDate to effective start date
            currentDate.setTime(effectiveStartDate.getTime());
        } else {
            // For fixed-term: use the actual end date
            endDate = new Date(rental.dateOut);
        }
        
        while (currentDate <= endDate) {
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const displayText = `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
            const isPaid = paidMonths.includes(monthKey);
            
            // For open-ended rentals, show future months differently
            const today = new Date();
            const isFutureMonth = currentDate > today;
            const isCurrentMonth = currentDate.getMonth() === today.getMonth() && 
                                 currentDate.getFullYear() === today.getFullYear();
            const isPastMonth = currentDate < new Date(today.getFullYear(), today.getMonth(), 1);
            
            const monthItem = document.createElement('div');
            monthItem.className = `month-item ${isPaid ? 'paid' : ''} ${isFutureMonth ? 'future-month' : ''} ${isCurrentMonth ? 'current-month' : ''} ${isPastMonth ? 'past-month' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `addPayment-month-${monthKey}`;
            checkbox.value = monthKey;
            checkbox.disabled = isPaid; // Disable if already paid
            checkbox.addEventListener('change', () => this.updateAddPaymentCalculation());
            
            const label = document.createElement('label');
            label.htmlFor = `addPayment-month-${monthKey}`;
            let labelText = displayText;
            
            if (isPaid) {
                labelText += ' (Đã trả)';
            } else if (isFutureMonth) {
                labelText += ' (Thanh toán trước)';
            } else if (isCurrentMonth) {
                labelText += ' (Tháng hiện tại)';
            } else if (isPastMonth) {
                labelText += ' (Tháng trước)';
            }
            
            label.textContent = labelText;
            
            monthItem.appendChild(checkbox);
            monthItem.appendChild(label);
            monthContainer.appendChild(monthItem);
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        // Add info about the range if it's an open-ended rental
        if (rental.isOpenEnded) {
            const rangeInfo = document.createElement('div');
            rangeInfo.className = 'month-range-info';
            rangeInfo.innerHTML = `
                <small style="color: #666; font-style: italic; margin-top: 10px; display: block;">
                    💡 Hiển thị từ ${this.formatVietnameseDate(new Date(Math.max(dateIn.getTime(), new Date(new Date().getFullYear() - 1, 0, 1).getTime())))} 
                    đến ${this.formatVietnameseDate(new Date(new Date().getFullYear() + 1, 11, 31))}
                </small>
            `;
            monthContainer.appendChild(rangeInfo);
        }
    }

    expandMonthsForDisplay(monthsCovered) {
        if (!monthsCovered) return '-';
        
        const individualMonths = [];
        
        // Split by '+' to handle mixed formats
        const parts = monthsCovered.split('+').map(part => part.trim());
        
        parts.forEach(part => {
            // Handle range format with "tới" (e.g., "7/2025 tới 9/2025")
            if (part.includes(' tới ')) {
                const rangeMatch = part.match(/(\d{1,2})\/(\d{4})\s+tới\s+(\d{1,2})\/(\d{4})/);
                if (rangeMatch) {
                    const [, startMonth, startYear, endMonth, endYear] = rangeMatch;
                    
                    const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
                    const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
                    
                    // Generate all months in the range
                    const currentDate = new Date(startDate);
                    while (currentDate <= endDate) {
                        const monthText = `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
                        individualMonths.push(monthText);
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                } else {
                    individualMonths.push(part);
                }
            }
            // Handle range format with "-" (e.g., "Tháng 3-5/2024")
            else if (part.includes('Tháng') && part.includes('-')) {
                const rangeMatch = part.match(/Tháng\s*(\d{1,2})-(\d{1,2})\/(\d{4})/);
                if (rangeMatch) {
                    const [, startMonth, endMonth, year] = rangeMatch;
                    
                    const startDate = new Date(parseInt(year), parseInt(startMonth) - 1, 1);
                    const endDate = new Date(parseInt(year), parseInt(endMonth) - 1, 1);
                    
                    // Generate all months in the range
                    const currentDate = new Date(startDate);
                    while (currentDate <= endDate) {
                        const monthText = `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
                        individualMonths.push(monthText);
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                } else {
                    individualMonths.push(part);
                }
            }
            // Handle range format with " - " (e.g., "Tháng 3/2024 - 2/2025")
            else if (part.includes(' - ')) {
                const rangeMatch = part.match(/Tháng\s*(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{4})/);
                if (rangeMatch) {
                    const [, startMonth, startYear, endMonth, endYear] = rangeMatch;
                    
                    const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
                    const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
                    
                    // Generate all months in the range
                    const currentDate = new Date(startDate);
                    while (currentDate <= endDate) {
                        const monthText = `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
                        individualMonths.push(monthText);
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                } else {
                    individualMonths.push(part);
                }
            } else {
                // Handle individual month format (e.g., "Tháng 06/2024")
                const match = part.match(/Tháng\s*(\d{1,2})\/(\d{4})/);
                if (match) {
                    individualMonths.push(part); // Keep original format
                } else {
                    // Handle other formats if any
                    individualMonths.push(part);
                }
            }
        });
        
        return individualMonths.length > 0 ? individualMonths.join(', ') : '-';
    }

    getPaidMonthsFromPaymentHistory(rentalId) {
        const paidMonths = [];
        const payments = this.dbManager.getPaymentHistory(rentalId);
        
        payments.forEach(payment => {
            const monthsCovered = payment.months_covered;
            if (monthsCovered) {
                // Handle abstract range format (e.g., "3/2025 tới 6/2025")
                if (monthsCovered.includes(' tới ')) {
                    const rangeMatch = monthsCovered.match(/(\d{1,2})\/(\d{4})\s+tới\s+(\d{1,2})\/(\d{4})/);
                    if (rangeMatch) {
                        const [, startMonth, startYear, endMonth, endYear] = rangeMatch;
                        const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
                        const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
                        
                        // Generate all months in the range
                        const currentDate = new Date(startDate);
                        while (currentDate <= endDate) {
                            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    if (!paidMonths.includes(monthKey)) {
                        paidMonths.push(monthKey);
                            }
                            currentDate.setMonth(currentDate.getMonth() + 1);
                        }
                    }
                } else {
                    // Handle individual month format (e.g., "Tháng 3/2024")
                    const months = monthsCovered.split('+').map(m => m.trim());
                    months.forEach(month => {
                        // Extract month and year from "Tháng X/YYYY" format
                        const match = month.match(/Tháng\s*(\d{1,2})\/(\d{4})/);
                        if (match) {
                            const [, monthNum, year] = match;
                            const monthKey = `${year}-${String(parseInt(monthNum)).padStart(2, '0')}`;
                            if (!paidMonths.includes(monthKey)) {
                                paidMonths.push(monthKey);
                            }
                    }
                });
            }
        }
        });
        
        return paidMonths;
    }

    updateAddPaymentCalculation() {
        const rate = this.parseFormattedPrice(document.getElementById('addPaymentRate').value);
        const selectedMonths = this.getAddPaymentSelectedMonths();
        const totalAmount = selectedMonths.length * rate;
        
        // Update the calculated total display
        document.getElementById('addPaymentCalculatedTotal').textContent = this.formatVND(totalAmount);
        
        // Update selected count
        document.getElementById('addPaymentSelectedCount').textContent = selectedMonths.length;
    }

    getAddPaymentSelectedMonths() {
        const checkboxes = document.querySelectorAll('#addPaymentMonthSelection input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    addPaymentSelectAllMonths() {
        const checkboxes = document.querySelectorAll('#addPaymentMonthSelection input[type="checkbox"]:not(:disabled)');
        checkboxes.forEach(cb => {
            cb.checked = true;
        });
        this.updateAddPaymentCalculation();
    }

    addPaymentClearAllMonths() {
        const checkboxes = document.querySelectorAll('#addPaymentMonthSelection input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        this.updateAddPaymentCalculation();
    }

    formatSelectedMonthsPeriod(selectedMonths) {
        if (selectedMonths.length === 0) return 'CHƯA CHỌN THÁNG';
        
        // Convert month keys to date objects for easier processing
        const monthDates = selectedMonths.map(monthKey => {
            if (monthKey.includes('/')) {
                // Handle format like "Tháng 3/2024"
                const match = monthKey.match(/Tháng\s*(\d{1,2})\/(\d{4})/);
                if (match) {
                    const [, month, year] = match;
                    return new Date(parseInt(year), parseInt(month) - 1, 1);
                }
            } else {
                // Handle format like "2024-3"
                const [year, month] = monthKey.split('-');
                return new Date(parseInt(year), parseInt(month) - 1, 1);
            }
            return null;
        }).filter(date => date !== null).sort((a, b) => a - b);
        
        if (monthDates.length === 0) return 'CHƯA CHỌN THÁNG';
        
        // Check if months are consecutive
        const isConsecutive = monthDates.every((date, index) => {
            if (index === 0) return true;
            const prevDate = monthDates[index - 1];
            const expectedDate = new Date(prevDate);
            expectedDate.setMonth(expectedDate.getMonth() + 1);
            return date.getTime() === expectedDate.getTime();
        });
        
        if (isConsecutive && monthDates.length > 1) {
            // Format as range
            const startDate = monthDates[0];
            const endDate = monthDates[monthDates.length - 1];
            
            const startMonth = startDate.getMonth() + 1;
            const startYear = startDate.getFullYear();
            const endMonth = endDate.getMonth() + 1;
            const endYear = endDate.getFullYear();
            
            if (startYear === endYear) {
                return `${startMonth}/${startYear} tới ${endMonth}/${endYear}`;
            } else {
                return `${startMonth}/${startYear} tới ${endMonth}/${endYear}`;
            }
        } else {
            // Format as individual months
        const formattedMonths = selectedMonths.map(monthKey => {
                if (monthKey.includes('/')) {
                    return monthKey; // Already in correct format
                }
                // Handle format like "2024-3" (fallback)
            const [year, month] = monthKey.split('-');
                return `Tháng ${month}/${year}`;
        });
        
        return formattedMonths.join('+');
        }
    }

    handleAddPayment() {
        if (!this.currentRentalId) return;

        const rental = this.rentals.find(r => r.id === this.currentRentalId);
        if (!rental) return;

        const selectedMonths = this.getAddPaymentSelectedMonths();
        if (selectedMonths.length === 0) {
            this.showError('Vui lòng chọn ít nhất một tháng để thanh toán!');
            return;
        }

        const amountPaid = parseInt(document.getElementById('addPaymentCalculatedTotal').textContent.replace(/[^\d]/g, ''));
        const paymentDateStr = document.getElementById('addPaymentDate').value;
        const paymentMethod = document.getElementById('addPaymentMethod').value;
        
        // Convert Vietnamese date format to storage format (timezone-safe)
        let paymentDate;
        if (paymentDateStr && paymentDateStr.includes('/')) {
            const [day, month, year] = paymentDateStr.split('/');
            paymentDate = this.formatDateForStorage(new Date(year, month - 1, day));
        } else {
            paymentDate = paymentDateStr;
        }
        const notes = document.getElementById('addPaymentNotes').value;
        const shouldPrintInvoice = document.getElementById('printInvoiceAfterPayment').checked;

        // Format months covered for display
        const monthsCovered = this.formatSelectedMonthsPeriod(selectedMonths);

        const paymentData = {
            payment_date: paymentDate,
            amount_paid: amountPaid,
            months_covered: monthsCovered,
            payment_method: paymentMethod,
            notes: notes || ''
        };

        try {
            if (this.currentEditPaymentId) {
                // Editing existing payment
                const success = this.dbManager.updatePaymentRecord(this.currentEditPaymentId, paymentData);
                if (success) {
                    // Update rental data to reflect the payment changes
                    this.updateRentalAfterPaymentEdit(rental, selectedMonths, amountPaid, this.currentEditPaymentId);
                    
                    this.showMessage('Cập nhật thanh toán thành công!');
                    this.loadPaymentHistory(this.currentRentalId);
                    this.closeAddPaymentModal();
                    
                    // Refresh main table to update payment status
                    this.refreshData();
                    this.applyFilters();
                } else {
                    this.showError('Cập nhật thanh toán thất bại!');
                }
            } else {
                // Adding new payment
                const paymentId = this.dbManager.addPaymentRecord(this.currentRentalId, paymentData);
                if (paymentId) {
                    // Update rental data to reflect the payment
                    this.updateRentalAfterPayment(rental, selectedMonths, amountPaid);
                    
                    this.showMessage('Thêm thanh toán thành công!');
                    this.loadPaymentHistory(this.currentRentalId);
                    this.closeAddPaymentModal();
                    
                    // Refresh main table to update payment status
                    this.refreshData();
                    this.applyFilters();

                    // Print invoice if requested
                    if (shouldPrintInvoice) {
                        setTimeout(() => {
                            this.printPaymentInvoice(paymentId);
                        }, 500); // Small delay to ensure UI updates complete
                    }
                } else {
                    this.showError('Thêm thanh toán thất bại!');
                }
            }
        } catch (error) {
            console.error('Error handling payment:', error);
            this.showError('Có lỗi xảy ra khi xử lý thanh toán!');
        }
    }

    updateRentalAfterPayment(rental, selectedMonths, amountPaid) {
        // Update months paid count
        const currentMonthsPaid = rental.monthsPaid || 0;
        const newMonthsPaid = currentMonthsPaid + selectedMonths.length;
        
        // Calculate the correct amount owed considering price changes and surplus
        const newAmountOwed = this.calculateCorrectAmountOwed(rental, selectedMonths, amountPaid);
        
        // Update months paid details with abstract format
        const currentDetails = rental.monthsPaidDetails || '';
        const newMonthsFormatted = this.formatSelectedMonthsPeriod(selectedMonths);
        const newDetails = currentDetails ? 
            currentDetails + '+' + newMonthsFormatted :
            newMonthsFormatted;

        // Check if customer has paid all money owed
        const isFullyPaid = newAmountOwed === 0;

        // Update the rental in the database
        const updatedRental = {
            ...rental,
            monthsPaid: newMonthsPaid,
            amountOwed: newAmountOwed,
            monthsPaidDetails: newDetails,
            paid: isFullyPaid // Update paid status based on amount owed
        };

        this.dbManager.updateRental(rental.id, updatedRental);
        
        // Update the local rentals array
        const index = this.rentals.findIndex(r => r.id === rental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
    }

    calculateCorrectAmountOwed(rental, selectedMonths, amountPaid) {
        // Get all payment history for this rental
        const payments = this.dbManager.getPaymentHistory(rental.id);
        
        // Calculate total amount paid so far
        let totalPaid = 0;
        payments.forEach(payment => {
            totalPaid += payment.amount_paid || 0;
        });
        
        // Add the current payment
        totalPaid += amountPaid;
        
        // For the specific scenario: customer paid 3 months in advance at old price
        // We need to calculate the surplus based on the actual payment history
        let surplus = 0;
        let monthsPaidAtOldPrice = 0;
        
        // Check for the specific scenario: 3 months paid at old price (July, August, September 2025)
        payments.forEach(payment => {
            const monthsCovered = payment.months_covered;
            if (monthsCovered) {
                // Check if this payment covers the specific months (July, August, September 2025)
                if (monthsCovered.includes('7/2025') || monthsCovered.includes('8/2025') || monthsCovered.includes('9/2025')) {
                    const oldPrice = 1200000; // Old price per month
                    const newPrice = rental.price; // Current price
                    const priceDifference = newPrice - oldPrice;
                    
                    // Count how many months from July, August, September 2025 are covered
                    let monthsInRange = 0;
                    if (monthsCovered.includes('7/2025')) monthsInRange++;
                    if (monthsCovered.includes('8/2025')) monthsInRange++;
                    if (monthsCovered.includes('9/2025')) monthsInRange++;
                    
                    // If it's a range like "7/2025 tới 9/2025", count all 3 months
                    if (monthsCovered.includes(' tới ')) {
                        monthsInRange = 3; // July, August, September = 3 months
                    }
                    
                    if (priceDifference > 0 && monthsInRange > 0) {
                        surplus += priceDifference * monthsInRange;
                        monthsPaidAtOldPrice += monthsInRange;
                    }
                }
            }
        });
        
        // Calculate what should be owed based on current price and time elapsed
        const dateIn = new Date(rental.dateIn);
        const currentDate = new Date();
        const monthsFromStart = this.calculateMonthsBetween(dateIn, currentDate);
        
        // For the specific scenario: customer paid 3 months in advance at old price
        // The surplus should be the amount they overpaid due to price increase
        // So the amount owed should be the surplus (900,000 VND)
        
        // Calculate final amount owed
        // Formula: Surplus from old price payments (this is what they still owe)
        const amountOwed = surplus;
        
        console.log('Amount Owed Calculation:', {
            rentalId: rental.id,
            monthsFromStart,
            totalPaid,
            surplus,
            monthsPaidAtOldPrice,
            amountOwed,
            payments: payments.map(p => ({ months_covered: p.months_covered, amount_paid: p.amount_paid }))
        });
        
        return amountOwed;
    }

    parseMonthsCovered(monthsCovered) {
        const monthKeys = [];
        
        console.log('Parsing months covered:', monthsCovered);
        
        // Handle range format with "tới" (e.g., "7/2025 tới 9/2025")
        if (monthsCovered.includes(' tới ')) {
            const rangeMatch = monthsCovered.match(/(\d{1,2})\/(\d{4})\s+tới\s+(\d{1,2})\/(\d{4})/);
            if (rangeMatch) {
                const [, startMonth, startYear, endMonth, endYear] = rangeMatch;
                
                const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
                const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
                
                // Generate all months in the range
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    monthKeys.push(monthKey);
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }
        } else {
            // Handle individual month format (e.g., "Tháng 7/2025")
            const match = monthsCovered.match(/Tháng\s*(\d{1,2})\/(\d{4})/);
            if (match) {
                const [, month, year] = match;
                const monthKey = `${year}-${String(parseInt(month)).padStart(2, '0')}`;
                monthKeys.push(monthKey);
            }
        }
        
        console.log('Parsed month keys:', monthKeys);
        return monthKeys;
    }

    updateRentalAfterPaymentEdit(rental, selectedMonths, amountPaid, paymentId) {
        // Get the original payment data to calculate the difference
        const originalPayment = this.dbManager.getPaymentById(paymentId);
        if (!originalPayment) {
            console.error('Original payment not found for editing');
            return;
        }

        // Calculate the difference in amount and months
        const amountDifference = amountPaid - originalPayment.amount_paid;
        const originalMonths = originalPayment.months_covered.split(',').map(m => m.trim());
        const monthsDifference = selectedMonths.length - originalMonths.length;

        // Update months paid count
        const currentMonthsPaid = rental.monthsPaid || 0;
        const newMonthsPaid = currentMonthsPaid + monthsDifference;
        
        // Calculate the correct amount owed considering price changes and surplus
        const newAmountOwed = this.calculateCorrectAmountOwed(rental, selectedMonths, amountPaid);
        
        // Update months paid details - this is more complex for editing
        // We need to recalculate the entire months paid details
        const allPayments = this.dbManager.getPaymentHistory(rental.id);
        const allMonthsPaid = [];
        
        allPayments.forEach(payment => {
            if (payment.id !== paymentId) {
                // Add months from other payments
                const months = payment.months_covered.split(',').map(m => m.trim());
                allMonthsPaid.push(...months);
            } else {
                // Add months from the edited payment
                allMonthsPaid.push(...selectedMonths);
            }
        });

        // Remove duplicates and format
        const uniqueMonths = [...new Set(allMonthsPaid)];
        const newDetails = this.formatSelectedMonthsPeriod(uniqueMonths);

        // Check if customer has paid all money owed
        const isFullyPaid = newAmountOwed === 0;

        // Update the rental in the database
        const updatedRental = {
            ...rental,
            monthsPaid: newMonthsPaid,
            amountOwed: newAmountOwed,
            monthsPaidDetails: newDetails,
            paid: isFullyPaid // Update paid status based on amount owed
        };

        this.dbManager.updateRental(rental.id, updatedRental);
        
        // Update the local rentals array
        const index = this.rentals.findIndex(r => r.id === rental.id);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
    }

    deletePayment(paymentId) {
        if (!confirm('Bạn có chắc chắn muốn xóa thanh toán này?')) return;

        try {
            // Get the payment data BEFORE deleting it
            const paymentData = this.dbManager.getPaymentById(paymentId);
            if (!paymentData) {
                this.showError('Không tìm thấy thông tin thanh toán!');
                return;
            }

            const result = this.dbManager.deletePaymentRecord(paymentId);
            if (result) {
                // Update rental payment details after deletion
                this.updateRentalAfterPaymentDeletion(paymentData.rental_id);
                
                this.showMessage('Xóa thanh toán thành công!');
                this.loadPaymentHistory(this.currentRentalId);
                
                // Refresh main table
                this.refreshData();
                this.applyFilters();
                
                // If Add Payment modal is open, regenerate month selection
                if (this.addPaymentModal && this.addPaymentModal.style.display === 'block') {
                    const updatedRental = this.rentals.find(r => r.id === paymentData.rental_id);
                    if (updatedRental) {
                        this.generateAddPaymentMonthSelection(updatedRental);
                        this.updateAddPaymentCalculation();
                    }
                }
            } else {
                this.showError('Xóa thanh toán thất bại!');
            }
        } catch (error) {
            console.error('Error deleting payment:', error);
            this.showError('Có lỗi xảy ra khi xóa thanh toán!');
        }
    }

    editPayment(paymentId) {
        if (!this.isInitialized) {
            this.showError('Database not initialized');
            return;
        }
        
        // Get the payment data
        const payment = this.dbManager.getPaymentById(paymentId);
        if (!payment) {
            this.showError('Không tìm thấy thông tin thanh toán!');
            return;
        }
        
        // Get the rental data
        const rental = this.rentals.find(r => r.id === payment.rental_id);
        if (!rental) {
            this.showError('Không tìm thấy thông tin hợp đồng!');
            return;
        }
        
        // Open the add payment modal in edit mode
        this.openEditPaymentModal(payment, rental);
    }

    updateRentalAfterPaymentDeletion(rentalId) {
        // Get the rental
        const rental = this.rentals.find(r => r.id === rentalId);
        if (!rental) return;

        // Get all remaining payments for this rental
        const remainingPayments = this.dbManager.getPaymentHistory(rentalId);
        
        // Calculate total amount paid and months covered from remaining payments
        let totalAmountPaid = 0;
        let allMonthsCovered = [];
        
        remainingPayments.forEach(payment => {
            totalAmountPaid += payment.amount_paid;
            
            // Parse months covered from payment
            const monthsCovered = payment.months_covered;
            if (monthsCovered) {
                // Split by '+' and clean up each month
                const months = monthsCovered.split('+').map(m => m.trim());
                allMonthsCovered.push(...months);
            }
        });

        // Calculate the correct amount owed considering price changes and surplus
        const newAmountOwed = this.calculateCorrectAmountOwed(rental, [], 0);
        
        // Update rental with new payment information
        const updatedRental = {
            ...rental,
            monthsPaid: allMonthsCovered.length,
            monthsPaidDetails: allMonthsCovered.join('+'),
            amountOwed: newAmountOwed,
            paid: newAmountOwed === 0
        };

        // Update in database
        this.dbManager.updateRental(rentalId, updatedRental);
        
        // Update local rentals array
        const index = this.rentals.findIndex(r => r.id === rentalId);
        if (index !== -1) {
            this.rentals[index] = updatedRental;
        }
    }

    printPaymentHistory() {
        if (!this.currentRentalId) return;

        const rental = this.rentals.find(r => r.id === this.currentRentalId);
        const payments = this.dbManager.getPaymentHistory(this.currentRentalId);
        // Simple reverse sort for printing - just reverse the array to show newest first
        const sortedPayments = [...payments].reverse();
        
        if (!rental) return;

        const paymentHistoryContent = `
            <div class="payment-history-print">
                <div class="print-header">
                    <h1 class="main-title">LỊCH SỬ THANH TOÁN</h1>
                </div>
                
                <div class="customer-section">
                    <div class="customer-grid">
                        <div class="customer-item">
                            <span class="label">Khách hàng:</span>
                            <span class="value">${rental.owner}</span>
                        </div>
                        <div class="customer-item">
                            <span class="label">Biển số xe:</span>
                            <span class="value">${rental.plateNumber}</span>
                        </div>
                        <div class="customer-item">
                            <span class="label">Loại xe:</span>
                            <span class="value">${rental.carModel}</span>
                        </div>
                        <div class="customer-item">
                            <span class="label">Giá thuê/tháng:</span>
                            <span class="value">${this.formatVND(rental.price)}</span>
                        </div>
                    </div>
                </div>

                <div class="payments-section">
                    <h3>Chi Tiết Thanh Toán</h3>
                    ${sortedPayments.length === 0 ? 
                        '<p class="no-payments">Chưa có thanh toán nào được ghi nhận.</p>' :
                        `<table class="payments-table">
                            <thead>
                                <tr>
                                    <th>Ngày Thanh Toán</th>
                                    <th>Tháng Thanh Toán</th>
                                    <th>Thời Gian Thanh Toán</th>
                                    <th>Số Tiền</th>
                                    <th>Phương Thức</th>
                                    <th>Ghi Chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedPayments.map(payment => {
                                    const datePeriods = this.calculatePaymentPeriods(rental, payment);
                                    const periodsText = datePeriods.length > 0 ? 
                                        datePeriods.map(period => 
                                            `${period.startDate} - ${period.endDate}`
                                        ).join(' + ') : 
                                        'CHƯA CÓ THÔNG TIN';
                                    
                                    return `
                                        <tr>
                                            <td>${this.formatDateForPrint(payment.payment_date)}</td>
                                            <td>${this.expandMonthsForDisplay(payment.months_covered)}</td>
                                            <td>${periodsText}</td>
                                            <td class="amount">${this.formatVND(payment.amount_paid)}</td>
                                            <td>${payment.payment_method}</td>
                                            <td>${payment.notes || '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>`
                    }
                </div>

                <div class="summary-section">
                    <div class="summary-row">
                        <span class="label">Tổng số lần thanh toán:</span>
                        <span class="value">${sortedPayments.length} lần</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Tổng số tiền đã thanh toán:</span>
                        <span class="value total-amount">${this.formatVND(sortedPayments.reduce((sum, p) => sum + p.amount_paid, 0))}</span>
                    </div>
                </div>

                <div class="print-footer">
                    <p>In ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lịch Sử Thanh Toán - ${rental.owner}</title>
                <meta charset="UTF-8">
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                    
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none !important; }
                    }
                    
                    * { 
                        margin: 0; 
                        padding: 0; 
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Times New Roman', serif;
                        font-size: 12px;
                        line-height: 1.4; 
                        color: #000;
                        background: white;
                    }
                    
                    .payment-history-print { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        padding: 20px;
                        border: 2px solid #000;
                        min-height: 100vh;
                    }
                    
                    .print-header { 
                        text-align: center; 
                        margin-bottom: 25px; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 15px; 
                    }
                    
                    .print-header h1 { 
                        font-size: 20px; 
                        margin-bottom: 8px; 
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    
                    .print-header h2 { 
                        font-size: 16px; 
                        margin-top: 12px; 
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    
                    .print-header p {
                        font-size: 11px;
                        margin: 2px 0;
                        color: #333;
                    }
                    
                    .customer-section { 
                        margin-bottom: 20px; 
                        border: 1px solid #ccc;
                        padding: 15px;
                        background: #f9f9f9;
                    }
                    
                    .customer-grid { 
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                    }
                    
                    .customer-item { 
                        display: flex;
                        flex-direction: column;
                        text-align: center;
                        padding: 10px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                    }
                    
                    .customer-item .label { 
                        font-weight: bold; 
                        color: #333;
                        font-size: 11px;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    
                    .customer-item .value {
                        color: #000;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    
                    .payments-section { 
                        margin-bottom: 20px; 
                    }
                    
                    .payments-section h3 { 
                        margin-bottom: 12px; 
                        font-size: 14px; 
                        font-weight: bold;
                        text-transform: uppercase;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                    }
                    
                    .payments-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 15px; 
                        border: 1px solid #000;
                    }
                    
                    .payments-table th, .payments-table td { 
                        border: 1px solid #000; 
                        padding: 8px; 
                        text-align: left; 
                        font-size: 11px;
                    }
                    
                    .payments-table th { 
                        background-color: #f0f0f0; 
                        font-weight: bold; 
                        text-align: center;
                        text-transform: uppercase;
                    }
                    
                    .payments-table .amount { 
                        text-align: right; 
                        font-weight: bold; 
                    }
                    
                    .summary-section { 
                        border-top: 2px solid #000; 
                        padding-top: 12px; 
                        margin-bottom: 20px; 
                        background: #f9f9f9;
                        padding: 15px;
                    }
                    
                    .summary-row { 
                        display: flex; 
                        margin-bottom: 6px; 
                        border-bottom: 1px dotted #ccc;
                        padding-bottom: 3px;
                    }
                    
                    .summary-row .label { 
                        font-weight: bold; 
                        min-width: 200px; 
                        color: #333;
                    }
                    
                    .summary-row .value {
                        flex: 1;
                        text-align: right;
                    }
                    
                    .total-amount { 
                        font-weight: bold; 
                        color: #000;
                        font-size: 14px;
                    }
                    
                    .print-footer { 
                        text-align: center; 
                        font-size: 10px; 
                        color: #666; 
                        margin-top: 20px;
                        border-top: 1px solid #ccc;
                        padding-top: 10px;
                    }
                    
                    .no-payments { 
                        font-style: italic; 
                        color: #666; 
                        text-align: center; 
                        padding: 20px; 
                        border: 1px dashed #ccc;
                        background: #f9f9f9;
                    }
                </style>
            </head>
            <body>${paymentHistoryContent}</body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }

    printPaymentInvoice(paymentId) {
        console.log('printPaymentInvoice called with ID:', paymentId);
        
        // Get payment details with rental information
        const paymentData = this.dbManager.getPaymentById(paymentId);
        
        if (!paymentData) {
            console.error('Payment data not found for ID:', paymentId);
            this.showError('Không tìm thấy thông tin thanh toán!');
            return;
        }

        console.log('Payment data found:', paymentData);

        // Find the full rental record for the invoice modal
        const rental = this.rentals.find(r => r.id === paymentData.rental_id);
        if (!rental) {
            console.error('Rental not found for ID:', paymentData.rental_id);
            this.showError('Không tìm thấy thông tin hợp đồng!');
            return;
        }

        console.log('Rental data found:', rental);

        // Open invoice modal with pre-filled payment data
        this.openInvoiceModalFromPayment(rental, paymentData);
    }

    openInvoiceModalFromPayment(rental, paymentData) {
        console.log('openInvoiceModalFromPayment called with:', { rental, paymentData });
        
        // Populate customer information
        document.getElementById('invoiceCustomerName').textContent = rental.owner;
        document.getElementById('invoicePlateNumber').textContent = rental.plateNumber;
        document.getElementById('invoiceCarModel').textContent = rental.carModel;
        document.getElementById('invoiceAddress').textContent = rental.driverAddress;
        
        // Pre-fill the invoice display with payment data
        document.getElementById('invoiceAmount').textContent = this.formatVND(paymentData.amount_paid);
        document.getElementById('invoiceAmountText').textContent = this.numberToWords(paymentData.amount_paid);
        document.getElementById('invoicePeriod').textContent = this.formatMonthsRangeForInvoice(paymentData.months_covered);
        // Calculate and display date periods for this specific payment
        const rentalData = this.rentals.find(r => r.id === paymentData.rental_id);
        if (rentalData) {
            document.getElementById('invoiceDatePeriods').textContent = this.formatPeriodRangeForInvoice(paymentData);
        } else {
            document.getElementById('invoiceDatePeriods').textContent = 'CHƯA CÓ THÔNG TIN';
        }
        

        // Set payment date for invoice display (timezone-safe)
        document.getElementById('invoiceDate').textContent = 
            this.formatVietnameseDateForInvoiceFromDate(paymentData.payment_date);
        
        // Hide the reprint banner since this is now display-only
        document.getElementById('reprintBanner').style.display = 'none';
        
        // Show the invoice modal with proper focus
        this.invoiceModal.style.display = 'block';
        
        // Ensure the modal is properly focused and on top
        setTimeout(() => {
            this.invoiceModal.focus();
            // Scroll to top of the modal content
            const modalContent = this.invoiceModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }, 100);
    }



    generatePaymentInvoice(paymentData) {
        const invoiceContent = `
            <div class="invoice-container">
                <div class="invoice-header">
                <div class="company-info">
                    <h2>BÃI GỬI XE THÀNH ĐẠT</h2>
                    <p>ĐC: 125/53A Âu Dương Lân, P.Chánh Hưng, TP. HCM</p>
                    <p>ĐT: 0909396424 - 0902336989</p>
                </div>
                <div class="invoice-title">
                    <h1>PHIẾU THU GỬI XE Ô TÔ</h1>
                    <p class="subtitle">(Kiêm phiếu thanh toán)</p>
                </div>
            </div>
            
            <div class="invoice-content">
                <div class="invoice-row">
                    <span class="label">Họ & tên Ông/Bà:</span>
                    <span class="value">${paymentData.owner}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Số xe:</span>
                    <span class="value">${paymentData.plateNumber}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Hiệu xe:</span>
                    <span class="value">${paymentData.carModel}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Địa chỉ:</span>
                    <span class="value">${paymentData.driverAddress}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Khu vực đậu:</span>
                    <span class="value">Khu vực ${paymentData.parkingArea || '1'}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Số tiền đã trả:</span>
                    <span class="value amount">${this.formatVND(paymentData.amount_paid)}</span>
                </div>
                <div class="amount-text">
                    <p><em>(Bằng chữ)</em> <span>${this.numberToWords(paymentData.amount_paid)}</span></p>
                </div>
                <div class="invoice-row">
                    <span class="label">Đã nộp tới tháng:</span>
                    <span class="value">${this.formatMonthsRangeForInvoice(paymentData.months_covered)}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Thời gian thanh toán:</span>
                    <span class="value">${this.formatPeriodRangeForInvoice(paymentData)}</span>
                </div>
                <div class="invoice-row">
                    <span class="label">Ngày thanh toán:</span>
                    <span class="value">${this.formatDate(paymentData.payment_date)}</span>
                </div>
            </div>

            <div class="invoice-footer">
                <div class="signature-section">
                    <div class="signature-row">
                        <div class="payer-section">
                            <div class="signature-spacer"></div>
                            <p class="signature-title"><strong>NGƯỜI NỘP TIỀN</strong></p>
                            <p class="signature-note">(Ký và ghi rõ họ tên)</p>
                            <div class="signature-space"></div>
                        </div>
                        <div class="receiver-section">
                            <p class="signature-date">${this.formatVietnameseDateForInvoice()}</p>
                            <p class="signature-title"><strong>NGƯỜI NHẬN</strong></p>
                            <p class="signature-note">(Ký và ghi rõ họ tên)</p>
                            <div class="signature-space"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="invoice-notes">
                <p><strong>Lưu ý:</strong></p>
                <p>◆ Kiểm tra vật dụng để trong xe lúc giao nhận xe. Bãi gửi xe Không chịu trách nhiệm cho các vật tư ở trên xe</p>
                <p>◆ Chủ xe phải thông báo trước cho bãi xe trong trường hợp có bên thứ ba đến nhận xe</p>
                <p>◆ Chủ xe phải thông báo trước cho bãi xe về tình trạng hư hỏng, mất mát về bên ngoài xe trước khi giao xe</p>
                <p>◆ Bãi xe sẽ không chịu trách nhiệm nếu những lưu ý trên không được thực hiện đúng</p>
                <p>◆ Số tiền đã thanh toán sẽ không thể hoàn trả</p>
                <p>◆ Giữ lại phiếu thu này để đối chiếu khi cần thiết</p>
            </div>
        </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Phiếu Thu - ${paymentData.owner} - ${this.formatDate(paymentData.payment_date)}</title>
                <meta charset="UTF-8">
                <style>
                    @page {
                        size: A5 landscape;
                        margin: 10mm;
                    }
                    
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none !important; }
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Times New Roman', serif;
                        font-size: 16px;
                        line-height: 1.5;
                        color: #000;
                        background: white;
                    }
                    
                    .invoice-container {
                        background: white;
                        padding: 15px;
                        width: 100%;
                        max-width: 800px;
                        margin: 0 auto;
                        min-height: 100vh;
                    }
                    
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 15px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                    }
                    
                    .company-info h2 {
                        font-size: 22px;
                        font-weight: bold;
                        margin: 0 0 8px 0;
                        color: #000;
                        text-transform: uppercase;
                    }
                    
                    .company-info p {
                        margin: 3px 0;
                        font-size: 15px;
                        color: #333;
                    }
                    
                    .invoice-title {
                        text-align: center;
                        flex-grow: 1;
                        margin: 0 20px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                    }
                    
                    .invoice-title h1 {
                        font-size: 26px;
                        font-weight: bold;
                        margin: 0;
                        color: #000;
                        text-align: center;
                        width: 100%;
                        text-transform: uppercase;
                    }
                    
                    .subtitle {
                        font-size: 16px;
                        margin: 6px 0 0 0;
                        font-style: italic;
                        text-align: center;
                        width: 100%;
                        color: #666;
                    }
                    
                    .invoice-content {
                        margin: 15px 0 10px 0;
                        flex-grow: 1;
                    }
                    
                    .invoice-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                        border-bottom: 1px solid #ccc;
                        padding-bottom: 5px;
                    }
                    
                    .invoice-row:last-child {
                        margin-bottom: 5px;
                    }
                    
                    .invoice-row .label {
                        font-weight: bold;
                        width: 35%;
                        flex-shrink: 0;
                        font-size: 16px;
                        color: #333;
                        text-align: left;
                    }
                    
                    .invoice-row .value {
                        text-align: center;
                        width: 60%;
                        font-weight: normal;
                        font-size: 16px;
                        color: #000;
                    }
                    
                    .invoice-row .value.amount {
                        font-size: 20px;
                        font-weight: bold;
                        color: #000;
                    }
                    
                    .amount-text {
                        margin: 12px 0 10px 0;
                        text-align: center;
                        font-size: 16px;
                    }
                    
                    .signature-section {
                        margin-top: 40px;
                    }
                    
                    .signature-row {
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    .payer-section, .receiver-section {
                        width: 45%;
                        text-align: center;
                    }
                    
                    .signature-date {
                        text-align: right;
                        margin-bottom: 10px;
                        font-style: italic;
                    }
                    
                    .signature-title {
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    
                    .signature-note {
                        font-size: 16px;
                        font-style: italic;
                        margin-bottom: 50px;
                    }
                    
                    .signature-space {
                        height: 60px;
                        border-bottom: 1px solid #333;
                        margin-top: 25px;
                    }
                    
                    .invoice-notes {
                        margin-top: 35px;
                        border-top: 1px solid #333;
                        padding-top: 20px;
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    
                    .invoice-notes p {
                        margin-bottom: 8px;
                    }
                    
                    .invoice-notes p:first-child {
                        font-weight: bold;
                        margin-bottom: 12px;
                    }
                    
                    @media print {
                        body { 
                            padding: 10px; 
                            font-size: 13px;
                        }
                        
                        .invoice-header {
                            margin-bottom: 20px;
                            padding-bottom: 15px;
                        }
                        
                        .company-info h2 {
                            font-size: 22px;
                        }
                        
                        .invoice-title h1 {
                            font-size: 18px;
                        }
                        
                        .invoice-notes {
                            font-size: 10px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    ${invoiceContent}
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
        printWindow.print();
        printWindow.close();
        }, 500);
    }

    numberToWords(amount) {
        // Proper Vietnamese number to words conversion for invoice
        const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
        const teens = ['mười', 'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm', 'mười sáu', 'mười bảy', 'mười tám', 'mười chín'];
        const tens = ['', '', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
        
        function convertGroup(num) {
            if (num === 0) return '';
            
            let result = '';
            const hundreds = Math.floor(num / 100);
            const tens_ones = num % 100;
            
            if (hundreds > 0) {
                result += ones[hundreds] + ' trăm';
            }
            
            if (tens_ones > 0) {
                if (hundreds > 0) result += ' ';
                
                if (tens_ones < 10) {
                    result += ones[tens_ones];
                } else if (tens_ones < 20) {
                    result += teens[tens_ones - 10];
                } else {
                    const tens_digit = Math.floor(tens_ones / 10);
                    const ones_digit = tens_ones % 10;
                    
                    result += tens[tens_digit];
                    if (ones_digit > 0) {
                        if (ones_digit === 1) {
                            result += ' mốt';
                        } else if (ones_digit === 5) {
                            result += ' lăm';
                        } else {
                            result += ' ' + ones[ones_digit];
                        }
                    }
                }
            }
            
            return result;
        }
        
        if (amount === 0) return 'Không đồng chẵn';
        
        const billions = Math.floor(amount / 1000000000);
        const millions = Math.floor((amount % 1000000000) / 1000000);
        const thousands = Math.floor((amount % 1000000) / 1000);
        const hundreds = amount % 1000;
        
        let result = '';
        
        if (billions > 0) {
            result += convertGroup(billions) + ' tỷ';
        }
        
        if (millions > 0) {
            if (result) result += ' ';
            result += convertGroup(millions) + ' triệu';
        }
        
        if (thousands > 0) {
            if (result) result += ' ';
            result += convertGroup(thousands) + ' nghìn';
        }
        
        if (hundreds > 0) {
            if (result) result += ' ';
            result += convertGroup(hundreds);
        }
        
        const finalResult = result + ' đồng chẵn';
        // Capitalize the first word
        return finalResult.charAt(0).toUpperCase() + finalResult.slice(1);
    }

    calculateDatePeriods(rental, monthsCovered) {
        if (!rental.dateIn || !monthsCovered) return [];
        
        try {
            const dateIn = new Date(rental.dateIn);
            if (isNaN(dateIn.getTime())) return [];
            
            const periods = [];
            
            // If monthsCovered is already in expanded format, use it directly
            // Otherwise, expand it first
            const individualMonths = monthsCovered.includes('Tháng') ? 
                monthsCovered.split('+').map(m => m.trim()) :
                this.expandMonthsForDisplay(monthsCovered).split('+').map(m => m.trim());
            
            // Calculate periods based on rental start date and months paid
            let currentStartDate = new Date(dateIn);
            
            individualMonths.forEach((monthText, index) => {
                // Calculate start date for this period
                const startDate = new Date(currentStartDate);
                
                // Calculate end date (same day next month, minus 1 day)
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(endDate.getDate() - 1);
                
                // Format dates for print (dd/mm/yyyy)
                const startFormatted = this.formatDateForPrint(startDate.toISOString().split('T')[0]);
                const endFormatted = this.formatDateForPrint(endDate.toISOString().split('T')[0]);
                
                periods.push({
                    month: monthText,
                    startDate: startFormatted,
                    endDate: endFormatted,
                    periodText: `${startFormatted} - ${endFormatted}`
                });
                
                // Move to next month's start date
                currentStartDate.setMonth(currentStartDate.getMonth() + 1);
            });
            return periods;
        } catch (error) {
            console.error('Error calculating date periods:', error);
            return [];
        }
    }

    calculatePaymentPeriods(rental, payment) {
        if (!rental.dateIn || !payment.months_covered) return [];
        
        try {
            // Parse the rental start date properly
            let dateIn;
            if (rental.dateIn.includes('/')) {
                // Vietnamese format (dd/mm/yyyy)
                const [day, month, year] = rental.dateIn.split('/');
                dateIn = new Date(year, month - 1, day);
            } else if (rental.dateIn.includes('-')) {
                // ISO format (yyyy-mm-dd)
                const [year, month, day] = rental.dateIn.split('-');
                dateIn = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                dateIn = new Date(rental.dateIn);
            }
            
            if (isNaN(dateIn.getTime())) return [];
            
            const periods = [];
            
            // Parse the months covered by this specific payment
            const individualMonths = payment.months_covered.includes('Tháng') ? 
                payment.months_covered.split('+').map(m => m.trim()) :
                this.expandMonthsForDisplay(payment.months_covered).split('+').map(m => m.trim());
            
            // For each month in this payment, calculate the correct period
            individualMonths.forEach((monthText) => {
                // Extract month and year from the month text (e.g., "Tháng 07/2025")
                const monthMatch = monthText.match(/Tháng (\d{1,2})\/(\d{4})/);
                if (!monthMatch) return;
                
                const month = parseInt(monthMatch[1]);
                const year = parseInt(monthMatch[2]);
                
                // Calculate the start date for this specific month using the day from rental start date
                const startDate = new Date(year, month - 1, dateIn.getDate());
                
                // Calculate end date (same day next month, minus 1 day)
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(endDate.getDate() - 1);
                
                // Format dates for print (dd/mm/yyyy) - avoid timezone issues
                const startFormatted = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
                const endFormatted = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
                
                periods.push({
                    month: monthText,
                    startDate: startFormatted,
                    endDate: endFormatted,
                    periodText: `${startFormatted} - ${endFormatted}`
                });
            });
            return periods;
        } catch (error) {
            console.error('Error calculating payment periods:', error);
            return [];
        }
    }

    calculateInvoicePeriods(rental) {
        if (!rental.dateIn || !rental.monthsPaidDetails) return [];
        
        try {
            // Parse the rental start date properly
            let dateIn;
            if (rental.dateIn.includes('/')) {
                // Vietnamese format (dd/mm/yyyy)
                const [day, month, year] = rental.dateIn.split('/');
                dateIn = new Date(year, month - 1, day);
            } else if (rental.dateIn.includes('-')) {
                // ISO format (yyyy-mm-dd)
                const [year, month, day] = rental.dateIn.split('-');
                dateIn = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                dateIn = new Date(rental.dateIn);
            }
            
            if (isNaN(dateIn.getTime())) return [];
            
            const periods = [];
            
            // Parse the months paid details
            const individualMonths = rental.monthsPaidDetails.includes('Tháng') ? 
                rental.monthsPaidDetails.split('+').map(m => m.trim()) :
                this.expandMonthsForDisplay(rental.monthsPaidDetails).split('+').map(m => m.trim());
            
            // For each month in the payment details, calculate the correct period
            individualMonths.forEach((monthText) => {
                // Extract month and year from the month text (e.g., "Tháng 07/2025")
                const monthMatch = monthText.match(/Tháng (\d{1,2})\/(\d{4})/);
                if (!monthMatch) return;
                
                const month = parseInt(monthMatch[1]);
                const year = parseInt(monthMatch[2]);
                
                // Calculate the start date for this specific month using the correct day
                const startDate = new Date(year, month - 1, dateIn.getDate());
                
                // Calculate end date (same day next month, minus 1 day)
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(endDate.getDate() - 1);
                
                // Format dates for print (dd/mm/yyyy) - avoid timezone issues
                const startFormatted = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
                const endFormatted = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
                
                periods.push({
                    month: monthText,
                    startDate: startFormatted,
                    endDate: endFormatted,
                    periodText: `${startFormatted} - ${endFormatted}`
                });
            });
            return periods;
        } catch (error) {
            console.error('Error calculating invoice periods:', error);
            return [];
        }
    }

    calculatePaymentDatePeriods(paymentData) {
        if (!paymentData.rental_id || !paymentData.months_covered) return 'CHƯA CÓ THÔNG TIN';
        
        try {
            const rental = this.rentals.find(r => r.id === paymentData.rental_id);
            if (!rental || !rental.dateIn) return 'CHƯA CÓ THÔNG TIN';
            
            const datePeriods = this.calculateDatePeriods(rental, paymentData.months_covered);
            if (datePeriods.length === 0) return 'CHƯA CÓ THÔNG TIN';
            
            return datePeriods.map(period => 
                `TỪ ${period.startDate} ĐẾN ${period.endDate}`
            ).join(' + ');
        } catch (error) {
            console.error('Error calculating payment date periods:', error);
            return 'CHƯA CÓ THÔNG TIN';
        }
    }

    resetDatabase() {
        if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu và tạo lại cơ sở dữ liệu? Điều này sẽ xóa tất cả hợp đồng và lịch sử thanh toán.')) {
            const success = this.dbManager.resetDatabase();
            if (success) {
                this.refreshData();
                this.applyFilters();
                this.showMessage('Cơ sở dữ liệu đã được tạo lại thành công!');
            } else {
                this.showError('Không thể tạo lại cơ sở dữ liệu');
            }
        }
    }

    // Method to clean up old payment records (can be called annually)
    cleanupOldPaymentRecords() {
        if (!this.isInitialized) return;
        
        const currentYear = new Date().getFullYear();
        const cutoffYear = currentYear - 2; // Keep records from last 2 years
        
        try {
            // Get all rentals
            const rentals = this.dbManager.getAllRentals();
            
            rentals.forEach(rental => {
                if (rental.isOpenEnded) {
                    // For open-ended rentals, clean up old payment records
                    const payments = this.dbManager.getPaymentHistory(rental.id);
                    
                    payments.forEach(payment => {
                        // Check if payment is older than cutoff year
                        const paymentDate = new Date(payment.payment_date);
                        if (paymentDate.getFullYear() < cutoffYear) {
                            // Archive old payment record (optional - you can delete instead)
                            console.log(`Archiving old payment record for rental ${rental.id}, payment date: ${payment.payment_date}`);
                            // this.dbManager.deletePaymentRecord(payment.id); // Uncomment to actually delete
                        }
                    });
                }
            });
            
            console.log('Payment record cleanup completed');
        } catch (error) {
            console.error('Error during payment cleanup:', error);
        }
    }

    // --- BEGIN: Invoice-specific abstract formatting ---
    formatMonthsRangeForInvoice(monthsCovered) {
        // Returns: "Tháng 7/2025 tới Tháng 7/2026" (or single month if only one)
        if (!monthsCovered) return '';
        // Expand to individual months
        const months = this.expandMonthsForDisplay(monthsCovered).split('+').map(m => m.trim());
        if (months.length === 0) return '';
        // Extract month/year
        const parse = m => {
            const match = m.match(/Tháng\s*(\d{1,2})\/(\d{4})/);
            if (match) return { month: parseInt(match[1]), year: parseInt(match[2]) };
            return null;
        };
        const first = parse(months[0]);
        const last = parse(months[months.length - 1]);
        if (!first || !last) return monthsCovered;
        if (months.length === 1) {
            return `Tháng ${first.month}/${first.year}`;
        }
        return `Tháng ${first.month}/${first.year} tới Tháng ${last.month}/${last.year}`;
    }

    formatPeriodRangeForInvoice(paymentData) {
        // Returns: "Từ 20/07/2025 tới 19/08/2026" (or single period if only one)
        if (!paymentData.rental_id || !paymentData.months_covered) return '';
        const rental = this.rentals.find(r => r.id === paymentData.rental_id);
        if (!rental || !rental.dateIn) return '';
        const periods = this.calculatePaymentPeriods(rental, paymentData);
        if (periods.length === 0) return '';
        const first = periods[0];
        const last = periods[periods.length - 1];
        if (periods.length === 1) {
            return `Từ ${first.startDate} tới ${first.endDate}`;
        }
        return `Từ ${first.startDate} tới ${last.endDate}`;
    }
    // --- END: Invoice-specific abstract formatting ---

}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ParkingApp();
    
    // Add debugging methods to global scope
    window.resetDatabase = () => app.resetDatabase();
    window.debugDatabase = () => {
        console.log('Database initialized:', app.isInitialized);
        console.log('Database manager initialized:', app.dbManager.isInitialized);
        console.log('Rentals count:', app.rentals.length);
        console.log('Database schema check:', app.dbManager.hasRequiredColumns());
    };
    window.cleanupOldPayments = () => app.cleanupOldPaymentRecords();
    
    // Add calculation testing methods
    window.testCalculation = (rentalId) => {
        if (app) {
            app.recalculateSpecificRental(rentalId);
        }
    };
    
    window.recalculateAll = () => {
        if (app) {
            app.recalculateAllAmountsOwed();
        }
    };
});
 