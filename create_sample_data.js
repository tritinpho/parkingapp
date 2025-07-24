// Sample Data Generator for Parking Management App
// Run this in the browser console after the app loads to populate with sample data
// 
// Recent changes:
// - Payment method column removed from main table (now only in payment history)
// - Invoice printing shows payment method
// - Simplified customer form (removed payment-related fields)
// - Automatic paid status updates when amount owed reaches zero

function resetDatabase() {
    console.log('🔄 Resetting database to get latest schema...');
    
    // Clear the existing database from localStorage
    localStorage.removeItem('sqliteDatabase');
    localStorage.removeItem('columnVisibility');
    
    console.log('✅ Database cleared. Please refresh the page to initialize with new schema.');
    console.log('After refresh, run createSampleData() again.');
}

function createSampleData() {
    if (!app || !app.dbManager || !app.dbManager.isInitialized) {
        console.error('App not initialized. Please wait for the app to load completely.');
        return;
    }

    // Check if parkingArea column exists by trying a simple query
    try {
        const testQuery = app.dbManager.db.prepare("SELECT parkingArea FROM rentals LIMIT 1");
        testQuery.free();
    } catch (error) {
        console.error('❌ Database schema is outdated. The parkingArea column is missing.');
        console.log('🔧 SOLUTION: Run resetDatabase() then refresh the page, then run createSampleData() again.');
        console.log('Type: resetDatabase()');
        return;
    }

    const sampleRentals = [
        {
            owner: "Nguyễn Văn Minh",
            driverAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
            phoneNumber: "0901234567",
            carModel: "Toyota Camry - Màu Đen",
            plateNumber: "51G-123.45",
            parkingArea: "1",
            dateIn: "2024-01-15",
            dateOut: "2024-12-15",
            price: 3500000,
            monthsPaid: 8,
            monthsPaidDetails: "Tháng 1-8/2024",
            amountOwed: 1400000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Khách hàng VIP, ưu tiên chỗ đậu"
        },
        {
            owner: "Trần Thị Lan Anh",
            driverAddress: "456 Lê Lợi, Quận 3, TP.HCM",
            phoneNumber: "0912345678",
            carModel: "Honda Civic - Màu Trắng",
            plateNumber: "51H-456.78",
            parkingArea: "2",
            dateIn: "2024-03-01",
            dateOut: "2025-03-01",
            price: 3000000,
            monthsPaid: 12,
            monthsPaidDetails: "Tháng 3/2024 - 2/2025",
            amountOwed: 0,
            paid: true,
            paymentMethod: "Chuyển khoản",
            notes: "Đã thanh toán đủ 1 năm"
        },
        {
            owner: "Lê Hoàng Việt",
            driverAddress: "789 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM",
            phoneNumber: "0923456789",
            carModel: "Mazda CX-5 - Màu Xám",
            plateNumber: "51F-789.12",
            parkingArea: "3",
            dateIn: "2024-06-01",
            dateOut: "2025-06-01",
            price: 3200000,
            monthsPaid: 4,
            monthsPaidDetails: "Tháng 6-9/2024",
            amountOwed: 9600000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Cần nhắc nhở thanh toán"
        },
        {
            owner: "Phạm Thị Mai",
            driverAddress: "321 Võ Văn Tần, Quận 1, TP.HCM",
            phoneNumber: "0934567890",
            carModel: "BMW X3 - Màu Đen",
            plateNumber: "51B-321.54",
            parkingArea: "4",
            dateIn: "2024-02-20",
            dateOut: "2025-02-20",
            price: 4500000,
            monthsPaid: 12,
            monthsPaidDetails: "Tháng 2/2024 - 1/2025",
            amountOwed: 0,
            paid: true,
            paymentMethod: "Chuyển khoản",
            notes: "Khách hàng thân thiết"
        },
        {
            owner: "Võ Minh Tuấn",
            driverAddress: "654 Cách Mạng Tháng 8, Quận 10, TP.HCM",
            phoneNumber: "0945678901",
            carModel: "Hyundai Tucson - Màu Bạc",
            plateNumber: "51A-654.87",
            parkingArea: "5",
            dateIn: "2024-08-01",
            dateOut: "2025-08-01",
            price: 2800000,
            monthsPaid: 2,
            monthsPaidDetails: "Tháng 8-9/2024",
            amountOwed: 8400000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Mới ký hợp đồng"
        },
        {
            owner: "Đặng Thị Hồng",
            driverAddress: "987 Pasteur, Quận 1, TP.HCM",
            phoneNumber: "0956789012",
            carModel: "Mercedes C200 - Màu Trắng",
            plateNumber: "51G-987.65",
            parkingArea: "6",
            dateIn: "2023-12-01",
            dateOut: "2024-12-01",
            price: 5000000,
            monthsPaid: 10,
            monthsPaidDetails: "Tháng 12/2023 - 9/2024",
            amountOwed: 10000000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Hết hạn hợp đồng, cần gia hạn"
        },
        {
            owner: "Ngô Văn Đức",
            driverAddress: "147 Trường Chinh, Quận Tân Bình, TP.HCM",
            phoneNumber: "0967890123",
            carModel: "Ford EcoSport - Màu Đỏ",
            plateNumber: "51F-147.25",
            parkingArea: "7",
            dateIn: "2024-04-15",
            dateOut: "2025-04-15",
            price: 2500000,
            monthsPaid: 6,
            monthsPaidDetails: "Tháng 4-9/2024",
            amountOwed: 5000000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Học sinh lái xe mới"
        },
        {
            owner: "Bùi Thị Thanh",
            driverAddress: "258 Hoàng Văn Thụ, Quận Phú Nhuận, TP.HCM",
            phoneNumber: "0978901234",
            carModel: "Kia Morning - Màu Xanh",
            plateNumber: "51H-258.96",
            parkingArea: "8",
            dateIn: "2024-07-01",
            dateOut: "2025-07-01",
            price: 2200000,
            monthsPaid: 3,
            monthsPaidDetails: "Tháng 7-9/2024",
            amountOwed: 6600000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Xe nhỏ, dễ đậu"
        },
        {
            owner: "Hoàng Minh Khôi",
            driverAddress: "369 Nam Kỳ Khởi Nghĩa, Quận 3, TP.HCM",
            phoneNumber: "0989012345",
            carModel: "Lexus RX350 - Màu Bạc",
            plateNumber: "51G-369.14",
            parkingArea: "1",
            dateIn: "2024-05-10",
            dateOut: "2025-05-10",
            price: 6000000,
            monthsPaid: 5,
            monthsPaidDetails: "Tháng 5-9/2024",
            amountOwed: 18000000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Xe sang, cần chỗ rộng"
        },
        {
            owner: "Lý Thị Ngọc",
            driverAddress: "741 Cộng Hòa, Quận Tân Bình, TP.HCM",
            phoneNumber: "0990123456",
            carModel: "Vinfast LUX A2.0 - Màu Đen",
            plateNumber: "51V-741.82",
            parkingArea: "2",
            dateIn: "2024-09-01",
            dateOut: "2025-09-01",
            price: 3800000,
            monthsPaid: 1,
            monthsPaidDetails: "Tháng 9/2024",
            amountOwed: 11400000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Xe Việt Nam, khách hàng mới"
        },
        {
            owner: "Đinh Văn Sơn",
            driverAddress: "852 Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TP.HCM",
            phoneNumber: "0901357924",
            carModel: "Audi Q5 - Màu Xanh",
            plateNumber: "51A-852.73",
            parkingArea: "3",
            dateIn: "2024-01-01",
            dateOut: "2024-12-31",
            price: 5500000,
            monthsPaid: 12,
            monthsPaidDetails: "Tháng 1-12/2024",
            amountOwed: 0,
            paid: true,
            paymentMethod: "Chuyển khoản",
            notes: "Thanh toán đúng hạn, khách tin cậy"
        },
        {
            owner: "Phan Thị Thu",
            driverAddress: "963 Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
            phoneNumber: "0912468135",
            carModel: "Chevrolet Spark - Màu Vàng",
            plateNumber: "51C-963.41",
            parkingArea: "4",
            dateIn: "2024-10-01",
            dateOut: "2025-10-01",
            price: 2000000,
            monthsPaid: 0,
            monthsPaidDetails: "",
            amountOwed: 6000000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Mới vào, chưa thanh toán lần nào"
        },
        {
            owner: "Trịnh Minh Đạt",
            driverAddress: "159 Hai Bà Trưng, Quận 1, TP.HCM",
            phoneNumber: "0923579468",
            carModel: "Land Rover Evoque - Màu Trắng",
            plateNumber: "51L-159.62",
            parkingArea: "5",
            dateIn: "2023-06-01",
            dateOut: "2024-06-01",
            price: 7000000,
            monthsPaid: 12,
            monthsPaidDetails: "Tháng 6/2023 - 5/2024",
            amountOwed: 35000000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Hết hạn từ tháng 6/2024, cần gia hạn gấp"
        },
        {
            owner: "Cao Thị Bích",
            driverAddress: "357 Lý Thường Kiệt, Quận 10, TP.HCM",
            phoneNumber: "0934680257",
            carModel: "Nissan X-Trail - Màu Ghi",
            plateNumber: "51N-357.91",
            parkingArea: "6",
            dateIn: "2024-03-15",
            dateOut: "2025-03-15",
            price: 3300000,
            monthsPaid: 7,
            monthsPaidDetails: "Tháng 3-9/2024",
            amountOwed: 9900000,
            paid: false,
            paymentMethod: "Chuyển khoản",
            notes: "Thanh toán đều đặn"
        },
        {
            owner: "Vương Văn Hải",
            driverAddress: "468 An Dương Vương, Quận 5, TP.HCM",
            phoneNumber: "0945791368",
            carModel: "Suzuki Swift - Màu Đỏ",
            plateNumber: "51S-468.37",
            parkingArea: "7",
            dateIn: "2024-08-15",
            dateOut: "2025-08-15",
            price: 2300000,
            monthsPaid: 2,
            monthsPaidDetails: "Tháng 8-9/2024",
            amountOwed: 4600000,
            paid: false,
            paymentMethod: "Tiền mặt",
            notes: "Sinh viên, thường trễ hạn"
        }
    ];

    console.log('Starting to create sample data...');
    
    let successCount = 0;
    sampleRentals.forEach((rental, index) => {
        try {
            const result = app.dbManager.addRental(rental);
            if (result) {
                successCount++;
                console.log(`✅ Added rental ${index + 1}: ${rental.owner}`);
            } else {
                console.error(`❌ Failed to add rental ${index + 1}: ${rental.owner}`);
            }
        } catch (error) {
            console.error(`❌ Error adding rental ${index + 1}: ${rental.owner}`, error);
        }
    });

    // Refresh the app to show new data
    if (successCount > 0) {
        app.refreshData();
        app.applyFilters();
        console.log(`🎉 Successfully created ${successCount}/${sampleRentals.length} sample rentals!`);
        
        // Add some sample payment history
        console.log('📋 Adding sample payment history...');
        createSamplePaymentHistory();
        
        console.log('The table should now display the sample data with payment history.');
    } else {
        console.error('❌ No sample data was created. Please check the console for errors.');
    }
}

function createSamplePaymentHistory() {
    // Sample payment records for some customers
    const samplePayments = [
        // Payments for customer ID 1 (Nguyễn Văn Minh)
        { rentalId: 1, payment_date: '2024-01-15', amount_paid: 3500000, months_covered: 'Tháng 1/2024', payment_method: 'Tiền mặt', notes: 'Thanh toán đầu kỳ' },
        { rentalId: 1, payment_date: '2024-02-15', amount_paid: 3500000, months_covered: 'Tháng 2/2024', payment_method: 'Tiền mặt', notes: '' },
        { rentalId: 1, payment_date: '2024-05-20', amount_paid: 10500000, months_covered: 'Tháng 3-5/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 3 tháng' },
        { rentalId: 1, payment_date: '2024-08-15', amount_paid: 10500000, months_covered: 'Tháng 6-8/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 3 tháng' },
        
        // Payments for customer ID 2 (Trần Thị Lan Anh)
        { rentalId: 2, payment_date: '2024-03-01', amount_paid: 36000000, months_covered: 'Tháng 3/2024 - 2/2025', payment_method: 'Chuyển khoản', notes: 'Thanh toán cả năm' },
        
        // Payments for customer ID 4 (Phạm Thị Mai)
        { rentalId: 4, payment_date: '2024-02-20', amount_paid: 54000000, months_covered: 'Tháng 2/2024 - 1/2025', payment_method: 'Chuyển khoản', notes: 'Thanh toán 12 tháng' },
        
        // Payments for customer ID 6 (Đặng Thị Hồng)
        { rentalId: 6, payment_date: '2023-12-01', amount_paid: 15000000, months_covered: 'Tháng 12/2023 - 2/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 3 tháng đầu' },
        { rentalId: 6, payment_date: '2024-03-15', amount_paid: 20000000, months_covered: 'Tháng 3-6/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 4 tháng' },
        { rentalId: 6, payment_date: '2024-07-10', amount_paid: 15000000, months_covered: 'Tháng 7-9/2024', payment_method: 'Tiền mặt', notes: 'Thanh toán 3 tháng' },
        
        // Payments for customer ID 11 (Đinh Văn Sơn)
        { rentalId: 11, payment_date: '2024-01-01', amount_paid: 66000000, months_covered: 'Tháng 1-12/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán cả năm 2024' },
        
        // Some recent payments for other customers
        { rentalId: 3, payment_date: '2024-06-01', amount_paid: 3200000, months_covered: 'Tháng 6/2024', payment_method: 'Chuyển khoản', notes: '' },
        { rentalId: 3, payment_date: '2024-07-15', amount_paid: 6400000, months_covered: 'Tháng 7-8/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 2 tháng' },
        { rentalId: 3, payment_date: '2024-09-10', amount_paid: 3200000, months_covered: 'Tháng 9/2024', payment_method: 'Tiền mặt', notes: '' },
        
        { rentalId: 5, payment_date: '2024-08-01', amount_paid: 2800000, months_covered: 'Tháng 8/2024', payment_method: 'Tiền mặt', notes: 'Tháng đầu tiên' },
        { rentalId: 5, payment_date: '2024-09-05', amount_paid: 2800000, months_covered: 'Tháng 9/2024', payment_method: 'Tiền mặt', notes: '' },
        
        { rentalId: 14, payment_date: '2024-03-15', amount_paid: 9900000, months_covered: 'Tháng 3-5/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 3 tháng đầu' },
        { rentalId: 14, payment_date: '2024-06-20', amount_paid: 6600000, months_covered: 'Tháng 6-7/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 2 tháng' },
        { rentalId: 14, payment_date: '2024-08-25', amount_paid: 6600000, months_covered: 'Tháng 8-9/2024', payment_method: 'Chuyển khoản', notes: 'Thanh toán 2 tháng' }
    ];

    let paymentSuccessCount = 0;
    samplePayments.forEach((payment, index) => {
        try {
            const result = app.dbManager.addPaymentRecord(payment.rentalId, {
                payment_date: payment.payment_date,
                amount_paid: payment.amount_paid,
                months_covered: payment.months_covered,
                payment_method: payment.payment_method,
                notes: payment.notes
            });
            
            if (result) {
                paymentSuccessCount++;
            }
        } catch (error) {
            console.error(`❌ Error adding payment ${index + 1}:`, error);
        }
    });

    if (paymentSuccessCount > 0) {
        console.log(`✅ Added ${paymentSuccessCount}/${samplePayments.length} payment history records!`);
        console.log('💡 Try clicking "Lịch Sử" button on any customer to see their payment history!');
    }
}

// Instructions for use
console.log(`
🚗 PARKING APP SAMPLE DATA GENERATOR 🚗

If you're getting errors about missing columns:
1. Run: resetDatabase()
2. Refresh the page (F5)
3. Wait for app to load completely
4. Run: createSampleData()

If no errors:
- Just run: createSampleData()

This will create 15 realistic parking contracts with:
✅ Various parking areas (1-8)
✅ Different payment statuses  
✅ Mix of car types (Toyota, BMW, Mercedes, etc.)
✅ Vietnamese names and addresses
✅ Different payment methods
✅ Some overdue contracts for testing reminders
✅ Various contract periods

Commands available:
- resetDatabase() - Clear and reset database
- createSampleData() - Create sample data + payment history

NEW FEATURES: Payment History + Perfect Compact Invoice UX! 
🎯 Click "Lịch Sử" button on any customer to see their detailed payment records
📝 Add new payments with automatic invoice printing option
🖨️ Reprint/customize invoices for any past payment (click "🖨️ In Lại" on each payment)
⚙️ Full customization: edit amounts, select months, preview before printing
💰 Track exactly when customers paid and for which months
📋 Professional invoices with complete editing control
✨ Perfect modal layering - invoice modal appears on top with smooth animations
🖨️ Compact UI - everything fits in viewport without scrolling
📱 Sticky print button always visible at bottom
🔧 Fixed: Month selection now properly updates "Đã nộp cho" display
💳 NEW: Enhanced Add Payment Modal with Rate Input & Month Selection
📊 Automatic calculation based on selected months and rate
🔄 Real-time updates of rental data after payment
📈 Tracks paid months and reduces amount owed automatically
✅ Auto-updates paid status when amount owed reaches zero
🔄 Automatic paid status calculation in both payment and edit forms
📝 Simplified customer form - payment details managed through payment history
🔄 Automatic rental updates when payments are deleted from history
📄 Simplified invoice reprinting - display-only without month selection
`); 