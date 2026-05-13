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
      "OpenAPI 3.1 RESTful API for the Nebula commerce platform. Supports user, product, order, and payment workflows.",
    baseUrl: "https://api.nebula.dev/v2",
    servers: [{ url: "https://api.nebula.dev/v2", description: "Production" }],
  },
  tags: [
    {
      name: "Authentication",
      description: "Register, sign in, and manage JWT tokens.",
      endpoints: [
        {
          id: "auth-login",
          method: "POST",
          path: "/auth/login",
          summary: "Sign in user",
          description:
            "Authenticates email and password, then returns an access token and refresh token.",
          headers: [
            {
              name: "Content-Type",
              in: "header",
              type: "string",
              required: true,
              description: "Submitted content type",
              example: "application/json",
            },
            {
              name: "X-Client-Id",
              in: "header",
              type: "string",
              required: false,
              description: "Client identifier",
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
                description: "User email address",
                example: "alice@example.com",
              },
              {
                name: "password",
                type: "string",
                required: true,
                description: "Password (minimum 8 characters)",
                example: "********",
              },
              {
                name: "remember",
                type: "boolean",
                description: "Remember the sign-in session for 30 days",
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
              description: "Signed in successfully",
              example: {
                access_token: "eyJhbGciOiJIUzI1...",
                refresh_token: "rt_9f8a...",
                expires_in: 3600,
                user: { id: "u_123", email: "alice@example.com" },
              },
            },
            {
              status: 400,
              description: "Invalid request payload",
              example: { error: "invalid_request", message: "Email is required" },
            },
            {
              status: 401,
              description: "Invalid credentials",
              example: {
                error: "invalid_credentials",
                message: "The email or password is incorrect",
              },
            },
            {
              status: 429,
              description: "Too many attempts",
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
          summary: "Refresh access token",
          description: "Issues a new access token from a valid refresh token.",
          body: {
            contentType: "application/json",
            fields: [
              {
                name: "refresh_token",
                type: "string",
                required: true,
                description: "Active refresh token",
                example: "rt_9f8a...",
              },
            ],
            example: { refresh_token: "rt_9f8a7b6c5d4e3f2g1h" },
          },
          responses: [
            {
              status: 200,
              description: "Refreshed successfully",
              example: {
                access_token: "eyJhbGciOi...",
                expires_in: 3600,
              },
            },
            {
              status: 401,
              description: "Refresh token is expired or invalid",
              example: { error: "invalid_token" },
            },
          ],
        },
        {
          id: "auth-logout",
          method: "DELETE",
          path: "/auth/session",
          summary: "Sign out",
          description: "Revokes the token for the current session.",
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
            { status: 204, description: "Signed out successfully", example: null },
            {
              status: 401,
              description: "Unauthenticated",
              example: { error: "unauthorized" },
            },
          ],
        },
      ],
    },
    {
      name: "Users",
      description: "Manage user accounts and profiles.",
      endpoints: [
        {
          id: "users-list",
          method: "GET",
          path: "/users",
          summary: "List users",
          description: "Returns a paginated and filterable list of users.",
          headers: [
            {
              name: "Authorization",
              in: "header",
              type: "string",
              required: true,
              description: "Bearer token with admin scope",
              example: "Bearer eyJhbGc...",
            },
          ],
          params: [
            {
              name: "page",
              in: "query",
              type: "integer",
              description: "Page number (starts at 1)",
              example: "1",
            },
            {
              name: "limit",
              in: "query",
              type: "integer",
              description: "Records per page (1-100)",
              example: "20",
            },
            {
              name: "q",
              in: "query",
              type: "string",
              description: "Search keyword by email or name",
              example: "alice",
            },
            {
              name: "role",
              in: "query",
              type: "string",
              description: "Filter by role (admin|user|guest)",
              example: "user",
            },
          ],
          responses: [
            {
              status: 200,
              description: "Success",
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
              description: "Unauthenticated",
              example: { error: "unauthorized" },
            },
            {
              status: 403,
              description: "Forbidden",
              example: { error: "forbidden" },
            },
          ],
        },
        {
          id: "users-get",
          method: "GET",
          path: "/users/{userId}",
          summary: "Get user details",
          description: "Returns detailed information for a user by ID.",
          params: [
            {
              name: "userId",
              in: "path",
              type: "string",
              required: true,
              description: "User ID",
              example: "u_123",
            },
          ],
          responses: [
            {
              status: 200,
              description: "Success",
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
              description: "User not found",
              example: { error: "not_found", message: "User u_123 does not exist" },
            },
          ],
        },
        {
          id: "users-update",
          method: "PATCH",
          path: "/users/{userId}",
          summary: "Update user",
          description: "Partially updates a user profile.",
          params: [
            {
              name: "userId",
              in: "path",
              type: "string",
              required: true,
              description: "User ID",
              example: "u_123",
            },
          ],
          body: {
            contentType: "application/json",
            fields: [
              { name: "name", type: "string", description: "Display name", example: "Alice N." },
              { name: "phone", type: "string", description: "Phone number", example: "+84901234567" },
              { name: "avatar_url", type: "string", description: "Avatar image URL", example: "https://cdn.nebula.dev/u/123.png" },
            ],
            example: { name: "Alice N.", phone: "+84901234567" },
          },
          responses: [
            { status: 200, description: "Updated successfully", example: { id: "u_123", name: "Alice N." } },
            { status: 400, description: "Invalid payload", example: { error: "validation_error" } },
            { status: 404, description: "Not found", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Products",
      description: "Categories and products.",
      endpoints: [
        {
          id: "products-list",
          method: "GET",
          path: "/products",
          summary: "List products",
          description: "Supports search, category filtering, sorting, and pagination.",
          params: [
            { name: "category", in: "query", type: "string", description: "Category slug", example: "laptops" },
            { name: "min_price", in: "query", type: "number", description: "Minimum price", example: "100" },
            { name: "max_price", in: "query", type: "number", description: "Maximum price", example: "5000" },
            { name: "sort", in: "query", type: "string", description: "price_asc | price_desc | newest", example: "newest" },
          ],
          responses: [
            {
              status: 200,
              description: "Success",
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
          summary: "Create product",
          description: "Creates a new product. Requires the product:write scope.",
          headers: [
            { name: "Authorization", in: "header", type: "string", required: true, description: "Bearer token", example: "Bearer ..." },
            { name: "Idempotency-Key", in: "header", type: "string", description: "Key used to prevent duplicate requests", example: "c3f1-..." },
          ],
          body: {
            contentType: "application/json",
            fields: [
              { name: "name", type: "string", required: true, description: "Product name", example: "Aurora 14" },
              { name: "price", type: "number", required: true, description: "Price (USD)", example: 1299 },
              { name: "stock", type: "integer", required: true, description: "Available stock", example: 50 },
              { name: "category", type: "string", required: true, description: "Category slug", example: "laptops" },
              { name: "tags", type: "string[]", description: "Tags", example: ["new", "bestseller"] },
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
            { status: 201, description: "Created successfully", example: { id: "p_010", name: "Aurora 14" } },
            { status: 400, description: "Validation error", example: { error: "validation_error", fields: { price: "must be > 0" } } },
            { status: 409, description: "Product slug conflict", example: { error: "conflict" } },
          ],
        },
        {
          id: "products-delete",
          method: "DELETE",
          path: "/products/{productId}",
          summary: "Delete product",
          description: "Soft-deletes a product by ID.",
          params: [
            { name: "productId", in: "path", type: "string", required: true, description: "Product ID", example: "p_010" },
          ],
          responses: [
            { status: 204, description: "Deleted", example: null },
            { status: 404, description: "Does not exist", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Orders",
      description: "Create and manage orders.",
      endpoints: [
        {
          id: "orders-create",
          method: "POST",
          path: "/orders",
          summary: "Create order",
          description: "Creates an order from the current cart.",
          body: {
            contentType: "application/json",
            fields: [
              { name: "items", type: "OrderItem[]", required: true, description: "Order line items", example: [{ product_id: "p_001", qty: 1 }] },
              { name: "shipping_address_id", type: "string", required: true, description: "Shipping address ID", example: "addr_77" },
              { name: "coupon", type: "string", description: "Coupon code", example: "SPRING10" },
            ],
            example: {
              items: [{ product_id: "p_001", qty: 1 }],
              shipping_address_id: "addr_77",
              coupon: "SPRING10",
            },
          },
          responses: [
            { status: 201, description: "Created", example: { id: "o_555", total: 1169.1, status: "pending" } },
            { status: 402, description: "Payment failed", example: { error: "payment_required" } },
            { status: 422, description: "Could not process", example: { error: "out_of_stock", product_id: "p_001" } },
          ],
        },
        {
          id: "orders-get",
          method: "GET",
          path: "/orders/{orderId}",
          summary: "Get order details",
          description: "Returns order details including line items, shipping, and payment data.",
          params: [
            { name: "orderId", in: "path", type: "string", required: true, description: "Order ID", example: "o_555" },
          ],
          responses: [
            {
              status: 200,
              description: "Success",
              example: {
                id: "o_555",
                status: "paid",
                total: 1169.1,
                items: [{ product_id: "p_001", name: "Aurora 14", qty: 1, price: 1299 }],
                shipping: { carrier: "DHL", tracking: "JD012345" },
              },
            },
            { status: 404, description: "Not found", example: { error: "not_found" } },
          ],
        },
      ],
    },
    {
      name: "Webhooks",
      description: "Register for and receive system events.",
      endpoints: [
        {
          id: "webhooks-create",
          method: "POST",
          path: "/webhooks",
          summary: "Register webhook",
          description: "Registers a URL to receive events such as order.paid and product.updated.",
          body: {
            contentType: "application/json",
            fields: [
              { name: "url", type: "string", required: true, description: "Destination URL that receives POST requests", example: "https://hooks.acme.com/nebula" },
              { name: "events", type: "string[]", required: true, description: "List of subscribed events", example: ["order.paid", "order.refunded"] },
              { name: "secret", type: "string", description: "Secret used to sign HMAC payloads", example: "whsec_..." },
            ],
            example: {
              url: "https://hooks.acme.com/nebula",
              events: ["order.paid"],
              secret: "whsec_abc",
            },
          },
          responses: [
            { status: 201, description: "Registered successfully", example: { id: "wh_22", status: "active" } },
            { status: 400, description: "Invalid URL", example: { error: "invalid_url" } },
          ],
        },
      ],
    },
  ],
};
