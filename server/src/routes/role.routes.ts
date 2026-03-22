import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getRoles, createRole, updateRole, deleteRole, assignRole, addCustomRoleToMember, removeCustomRoleFromMember, toggleBooster, toggleVip } from '../controllers/role.controller';

const router = Router();
router.use(authenticate);

router.get('/:serverId/roles', getRoles);
router.post('/:serverId/roles', createRole);
router.patch('/roles/:roleId', updateRole);
router.delete('/roles/:roleId', deleteRole);
router.patch('/:serverId/members/:memberId/role', assignRole);
router.post('/:serverId/members/:memberId/roles/:roleId', addCustomRoleToMember);
router.delete('/:serverId/members/:memberId/roles/:roleId', removeCustomRoleFromMember);
router.patch('/:serverId/members/:memberId/booster', toggleBooster);
router.patch('/:serverId/members/:memberId/vip', toggleVip);

export default router;
