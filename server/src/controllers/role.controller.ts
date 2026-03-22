import { Request, Response } from 'express';
import { Server } from '../models/Server';
import { Role } from '../models/Role';
import { AuditLog } from '../models/AuditLog';
import { ADMIN_PERMISSIONS, MODERATOR_PERMISSIONS, MEMBER_PERMISSIONS } from '../utils/permissions';
import type { MemberRole } from '../models/Server';

export async function getRoles(req: Request, res: Response): Promise<void> {
  const { serverId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    const isMember = server.members.some((m) => String(m.userId) === userId);
    if (!isMember) { res.status(403).json({ error: 'Not a member' }); return; }

    const sid = String(server._id);
    let roles = await Role.find({ serverId: sid }).sort('position');
    if (roles.length === 0) {
      const roleIds = await initDefaultRoles(sid);
      server.roles = roleIds as any;
      await server.save();
      roles = await Role.find({ serverId: sid }).sort('position');
    }
    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
}

export async function createRole(req: Request, res: Response): Promise<void> {
  const serverIdParam = req.params.serverId;
  const serverIdStr = Array.isArray(serverIdParam) ? serverIdParam[0] : serverIdParam;
  const userId = req.user!.userId;
  const { name, color, permissions } = req.body;

  try {
    const server = await Server.findById(serverIdStr);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }

    const sid = String(server._id);
    const isOwner = server.ownerId.toString() === userId;
    const member = server.members.find((m) => String(m.userId) === userId);
    const isModerator = member?.role === 'moderator' || member?.role === 'admin';

    if (!isOwner && !isModerator) {
      res.status(403).json({ error: 'Only owner or moderator can create roles' }); return;
    }

    // Owner: any permissions. Moderator: only moderation and below (no Administrator).
    const rolePerms = isOwner
      ? (permissions ?? MEMBER_PERMISSIONS)
      : ((permissions ?? MEMBER_PERMISSIONS) & MODERATOR_PERMISSIONS);

    const maxPos = await Role.findOne({ serverId: sid }).sort('-position');
    const position = (maxPos?.position ?? 0) + 1;

    const role = await Role.create({
      name: (name || 'new role').trim(),
      type: 'member',
      color: color || '#99AAB5',
      permissions: rolePerms,
      position,
      serverId: sid,
      isSystemRole: false,
    });

    await AuditLog.create({
      serverId: sid, action: 'ROLE_CREATE', moderatorId: userId,
      metadata: { roleName: role.name },
    });

    res.status(201).json({ role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const { roleId } = req.params;
  const userId = req.user!.userId;
  const { name, color, permissions } = req.body;

  try {
    const role = await Role.findById(roleId);
    if (!role) { res.status(404).json({ error: 'Role not found' }); return; }

    const server = await Server.findById(role.serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }

    const isOwner = server.ownerId.toString() === userId;
    const member = server.members.find((m) => m.userId.toString() === userId);
    const isModerator = member?.role === 'moderator' || member?.role === 'admin';

    if (!isOwner && !isModerator) {
      res.status(403).json({ error: 'Insufficient permissions' }); return;
    }

    // Moderators cannot edit admin-type roles
    if (!isOwner && role.type === 'admin') {
      res.status(403).json({ error: 'Moderators cannot edit admin roles' }); return;
    }

    if (name !== undefined) role.name = name.trim();
    if (color !== undefined) role.color = color;
    if (permissions !== undefined) {
      // Moderators cannot grant admin permissions
      if (!isOwner) {
        const safePerms = permissions & MODERATOR_PERMISSIONS;
        role.permissions = safePerms;
      } else {
        role.permissions = permissions;
      }
    }
    await role.save();

    res.json({ role });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  const { roleId } = req.params;
  const userId = req.user!.userId;

  try {
    const role = await Role.findById(roleId);
    if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
    if (role.isSystemRole) { res.status(400).json({ error: 'Cannot delete system roles' }); return; }

    const server = await Server.findById(role.serverId);
    if (!server || server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can delete roles' }); return;
    }

    await Role.findByIdAndDelete(roleId);

    await AuditLog.create({
      serverId: role.serverId, action: 'ROLE_DELETE', moderatorId: userId,
      metadata: { roleName: role.name },
    });

    res.json({ message: 'Role deleted' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  const serverIdParam = req.params.serverId;
  const memberIdParam = req.params.memberId;
  const serverIdStr = Array.isArray(serverIdParam) ? serverIdParam[0] : serverIdParam;
  const memberIdStr = Array.isArray(memberIdParam) ? memberIdParam[0] : memberIdParam;
  const { role } = req.body;
  const userId = req.user!.userId;

  const validRoles: MemberRole[] = ['admin', 'moderator', 'member'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role. Must be: admin, moderator, or member' }); return;
  }

  try {
    const server = await Server.findById(serverIdStr);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }

    const isOwner = server.ownerId.toString() === userId;
    const actor = server.members.find((m) => String(m.userId) === userId);
    const isModerator = actor?.role === 'moderator' || actor?.role === 'admin';

    if (!isOwner && !isModerator) {
      res.status(403).json({ error: 'Only owner or moderator can assign roles' }); return;
    }
    if (!isOwner && role === 'admin') {
      res.status(403).json({ error: 'Only the server owner can assign the admin role' }); return;
    }

    const member = server.members.find((m) => String(m.userId) === memberIdStr);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    member.role = role;
    await server.save();

    await AuditLog.create({
      serverId: String(server._id), action: 'ROLE_ASSIGN', moderatorId: userId, targetId: memberIdStr,
      metadata: { role },
    });

    res.json({ message: `Role changed to ${role}`, member });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
}

export async function addCustomRoleToMember(req: Request, res: Response): Promise<void> {
  const serverIdStr = Array.isArray(req.params.serverId) ? req.params.serverId[0] : req.params.serverId;
  const memberIdStr = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const roleIdStr = Array.isArray(req.params.roleId) ? req.params.roleId[0] : req.params.roleId;
  const userId = req.user!.userId;

  try {
    const role = await Role.findById(roleIdStr);
    if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
    if (role.isSystemRole) { res.status(400).json({ error: 'Cannot assign system role via this endpoint' }); return; }
    if (String(role.serverId) !== serverIdStr) { res.status(400).json({ error: 'Role does not belong to this server' }); return; }

    const server = await Server.findById(serverIdStr);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    const isOwner = server.ownerId.toString() === userId;
    const actor = server.members.find((m) => String(m.userId) === userId);
    const isModerator = actor?.role === 'moderator' || actor?.role === 'admin';
    if (!isOwner && !isModerator) { res.status(403).json({ error: 'Only owner or moderator can assign custom roles' }); return; }

    const member = server.members.find((m) => String(m.userId) === memberIdStr);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    if (!member.customRoleIds) member.customRoleIds = [];
    const roleIdObj = role._id;
    if (member.customRoleIds.some((id) => String(id) === String(roleIdObj))) {
      res.json({ message: 'Member already has this role', member }); return;
    }
    member.customRoleIds.push(roleIdObj as any);
    await server.save();

    res.json({ message: 'Custom role added to member', member });
  } catch (error) {
    console.error('Add custom role to member error:', error);
    res.status(500).json({ error: 'Failed to add role to member' });
  }
}

export async function removeCustomRoleFromMember(req: Request, res: Response): Promise<void> {
  const serverIdStr = Array.isArray(req.params.serverId) ? req.params.serverId[0] : req.params.serverId;
  const memberIdStr = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const roleIdStr = Array.isArray(req.params.roleId) ? req.params.roleId[0] : req.params.roleId;
  const userId = req.user!.userId;

  try {
    const role = await Role.findById(roleIdStr);
    if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
    if (role.isSystemRole) { res.status(400).json({ error: 'Cannot remove system role via this endpoint' }); return; }

    const server = await Server.findById(serverIdStr);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    const isOwner = server.ownerId.toString() === userId;
    const actor = server.members.find((m) => String(m.userId) === userId);
    const isModerator = actor?.role === 'moderator' || actor?.role === 'admin';
    if (!isOwner && !isModerator) { res.status(403).json({ error: 'Only owner or moderator can remove custom roles' }); return; }

    const member = server.members.find((m) => String(m.userId) === memberIdStr);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    if (!member.customRoleIds) member.customRoleIds = [];
    const before = member.customRoleIds.length;
    member.customRoleIds = member.customRoleIds.filter((id) => String(id) !== String(roleIdStr));
    if (member.customRoleIds.length === before) {
      res.json({ message: 'Member did not have this role', member }); return;
    }
    await server.save();

    res.json({ message: 'Custom role removed from member', member });
  } catch (error) {
    console.error('Remove custom role from member error:', error);
    res.status(500).json({ error: 'Failed to remove role from member' });
  }
}

export async function toggleBooster(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can toggle booster' }); return;
    }

    const member = server.members.find((m) => m.userId.toString() === memberId);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    member.isBooster = !member.isBooster;
    await server.save();

    res.json({ message: `Booster ${member.isBooster ? 'enabled' : 'disabled'}`, member });
  } catch (error) {
    console.error('Toggle booster error:', error);
    res.status(500).json({ error: 'Failed to toggle booster' });
  }
}

export async function toggleVip(req: Request, res: Response): Promise<void> {
  const { serverId, memberId } = req.params;
  const userId = req.user!.userId;

  try {
    const server = await Server.findById(serverId);
    if (!server) { res.status(404).json({ error: 'Server not found' }); return; }
    if (server.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the server owner can toggle VIP' }); return;
    }

    const member = server.members.find((m) => m.userId.toString() === memberId);
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    member.isVip = !member.isVip;
    await server.save();

    res.json({ message: `VIP ${member.isVip ? 'enabled' : 'disabled'}`, member });
  } catch (error) {
    console.error('Toggle VIP error:', error);
    res.status(500).json({ error: 'Failed to toggle VIP' });
  }
}

export async function initDefaultRoles(serverId: string): Promise<string[]> {
  const roles = await Role.insertMany([
    { name: 'Admin', type: 'admin', color: '#ED4245', permissions: ADMIN_PERMISSIONS, position: 2, serverId, isSystemRole: true },
    { name: 'Moderator', type: 'moderator', color: '#FAA61A', permissions: MODERATOR_PERMISSIONS, position: 1, serverId, isSystemRole: true },
    { name: 'Member', type: 'member', color: '#99AAB5', permissions: MEMBER_PERMISSIONS, position: 0, serverId, isSystemRole: true },
  ]);
  return roles.map((r) => String(r._id));
}
