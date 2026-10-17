import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roomRoutes from './room.routes';
import meetingRoutes from './meeting.routes';
import { NotFoundError } from '../utils/errors';

const router = Router();

// Mount sub-routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rooms', roomRoutes);
router.use('/meetings', meetingRoutes);

// Catch all unmatched /api/v1 routes
router.use('*', (req, _res, next) => {
  next(new NotFoundError(`Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`));
});

export default router;
