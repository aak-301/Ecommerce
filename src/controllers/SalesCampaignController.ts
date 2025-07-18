// src/controllers/SalesCampaignController.ts
import { Request, Response } from "express";
import { SalesCampaignService } from "../services/SalesCampaignService";
import { sendResponse } from "../utils/response";
import { User } from "../types";
import { CampaignSearchParams } from "../types/sales-campaign";

interface AuthRequest extends Request {
  user?: User;
}

export class SalesCampaignController {
  // Create a new sales campaign
  static async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const campaign = await SalesCampaignService.createCampaign(
        req.body,
        req.user.id
      );

      sendResponse(res, 201, true, "Sales campaign created successfully", {
        campaign,
      });
    } catch (error) {
      console.error("Create campaign error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create sales campaign",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update a sales campaign
  static async updateCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const campaign = await SalesCampaignService.updateCampaign(
        id,
        req.body,
        req.user.id
      );

      if (!campaign) {
        sendResponse(res, 404, false, "Sales campaign not found");
        return;
      }

      sendResponse(res, 200, true, "Sales campaign updated successfully", {
        campaign,
      });
    } catch (error) {
      console.error("Update campaign error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update sales campaign",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get campaign by ID
  static async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await SalesCampaignService.getCampaignById(id);

      if (!campaign) {
        sendResponse(res, 404, false, "Sales campaign not found");
        return;
      }

      sendResponse(res, 200, true, "Sales campaign retrieved successfully", {
        campaign,
      });
    } catch (error) {
      console.error("Get campaign error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve sales campaign",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search campaigns with filters
  static async searchCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      const searchParams: CampaignSearchParams = {
        search: req.query.search as string,
        campaign_type: req.query.campaign_type as any,
        status: req.query.status as any,
        applies_to: req.query.applies_to as any,
        start_date_from: req.query.start_date_from
          ? new Date(req.query.start_date_from as string)
          : undefined,
        start_date_to: req.query.start_date_to
          ? new Date(req.query.start_date_to as string)
          : undefined,
        end_date_from: req.query.end_date_from
          ? new Date(req.query.end_date_from as string)
          : undefined,
        end_date_to: req.query.end_date_to
          ? new Date(req.query.end_date_to as string)
          : undefined,
        created_by: req.query.created_by as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await SalesCampaignService.searchCampaigns(searchParams);

      sendResponse(res, 200, true, "Sales campaigns retrieved successfully", {
        campaigns: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Search campaigns error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search sales campaigns",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete campaign
  static async deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await SalesCampaignService.deleteCampaign(id);

      if (!success) {
        sendResponse(res, 404, false, "Sales campaign not found");
        return;
      }

      sendResponse(res, 200, true, "Sales campaign deleted successfully");
    } catch (error) {
      console.error("Delete campaign error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete sales campaign",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update campaign status
  static async updateCampaignStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const campaign = await SalesCampaignService.updateCampaignStatus(
        id,
        status,
        req.user.id
      );

      if (!campaign) {
        sendResponse(res, 404, false, "Sales campaign not found");
        return;
      }

      sendResponse(res, 200, true, "Campaign status updated successfully", {
        campaign,
      });
    } catch (error) {
      console.error("Update campaign status error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update campaign status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get active campaigns for product
  static async getActiveCampaignsForProduct(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { productId } = req.params;
      const campaigns = await SalesCampaignService.getActiveCampaignsForProduct(
        productId
      );

      sendResponse(res, 200, true, "Active campaigns retrieved successfully", {
        campaigns,
        count: campaigns.length,
      });
    } catch (error) {
      console.error("Get active campaigns for product error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve active campaigns",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get campaign analytics
  static async getCampaignAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const analytics = await SalesCampaignService.getCampaignAnalytics(id);

      sendResponse(
        res,
        200,
        true,
        "Campaign analytics retrieved successfully",
        {
          analytics,
        }
      );
    } catch (error) {
      console.error("Get campaign analytics error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve campaign analytics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get campaign usage history
  static async getCampaignUsageHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const history = await SalesCampaignService.getCampaignUsageHistory(
        id,
        limit,
        offset
      );

      sendResponse(
        res,
        200,
        true,
        "Campaign usage history retrieved successfully",
        {
          usage_history: history,
          pagination: {
            limit,
            offset,
            has_more: history.length === limit,
          },
        }
      );
    } catch (error) {
      console.error("Get campaign usage history error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve campaign usage history",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get expiring campaigns
  static async getExpiringCampaigns(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const campaigns = await SalesCampaignService.getExpiringCampaigns(days);

      sendResponse(
        res,
        200,
        true,
        "Expiring campaigns retrieved successfully",
        {
          campaigns,
          expiring_in_days: days,
          count: campaigns.length,
        }
      );
    } catch (error) {
      console.error("Get expiring campaigns error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve expiring campaigns",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get campaign performance summary
  static async getCampaignPerformanceSummary(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const summary =
        await SalesCampaignService.getCampaignPerformanceSummary();

      sendResponse(
        res,
        200,
        true,
        "Campaign performance summary retrieved successfully",
        {
          summary,
        }
      );
    } catch (error) {
      console.error("Get campaign performance summary error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve campaign performance summary",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

// src/controllers/CouponController.ts
import { CouponService } from "../services/CouponService";
import { CouponSearchParams } from "../types/sales-campaign";

export class CouponController {
  // Create a new coupon
  static async createCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const coupon = await CouponService.createCoupon(req.body, req.user.id);

      sendResponse(res, 201, true, "Coupon created successfully", {
        coupon,
      });
    } catch (error) {
      console.error("Create coupon error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update a coupon
  static async updateCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const coupon = await CouponService.updateCoupon(
        id,
        req.body,
        req.user.id
      );

      if (!coupon) {
        sendResponse(res, 404, false, "Coupon not found");
        return;
      }

      sendResponse(res, 200, true, "Coupon updated successfully", {
        coupon,
      });
    } catch (error) {
      console.error("Update coupon error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get coupon by ID
  static async getCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const coupon = await CouponService.getCouponById(id);

      if (!coupon) {
        sendResponse(res, 404, false, "Coupon not found");
        return;
      }

      sendResponse(res, 200, true, "Coupon retrieved successfully", {
        coupon,
      });
    } catch (error) {
      console.error("Get coupon error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Validate coupon code
  static async validateCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { code, order_amount } = req.body;
      const product_ids = req.body.product_ids || [];
      const category_ids = req.body.category_ids || [];

      const validation = await CouponService.validateCoupon({
        code,
        user_id: req.user.id,
        order_amount,
        product_ids,
        category_ids,
      });

      sendResponse(res, 200, true, "Coupon validation completed", {
        validation,
      });
    } catch (error) {
      console.error("Validate coupon error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to validate coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search coupons with filters
  static async searchCoupons(req: AuthRequest, res: Response): Promise<void> {
    try {
      const searchParams: CouponSearchParams = {
        search: req.query.search as string,
        status: req.query.status as any,
        discount_type: req.query.discount_type as any,
        applies_to: req.query.applies_to as string,
        valid_from: req.query.valid_from
          ? new Date(req.query.valid_from as string)
          : undefined,
        valid_until: req.query.valid_until
          ? new Date(req.query.valid_until as string)
          : undefined,
        created_by: req.query.created_by as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await CouponService.searchCoupons(searchParams);

      sendResponse(res, 200, true, "Coupons retrieved successfully", {
        coupons: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Search coupons error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search coupons",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete coupon
  static async deleteCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await CouponService.deleteCoupon(id);

      if (!success) {
        sendResponse(res, 404, false, "Coupon not found");
        return;
      }

      sendResponse(res, 200, true, "Coupon deleted successfully");
    } catch (error) {
      console.error("Delete coupon error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get active coupons
  static async getActiveCoupons(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const coupons = await CouponService.getActiveCoupons(limit);

      sendResponse(res, 200, true, "Active coupons retrieved successfully", {
        coupons,
        count: coupons.length,
      });
    } catch (error) {
      console.error("Get active coupons error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve active coupons",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get coupon analytics
  static async getCouponAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const analytics = await CouponService.getCouponAnalytics(id);

      sendResponse(res, 200, true, "Coupon analytics retrieved successfully", {
        analytics,
      });
    } catch (error) {
      console.error("Get coupon analytics error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve coupon analytics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get coupon usage history
  static async getCouponUsageHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const history = await CouponService.getCouponUsageHistory(
        id,
        limit,
        offset
      );

      sendResponse(
        res,
        200,
        true,
        "Coupon usage history retrieved successfully",
        {
          usage_history: history,
          pagination: {
            limit,
            offset,
            has_more: history.length === limit,
          },
        }
      );
    } catch (error) {
      console.error("Get coupon usage history error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve coupon usage history",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Generate bulk coupon codes
  static async generateBulkCoupons(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { count, prefix, template } = req.body;

      if (!count || count <= 0 || count > 1000) {
        sendResponse(res, 400, false, "Count must be between 1 and 1000");
        return;
      }

      const coupons = await CouponService.generateBulkCoupons(
        count,
        prefix,
        template,
        req.user.id
      );

      sendResponse(res, 201, true, "Bulk coupons generated successfully", {
        coupons,
        count: coupons.length,
      });
    } catch (error) {
      console.error("Generate bulk coupons error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to generate bulk coupons",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

// src/controllers/BogoController.ts
import { BogoService } from "../services/BogoService";
import { BogoSearchParams } from "../types/sales-campaign";

export class BogoController {
  // Create a new BOGO offer
  static async createBogoOffer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const bogo = await BogoService.createBogoOffer(req.body, req.user.id);

      sendResponse(res, 201, true, "BOGO offer created successfully", {
        bogo_offer: bogo,
      });
    } catch (error) {
      console.error("Create BOGO offer error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create BOGO offer",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update a BOGO offer
  static async updateBogoOffer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const bogo = await BogoService.updateBogoOffer(id, req.body);

      if (!bogo) {
        sendResponse(res, 404, false, "BOGO offer not found");
        return;
      }

      sendResponse(res, 200, true, "BOGO offer updated successfully", {
        bogo_offer: bogo,
      });
    } catch (error) {
      console.error("Update BOGO offer error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update BOGO offer",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get BOGO offer by ID
  static async getBogoOffer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const bogo = await BogoService.getBogoOfferById(id);

      if (!bogo) {
        sendResponse(res, 404, false, "BOGO offer not found");
        return;
      }

      sendResponse(res, 200, true, "BOGO offer retrieved successfully", {
        bogo_offer: bogo,
      });
    } catch (error) {
      console.error("Get BOGO offer error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve BOGO offer",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search BOGO offers with filters
  static async searchBogoOffers(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const searchParams: BogoSearchParams = {
        search: req.query.search as string,
        status: req.query.status as any,
        start_date_from: req.query.start_date_from
          ? new Date(req.query.start_date_from as string)
          : undefined,
        start_date_to: req.query.start_date_to
          ? new Date(req.query.start_date_to as string)
          : undefined,
        end_date_from: req.query.end_date_from
          ? new Date(req.query.end_date_from as string)
          : undefined,
        end_date_to: req.query.end_date_to
          ? new Date(req.query.end_date_to as string)
          : undefined,
        created_by: req.query.created_by as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await BogoService.searchBogoOffers(searchParams);

      sendResponse(res, 200, true, "BOGO offers retrieved successfully", {
        bogo_offers: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Search BOGO offers error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete BOGO offer
  static async deleteBogoOffer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await BogoService.deleteBogoOffer(id);

      if (!success) {
        sendResponse(res, 404, false, "BOGO offer not found");
        return;
      }

      sendResponse(res, 200, true, "BOGO offer deleted successfully");
    } catch (error) {
      console.error("Delete BOGO offer error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete BOGO offer",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update BOGO offer status
  static async updateBogoOfferStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const bogo = await BogoService.updateBogoOfferStatus(id, status);

      if (!bogo) {
        sendResponse(res, 404, false, "BOGO offer not found");
        return;
      }

      sendResponse(res, 200, true, "BOGO offer status updated successfully", {
        bogo_offer: bogo,
      });
    } catch (error) {
      console.error("Update BOGO offer status error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update BOGO offer status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get active BOGO offers for product
  static async getActiveBogoOffersForProduct(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { productId } = req.params;
      const offers = await BogoService.getActiveOffersForProduct(productId);

      sendResponse(
        res,
        200,
        true,
        "Active BOGO offers retrieved successfully",
        {
          bogo_offers: offers,
          count: offers.length,
        }
      );
    } catch (error) {
      console.error("Get active BOGO offers for product error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve active BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Check cart for BOGO eligibility
  static async checkCartForBogo(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { cart_items } = req.body;

      if (!cart_items || !Array.isArray(cart_items)) {
        sendResponse(res, 400, false, "Cart items are required");
        return;
      }

      const eligibleOffers = await BogoService.checkCartForBogo(cart_items);

      sendResponse(res, 200, true, "BOGO eligibility check completed", {
        eligible_offers: eligibleOffers,
        count: eligibleOffers.length,
      });
    } catch (error) {
      console.error("Check cart for BOGO error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to check cart for BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get BOGO analytics
  static async getBogoAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const analytics = await BogoService.getBogoAnalytics(id);

      sendResponse(res, 200, true, "BOGO analytics retrieved successfully", {
        analytics,
      });
    } catch (error) {
      console.error("Get BOGO analytics error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve BOGO analytics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get BOGO usage history
  static async getBogoUsageHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const history = await BogoService.getBogoUsageHistory(id, limit, offset);

      sendResponse(
        res,
        200,
        true,
        "BOGO usage history retrieved successfully",
        {
          usage_history: history,
          pagination: {
            limit,
            offset,
            has_more: history.length === limit,
          },
        }
      );
    } catch (error) {
      console.error("Get BOGO usage history error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve BOGO usage history",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get active BOGO offers (general)
  static async getActiveBogoOffers(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offers = await BogoService.getActiveOffers(limit);

      sendResponse(
        res,
        200,
        true,
        "Active BOGO offers retrieved successfully",
        {
          bogo_offers: offers,
          count: offers.length,
        }
      );
    } catch (error) {
      console.error("Get active BOGO offers error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve active BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get expiring BOGO offers
  static async getExpiringBogoOffers(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const offers = await BogoService.getExpiringOffers(days);

      sendResponse(
        res,
        200,
        true,
        "Expiring BOGO offers retrieved successfully",
        {
          bogo_offers: offers,
          expiring_in_days: days,
          count: offers.length,
        }
      );
    } catch (error) {
      console.error("Get expiring BOGO offers error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve expiring BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get most popular BOGO offers
  static async getMostPopularBogoOffers(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const offers = await BogoService.getMostPopular(limit);

      sendResponse(
        res,
        200,
        true,
        "Most popular BOGO offers retrieved successfully",
        {
          bogo_offers: offers,
          count: offers.length,
        }
      );
    } catch (error) {
      console.error("Get most popular BOGO offers error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve most popular BOGO offers",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Calculate BOGO discount
  static async calculateBogoDiscount(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { bogo_id, buy_product_id, buy_quantity, get_product_id } =
        req.body;

      if (!bogo_id || !buy_product_id || !buy_quantity) {
        sendResponse(
          res,
          400,
          false,
          "BOGO ID, buy product ID, and buy quantity are required"
        );
        return;
      }

      const calculation = await BogoService.calculateBogoDiscount(
        bogo_id,
        buy_product_id,
        buy_quantity,
        get_product_id
      );

      sendResponse(res, 200, true, "BOGO discount calculated successfully", {
        calculation,
      });
    } catch (error) {
      console.error("Calculate BOGO discount error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to calculate BOGO discount",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
