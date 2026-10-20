---
trigger: always_on
description: Quy tắc bắt buộc sử dụng tiếng Việt có dấu chuẩn Unicode UTF-8
---

# Quy Chuẩn Ngôn Ngữ & Chú Thích Tiếng Việt

1. **Giao tiếp và Phản hồi**:
   - Luôn trả lời, giải thích, báo cáo và tương tác với người dùng bằng **TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ**, đúng chính tả và chuẩn Unicode UTF-8.
   - Tuyệt đối không viết tiếng Việt không dấu (unaccented / ASCII Vietnamese) trong bất kỳ trường hợp nào.

2. **Chú thích trong mã nguồn (Code Comments & Docstrings)**:
   - Toàn bộ chú thích (comments), giải thích logic nghiệp vụ, tài liệu hàm/lớp (docstrings) trong mã nguồn BẮT BUỘC phải viết bằng **TIẾNG VIỆT CÓ DẤU**.
   - Tuyệt đối không viết chú thích kiểu không dấu (ví dụ: không viết // Quan ly kho luu tru, phải viết // Quản lý kho lưu trữ).
   - Nếu gặp file mã nguồn cũ có chứa chú thích tiếng Việt không dấu, khi sửa đổi hoặc thêm mới code tại file đó, phải chủ động viết chú thích mới bằng tiếng Việt có dấu, tuyệt đối không bắt chước theo kiểu không dấu cũ.

3. **Kế hoạch & Quy trình Superpowers / Subagents**:
   - Mọi kế hoạch công việc (Plans), danh sách nhiệm vụ (Todos), hướng dẫn dispatch và báo cáo thực thi của Subagent phải sử dụng tiếng Việt có dấu đầy đủ.
   - Subagent phải tuân thủ nghiêm ngặt quy định viết chú thích code bằng tiếng Việt có dấu trong toàn bộ các file code được chỉnh sửa hoặc tạo mới.
