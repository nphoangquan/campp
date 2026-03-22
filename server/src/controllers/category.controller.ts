import { Request, Response } from 'express';
import { Server } from '../models/Server';
import { Category } from '../models/Category';
import { Channel } from '../models/Channel';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/server.validator';

export async function createCategory(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  const result = createCategorySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  try {
    const server = await Server.findById(serverId);
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can create categories' });
      return;
    }

    const position = server.categories.length;
    const category = await Category.create({
      name: result.data.name,
      serverId,
      position,
    });

    server.categories.push(category._id as any);
    await server.save();

    res.status(201).json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const { categoryId } = req.params;
  const userId = req.user!.userId;

  const result = updateCategorySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const server = await Server.findById(category.serverId);
    if (!server || server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can update categories' });
      return;
    }

    category.name = result.data.name;
    await category.save();

    res.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const { categoryId } = req.params;
  const userId = req.user!.userId;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const server = await Server.findById(category.serverId);
    if (!server || server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can delete categories' });
      return;
    }

    // Channels trong category chuyển về không có category
    await Channel.updateMany({ categoryId }, { categoryId: null });

    await Server.findByIdAndUpdate(category.serverId, {
      $pull: { categories: categoryId },
    });
    await Category.findByIdAndDelete(categoryId);

    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
}

export async function reorderCategories(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;
  const { order } = req.body;

  if (!Array.isArray(order)) {
    res.status(400).json({ error: 'Order must be an array of category IDs' });
    return;
  }

  try {
    const server = await Server.findById(serverId);
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can reorder categories' });
      return;
    }

    for (let i = 0; i < order.length; i++) {
      await Category.findByIdAndUpdate(order[i], { position: i });
    }

    server.categories = order as any;
    await server.save();

    res.json({ message: 'Categories reordered' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
}
