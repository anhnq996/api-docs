export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Param {
  name: string;
  in: "path" | "query" | "header";
  type: string;
  required?: boolean;
  description: string;
  example?: string;
}

export interface BodyField {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  example?: unknown;
}

export interface ResponseSpec {
  status: number;
  description: string;
  example: unknown;
}

export interface RequestBodySpec {
  contentType: string;
  fields: BodyField[];
  example: unknown;
  schemaType?: string;
  description?: string;
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  headers?: Param[];
  params?: Param[];
  body?: RequestBodySpec;
  bodies?: RequestBodySpec[];
  responses: ResponseSpec[];
}

export interface Tag {
  name: string;
  description: string;
  endpoints: Endpoint[];
}

export interface ApiSpec {
  info: {
    title: string;
    version: string;
    description: string;
    baseUrl: string;
    servers?: ApiServer[];
  };
  tags: Tag[];
}

export interface ApiServer {
  url: string;
  description?: string;
}

export const spec: ApiSpec = {
  info: {
    title: "Nebula Commerce API",
    version: "2.4.1",
    description:
      "RESTful API chuẩn OpenAPI 3.1 cho nền tảng thương mại điện tử Nebula. Hỗ trợ quản lý người dùng, sản phẩm, đơn hàng và thanh toán.",
    baseUrl: "https://api.nebula.dev/v2",
    servers: [{ url: "https://api.nebula.dev/v2", description: "Production" }],
  },
  tags: [
    {
      name: "Authentication",
      description: "Đăng ký, đăng nhập và quản lý token JWT.",
      endpoints: [
        {
          id: "auth-login",
          method: "POST",
          path: "/auth/login",
          summary: "Đăng nhập người dùng",
          description:
            "Xác thực email/password, trả về access token và refresh token.",
          headers: [
            {
              name: "Content-Type",
              in: "header",
              type: "string",
              required: true,
              description: "Kiểu dữ liệu gửi lên",
              example: "application/json",
            },
            {
              name: "X-Client-Id",
              in: "header",
              type: "string",
              required: false,
              description: "Mã định danh client",
              example: "web-app-v2",
            },
          ],
          body: {
            contentType: "application/json",
            fields: [
              {
                name: "email",
                type: "string",
                required: true,
                description: "Địa chỉ email người dùng",
                example: "alice@example.com",
              },
              {
                name: "password",
                type: "string",
                required: true,
                description: "Mật khẩu (tối thiểu 8 ký tự)",
                example: "••••••••",
              },
              {
                name: "remember",
                type: "boolean",
                description: "Ghi nhớ phiên đăng nhập 30 ngày",
                example: true,
              },
            ],
            example: {
              email: "alice@example.com",
              password: "SuperSecret!23",
              remember: true,
            },
          },
          responses: [
            {
              status: 200,
              description: "Đăng nhập thành công",
              example: {
                access_token: "eyJhbGciOiJIUzI1...",
                refresh_token: "rt_9f8a...",
                expires_in: 3600,
                user: { id: "u_123", email: "alice@example.com" },
              },
            },
            {
              status: 400,
              description: "Dữ liệu gửi lên không hợp lệ",
              example: { error: "invalid_request", message: "Email is required" },
            },
            {
              status: 401,
              description: "Sai thông tin đăng nhập",
              example: {
                error: "invalid_credentials",
                message: "Email hoặc mật khẩu không đúng",
              },
            },
            {
              status: 429,
              description: "Vượt quá số lần thử cho phép",
              example: {
                error: "too_many_requests",
                retry_after: 60,
              },
            },
          ],
        },
        {
          id: "auth-refresh",
          method: "POST",
          path: "/auth/refresh",
          summary: "Làm mới access token",
          description: "Cấp lại access token mới từ refresh token hợp lệ.",
          body: {
            contentType: "application/json",
            fields: [
              {
                name: "refresh_token",
                type: "string",
                required: true,
                description: "Refresh token đang có hiệu lực",
                example: "rt_9f8a...",
              },
            ],
            example: { refresh_token: "rt_9f8a7b6c5d4e3f2g1h" },
          },
          responses: [
            {
              status: 200,
              description: "Làm mới thành công",
              example: {
                access_token: "eyJhbGciOi...",
                expires_in: 3600,
              },
            },
            {
              status: 401,
              description: "Refresh token hết hạn hoặc không hợp lệ",
              example: { error: "invalid_token" },
            },
          ],
        },
        {
          id: "auth-logout",
          method: "DELETE",
          path: "/auth/session",
          summary: "Đăng xuất",
          description: "Thu hồi token của phiên hiện tại.",
          headers: [
            {
              name: "Authorization",
              in: "header",
              type: "string",
              required: true,
              description: "Bearer access token",
              example: "Bearer eyJhbGciOi...",
            },
          ],
          responses: [
            { status: 204, description: "Đăng xuất thành công", example: null },
            {
              status: 401,
              description: "Chưa xác thực",
              example: { error: "unauthorized" },
            },
          ],
        },
      ],
    },
    {
      name: "Users",
      description: "Quản lý tài khoản người dùng và hồ sơ.",
      endpoints: [
        {
          id: "users-list",
          method: "GET",
          path: "/users",
          summary: "Danh sách người dùng",
          description: "Lấy danh sách người dùng với phân trang và lọc.",
          headers: [
            {
              name: "Authorization",
              in: "header",
              type: "string",
              required: true,
              description: "Bearer token với scope admin",
              example: "Bearer eyJhbGc...",
            },
          ],
          params: [
            {
              name: "page",
              in: "query",
              type: "integer",
              description: "Số trang (bắt đầu từ 1)",
              example: "1",
            },
            {
              name: "limit",
              in: "query",
              type: "integer",
              description: "Số bản ghi/trang (1-100)",
              example: "20",
            },
            {
              name: "q",
              in: "query",
              type: "string",
              description: "Từ khoá tìm kiếm theo email/tên",
              example: "alice",
            },
            {
              name: "role",
              in: "query",
              type: "string",
              description: "Lọc theo vai trò (admin|user|guest)",
              example: "user",
            },
          ],
          responses: [
            {
              status: 200,
              description: "Thành công",
              example: {
                data: [
                  {
                    id: "u_123",
                    email: "alice@example.com",
                    name: "Alice Nguyen",
                    role: "user",
                    created_at: "2026-01-14T08:22:11Z",
                  },
                ],
                meta: { page: 1, limit: 20, total: 1284 },
              },
            },
            {
              status: 401,
              description: "Chưa xác thực",
              example: { error: "unauthorized" },
            },
            {
              status: 403,
              description: "Không đủ quyền",
              example: { error: "forbidden" },
            },
          ],
        },
        {
          id: "users-get",
          method: "GET",
          path: "/users/{userId}",
          summary: "Chi tiết người dùng",
          description: "Lấy thông tin chi tiết của một người dùng theo ID.",
          params: [
            {
              name: "userId",
              in: "path",
              type: "string",
              required: true,
              description: "ID người dùng",
              example: "u_123",
            },
          ],
          responses: [
            {
              status: 200,
              description: "Thành công",
              example: {
                id: "u_123",
                email: "alice@example.com",
                name: "Alice Nguyen",
                role: "user",
                phone: "+84901234567",
                created_at: "2026-01-14T08:22:11Z",
              },
            },
            {
              status: 404,
              description: "Không tìm thấy người dùng",
              example: { error: "not_found", message: "User u_123 không tồn tại" },
            },
          ],
        },
        {
          id: "users-update",
          method: "PATCH",
          path: "/users/{userId}",
          summary: "Cập nhật người dùng",
          description: "Cập nhật một phần thông tin hồ sơ người dùng.",
          params: [
            {
              name: "userId",
              in: "path",
              type: "string",
              required: true,
              description: "ID người dùng",
              example: "u_123",
            },
          ],
          body: {
            contentType: "application/json",
            fields: [
              { name: "name", type: "string", description: "Tên hiển thị", example: "Alice N." },
              { name: "phone", type: "string", description: "Số điện thoại", example: "+84901234567" },
              { name: "avatar_url", type: "string", description: "URL ảnh đại diện", example: "https://cdn.nebula.dev/u/123.png" },
            ],
            example: { name: "Alice N.", phone: "+84901234567" },
          },
          responses: [
            { status: 200, description: "Cập nhật thành công", example: { id: "u_123", name: "Alice N." } },
            { status: 400, description: "Payload không hợp lệ", example: { error: "validation_error" } },
            { status: 404, description: "Không tìm thấy", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Products",
      description: "Danh mục và sản phẩm.",
      endpoints: [
        {
          id: "products-list",
          method: "GET",
          path: "/products",
          summary: "Danh sách sản phẩm",
          description: "Hỗ trợ tìm kiếm, lọc theo danh mục, sắp xếp và phân trang.",
          params: [
            { name: "category", in: "query", type: "string", description: "Slug danh mục", example: "laptops" },
            { name: "min_price", in: "query", type: "number", description: "Giá tối thiểu", example: "100" },
            { name: "max_price", in: "query", type: "number", description: "Giá tối đa", example: "5000" },
            { name: "sort", in: "query", type: "string", description: "price_asc | price_desc | newest", example: "newest" },
          ],
          responses: [
            {
              status: 200,
              description: "Thành công",
              example: {
                data: [
                  { id: "p_001", name: "Aurora 14", price: 1299, stock: 42, category: "laptops" },
                  { id: "p_002", name: "Nebula Pad Pro", price: 899, stock: 17, category: "tablets" },
                ],
                meta: { total: 482 },
              },
            },
          ],
        },
        {
          id: "products-create",
          method: "POST",
          path: "/products",
          summary: "Tạo sản phẩm",
          description: "Tạo mới sản phẩm. Yêu cầu scope product:write.",
          headers: [
            { name: "Authorization", in: "header", type: "string", required: true, description: "Bearer token", example: "Bearer ..." },
            { name: "Idempotency-Key", in: "header", type: "string", description: "Khoá tránh trùng lặp", example: "c3f1-..." },
          ],
          body: {
            contentType: "application/json",
            fields: [
              { name: "name", type: "string", required: true, description: "Tên sản phẩm", example: "Aurora 14" },
              { name: "price", type: "number", required: true, description: "Giá (USD)", example: 1299 },
              { name: "stock", type: "integer", required: true, description: "Số lượng tồn", example: 50 },
              { name: "category", type: "string", required: true, description: "Slug danh mục", example: "laptops" },
              { name: "tags", type: "string[]", description: "Nhãn", example: ["new", "bestseller"] },
            ],
            example: {
              name: "Aurora 14",
              price: 1299,
              stock: 50,
              category: "laptops",
              tags: ["new"],
            },
          },
          responses: [
            { status: 201, description: "Tạo thành công", example: { id: "p_010", name: "Aurora 14" } },
            { status: 400, description: "Lỗi validate", example: { error: "validation_error", fields: { price: "must be > 0" } } },
            { status: 409, description: "Trùng slug sản phẩm", example: { error: "conflict" } },
          ],
        },
        {
          id: "products-delete",
          method: "DELETE",
          path: "/products/{productId}",
          summary: "Xoá sản phẩm",
          description: "Xoá mềm một sản phẩm theo ID.",
          params: [
            { name: "productId", in: "path", type: "string", required: true, description: "ID sản phẩm", example: "p_010" },
          ],
          responses: [
            { status: 204, description: "Đã xoá", example: null },
            { status: 404, description: "Không tồn tại", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Orders",
      description: "Tạo và quản lý đơn hàng.",
      endpoints: [
        {
          id: "orders-create",
          method: "POST",
          path: "/orders",
          summary: "Tạo đơn hàng",
          description: "Tạo đơn hàng từ giỏ hàng hiện tại.",
          body: {
            contentType: "application/json",
            fields: [
              { name: "items", type: "OrderItem[]", required: true, description: "Danh sách mục hàng", example: [{ product_id: "p_001", qty: 1 }] },
              { name: "shipping_address_id", type: "string", required: true, description: "ID địa chỉ giao hàng", example: "addr_77" },
              { name: "coupon", type: "string", description: "Mã khuyến mại", example: "SPRING10" },
            ],
            example: {
              items: [{ product_id: "p_001", qty: 1 }],
              shipping_address_id: "addr_77",
              coupon: "SPRING10",
            },
          },
          responses: [
            { status: 201, description: "Đã tạo", example: { id: "o_555", total: 1169.1, status: "pending" } },
            { status: 402, description: "Thanh toán thất bại", example: { error: "payment_required" } },
            { status: 422, description: "Không thể xử lý", example: { error: "out_of_stock", product_id: "p_001" } },
          ],
        },
        {
          id: "orders-get",
          method: "GET",
          path: "/orders/{orderId}",
          summary: "Chi tiết đơn hàng",
          description: "Lấy chi tiết đơn hàng bao gồm mục hàng, vận chuyển và thanh toán.",
          params: [
            { name: "orderId", in: "path", type: "string", required: true, description: "ID đơn hàng", example: "o_555" },
          ],
          responses: [
            {
              status: 200,
              description: "Thành công",
              example: {
                id: "o_555",
                status: "paid",
                total: 1169.1,
                items: [{ product_id: "p_001", name: "Aurora 14", qty: 1, price: 1299 }],
                shipping: { carrier: "DHL", tracking: "JD012345" },
              },
            },
            { status: 404, description: "Không tìm thấy", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Webhooks",
      description: "Đăng ký và nhận sự kiện hệ thống.",
      endpoints: [
        {
          id: "webhooks-create",
          method: "POST",
          path: "/webhooks",
          summary: "Đăng ký webhook",
          description: "Đăng ký URL nhận sự kiện (order.paid, product.updated,...).",
          body: {
            contentType: "application/json",
            fields: [
              { name: "url", type: "string", required: true, description: "URL đích nhận POST", example: "https://hooks.acme.com/nebula" },
              { name: "events", type: "string[]", required: true, description: "Danh sách sự kiện quan tâm", example: ["order.paid", "order.refunded"] },
              { name: "secret", type: "string", description: "Secret để ký HMAC", example: "whsec_..." },
            ],
            example: {
              url: "https://hooks.acme.com/nebula",
              events: ["order.paid"],
              secret: "whsec_abc",
            },
          },
          responses: [
            { status: 201, description: "Đăng ký thành công", example: { id: "wh_22", status: "active" } },
            { status: 400, description: "URL không hợp lệ", example: { error: "invalid_url" } },
          ],
        },
      ],
    },
  ],
};
