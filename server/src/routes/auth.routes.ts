import { Router } from 'express';
import {
  register, verifyRegistration, resendRegistrationOtp,
  login, logout, refreshToken, getMe,
  forgotPassword, verifyOtp, resetPassword,
  requestDeleteAccount, confirmDeleteAccount,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/register/verify', verifyRegistration);
router.post('/register/resend-otp', resendRegistrationOtp);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/delete-account/request', authenticate, requestDeleteAccount);
router.post('/delete-account/confirm', authenticate, confirmDeleteAccount);

export default router;
