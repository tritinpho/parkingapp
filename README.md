# Ứng Dụng Quản Lý Thuê Chỗ Đậu Xe

Ứng dụng quản lý thuê chỗ đậu xe địa phương với cơ sở dữ liệu SQLite, không cần kết nối internet hay dịch vụ trả phí.

## 🆕 Tính Năng Database SQLite

### ✨ Tính Năng Chính
- **SQLite Database**: Lưu trữ dữ liệu trong file SQLite thực thụ
- **Xuất Database**: Tải file .sqlite xuống máy tính
- **Nhập Database**: Tải lên file .sqlite từ máy khác  
- **Portable**: Mang database đi bất kỳ máy nào
- **Backup**: Sao lưu dữ liệu dễ dàng

### 🔄 Cách Sử Dụng Database

#### Xuất Database:
1. Click nút **"Xuất Database"** màu tím
2. File `bai_gui_xe_YYYY-MM-DD.sqlite` sẽ được tải xuống
3. Lưu file này để backup hoặc chuyển sang máy khác

#### Nhập Database:
1. Click nút **"Nhập Database"** màu tím  
2. Chọn file `.sqlite` hoặc `.db`
3. Xác nhận thay thế dữ liệu hiện có
4. Database mới sẽ được tải lên



## 📊 Quản Lý Khách Hàng

### Thông Tin Khách Hàng:
- **Chủ xe**: Tên người thuê chỗ đậu
- **Địa chỉ**: Địa chỉ liên hệ của khách hàng  
- **Số điện thoại**: Thông tin liên lạc
- **Loại xe**: Model xe (Toyota Camry, Honda Civic, v.v.)
- **Biển số**: Biển số xe
- **Ngày vào/ra**: Thời gian thuê chỗ đậu
- **Giá thuê**: Giá thuê hàng tháng (VND)

### Quản Lý Thanh Toán:
- **Số tháng đã trả**: Số tháng đã thanh toán
- **Chi tiết tháng**: Ghi chú các tháng cụ thể đã trả
- **Số tiền còn nợ**: Tự động tính toán
- **Trạng thái**: Đã thanh toán / Chưa thanh toán


### 📊 Báo Cáo Tài Chính:
- **Thống kê tổng quan**: Tổng khách hàng, khách đã thanh toán, khách còn nợ
- **Phân tích doanh thu**: Tổng thu, thu tiền mặt, thu chuyển khoản
- **Thống kê giao dịch**: Số lượng giao dịch theo từng phương thức
- **Tỷ lệ phần trăm**: Tỷ lệ thanh toán đủ
- **📄 Xuất báo cáo**: In PDF hoặc xuất file CSV/Excel

### Nhắc Nhở Thanh Toán:
- **Ngày nhắc nhở tiếp theo**: Tự động +30 ngày từ ngày ra
- **Màu sắc trạng thái**:
  - 🔴 **Đỏ**: Quá hạn (cần thu tiền gấp)
  - 🟡 **Vàng**: Hôm nay (cần thu tiền hôm nay)  
  - 🟢 **Xanh**: Sắp tới (còn thời gian)

## 🔍 Tìm Kiếm & Lọc

### Tìm Kiếm:
- Tìm theo **tên chủ xe**
- Tìm theo **biển số xe**
- Tìm theo **địa chỉ**
- Tìm theo **số điện thoại**
- Tìm theo **loại xe**

- **🇻🇳 Hỗ trợ tiếng Việt có dấu**: Tìm "Nguyen" sẽ khớp với "Nguyễn", "Truong" khớp với "Trường"

### Lọc Dữ Liệu:
- **Trạng thái thanh toán**: Tất cả / Đã thanh toán / Chưa thanh toán
- **Nhắc nhở**: Tất cả / Quá hạn / Hôm nay / Sắp tới

### Sắp Xếp:
- Click tiêu đề cột để sắp xếp
- Mũi tên hiển thị hướng sắp xếp (↑↓)
- Sắp xếp theo: ID, Tên, Loại xe, Biển số, Giá thuê, v.v.

## 💻 Sử Dụng Ứng Dụng

### Thêm Khách Hàng Mới:
1. Click **"Thêm Hợp Đồng Mới"**
2. Điền thông tin vào form 2 cột
3. Click **"Thêm"** để lưu

### Chỉnh Sửa Khách Hàng:
1. Click nút **"Sửa"** ở hàng muốn chỉnh sửa
2. Cập nhật thông tin trong form
3. Click **"Cập nhật"** để lưu

### Xóa Khách Hàng:
1. Click nút **"Xóa"** ở hàng muốn xóa
2. Xác nhận xóa trong dialog
3. Dữ liệu sẽ bị xóa vĩnh viễn

### Tạo Báo Cáo Tài Chính:
1. Click nút **"Báo Cáo Tài Chính"** màu cam
2. Xem thống kê chi tiết về doanh thu và khách hàng
3. **In báo cáo**: Click "🖨️ In Báo Cáo" để in
4. **Xuất Excel**: Click "📤 Xuất Excel" để tải file CSV

## 🏗️ Cấu Trúc Dự Án

```
parkingapp/
├── index.html          # Giao diện chính
├── styles.css          # Styling CSS
├── script.js          # Logic JavaScript + SQLite
└── README.md          # Tài liệu hướng dẫn
```

## 📱 Responsive Design

- **Desktop**: Hiển thị đầy đủ tất cả cột
- **Tablet**: Form 2 cột, bảng scroll ngang
- **Mobile**: Form 1 cột, bảng compact

## 🔧 Công Nghệ Sử Dụng

- **HTML5**: Cấu trúc trang web
- **CSS3**: Styling và responsive
- **JavaScript ES6+**: Logic ứng dụng
- **SQL.js**: SQLite chạy trong browser
- **LocalStorage**: Cache database tạm thời

## 🚀 Cài Đặt & Chạy

1. **Tải về**: Clone hoặc download folder `parkingapp`
2. **Mở file**: Double-click `index.html`
3. **Sử dụng**: App chạy hoàn toàn offline trong browser

> **Lưu ý**: App cần kết nối internet lần đầu để tải thư viện SQL.js từ CDN. Sau đó có thể dùng offline.

## 💾 Backup & Di Chuyển

### Backup Database:
1. Click **"Xuất Database"** 
2. Lưu file `.sqlite` ở nơi an toàn
3. Có thể mở bằng DB Browser for SQLite

### Chuyển Sang Máy Khác:
1. Copy toàn bộ folder `parkingapp`
2. Mở `index.html` trên máy mới
3. Click **"Nhập Database"** và chọn file `.sqlite` cũ
4. Tất cả dữ liệu sẽ được phục hồi

## 🔒 Bảo Mật & Riêng Tư

- **Offline hoàn toàn**: Không gửi dữ liệu lên server
- **Local storage**: Dữ liệu chỉ lưu trên máy tính cá nhân
- **Không tracking**: Không thu thập thông tin người dùng
- **Portable**: Kiểm soát hoàn toàn dữ liệu của bạn

## 🐛 Troubleshooting

### Database không khởi tạo được:
- Kiểm tra kết nối internet (cần tải SQL.js lần đầu)
- Thử refresh trang (F5)
- Kiểm tra console log (F12)

### File import không được:
- Đảm bảo file có extension `.sqlite` hoặc `.db`
- File phải là SQLite database hợp lệ
- Thử export rồi import lại để test

### Dữ liệu bị mất:
- Kiểm tra localStorage của browser
- Thử import file backup `.sqlite`


---

**Phiên bản**: 2.0 with SQLite  
**Cập nhật cuối**: 2024  
**Tác giả**: Parking Management System 
