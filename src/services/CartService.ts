// src/services/CartService.ts
import { CartModel } from "../models/CartModel";
import { ProductModel } from "../models/ProductModel";
import {
  ShoppingCart,
  CartItem,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "../types/product";

export class CartService {
  // Get user's cart with items
  static async getUserCart(userId: string): Promise<ShoppingCart> {
    const cart = await CartModel.getOrCreateCart(userId);
    return (await CartModel.getCartWithItems(cart.id)) || cart;
  }

  // Add item to cart
  static async addItemToCart(
    userId: string,
    itemData: AddToCartRequest
  ): Promise<CartItem> {
    // Validate product exists and is available
    const product = await ProductModel.findById(itemData.product_id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.status !== "published" || product.visibility !== "public") {
      throw new Error("Product is not available for purchase");
    }

    // Check stock availability
    if (product.track_quantity && !product.allow_backorders) {
      if (itemData.variant_id) {
        // Check variant stock
        // This would require a variant model implementation
      } else {
        if (product.quantity < itemData.quantity) {
          throw new Error(`Only ${product.quantity} units available`);
        }
      }
    }

    const cart = await CartModel.getOrCreateCart(userId);
    return await CartModel.addItem(cart.id, itemData);
  }

  // Update cart item
  static async updateCartItem(
    itemId: string,
    userId: string,
    updates: UpdateCartItemRequest
  ): Promise<CartItem | null> {
    // Verify the item belongs to the user's cart
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("Cart not found");
    }

    return await CartModel.updateItem(itemId, updates);
  }

  // Remove cart item
  static async removeCartItem(
    itemId: string,
    userId: string
  ): Promise<boolean> {
    // Verify the item belongs to the user's cart
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("Cart not found");
    }

    return await CartModel.removeItem(itemId);
  }

  // Clear user's cart
  static async clearUserCart(userId: string): Promise<boolean> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      return false;
    }

    return await CartModel.clearCart(cart.id);
  }

  // Get cart summary
  static async getCartSummary(
    userId: string
  ): Promise<{ item_count: number; total: number }> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      return { item_count: 0, total: 0 };
    }

    const cartWithItems = await CartModel.getCartWithItems(cart.id);
    return {
      item_count: cartWithItems?.items?.length || 0,
      total: cartWithItems?.total || 0,
    };
  }
}
