# Phong Cách Stardew Cổ Điển (Classic Vanilla 16-Bit)

Phong cách đồ họa nền tảng của Stardew Valley, tái hiện vẻ đẹp nông trại mộc mạc, yên bình với góc nhìn Top-Down 3/4.

## 1. Thông Số Cốt Lõi
- **Lưới nhân vật (NPC):** 16x32 pixel (chiều rộng 16px, chiều cao 32px).
- **Lưới vật phẩm/công cụ:** 16x16 pixel.
- **Lưới ô đất/Tilemap:** 16x16 pixel.
- **Lưới động vật/quái vật:** 32x32 pixel hoặc 32x16 pixel (gà, vịt: 16x16; bò, dê: 32x32).
- **Góc nhìn:** Top-Down 3/4 (nhìn chếch từ trên xuống khoảng 45 độ, hiển thị rõ cả mặt trên và mặt trước của khối).

## 2. Quy Tắc Tạo Hình
- **Đường viền có chọn lọc (Selective Outlining - Sel-out):**
  - Không dùng viền đen tuyền (#000000).
  - Sử dụng màu nâu sẫm hữu cơ `#3a2010` cho các đường viền ngoài tiếp xúc với không gian nền.
  - Các đường nét phân tách nội bộ dùng phiên bản tối hơn của màu chính (ví dụ viền áo dùng màu vải tối).
- **Đổ bóng mảng khối (Cluster Shading):**
  - Ánh sáng chuẩn: Chiếu từ góc trên bên trái xuống (Top-Left light source).
  - Phân bổ 3-4 mức sắc độ: Điểm sáng (Highlight) -> Màu chính (Midtone) -> Vùng tối (Shadow) -> Đường chân viền (Deep shadow).
  - Tránh dither hạt caro trên các sprite nhỏ; giữ các mảng màu liền lạc, sắc nét.
- **Tỷ lệ nhân vật:**
  - Đầu chiếm khoảng 10-12px (bao gồm tóc và mũ).
  - Thân và áo chiếm khoảng 8-10px.
  - Chân và giày chiếm khoảng 8-10px.
  - Mắt nhân vật thường là 1 pixel đơn (kèm 1 pixel highlight sáng hoặc bóng mi bên trên).
