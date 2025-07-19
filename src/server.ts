// src/server.ts - Updated to include customer routes
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import onboardRoutes from "./routes/onboardRoutes";
import accountRoutes from "./routes/accountRoutes";
import productRoutes from "./routes/productRoutes";
import customerRoutes from "./routes/customerRoutes"; // Add this import

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/onboard", onboardRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/products", productRoutes); // Admin product management
app.use("/api/customer", customerRoutes); // Customer-facing features

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Complete E-commerce API with Customer Features",
    version: "2.0.0",
    endpoints: {
      authentication: "/api/auth",
      onboarding: "/api/onboard",
      account_management: "/api/account",
      admin_product_management: "/api/products",
      customer_features: "/api/customer",
    },
    customer_features: {
      product_browsing: "/api/customer/products",
      shopping_cart: "/api/customer/cart",
      order_management: "/api/customer/orders",
      address_management: "/api/customer/addresses",
      product_reviews: "/api/customer/reviews",
      wishlist: "/api/customer/wishlist",
      customer_profile: "/api/customer/profile",
    },
    documentation: {
      postman_collection: "Available in project files",
      features: [
        "Magic link authentication",
        "Role-based access control",
        "Admin onboarding workflow",
        "Account deletion & restoration",
        "Admin product CRUD operations",
        "Inventory management",
        "Category management",
        "Bulk operations",
        "Excel import/export",
        "Customer product browsing",
        "Shopping cart management",
        "Order placement & tracking",
        "Customer address management",
        "Product reviews & ratings",
        "Wishlist functionality",
        "Order cancellation",
        "Customer profile management",
        "Product search & filtering",
        "Cascade deletion",
      ],
    },
  });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: "Something went wrong!",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    available_endpoints: {
      api_info: "GET /api",
      health_check: "GET /health",
      authentication: "/api/auth/*",
      onboarding: "/api/onboard/*",
      account_management: "/api/account/*",
      admin_product_management: "/api/products/*",
      customer_features: "/api/customer/*",
    },
    customer_endpoints: {
      product_browsing: {
        all_products: "GET /api/customer/products",
        product_details: "GET /api/customer/products/:id",
        search_products: "GET /api/customer/products/search?q=query",
        featured_products: "GET /api/customer/products/featured",
        categories: "GET /api/customer/categories",
      },
      shopping: {
        cart: "GET|POST|PUT|DELETE /api/customer/cart/*",
        wishlist: "GET|POST|DELETE /api/customer/wishlist/*",
        orders: "GET|POST /api/customer/orders/*",
        addresses: "GET|POST|PUT|DELETE /api/customer/addresses/*",
      },
      reviews: {
        create: "POST /api/customer/reviews",
        my_reviews: "GET /api/customer/reviews",
        update: "PUT /api/customer/reviews/:id",
        delete: "DELETE /api/customer/reviews/:id",
      },
      profile: {
        get_profile: "GET /api/customer/profile",
      },
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🏪 Admin Management: http://localhost:${PORT}/api/products`);
  console.log(`🛒 Customer Features: http://localhost:${PORT}/api/customer`);
  console.log(``);
  console.log(`🎯 Customer Endpoints:`);
  console.log(`   📱 Product Browsing: /api/customer/products`);
  console.log(`   🛍️  Shopping Cart: /api/customer/cart`);
  console.log(`   📦 Order Management: /api/customer/orders`);
  console.log(`   🏠 Address Management: /api/customer/addresses`);
  console.log(`   ⭐ Product Reviews: /api/customer/reviews`);
  console.log(`   💝 Wishlist: /api/customer/wishlist`);
  console.log(`   👤 Customer Profile: /api/customer/profile`);
});

export default app;