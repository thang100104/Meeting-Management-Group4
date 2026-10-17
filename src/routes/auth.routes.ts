import { Router } from 'express';
import { getMe, login } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { loginSchema } from '../schemas/auth.schema';
import { authenticateBearer } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', validate({ body: loginSchema }), login);
router.get('/me', authenticateBearer, getMe);

export default router;
