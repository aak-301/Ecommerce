// src/server.ts - Updated to include product routes
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import onboardRoutes from "./routes/onboardRoutes";
import accountRoutes from "./routes/accountRoutes";
import productRoutes from "./routes/productRoutes"; // Add this import

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
app.use("/api/products", productRoutes); // Add this route

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Complete Authentication & Product Management API",
    version: "1.0.0",
    endpoints: {
      authentication: "/api/auth",
      onboarding: "/api/onboard",
      account_management: "/api/account",
      product_management: "/api/products",
    },
    documentation: {
      postman_collection: "Available in project files",
      features: [
        "Magic link authentication",
        "Role-based access control",
        "Admin onboarding workflow",
        "Account deletion & restoration",
        "Product CRUD operations",
        "Inventory management",
        "Category management",
        "Bulk operations",
        "Excel import/export",
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
      product_management: "/api/products/*",
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🛍️  Product Management: http://localhost:${PORT}/api/products`);
});

export default app;
